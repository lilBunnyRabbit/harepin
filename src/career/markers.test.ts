import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { World } from "../world/world";
import { KINDS, build_world } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import { SPAWN_INDEX } from "../worldgen/types";
import { EVENTS, TIERS } from "./career";
import { event_map } from "./career-store";
import { MARKER_REACH, event_markers, marker_at, marker_open } from "./markers";

const ISLAND = "1C0000003";
const here = EVENTS.filter((event) => map_code(event_map(event)) === ISLAND);
const map = event_map(here[0]);
const world = new World(map.seed, build_world(map.seed, map.kind, map.levels).data, undefined, map.levels);
const markers = event_markers(world, SPAWN_INDEX, here, KINDS[map.kind].open_ground);

test("every event on the map gets a flag, none in another's reach", () => {
  expect(here.map((event) => event.id)).toEqual(["r1", "r2", "r3", "e10"]);
  expect(markers.map((m) => m.event.id)).toEqual(["r1", "r2", "r3", "e10"]);
  for (const a of markers) for (const b of markers) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(MARKER_REACH * 2);
});

test("flags stand off the road on open ground", () => {
  for (const m of markers) expect(world.on_road(m.x, m.z)).toBe(false);
});

test("the car is at a flag only within its reach", () => {
  const [first] = markers;
  expect(marker_at(markers, first.x + 1, first.z)).toBe(first);
  expect(marker_at(markers, first.x + MARKER_REACH + 1, first.z)).toBe(null);
});

test("a flag is open with its tier, or with tune", () => {
  const club = event_markers(world, SPAWN_INDEX, [TIERS[1].events[3]], true)[0];
  expect(club.tier).toBe(1);
  expect(marker_open(club, {}, false)).toBe(false);
  expect(marker_open(club, {}, true)).toBe(true);
  expect(marker_open(club, Object.fromEntries(TIERS[0].events.map((e) => [e.id, 2])), false)).toBe(true);
  expect(marker_open(markers[0], {}, false)).toBe(true);
});
