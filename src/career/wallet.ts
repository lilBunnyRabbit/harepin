import { DEFAULT_BUILD, SLOTS, SLOT_NAMES, type Build, type Slot } from "../car/build";
import { is_car, type CarId } from "../car/cars";
import { is_cosmetic, part_price, type Cosmetic } from "./prices";
import type { WalletSaves } from "./wallet-db";

export const WALLET_ID = "you";
/** Every player starts the series on this car alone, legacy progress or not (round 3). */
export const BASE_CAR: CarId = DEFAULT_BUILD.car;
export const MAX_CREDITS = 1_000_000_000;

/** Bought parts per body: a bitmask per slot, bit i for `SLOTS[slot].parts[i]`. Free parts are owned without a bit. */
export type OwnedParts = Readonly<Partial<Record<CarId, Readonly<Partial<Record<Slot, number>>>>>>;

export interface PartPick {
  readonly slot: Slot;
  readonly index: number;
}

export interface WalletState {
  readonly id: typeof WALLET_ID;
  readonly credits: number;
  readonly cars: readonly CarId[];
  readonly cosmetics: readonly Cosmetic[];
  readonly parts: OwnedParts;
  /** The UTC date (`2026-11-20`) the daily podium bonus last paid; "" before one. */
  readonly bonus_day: string;
}

export type ShopItem =
  | { readonly kind: "car"; readonly car: CarId }
  | { readonly kind: "cosmetic"; readonly id: Cosmetic }
  | { readonly kind: "parts"; readonly car: CarId; readonly parts: readonly PartPick[] };

export function owns_part(parts: OwnedParts, car: CarId, { slot, index }: PartPick): boolean {
  return part_price(slot, index) === 0 || ((parts[car]?.[slot] ?? 0) & (1 << index)) !== 0;
}

export const paid_parts = (build: Build): PartPick[] => SLOT_NAMES.map((slot) => ({ slot, index: build.parts[slot] })).filter((pick) => part_price(pick.slot, pick.index) > 0);

export function with_parts(parts: OwnedParts, car: CarId, picks: readonly PartPick[]): OwnedParts {
  if (!picks.length) return parts;
  const own = { ...parts[car] };
  for (const { slot, index } of picks) own[slot] = (own[slot] ?? 0) | (1 << index);
  return { ...parts, [car]: own };
}

export const grant_fitted = (parts: OwnedParts, builds: readonly Build[]): OwnedParts => builds.reduce((owned, build) => with_parts(owned, build.car, paid_parts(build)), parts);

/** The base car's stock build wears a part that costs (the Wing): every player owns it. */
const STARTER_PARTS: OwnedParts = grant_fitted({}, [DEFAULT_BUILD]);

export const fresh_wallet = (): WalletState => ({ id: WALLET_ID, credits: 0, cars: [BASE_CAR], cosmetics: [], parts: STARTER_PARTS, bonus_day: "" });

function parse_parts(raw: unknown): OwnedParts {
  if (typeof raw !== "object" || raw === null) return STARTER_PARTS;
  const out: Partial<Record<CarId, Partial<Record<Slot, number>>>> = {};
  for (const [car, slots] of Object.entries(raw)) {
    if (!is_car(car) || typeof slots !== "object" || slots === null) continue;
    const own: Partial<Record<Slot, number>> = {};
    for (const slot of SLOT_NAMES) {
      const mask = (slots as Partial<Record<string, unknown>>)[slot];
      const kept = typeof mask === "number" && Number.isInteger(mask) ? mask & ((1 << SLOTS[slot].parts.length) - 1) : 0;
      if (kept > 0) own[slot] = kept;
    }
    if (Object.keys(own).length) out[car] = own;
  }
  return grant_fitted(out, [DEFAULT_BUILD]);
}

/** A wallet saved before parts cost credits, or none at all: the parts on the player's saved builds are granted once. */
const before_parts = (raw: unknown): boolean => typeof raw !== "object" || raw === null || !("parts" in raw);

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A stored wallet is untrusted: a bad total reads as none, unknown cars and cosmetics drop out, the base car is always owned. */
export function parse_wallet(raw: unknown): WalletState {
  if (typeof raw !== "object" || raw === null) return fresh_wallet();
  const { credits, cars, cosmetics, parts, bonus_day } = raw as { credits?: unknown; cars?: unknown; cosmetics?: unknown; parts?: unknown; bonus_day?: unknown };
  const total = typeof credits === "number" && Number.isInteger(credits) && credits >= 0 && credits <= MAX_CREDITS ? credits : 0;
  const owned = Array.isArray(cars) ? cars.filter((c): c is CarId => typeof c === "string" && is_car(c)) : [];
  const bought = Array.isArray(cosmetics) ? cosmetics.filter(is_cosmetic) : [];
  const day = typeof bonus_day === "string" && DAY.test(bonus_day) ? bonus_day : "";
  return { id: WALLET_ID, credits: total, cars: [...new Set([BASE_CAR, ...owned])], cosmetics: [...new Set(bought)], parts: parse_parts(parts), bonus_day: day };
}

