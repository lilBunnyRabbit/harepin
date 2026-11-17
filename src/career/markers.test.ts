import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { World } from "../world/world";
import { KINDS, build_world } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import { SPAWN_INDEX } from "../worldgen/types";
import { EVENTS, TIERS } from "./career";
import { event_map } from "./career-store";
import { NEW_PLAYER_MAP } from "../world/world-pick";
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

const go = (on: World, m: Pose, aside = true) => arrival(m, aside, (x, z, fx, fz) => on.spawn_near(x, z, fx, fz));
// How far `car` stands before the flag, along its heading.
const short_of = (car: Pose, flag: Pose) => Math.sin(car.heading) * (flag.x - car.x) + Math.cos(car.heading) * (flag.z - car.z);

test("Go stops the car before its flag, on the road for a race, facing past it, outside its ring", () => {
  for (const m of markers) {
    const car = go(world, m);
    if (m.event.mode === "race") expect(world.on_road(car.x, car.z)).toBe(true);
    expect(Math.hypot(m.x - car.x, m.z - car.z)).toBeGreaterThan(MARKER_REACH);
    expect(short_of(car, m)).toBeGreaterThan(4);
    expect(Math.abs(wrap(ahead(car, m.x, m.z)))).toBeLessThan(Math.PI / 4);
    expect(Math.abs(wrap(car.heading - m.heading))).toBeLessThan(Math.PI / 6);
    expect(marker_at(markers, car.x, car.z)).toBe(null);
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
  const car = arrival(flag, true, bend);
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
  const car = arrival(flag, false, straight);
  expect(car.z).toBeCloseTo(1.5, 6);
  expect(car.x).toBeCloseTo(-6, 6);
  const first = arrival(flag, false, nowhere);
  expect(first.x).toBeCloseTo(0, 6);
  expect(first.z).toBeCloseTo(1.5, 6);
});

test("a flag on open ground stands before the line, and with no road behind the line the car backs onto open ground", () => {
  const car = arrival({ x: -3, z: 8.5, heading: Math.PI / 2 }, true, nowhere);
  expect(car.x).toBeCloseTo(-9, 6);
  expect(car.z).toBeCloseTo(3, 6);
});

test("a race whose road starts at its line still stops the car before the flag", () => {
  for (const id of ["c1", "c7", "e2", "l11", "p7"]) {
    const event = EVENTS.find((one) => one.id === id);
    if (!event) throw new Error(id);
    const at = event_map(event);
    const its = new World(at.seed, build_world(at.seed, at.kind, at.levels).data, undefined, at.levels);
    const [m] = event_markers(its, SPAWN_INDEX, [event], KINDS[at.kind].open_ground);
    const car = go(its, m);
    expect(short_of(car, m)).toBeGreaterThan(4);
    expect(Math.abs(wrap(ahead(car, m.x, m.z)))).toBeLessThan(Math.PI / 4);
  }
});

test("a new player's map spawns the car on the road a short drive before its first flag, facing it", () => {
  expect(map_code(map)).toBe(NEW_PLAYER_MAP);
  const p = world.road[world.clear_spawn(SPAWN_INDEX)];
  const car = { x: p.x, z: p.z, heading: Math.atan2(p.tx, p.tz) };
  const [first] = markers;
  const away = Math.hypot(first.x - car.x, first.z - car.z);
  expect(away).toBeGreaterThan(40);
  expect(away).toBeLessThan(120);
  expect(short_of(car, first)).toBeGreaterThan(40);
});
