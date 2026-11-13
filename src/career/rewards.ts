import { DECALS } from "../car/build";
import type { TierBadge } from "../net/net";
import { TIERS, tier_max, tier_stars, type Stars, type Tier } from "./career";

export interface Unlocks {
  paints: readonly number[];
  decals: readonly number[];
  badge: TierBadge | null;
}

export const NO_UNLOCKS: Unlocks = { paints: [], decals: [], badge: null };

export const paint_open = (stars: Stars, tier: Tier) => tier_stars(stars, tier) >= tier.rewards.paint_at;
export const decal_open = (stars: Stars, tier: Tier) => tier.rewards.decal !== undefined && tier_stars(stars, tier) >= tier_max(tier);
export const badge_open = (stars: Stars, tier: Tier) => tier.events.some((event) => event.final && (stars[event.id] ?? 0) > 0);

export function unlocks(stars: Stars): Unlocks {
  const badge = TIERS.findLastIndex((tier) => badge_open(stars, tier));
  return {
    paints: TIERS.filter((tier) => paint_open(stars, tier)).map((tier) => tier.rewards.paint),
    decals: TIERS.flatMap((tier) => (tier.rewards.decal && decal_open(stars, tier) ? [DECALS.indexOf(tier.rewards.decal)] : [])),
    badge: badge < 0 ? null : ((badge + 1) as TierBadge),
  };
}

export const REWARD_DECALS: readonly number[] = TIERS.flatMap(({ rewards: { decal } }) => (decal ? [DECALS.indexOf(decal)] : []));

export const badge_text = (badge: TierBadge) => `${TIERS[badge - 1].name} champion`;

/** One per tier, in the order of palette `tier_metals`; `metallic` false for a finish that is no metal (Legend's carbon weave). */
export const TIER_METAL_NAMES: readonly { name: string; metallic: boolean }[] = [
  { name: "Bronze", metallic: true },
  { name: "Silver", metallic: true },
  { name: "Gold", metallic: true },
  { name: "Platinum", metallic: true },
  { name: "Carbon", metallic: false },
];

export function reward_paint_name(tier: Tier): string {
  const { name, metallic } = TIER_METAL_NAMES[TIERS.indexOf(tier)];
  return metallic ? `${name} metallic` : name;
}

export type RewardKind = "paint" | "decal" | "badge";

export interface Reward {
  kind: RewardKind;
  tier: Tier;
}

const OPENS: Record<RewardKind, (stars: Stars, tier: Tier) => boolean> = { paint: paint_open, decal: decal_open, badge: badge_open };

/** The reward a garage can try on; a badge has no garage option. */
export const garage_reward = (rewards: readonly Reward[]): Reward | null => rewards.find((reward) => reward.kind !== "badge") ?? null;

/** What a run moved from locked to earned in `tier`, in garage order: paint, decal, badge. */
export const earned = (before: Stars, after: Stars, tier: Tier): Reward[] =>
  (Object.keys(OPENS) as RewardKind[]).filter((kind) => !OPENS[kind](before, tier) && OPENS[kind](after, tier)).map((kind) => ({ kind, tier }));
