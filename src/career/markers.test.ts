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

// Seen from about where the chase camera sits behind the car.
const CHASE_BACK = 7;
const ahead = (car: Pose, x: number, z: number) =>
  Math.atan2(x - car.x + Math.sin(car.heading) * CHASE_BACK, z - car.z + Math.cos(car.heading) * CHASE_BACK) - car.heading;
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
  // A circle round the origin: the heading at angle a is a + PI/2.
  const bend = (x: number, z: number): Pose => {
    const a = Math.atan2(x, z);
    return { x: Math.sin(a) * radius, z: Math.cos(a) * radius, heading: a + Math.PI / 2 };
  };
  const line = bend(Math.sin(0.6), Math.cos(0.6));
  const flag = { x: line.x - Math.cos(line.heading) * 8.5, z: line.z + Math.sin(line.heading) * 8.5, heading: line.heading };
  const car = arrival(flag, true, { spawn_near: bend, on_road: () => true });
  const out = Math.hypot(car.x, car.z) - radius;
  expect(Math.abs(Math.abs(out) - 3)).toBeLessThan(0.01);
  expect(Math.sign(out)).toBe(Math.sign(Math.hypot(flag.x, flag.z) - radius));
  expect(Math.abs(wrap(car.heading - (Math.atan2(car.x, car.z) + Math.PI / 2)))).toBeLessThan(1e-9);
  expect(Math.abs(wrap(ahead(car, flag.x, flag.z)))).toBeLessThan(Math.PI / 4);
});

// Heading PI / 2 drives along +x; the flag's side is +z.
const straight = (x: number): Pose => ({ x, z: 0, heading: Math.PI / 2 });
const nowhere = (): Pose => ({ x: 1e3, z: 1e3, heading: 0 });

test("a flag on a track in the air keeps the car clear of its pole, and off the air behind a track's start", () => {
  const flag = { x: 0, z: 4.5, heading: Math.PI / 2 };
  const car = arrival(flag, false, { spawn_near: straight, on_road: () => true });
  expect(car.z).toBeCloseTo(1.5, 6);
  expect(car.x).toBeCloseTo(-6, 6);
  const first = arrival(flag, false, { spawn_near: nowhere, on_road: () => false });
  expect(first.x).toBeCloseTo(0, 6);
  expect(first.z).toBeCloseTo(1.5, 6);
});

test("a flag on open ground stands before the line; where the road starts short of the car's spot, the car backs only as far as it runs", () => {
  const flag = { x: -3, z: 8.5, heading: Math.PI / 2 };
  const car = arrival(flag, true, { spawn_near: nowhere, on_road: (x, z) => x >= -5 && Math.abs(z) < 6 });
  expect(car.x).toBeCloseTo(-5, 6);
  expect(car.z).toBeCloseTo(3, 6);
  const site = arrival(flag, true, { spawn_near: nowhere, on_road: () => false });
  expect(site.x).toBeCloseTo(-9, 6);
  expect(site.z).toBeCloseTo(3, 6);
});

test("a race whose road runs only metres behind its line still puts the car on the road", () => {
  for (const id of ["c1", "c7", "e2", "l11", "p7"]) {
    const event = EVENTS.find((one) => one.id === id);
    if (!event) throw new Error(id);
    const at = event_map(event);
    const its = new World(at.seed, build_world(at.seed, at.kind, at.levels).data, undefined, at.levels);
    const [m] = event_markers(its, SPAWN_INDEX, [event], KINDS[at.kind].open_ground);
    expect(its.on_road(m.arrive.x, m.arrive.z)).toBe(true);
    expect(Math.abs(wrap(ahead(m.arrive, m.x, m.z)))).toBeLessThan(Math.PI / 4);
  }
});
