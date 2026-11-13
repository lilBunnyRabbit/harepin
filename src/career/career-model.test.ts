import { expect, test } from "bun:test";
import { EVENTS, TIERS, type Stars } from "./career";
import { GOALS, career_total, goals, tier_views } from "./career-model";

const all_three: Stars = Object.fromEntries(EVENTS.map((event) => [event.id, 3]));

test("a fresh career is Rookie here, every later tier locked, and its goals start with the Rookie events", () => {
  const views = tier_views({});
  expect(views.map((view) => view.state)).toEqual(["current", ...TIERS.slice(1).map(() => "locked" as const)]);
  const list = goals({});
  expect(list.find((goal) => goal.kind === "badge")?.event?.final).toBe(true);
  expect(list[0].event?.id).toBe("r1");
  expect(list.map((goal) => goal.kind)).toEqual(["paint", "gate", "badge"]);
});

test("goals put the near star goals first, then the final, and drop what is already earned", () => {
  const stars: Stars = { r1: 3, r2: 3, r3: 2, r4: 3, r5: 2, r6: 1, r7: 3, c1: 3, c2: 2, c3: 1, c4: 2, c5: 1 };
  const list = goals(stars);
  expect(list.map((goal) => goal.kind)).toEqual(["paint", "gate", "badge"]);
  expect(list.every((goal) => goal.view.tier.id === TIERS[1].id)).toBe(true);
  expect(tier_views(stars)[0].rewards.find((reward) => reward.kind === "badge")?.got).toBe(true);
});

test("a finished career has no goals left and every star counted", () => {
  expect(goals(all_three)).toEqual([]);
  const total = career_total(all_three);
  expect(total.have).toBe(total.max);
  expect(tier_views(all_three).every((view) => view.rewards.every((reward) => reward.got))).toBe(true);
});

test("tune opens every tier", () => {
  expect(tier_views({}, true).every((view) => view.state === "current")).toBe(true);
});

const ids = (stars: Stars) => goals(stars).map((goal) => goal.event?.id);

test("every goal plays an event of its own", () => {
  const samples: Stars[] = [{}, { r1: 3, r2: 3, r3: 2, r4: 3, r5: 2, r6: 1, r7: 3, c1: 3, c2: 2, c3: 1, c4: 2, c5: 1 }];
  for (const stars of samples) {
    const list = ids(stars);
    expect(list.length).toBe(GOALS);
    expect(new Set(list).size).toBe(GOALS);
    expect(list).not.toContain(undefined);
  }
});

test("a current tier with little left fills from earlier tiers' rewards, then 3 ★ chases", () => {
  const stars: Stars = { ...all_three, r1: 1, c1: 0, r2: 2 };
  const list = goals(stars);
  expect(list.map((goal) => goal.key)).toEqual([`decal:${TIERS[0].id}`, `decal:${TIERS[1].id}`, "chase:r2"]);
  expect(list.map((goal) => goal.event?.id)).toEqual(["r1", "c1", "r2"]);
});

test("a missing earlier badge plays that tier's final", () => {
  const final = TIERS[0].events.find((event) => event.final);
  if (!final) throw new Error("Rookie has no final");
  const badge = goals({ ...all_three, [final.id]: 0 }).find((goal) => goal.kind === "badge");
  expect(badge?.event?.id).toBe(final.id);
});

test("goals run short only when every open event has 3 ★", () => {
  expect(goals({ ...all_three, r1: 2 }).map((goal) => goal.key)).toEqual([`decal:${TIERS[0].id}`]);
});
