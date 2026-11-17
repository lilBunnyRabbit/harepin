import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { EVENTS, TIERS, type Stars } from "../career/career";
import { tier_views } from "../career/career-model";
import { event_map } from "../career/career-store";
import { by_map } from "../career/place";
import { daily, random, weekly } from "../runs/runs";
import { SEASON_STEP } from "../runs/season";
import { plain_map } from "../worldgen/kinds/kinds";
import { complete_line, go_line, in_map_order, start_view, tier_eyebrow, tier_front, tier_line } from "./events-view";
import SeasonBar from "./runs/SeasonBar.svelte";

const MID: Stars = { r1: 3, r2: 3, r3: 2, r4: 3, r5: 2, r6: 1, r7: 3, c1: 3, c2: 2, c3: 1, c4: 2, c5: 1 };
const ROOKIE = TIERS[0];
const HOME = event_map(ROOKIE.events[0]);
const AWAY = plain_map("volcano", 99);
const ALL = TIERS.flatMap((tier) => tier.events);

test("a tier's events read Here first, then one group per map", () => {
  const groups = by_map(ROOKIE.events, HOME);
  expect(groups[0].place.here).toBe(true);
  expect(groups.slice(1).every((group) => !group.place.here)).toBe(true);
  expect(in_map_order(groups)).toHaveLength(ROOKIE.events.length);
});

test("a tier opens on Next up when it is in the tier, else on its first event short of 3 stars", () => {
  const order = in_map_order(by_map(ROOKIE.events, HOME));
  expect(tier_front({}, order, HOME)).toBe(order[0]);
  const front = tier_front(MID, in_map_order(by_map(TIERS[1].events, HOME)), HOME);
  expect(MID[front.id] ?? 0).toBeLessThan(3);
  const done = Object.fromEntries(ROOKIE.events.map((event) => [event.id, 3]));
  expect(tier_front(done, order, HOME)).toBe(order[0]);
});

test("a tier card counts its stars and maps while open, and names what opens it while shut", () => {
  const views = tier_views({});
  expect(tier_line(views[0], 3)).toBe(`0 of ${views[0].max} ★ · ${ROOKIE.events.length} events on 3 maps`);
  expect(tier_eyebrow(views[0])).toBe(`Tier 1 of ${TIERS.length} · now`);
  expect(tier_line(views[1], 1)).toBe(`Opens at ${TIERS[1].opens_at} ★ in ${ROOKIE.name}`);
});

test("the start sheet races here with no loading and travels to another map by name", () => {
  const event = ROOKIE.events[0];
  const here = start_view({ kind: "event", event }, HOME);
  expect(here.place.here).toBe(true);
  expect(go_line(here, event.name).verb).toBe(`Race ${event.name}`);
  expect(go_line(here, event.name).note).toContain("No loading");
  const away = start_view({ kind: "event", event }, AWAY);
  expect(away.place.here).toBe(false);
  expect(go_line(away, event.name).verb).toBe(`Travel to ${away.place.here ? "" : away.place.name}`);
});

test("the sheet sends a class-capped event through the car picker and a lent car straight to the start", () => {
  const capped = ALL.find((event) => "cap" in event.car);
  const fixed = ALL.find((event) => "preset" in event.car);
  if (!capped || !fixed) throw new Error("the career has both kinds of event");
  const picks = start_view({ kind: "event", event: capped }, HOME);
  expect(picks.limit).not.toBeNull();
  expect(picks.lent).toBeNull();
  expect(go_line(picks, capped.name).note).toStartWith("Pick a car");
  const lent = start_view({ kind: "event", event: fixed }, event_map(fixed));
  expect(lent.limit).toBeNull();
  expect(lent.lent).not.toBeNull();
  expect(go_line(lent, fixed.name).note).toStartWith("Starts now");
});

test("the sheet shows an event's star marks and a weekly's stages", () => {
  const timed = ALL.find((event) => event.stars);
  if (!timed) throw new Error("the career has a timed event");
  expect(start_view({ kind: "event", event: timed }, HOME).marks.map((mark) => mark.head)).toEqual(["★", "★★", "★★★"]);
  const cup = weekly("2026-W46");
  expect(start_view({ kind: "run", pick: cup }, HOME).marks).toHaveLength(cup.stages?.length ?? 0);
  expect(start_view({ kind: "run", pick: daily("2026-11-17") }, HOME).eyebrow).toBe("Daily run");
  expect(start_view({ kind: "run", pick: random(7) }, HOME).eyebrow).toBe("Random run");
});

test("the season bar names the next reward and its stars, then says every reward is won", () => {
  const out = render(SeasonBar, { props: { stars: 4, season: "2026-11-02", today: "2026-11-17" } }).body;
  expect(out).toContain("4 season stars");
  expect(out).toContain(`Next reward at ${SEASON_STEP} ★`);
  expect(render(SeasonBar, { props: { stars: 9999, season: "2026-11-02", today: "2026-11-17" } }).body).toContain("Every reward won");
});

test("career complete shows only once every tier and reward is won", () => {
  expect(complete_line(tier_views(MID))).toBeNull();
  const views = tier_views(Object.fromEntries(EVENTS.map((event) => [event.id, 3])));
  expect(complete_line(views)).toBe(`${TIERS[TIERS.length - 1].name} rank and all ${views.reduce((sum, view) => sum + view.rewards.length, 0)} trophies won`);
});
