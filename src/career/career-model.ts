import { DECAL_NAMES, type Decal } from "../car/build";
import { TIERS, current_tier, suggested, tier_max, tier_open, tier_stars, type CareerEvent, type Stars, type Tier } from "./career";
import { badge_open, badge_text, decal_open, paint_open, reward_paint_name, type RewardKind } from "./rewards";
import type { TierBadge } from "../net/net";

export type TierState = "passed" | "current" | "locked";

export interface RewardView {
  kind: RewardKind;
  name: string;
  how: string;
  got: boolean;
  /** Stars still missing; null for the badge, which the final wins. */
  need: number | null;
  decal?: Decal;
}

export interface TierView {
  tier: Tier;
  index: number;
  state: TierState;
  have: number;
  max: number;
  final: CareerEvent | null;
  won: boolean;
  rewards: RewardView[];
  /** The next tier while it is still shut: it opens at `at` stars here, `need` more to go. */
  gate: { tier: Tier; at: number; need: number } | null;
}

export interface Goal {
  key: RewardKind | "gate";
  title: string;
  detail: string;
  need: number;
  have: number;
  of: number;
  event: CareerEvent | null;
  reward: RewardView | null;
  view: TierView;
}

// The final waits behind the near star goals, so a fresh career opens on its first event and not the tier's hardest; the
// decal (every star in the tier) is the farthest of all.
const GOAL_ORDER: Record<Goal["key"], number> = { gate: 0, paint: 0, badge: 1, decal: 2 };

function rewards_of(stars: Stars, tier: Tier, have: number, max: number, final: CareerEvent | null): RewardView[] {
  const list: RewardView[] = [
    { kind: "paint", name: reward_paint_name(tier), how: `${tier.rewards.paint_at} ★ in ${tier.name}`, got: paint_open(stars, tier), need: Math.max(0, tier.rewards.paint_at - have) },
  ];
  const { decal } = tier.rewards;
  if (decal) list.push({ kind: "decal", name: `${DECAL_NAMES[decal]} decal`, how: `All ${max} ★`, got: decal_open(stars, tier), need: max - have, decal });
  const badge = badge_text((TIERS.indexOf(tier) + 1) as TierBadge);
  list.push({ kind: "badge", name: badge, how: final ? `Win ${final.name}` : "Win the final", got: badge_open(stars, tier), need: null });
  return list;
}

/** `open_all` (`?tune`) plays every tier as if it were the current one. */
export function tier_view(stars: Stars, tier: Tier, open_all = false): TierView {
  const index = TIERS.indexOf(tier);
  const at = TIERS.indexOf(current_tier(stars));
  const state: TierState = index < at ? "passed" : index === at || open_all ? "current" : "locked";
  const have = tier_stars(stars, tier);
  const max = tier_max(tier);
  const final = tier.events.find((event) => event.final) ?? null;
  const after = TIERS.at(index + 1);
  return {
    tier,
    index,
    state,
    have,
    max,
    final,
    won: final !== null && (stars[final.id] ?? 0) > 0,
    rewards: rewards_of(stars, tier, have, max, final),
    gate: after && !tier_open(stars, after) ? { tier: after, at: after.opens_at, need: after.opens_at - have } : null,
  };
}

export const tier_views = (stars: Stars, open_all = false) => TIERS.map((tier) => tier_view(stars, tier, open_all));

export function goals(stars: Stars): Goal[] {
  const view = tier_view(stars, current_tier(stars));
  const pick = suggested(stars, 1).at(0) ?? null;
  const list: Goal[] = [];
  if (view.gate) list.push({ key: "gate", title: `Unlock ${view.gate.tier.name}`, detail: `${view.gate.need} more ★ in ${view.tier.name}`, need: view.gate.need, have: view.have, of: view.gate.at, event: pick, reward: null, view });
  for (const reward of view.rewards) {
    if (reward.got) continue;
    if (reward.need === null) list.push({ key: reward.kind, title: `${reward.name} badge`, detail: reward.how, need: 1, have: 0, of: 1, event: view.final, reward, view });
    else list.push({ key: reward.kind, title: reward.name, detail: `${reward.need} more ★ in ${view.tier.name}`, need: reward.need, have: view.have, of: view.have + reward.need, event: pick, reward, view });
  }
  return list.sort((a, b) => GOAL_ORDER[a.key] - GOAL_ORDER[b.key] || a.need - b.need);
}

export const career_total = (stars: Stars) => ({
  have: TIERS.reduce((sum, tier) => sum + tier_stars(stars, tier), 0),
  max: TIERS.reduce((sum, tier) => sum + tier_max(tier), 0),
});
