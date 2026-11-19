import type { Decal, Neon, Slot } from "../car/build";
import type { FrameId } from "../car/cars";
import type { CarClass } from "../car/pi";

/** Race credits by the season's class cap; a cup's cap is its loaner's class. Past S1 pays as S1. */
export const CLASS_FACTOR: Record<CarClass, number> = { d: 1, c: 1, b: 1.2, a: 1.5, s1: 1.8, s2: 1.8, x: 1.8 };
/** A rerun of an event already podiumed pays this share: the one-event farm halves, a retry before the podium pays full. */
export const RERUN_SHARE = 0.5;
export const ROUND_STEP = 0.25;
export const ROUND_MAX = 2;
/** A replay round run to its end pays this share of the season's reward; a cup's reruns pay their races only. */
export const REPLAY_REWARD_SHARE = 0.25;
export const CUP_CLEAR = 3_000;
export const DAILY_PODIUM = 2_000;
export const RUN_STAR_CREDITS = 150;

export const FrameTier = {
  STARTER: "starter",
  CUP: "cup",
  TOP_CUP: "top_cup",
  FORMULA: "formula",
  NOT_SOLD: "not_sold",
} as const;
export type FrameTier = (typeof FrameTier)[keyof typeof FrameTier];

export const FRAME_TIER: Record<FrameId, FrameTier> = {
  hatch: FrameTier.STARTER,
  coupe: FrameTier.STARTER,
  tsumuji: FrameTier.STARTER,
  rally: FrameTier.CUP,
  muscle: FrameTier.CUP,
  sajin: FrameTier.CUP,
  sturm: FrameTier.TOP_CUP,
  raijin: FrameTier.TOP_CUP,
  formula: FrameTier.FORMULA,
  fujin: FrameTier.NOT_SOLD,
  bus: FrameTier.NOT_SOLD,
};

/** A frame's extra body; its first body comes with the frame. */
export const BODY_PRICE: Record<FrameTier, number | null> = { starter: 15_000, cup: 25_000, top_cup: 35_000, formula: 50_000, not_sold: null };

/** A part's price by its index in `SLOTS[slot].parts`, the same on every car; 0 is free (stock, Soft and Sport, every bias). */
export const PART_PRICES: { readonly [S in Slot]: readonly number[] } = {
  engine: [0, 2_000, 4_000, 7_000, 9_000, 14_000],
  tyres: [0, 1_500, 3_500, 2_000, 1_500, 2_000, 6_000],
  aero: [0, 1_000, 2_000, 3_500, 5_000, 8_000],
  suspension: [0, 0, 2_500, 2_500, 1_500],
  brakes: [0, 1_500, 3_500],
  weight: [0, 2_000, 4_000, 9_000],
  bias: [0, 0, 0],
  nitro: [0, 3_000, 6_000],
};

export const part_price = (slot: Slot, index: number): number => PART_PRICES[slot][index] ?? 0;

export const DECAL_PRICE: Readonly<Partial<Record<Decal, number>>> = { flames: 2_000, slash: 2_000, checker: 2_000, rabbit: 2_000 };
/** A neon style; it opens every tone. */
export const NEON_PRICE: Readonly<Partial<Record<Neon, number>>> = { pool: 4_000, ring: 6_000 };

/** A cosmetic bought once, account-wide: `decal.flames`, `neon.ring`. */
export type Cosmetic = `decal.${Decal}` | `neon.${Neon}`;

export const decal_id = (decal: Decal): Cosmetic => `decal.${decal}`;
export const neon_id = (neon: Neon): Cosmetic => `neon.${neon}`;

export const COSMETIC_PRICE: Readonly<Partial<Record<Cosmetic, number>>> = Object.fromEntries([
  ...Object.entries(DECAL_PRICE).map(([decal, price]) => [decal_id(decal as Decal), price]),
  ...Object.entries(NEON_PRICE).map(([neon, price]) => [neon_id(neon as Neon), price]),
]);

export const is_cosmetic = (id: unknown): id is Cosmetic => typeof id === "string" && Object.hasOwn(COSMETIC_PRICE, id);
