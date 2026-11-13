import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { EVENTS, type Stars } from "../career/career";
import { career_total, goals, tier_views } from "../career/career-model";
import CareerGoals from "./CareerGoals.svelte";
import CareerProfile from "./CareerProfile.svelte";
import TrophyCase from "./TrophyCase.svelte";

const MID: Stars = { r1: 3, r2: 3, r3: 2, r4: 3, r5: 2, r6: 1, r7: 3, c1: 3, c2: 2, c3: 1, c4: 2, c5: 1 };

test("next up offers one Play per goal, the nearest one primary", () => {
  const out = render(CareerGoals, { props: { goals: goals(MID).slice(0, 3), onstart: () => {} } }).body;
  expect(out.match(/Play /g)?.length).toBe(3);
  expect(out.match(/data-variant="primary"/g)?.length).toBe(1);
});

test("the rank card names the current tier and the career total", () => {
  const views = tier_views(MID);
  const total = career_total(MID);
  const out = render(CareerProfile, { props: { here: views[1], total } }).body;
  expect(out).toContain("Club");
  expect(out).toContain(`of ${total.max} career ★`);
});

test("the trophy case locks what is not earned and frees it all at the end", () => {
  expect(render(TrophyCase, { props: { views: tier_views({}) } }).body).toContain("icon-lock");
  const done = tier_views(Object.fromEntries(EVENTS.map((event) => [event.id, 3])));
  expect(render(TrophyCase, { props: { views: done } }).body).not.toContain("icon-lock");
});