export const credits_text = (n: number) => `${n.toLocaleString("en-US")} cr`;

/** Credits and owned cars, replaced with a new object on each change so a `$derived` over it wakes. */
export class Wallet {
  private state_: WalletState = fresh_wallet();
  ready = false;
  private changed = false;
  private loading: Promise<void> | null = null;

  /** `fitted`: the player's saved builds on the cars they own (`cars`, the wallet's), granted once to a wallet saved before parts cost. */
  constructor(
    private readonly saves: WalletSaves | null,
    private readonly fitted: (cars: readonly CarId[]) => readonly Build[] = () => [],
  ) {}

  /** Every season's series shares the one wallet, so the first call reads it and the rest wait on that read. */
  load(): Promise<void> {
    this.loading ??= this.read();
    return this.loading;
  }

  private async read(): Promise<void> {
    try {
      const raw = await this.saves?.load();
      // Credits earned while the load was out are newer than anything it read.
      if (!this.changed) {
        const read = parse_wallet(raw);
        if (before_parts(raw)) this.set({ ...read, parts: grant_fitted(read.parts, this.fitted(read.cars)) });
        else this.state_ = read;
      }
    } catch (error) {
      console.warn("wallet: saved wallet unreadable, starting on the base car", error);
    }
    this.ready = true;
  }

  get state(): WalletState {
    return this.state_;
  }

  get credits(): number {
    return this.state_.credits;
  }

  owns(car: CarId): boolean {
    return this.state_.cars.includes(car);
  }

  earn(credits: number) {
    if (credits <= 0) return;
    this.set({ ...this.state_, credits: Math.min(MAX_CREDITS, this.state_.credits + Math.round(credits)) });
  }

  has(id: Cosmetic): boolean {
    return this.state_.cosmetics.includes(id);
  }

  owns_part(car: CarId, pick: PartPick): boolean {
    return owns_part(this.state_.parts, car, pick);
  }

  claim_daily(day: string, credits: number): boolean {
    if (this.state_.bonus_day === day) return false;
    this.set({ ...this.state_, bonus_day: day, credits: Math.min(MAX_CREDITS, this.state_.credits + Math.round(credits)) });
    return true;
  }

  /** Takes the credits and adds the item in one write: never paid without the item, or the other way round. */
  buy(item: ShopItem, price: number): boolean {
    if (!Number.isInteger(price) || price <= 0 || price > this.state_.credits) return false;
    const credits = this.state_.credits - price;
    if (item.kind === "car") {
      if (this.owns(item.car)) return false;
      this.set({ ...this.state_, credits, cars: [...this.state_.cars, item.car] });
    } else if (item.kind === "parts") {
      if (!this.sells(item.car, item.parts, price)) return false;
      this.set({ ...this.state_, credits, parts: with_parts(this.state_.parts, item.car, item.parts) });
    } else {
      if (this.has(item.id)) return false;
      this.set({ ...this.state_, credits, cosmetics: [...this.state_.cosmetics, item.id] });
    }
    return true;
  }

  private sells(car: CarId, picks: readonly PartPick[], price: number): boolean {
    if (!picks.length || new Set(picks.map(({ slot, index }) => `${slot}.${index}`)).size !== picks.length) return false;
    if (picks.some((pick) => !Number.isInteger(pick.index) || pick.index < 0 || pick.index >= SLOTS[pick.slot].parts.length || this.owns_part(car, pick))) return false;
    return picks.reduce((sum, pick) => sum + part_price(pick.slot, pick.index), 0) === price;
  }

  grant(car: CarId): boolean {
    if (this.owns(car)) return false;
    this.set({ ...this.state_, cars: [...this.state_.cars, car] });
    return true;
  }

  private set(state: WalletState) {
    this.state_ = state;
    this.changed = true;
    this.saves?.save(state).catch((error: unknown) => console.warn("wallet: not saved", error));
  }
}
