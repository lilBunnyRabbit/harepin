import { DECALS } from "../car/build";
import type { TierBadge } from "../net/net";
import { TIERS, tier_max, tier_stars, type Stars, type Tier } from "./career";

export const PAINT_STARS = 10;

export interface Unlocks {
  paints: readonly number[];
  decals: readonly number[];
  badge: TierBadge | null;
}

export const NO_UNLOCKS: Unlocks = { paints: [], decals: [], badge: null };

export const paint_open = (stars: Stars, tier: Tier) => tier_stars(stars, tier) >= PAINT_STARS;
export const decal_open = (stars: Stars, tier: Tier) => tier_stars(stars, tier) >= tier_max(tier);
export const badge_open = (stars: Stars, tier: Tier) => tier.events.some((event) => event.final && (stars[event.id] ?? 0) > 0);

export function unlocks(stars: Stars): Unlocks {
  const badge = TIERS.findLastIndex((tier) => badge_open(stars, tier));
  return {
    paints: TIERS.filter((tier) => paint_open(stars, tier)).map((tier) => tier.rewards.paint),
    decals: TIERS.filter((tier) => decal_open(stars, tier)).map((tier) => DECALS.indexOf(tier.rewards.decal)),
    badge: badge < 0 ? null : ((badge + 1) as TierBadge),
  };
}

export const REWARD_DECALS: readonly number[] = TIERS.map((tier) => DECALS.indexOf(tier.rewards.decal));

export const badge_text = (badge: TierBadge) => `${TIERS[badge - 1].name} champion`;

const METALS = ["Bronze", "Silver", "Gold"];

export const reward_paint_name = (tier: Tier) => `${METALS[TIERS.indexOf(tier)]} metallic`;

export type RewardKind = "paint" | "decal" | "badge";

export interface Reward {
  kind: RewardKind;
  tier: Tier;
}

const OPENS: Record<RewardKind, (stars: Stars, tier: Tier) => boolean> = { paint: paint_open, decal: decal_open, badge: badge_open };

/** What a run moved from locked to earned in `tier`, in garage order: paint, decal, badge. */
export const earned = (before: Stars, after: Stars, tier: Tier): Reward[] =>
  (Object.keys(OPENS) as RewardKind[]).filter((kind) => !OPENS[kind](before, tier) && OPENS[kind](after, tier)).map((kind) => ({ kind, tier }));
