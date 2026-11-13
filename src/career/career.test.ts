import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { is_lap } from "../car/ghost-cap";
import { PRESETS } from "../car/presets";
import { DRIFT_LEVELS } from "../modes/drift";
import { DUEL_LEVELS } from "../modes/duel";
import { LEVELS as GYMKHANA_LEVELS } from "../modes/gymkhana";
import { HUNT_LEVELS } from "../modes/hunt";
import { PARK_LEVELS } from "../modes/parking";
import { race_levels } from "../modes/races";
import { SILVER_SHARE, type Store } from "../modes/track";
import { world_key } from "../worldgen/kinds/kinds";
import { parse_map_code } from "../worldgen/kinds/map-code";
import { EVENTS, TIERS, current_tier, event_of, ghost_path, next_event, parse_stars, spot_of, suggested, tier_line, tier_max, tier_open, type Stars } from "./career";
import { CAREER_KEY, Career, event_map, event_track, owner_times } from "./career-store";

const LEVEL_IDS: Record<string, readonly { id: string }[]> = {
  gymkhana: GYMKHANA_LEVELS,
  parking: PARK_LEVELS,
  drift: DRIFT_LEVELS,
  hunt: HUNT_LEVELS,
  duel: DUEL_LEVELS,
};

const known_level = (mode: string, level: string) => (mode === "race" ? race_levels([{ id: level }], "").length === 1 : (LEVEL_IDS[mode]?.some((l) => l.id === level) ?? false));

function memory(seed: Record<string, string> = {}): Store & { data: Record<string, string> } {
  const data = { ...seed };
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) };
}

const all = (stars: number, ids: readonly string[]): Stars => Object.fromEntries(ids.map((id) => [id, stars]));
const ids_of = (tier: number) => TIERS[tier].events.map((event) => event.id);

// A tier still growing has no final yet, and no decal: the decal waits for the tier's max to stop moving.
test("event ids are unique and every finished tier ends in its one final", () => {
  expect(new Set(EVENTS.map((event) => event.id)).size).toBe(EVENTS.length);
  for (const tier of TIERS) {
    const finals = tier.events.map((event) => event.final === true);
    expect([tier.id, finals]).toEqual([tier.id, tier.events.map((_, i) => tier.rewards.decal !== undefined && i === tier.events.length - 1)]);
  }
});

test("every event's level is one its mode has, on a map code that reads", () => {
  for (const event of EVENTS) {
    const spot = spot_of(event);
    expect([event.id, known_level(event.mode, spot.level)]).toEqual([event.id, true]);
    expect([event.id, parse_map_code(spot.map).ok]).toEqual([event.id, true]);
    expect([event.id, parse_map_code(event.map).ok]).toEqual([event.id, true]);
    if ("preset" in event.car) expect(PRESETS.map((p) => p.name)).toContain(event.car.preset);
  }
});

// Fails on every generator bump of an event's world: re-tune the event, then update `tuned`.
test("every event's thresholds were tuned on the world it runs on now", () => {
  for (const event of EVENTS) {
    const { seed, kind, levels } = event_map(event);
    expect([event.id, event.tuned]).toEqual([event.id, world_key(seed, kind, levels)]);
  }
});

test("race events carry bot-tuned star times, silver a quarter over gold", () => {
  for (const event of EVENTS.filter((e) => e.mode === "race")) expect([event.id, event.stars?.two]).toEqual([event.id, Math.round((event.stars?.three ?? NaN) * SILVER_SHARE)]);
});

test("every event with a dev ghost ships it for the world it was tuned on, finishing in three-star time", () => {
  for (const event of EVENTS.filter((e) => e.ghost)) {
    const file = new URL(`../../public/${ghost_path(event)}`, import.meta.url);
    expect([event.id, existsSync(file)]).toEqual([event.id, true]);
    const lap: unknown = JSON.parse(readFileSync(file, "utf8"));
    expect([event.id, is_lap(lap)]).toEqual([event.id, true]);
    if (event.stars && is_lap(lap)) expect(lap[lap.length - 8]).toBeLessThanOrEqual(event.stars.three);
  }
});

