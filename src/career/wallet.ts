import { DEFAULT_BUILD } from "../car/build";
import { is_car, type CarId } from "../car/cars";
import { is_cosmetic, type Cosmetic } from "./prices";
import type { WalletSaves } from "./wallet-db";

export const WALLET_ID = "you";
/** Every player starts the series on this car alone, legacy progress or not (round 3). */
export const BASE_CAR: CarId = DEFAULT_BUILD.car;
export const MAX_CREDITS = 1_000_000_000;

export interface WalletState {
  readonly id: typeof WALLET_ID;
  readonly credits: number;
  readonly cars: readonly CarId[];
  readonly cosmetics: readonly Cosmetic[];
  /** The UTC date (`2026-11-20`) the daily podium bonus last paid; "" before one. */
  readonly bonus_day: string;
}

export type ShopItem = { readonly kind: "car"; readonly car: CarId } | { readonly kind: "cosmetic"; readonly id: Cosmetic };

export const fresh_wallet = (): WalletState => ({ id: WALLET_ID, credits: 0, cars: [BASE_CAR], cosmetics: [], bonus_day: "" });

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A stored wallet is untrusted: a bad total reads as none, unknown cars and cosmetics drop out, the base car is always owned. */
export function parse_wallet(raw: unknown): WalletState {
  if (typeof raw !== "object" || raw === null) return fresh_wallet();
  const { credits, cars, cosmetics, bonus_day } = raw as { credits?: unknown; cars?: unknown; cosmetics?: unknown; bonus_day?: unknown };
  const total = typeof credits === "number" && Number.isInteger(credits) && credits >= 0 && credits <= MAX_CREDITS ? credits : 0;
  const owned = Array.isArray(cars) ? cars.filter((c): c is CarId => typeof c === "string" && is_car(c)) : [];
  const bought = Array.isArray(cosmetics) ? cosmetics.filter(is_cosmetic) : [];
  const day = typeof bonus_day === "string" && DAY.test(bonus_day) ? bonus_day : "";
  return { id: WALLET_ID, credits: total, cars: [...new Set([BASE_CAR, ...owned])], cosmetics: [...new Set(bought)], bonus_day: day };
}

export const credits_text = (n: number) => `${n.toLocaleString("en-US")} cr`;

/** Credits and owned cars, replaced with a new object on each change so a `$derived` over it wakes. */
export class Wallet {
  private state_: WalletState = fresh_wallet();
  ready = false;
  private changed = false;
  private loading: Promise<void> | null = null;

  constructor(private readonly saves: WalletSaves | null) {}

  /** Every season's series shares the one wallet, so the first call reads it and the rest wait on that read. */
  load(): Promise<void> {
    this.loading ??= this.read();
    return this.loading;
  }

  private async read(): Promise<void> {
    try {
      const raw = await this.saves?.load();
      // Credits earned while the load was out are newer than anything it read.
      if (!this.changed) this.state_ = parse_wallet(raw);
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
    } else {
      if (this.has(item.id)) return false;
      this.set({ ...this.state_, credits, cosmetics: [...this.state_.cosmetics, item.id] });
    }
    return true;
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
