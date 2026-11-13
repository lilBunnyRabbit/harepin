import { DECAL_NAMES, type Decal } from "../car/build";
import { MAX_EVENT_STARS, TIERS, current_tier, suggested, tier_max, tier_open, tier_stars, type CareerEvent, type Stars, type Tier } from "./career";
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

export type GoalKind = RewardKind | "gate" | "chase";

export interface Goal {
  key: string;
  kind: GoalKind;
  title: string;
  detail: string;
  need: number;
  have: number;
  of: number;
  event: CareerEvent | null;
  reward: RewardView | null;
  view: TierView;
}

export const GOALS = 3;

// The final waits behind the near star goals, so a fresh career opens on its first event and not the tier's hardest; the
// decal (every star in the tier) is the farthest of all.
const GOAL_ORDER: Record<GoalKind, number> = { gate: 0, paint: 0, badge: 1, decal: 2, chase: 3 };

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

const short_of_three = (stars: Stars, tier: Tier) =>
  tier.events
    .map((event, i) => ({ event, i, have: stars[event.id] ?? 0 }))
    .filter(({ have }) => have < MAX_EVENT_STARS)
    .sort((a, b) => a.have - b.have || a.i - b.i)
    .map(({ event }) => event);

function reward_goals(view: TierView): Goal[] {
  const list: Goal[] = [];
  const { tier, have } = view;
  for (const reward of view.rewards) {
    if (reward.got) continue;
    if (reward.need === null) list.push({ key: `badge:${tier.id}`, kind: "badge", title: `${reward.name} badge`, detail: reward.how, need: 1, have: 0, of: 1, event: view.final, reward, view });
    else list.push({ key: `${reward.kind}:${tier.id}`, kind: reward.kind, title: reward.name, detail: `${reward.need} more ★ in ${tier.name}`, need: reward.need, have, of: have + reward.need, event: null, reward, view });
  }
  return list;
}

/**
 * Up to `count` goals, each on an event of its own: the current tier's gate and rewards, then rewards an earlier tier still
 * holds, then 3 ★ on the open events furthest from it. Fewer only when every open event already has 3 ★.
 */
export function goals(stars: Stars, count = GOALS): Goal[] {
  const here = current_tier(stars);
  const view = tier_view(stars, here);
  const now: Goal[] = reward_goals(view);
  if (view.gate) now.push({ key: "gate", kind: "gate", title: `Unlock ${view.gate.tier.name}`, detail: `${view.gate.need} more ★ in ${here.name}`, need: view.gate.need, have: view.have, of: view.gate.at, event: null, reward: null, view });
  now.sort((a, b) => GOAL_ORDER[a.kind] - GOAL_ORDER[b.kind] || a.need - b.need);
  const earlier = TIERS.slice(0, TIERS.indexOf(here)).flatMap((tier) => reward_goals(tier_view(stars, tier)));
  const list = [...now, ...earlier].slice(0, count);

  const used = new Set(list.flatMap((goal) => (goal.event ? [goal.event.id] : [])));
  const free = (pool: readonly CareerEvent[]) => pool.find((event) => !used.has(event.id)) ?? null;
  for (const goal of list) {
    if (goal.event) continue;
    goal.event = free(goal.view.tier === here ? suggested(stars, here.events.length) : short_of_three(stars, goal.view.tier));
    if (goal.event) used.add(goal.event.id);
  }

  const open = TIERS.filter((tier) => tier_open(stars, tier));
  const chases = open.flatMap((tier) => short_of_three(stars, tier).map((event) => ({ event, tier }))).sort((a, b) => (stars[a.event.id] ?? 0) - (stars[b.event.id] ?? 0));
  for (const { event, tier } of chases) {
    if (list.length >= count) break;
    if (used.has(event.id)) continue;
    used.add(event.id);
    const got = stars[event.id] ?? 0;
    list.push({ key: `chase:${event.id}`, kind: "chase", title: `3 ★ on ${event.name}`, detail: `${got} ★ so far · ${tier.name}`, need: MAX_EVENT_STARS - got, have: got, of: MAX_EVENT_STARS, event, reward: null, view: tier_view(stars, tier) });
  }
  return list;
}

export const career_total = (stars: Stars) => ({
  have: TIERS.reduce((sum, tier) => sum + tier_stars(stars, tier), 0),
  max: TIERS.reduce((sum, tier) => sum + tier_max(tier), 0),
});

export const trophy_count = (views: readonly TierView[]) => views.reduce((sum, view) => sum + view.rewards.length, 0);
