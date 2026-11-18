import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { EVENTS, MAX_EVENT_STARS, TIERS, event_of, type CareerEvent, type Stars } from "../career/career";
import { event_map } from "../career/career-store";
import { plain_map } from "../worldgen/kinds/kinds";
import { WorldKind } from "../worldgen/types";
import { distance_text, elsewhere, first_pick, kind_map, map_event, map_stops } from "./maps";

const at = (id: string): CareerEvent => event_of(id)!;
const island = event_map(at("r1"));
const full = (events: readonly CareerEvent[]): Stars => Object.fromEntries(events.map((event) => [event.id, MAX_EVENT_STARS]));

test("a fresh profile's rail is the loaded map, then the other Rookie maps", () => {
  const stops = map_stops({}, island, "Island · Harwar");
  expect(stops[0].place).toEqual({ here: true });
  expect(stops[0].name).toBe("Island · Harwar");
  const rookie_maps = new Set(TIERS[0].events.map((event) => event.map));
  expect(stops.length).toBe(rookie_maps.size);
  for (const stop of stops.slice(1)) expect(stop.events.some((event) => event.open)).toBe(true);
});

test("the loaded map keeps its locked events, marked with what opens them", () => {
  const [here] = map_stops({}, island, "Island");
  const locked = here.events.find((event) => !event.open)!;
  expect(locked.note).toStartWith("Opens at ");
  expect(here.of).toBe(here.events.filter((event) => event.open).length * MAX_EVENT_STARS);
});

test("a map with no events still leads the rail as here", () => {
  const sky = plain_map(WorldKind.SKY, 99);
  const stops = map_stops({}, sky, "Sky · Somewhere");
  expect(stops[0]).toMatchObject({ place: { here: true }, events: [], name: "Sky · Somewhere" });
});

test("an opened tier brings its maps onto the rail", () => {
  const fresh = map_stops({}, island, "Island").length;
  expect(map_stops(full(TIERS[0].events), island, "Island").length).toBeGreaterThan(fresh);
});

test("a map opens on its first open event short of full stars", () => {
  const events = TIERS[0].events.filter((event) => event.map === "1C0000003").map((event) => map_event(event, { r1: MAX_EVENT_STARS }));
  expect(first_pick(events)?.id).toBe("r2");
  expect(first_pick([])).toBeNull();
});

test("event rows read tier, place in tier, mode and car", () => {
  const row = map_event(at("r3"), { r3: 2 });
  expect(row).toMatchObject({ eyebrow: "Rookie 3 · Parking", title: "Bay", stars: 2, open: true, tier: 1 });
  expect(row.note).toContain("Easy cruiser");
});

test("elsewhere counts open unfinished events on other maps", () => {
  const away = elsewhere({}, island)!;
  const rookie_away = TIERS[0].events.filter((event) => event.map !== "1C0000003").length;
  expect(away.count).toBe(rookie_away);
  expect(away.line).toStartWith("on ");
  expect(elsewhere(full(EVENTS), island)).toBeNull();
});

test("distances read in metres, then kilometres", () => {
  expect(distance_text(423)).toBe("420 m");
  expect(distance_text(1130)).toBe("1.1 km");
});

test("Make a map: a kind comes back with the values it was left on, another kind plain", () => {
  const plain = plain_map(WorldKind.SKY, 7);
  const custom = plain.levels.map((level, at) => (at === 0 ? level + 1 : level));
  const kept = new Map([[WorldKind.SKY, custom]]);
  expect(kind_map(kept, WorldKind.SKY, 7)).toEqual({ kind: WorldKind.SKY, seed: 7, levels: custom });
  expect(kind_map(kept, WorldKind.RACEWAY, 7)).toEqual(plain_map(WorldKind.RACEWAY, 7));
});
