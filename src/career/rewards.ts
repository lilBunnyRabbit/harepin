import { DECALS } from "../car/build";
import { TIERS, tier_max, tier_stars, type Stars, type Tier } from "./career";

export const PAINT_STARS = 10;

// Sent online as `Hello.tier`: the highest tier whose final is finished.
export type TierBadge = 1 | 2 | 3;

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

export const badge_text = (badge: TierBadge) => TIERS[badge - 1].rewards.badge;
