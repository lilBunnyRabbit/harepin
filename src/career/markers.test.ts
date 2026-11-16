import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { World } from "../world/world";
import { KINDS, build_world } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import { SPAWN_INDEX } from "../worldgen/types";
import { EVENTS, TIERS } from "./career";
import { event_map } from "./career-store";
import { MARKER_REACH, arrival, event_markers, marker_at, marker_open, type Pose } from "./markers";

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

const ahead = (from: Pose, x: number, z: number) => Math.atan2(x - from.x, z - from.z) - from.heading;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

test("Go stops the car before its flag, on the road for a race, facing past it, and the card opens there", () => {
  for (const m of markers) {
    const { arrive } = m;
    if (m.event.mode === "race") expect(world.on_road(arrive.x, arrive.z)).toBe(true);
    const gap = Math.hypot(m.x - arrive.x, m.z - arrive.z);
    expect(gap).toBeGreaterThan(MARKER_REACH);
    expect(gap).toBeLessThan(10);
    expect(Math.abs(wrap(ahead(arrive, m.x, m.z)))).toBeLessThan(Math.PI / 4);
    expect(Math.abs(wrap(arrive.heading - m.heading))).toBeLessThan(Math.PI / 6);
    expect(marker_at(markers, arrive.x, arrive.z)).toBe(m);
  }
});

test("on a bend the car sits in the flag's lane and faces along the curve", () => {
  const radius = 40;
  // A circle round the origin driven clockwise seen from above: heading at angle a is a + PI/2.
  const bend = (x: number, z: number): Pose => {
    const a = Math.atan2(x, z);
    return { x: Math.sin(a) * radius, z: Math.cos(a) * radius, heading: a + Math.PI / 2 };
  };
  const at = 0.6;
  const road = bend(Math.sin(at), Math.cos(at));
  const off = 8.5;
  const flag = { x: road.x - Math.cos(road.heading) * off, z: road.z + Math.sin(road.heading) * off, heading: road.heading };
  const car = arrival(flag, off, { spawn_near: bend, on_road: () => true });
  const out = Math.hypot(car.x, car.z) - radius;
  expect(Math.abs(Math.abs(out) - 3)).toBeLessThan(0.01);
  expect(Math.sign(out)).toBe(Math.sign(Math.hypot(flag.x, flag.z) - radius));
  expect(Math.abs(wrap(car.heading - (Math.atan2(car.x, car.z) + Math.PI / 2)))).toBeLessThan(1e-9);
  expect(Math.abs(wrap(ahead(car, flag.x, flag.z)))).toBeLessThan(Math.PI / 4);
});

test("a flag on a track in the air keeps the car clear of its pole", () => {
  const straight = (x: number): Pose => ({ x, z: 0, heading: Math.PI / 2 });
  const flag = { x: 0, z: 4.5, heading: Math.PI / 2 };
  const car = arrival(flag, 4.5, { spawn_near: (x) => straight(x), on_road: () => true });
  expect(car.z).toBeCloseTo(1.5, 6);
  expect(car.x).toBeCloseTo(-6, 6);
});

test("a race whose road starts at the line backs the car only as far as the road goes", () => {
  const flag = { x: 0, z: 8.5, heading: Math.PI / 2 };
  const elsewhere = (): Pose => ({ x: 0, z: 0, heading: Math.PI / 2 });
  const car = arrival(flag, 8.5, { spawn_near: elsewhere, on_road: (x, z) => x >= -2 && Math.abs(z) < 6 });
  expect(car.x).toBeCloseTo(-2, 6);
  expect(car.z).toBeCloseTo(3, 6);
});
