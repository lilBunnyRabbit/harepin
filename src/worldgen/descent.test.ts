/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { generate_world } from "./kinds/kinds";
import { WINTER_GRIP } from "./kinds/kind-def";
import { ICE_CANYON } from "./recipe";
import { HAIRPIN_RADIUS } from "./switchback";
import { CELL, RouteKind, SPUR_GRADE, SurfaceId, WorldKind, type RoadPoint } from "./types";
import { World } from "../world/world";

const COAST = 6;
const GRADE_RUN = 5;
/** Route points either side of the road's end where its shoulder, blending over SHOULDER metres, meets the bed. */
const ROAD_END = 10;
/** Route points of bed at the least: 2 m apart. */
const BED_MIN = 150;
/** Packed snow under a frozen fall's run-up before the toe, and past the deck, metres. */
const RUNUP = 30;
const RUNOUT = 15;
const BED_HALF = ICE_CANYON.road.descent?.bed?.half ?? 0;
/** Most the bed's ground stands off the race line, metres. */
const BED_LEVEL = 1.5;

for (const seed of sweep(10))
  test(`volcano ${seed}: one road down off the rim to the sea, raced one way and held to a road's grade`, () => {
    const data = generate_world(seed, WorldKind.VOLCANO);
    const route = data.routes.find((r) => r.kind === RouteKind.SPRINT);
    expect(route?.id).toBe("descent");
    if (!route) return;
    const { points, checkpoints } = route;
    const start = points[0];
    const end = points[points.length - 1];
    expect(route.closed).toBe(false);
    expect(data.road.some((p) => p.x === start.x && p.z === start.z && p.y === start.y)).toBe(true);
    expect(end.y).toBeLessThan(COAST);
    expect(start.y - end.y).toBeGreaterThan(150);
    const last = checkpoints[checkpoints.length - 1];
    expect([last.x, last.z]).toEqual([end.x, end.z]);
    expect(data.graph.edges.some((e) => !e.closed && e.points === points)).toBe(true);
    let walked = 0;
    const along = [0];
    for (let i = 1; i < points.length; i++) along.push((walked += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)));
    for (let i = GRADE_RUN; i < points.length; i++) expect(Math.abs(points[i].y - points[i - GRADE_RUN].y) / (along[i] - along[i - GRADE_RUN])).toBeLessThanOrEqual(SPUR_GRADE);
    const hairpins = data.items.filter((item) => item.kind === "barrier").length;
    expect(hairpins).toBeGreaterThan(0);
    expect(route.length).toBeGreaterThan(HAIRPIN_RADIUS * 100);
  });

for (const seed of sweep(10))
  test(`ice canyon ${seed}: the descent leaves the rim on packed snow and races on down a bare ice bed over frozen falls`, () => {
    const data = generate_world(seed, WorldKind.ICE_CANYON);
    const world = new World(seed, data);
    const route = data.routes.find((r) => r.kind === RouteKind.SPRINT);
    const road = data.graph.edges.find((e) => !e.closed && e.kind === "highway");
    expect(route?.id).toBe("descent");
    if (!route || !road) return;
    const { points } = route;
    const foot = road.points.length - 1;
    expect(road.points).toEqual(points.slice(0, foot + 1));
    expect(points.length - foot).toBeGreaterThan(BED_MIN);
    for (const p of points.slice(0, foot - ROAD_END)) expect(world.footing(p.x, p.z)).toBe(WINTER_GRIP.road);
    // The falls' kickers stand on the bed; the circuit's own road kickers stand on the rim.
    const bed = points.slice(foot);
    const kickers = data.ramps.filter((r) => r.road && bed.some((p) => (p.x - r.x) ** 2 + (p.z - r.z) ** 2 < BED_HALF * BED_HALF));
    expect(kickers.length).toBeGreaterThan(0);
    // Along each kicker's axis from its toe: packed snow from the run-up to past the deck. The paint rounds off the pad's
    // ends as wide as the bed, so between the two reaches either surface may show.
    const pad = (p: RoadPoint, slack: number) =>
      kickers.some((r) => {
        const d = (p.x - r.x) * r.fx + (p.z - r.z) * r.fz;
        return d > -RUNUP - slack && d < r.length + r.landing + RUNOUT + slack;
      });
    for (const p of points.slice(foot + ROAD_END)) {
      if (pad(p, -CELL)) expect(world.surface(p.x, p.z)).toBe(SurfaceId.PACKED_SNOW);
      else if (!pad(p, BED_HALF + 2 * CELL)) expect(world.surface(p.x, p.z)).toBe(SurfaceId.ICE);
      expect(Math.abs(world.tiles.height(p.x, p.z) - p.y), `${p.x}, ${p.z}`).toBeLessThan(BED_LEVEL);
    }
  });