test("Club opens at 12 Rookie stars, Pro at 14 Club stars", () => {
  const rookie = ids_of(0);
  const eleven = { ...all(2, rookie.slice(0, 5)), [rookie[5]]: 1 };
  expect(tier_open(eleven, TIERS[1])).toBe(false);
  const twelve = { ...eleven, [rookie[6]]: 1 };
  expect(tier_open(twelve, TIERS[1])).toBe(true);
  expect(current_tier(twelve).id).toBe("club");
  expect(tier_open({ ...twelve, ...all(2, ids_of(1)) }, TIERS[2])).toBe(true);
  expect(tier_line(eleven, TIERS[0])).toBe(`Rookie 11/${tier_max(TIERS[0])} ★ · Club at 12`);
  expect(tier_line(twelve, TIERS[0])).toBe(`Rookie 12/${tier_max(TIERS[0])} ★ · Club open`);
});

test("Elite opens at 16 Pro stars", () => {
  const pro = ids_of(2);
  const fifteen = { ...all(2, pro.slice(0, 6)), [pro[6]]: 3 };
  expect(tier_open(fifteen, TIERS[3])).toBe(false);
  expect(tier_open({ ...fifteen, [pro[0]]: 3 }, TIERS[3])).toBe(true);
  expect(tier_line(fifteen, TIERS[2])).toBe(`Pro 15/${tier_max(TIERS[2])} ★ · Elite at 16`);
});

test("next event is the next unplayed one in the tier, wrapping, then the next open tier", () => {
  const r = (id: string) => event_of(id) ?? EVENTS[0];
  expect(next_event({}, r("r1"))?.id).toBe("r2");
  expect(next_event({ r2: 1, r3: 3 }, r("r1"))?.id).toBe("r4");
  expect(next_event({ r1: 1, r2: 1, r3: 1, r4: 1, r5: 1, r6: 1 }, r("r6"))?.id).toBe("r7");
  expect(next_event(all(1, ids_of(0)), r("r7"))).toBeNull();
  expect(next_event(all(2, ids_of(0)), r("r7"))?.id).toBe("c1");
});

test("suggested plays the unplayed first, then the fewest stars", () => {
  expect(suggested({}, 2).map((e) => e.id)).toEqual(["r1", "r2"]);
  expect(suggested({ ...all(3, ids_of(0).slice(0, 3)), r4: 2 }, 2).map((e) => e.id)).toEqual(["r5", "r6"]);
});

test("saved stars are untrusted", () => {
  expect(parse_stars({ stars: { r1: 2, r2: 4, r3: 0, r4: 1.5, r5: "3", r6: 3 } })).toEqual({ r1: 2, r6: 3 });
  expect(parse_stars([1, 2])).toEqual({});
  expect(parse_stars({ stars: [3] })).toEqual({});
});

test("career keeps the best stars and its own best times apart from free play", () => {
  const store = memory();
  const career = new Career(store);
  const r1 = event_of("r1") ?? EVENTS[0];
  expect(career.record(r1, 2)).toBe(true);
  expect(career.record(r1, 1)).toBe(false);
  expect(career.record(r1, 0)).toBe(false);
  expect(JSON.parse(store.data[CAREER_KEY])).toEqual({ stars: { r1: 2 } });
  expect(new Career(store).stars).toEqual({ r1: 2 });
  event_track(r1, store).record("circuit", { stars: 2, ms: 90_000 });
  expect(new Career(store).best(r1)).toEqual({ stars: 2, ms: 90_000 });
  expect(Object.keys(store.data).filter((key) => key.startsWith("harepin:race:"))).toEqual([]);
  expect(Object.keys(store.data)).toContain(`harepin:career:r1:${r1.tuned}`);
});

test("Copy my times turns the best run of each played event into its stars, races only in a tier with a margin", () => {
  const store = memory();
  const at = (id: string) => event_of(id) ?? EVENTS[0];
  for (const [id, run] of [
    ["r1", { stars: 3, ms: 200_000 }],
    ["r2", { stars: 3, ms: 40_000 }],
    ["c2", { stars: 2, ms: 30_000, score: 1500 }],
    ["e1", { stars: 3, ms: 100_000 }],
    ["e4", { stars: 3, ms: 60_000, score: 1030 }],
  ] as const)
    event_track(at(id), store).record(spot_of(at(id)).level, run);
  expect(JSON.parse(owner_times(new Career(store)))).toEqual({
    r2: { stars: { two: 50_000, three: 40_000 }, tuned: at("r2").tuned },
    c2: { stars: { two: 1200, three: 1500 }, tuned: at("c2").tuned },
    e1: { stars: { two: 128_750, three: 103_000 }, tuned: at("e1").tuned },
    e4: { stars: { two: 800, three: 1000 }, tuned: at("e4").tuned },
  });
});
