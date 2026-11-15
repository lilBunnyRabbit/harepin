/// <reference types="bun" />
import { expect, test } from "bun:test";
import { drawn_roads, laid_height, laid_pad, paved_lots, paving_lift } from "./drawn-lift";
import { World } from "./world";
import { build_world } from "../worldgen/kinds/kinds";
import { LIFT } from "../worldgen/lifts";
import { EDGE_INSET, EDGE_WIDTH, GIVE_WAY_OUT, GIVE_WAY_WIDTH, road_junctions } from "../worldgen/road-layers";
import { GIVE_WAY_GAP, give_way_dash } from "../worldgen/roads";
import { WorldKind, type Lot, type RoadPoint } from "../worldgen/types";

const turn = Math.PI / 6;
const lot = (ground: Lot["ground"]): Lot => ({ id: 0, town: 0, edge: 0, side: 1, x: 100, y: 0, z: 50, w: 20, d: 20, fx: Math.sin(turn), fz: Math.cos(turn), angle: turn, kind: "plaza", ground });

test("a plaza lifts its paving and more its square, in the lot's turned frame, and nothing past it", () => {
  const lots = paved_lots([lot("plaza")], []);
  // Local (9.5, 0) is on the border paving, outside the square that starts 1.2 m in; the paving ends 1.2 m past the lot.
  const at = (lx: number, lz: number) => paving_lift(lots, 100 + Math.cos(turn) * lx + Math.sin(turn) * lz, 50 - Math.sin(turn) * lx + Math.cos(turn) * lz);
  expect([at(0, 0), at(9.5, 0), at(12, 0), at(0, -12)]).toEqual([LIFT.plaza, LIFT.pad, 0, 0]);
});

test("a tyre stands on the road it is on: the circuit, a street, a spur, and the paint on each", () => {
  const { data } = build_world(1, WorldKind.ISLAND);
  const world = new World(1, data);
  const roads = drawn_roads(data, road_junctions(data));
  const across = (p: RoadPoint, q: RoadPoint, u: number) => world.drawn_lift((p.x + q.x) / 2 - p.tz * u, (p.z + q.z) / 2 + p.tx * u);
  const seen = new Set<number>();
  for (const road of roads) {
    if (!road) continue;
    const { points, paint, lift } = road;
    const s = paint.centre.findIndex((on, i) => on === 1 && paint.edges[i] === 1 && i > 0 && paint.edges[i - 1] === 1 && paint.edges[i + 1] === 1);
    if (s < 0) continue;
    seen.add(lift);
    const [p, q] = [points[s], points[s + 1]];
    expect([across(p, q, 0), across(p, q, paint.half / 2), across(p, q, paint.half - 0.4), across(p, q, 0.4 - paint.half)]).toEqual([LIFT.mark, lift, LIFT.mark, LIFT.mark]);
  }
  expect([...seen].sort()).toEqual([LIFT.street, LIFT.ring, LIFT.spur]);
});

test("a tyre stands on a junction's own paint and asphalt: give-way dashes, corner edge lines, the patch between its arms' lifts", () => {
  const { data } = build_world(1, WorldKind.ISLAND);
  const world = new World(1, data);
  const seen = { bars: 0, lines: 0, eased: 0 };
  for (const { arms, patch } of road_junctions(data).patched) {
    for (const i of patch.minor) {
      const p = arms[i].points[patch.mouths[i]];
      const half = arms[i].half - EDGE_INSET;
      const dash = give_way_dash(half);
      const at = (side: number, ahead: number) => world.drawn_lift(p.x - p.tz * side + p.tx * ahead, p.z + p.tx * side + p.tz * ahead);
      const mid = GIVE_WAY_OUT + GIVE_WAY_WIDTH / 2;
      // On the first dash, in the gap after it, and on the arm's bare asphalt past the bar.
      expect([at(dash / 2 - half, mid), at(half - dash / 2, mid), at(dash + GIVE_WAY_GAP / 2 - half, mid) < LIFT.mark, at(dash / 2 - half, GIVE_WAY_OUT + GIVE_WAY_WIDTH + 0.2)]).toEqual([LIFT.mark, LIFT.mark, true, arms[i].lift]);
      seen.bars++;
    }
    for (const line of patch.lines) {
      const a = line[Math.floor((line.length - 1) / 2)];
      const b = line[Math.floor((line.length - 1) / 2) + 1];
      const across = (inward: number) => world.drawn_lift((a.x + b.x) / 2 + ((a.wx + b.wx) / 2) * inward, (a.z + b.z) / 2 + ((a.wz + b.wz) / 2) * inward);
      expect(across(EDGE_INSET + EDGE_WIDTH / 2)).toBe(LIFT.mark);
      expect(across(EDGE_INSET / 2)).toBeLessThan(LIFT.mark);
      seen.lines++;
    }
    const { centre, outline } = patch;
    const rim = outline.find((p) => p.lift !== centre.lift);
    if (!rim) continue;
    // Halfway out on a fan spoke the patch stands halfway between the centre's lift and the rim's, not at either road's.
    const half = world.drawn_lift((centre.x + rim.x) / 2, (centre.z + rim.z) / 2);
    if (half === LIFT.mark) continue;
    expect(half).toBeCloseTo((centre.lift + rim.lift) / 2, 6);
    seen.eased++;
  }
  expect(Math.min(seen.bars, seen.lines, seen.eased)).toBeGreaterThan(0);
});

test("a laid pad stands where its mesh is drawn: each cell's two triangles, in its turned frame, and nothing past its edges", () => {
  // Two cells of 2 m along u: nodes (0..2, 0..1), heights rising 1 m per node along u and 0.5 m along v; one corner raised.
  const heights = new Float64Array([0, 1, 2, 0.5, 1.5, 4]);
  const pad = laid_pad(100, 50, turn, { u0: -2, v0: 1, step: 2, nu: 2, nv: 1 }, heights);
  // `to_world` of the gymkhana site frame: u along (cos, -sin), v along (sin, cos).
  const at = (u: number, v: number) => laid_height([pad], 100 + u * Math.cos(turn) + v * Math.sin(turn), 50 - u * Math.sin(turn) + v * Math.cos(turn));
  expect(at(-1.9, 1.1)).toBeCloseTo(0.075, 9);
  expect(at(-1, 2)).toBeCloseTo(0.75, 9);
  // Second cell: below its diagonal (a, b, a + 1) the raised far corner does not count; above it (a + 1, b, b + 1) it does.
  expect(at(0.5, 1.5)).toBeCloseTo(1 + 0.25 + (0.5 - 0) * 0.25, 9);
  expect(at(1.5, 2.5)).toBeCloseTo(4 + (1.5 - 4) * 0.25 + (2 - 4) * 0.25, 9);
  expect([at(2.1, 2), at(0, 0.9), at(-2.1, 2), at(0, 3.1)]).toEqual([-Infinity, -Infinity, -Infinity, -Infinity]);
});

test("a pad laid on the world is what a tyre stands on under it, and is gone once taken away", () => {
  const { data } = build_world(1, WorldKind.ISLAND);
  const world = new World(1, data);
  const p = data.road[10];
  const off = { x: p.x + p.tz * 40, z: p.z - p.tx * 40 };
  const ground = world.height(p.x, p.z);
  const under = [world.drawn_lift(p.x, p.z), world.drawn_lift(off.x, off.z)];
  const flat = (y: number) => laid_pad(p.x - 3, p.z - 3, 0, { u0: 0, v0: 0, step: 6, nu: 1, nv: 1 }, new Float64Array(4).fill(y));
  const unlay = world.lay(flat(ground + under[0] + 0.03));
  expect(world.drawn_lift(p.x, p.z)).toBeCloseTo(under[0] + 0.03, 9);
  expect(world.drawn_lift(off.x, off.z)).toBe(under[1]);
  unlay();
  expect(world.drawn_lift(p.x, p.z)).toBe(under[0]);
  // A pad drawn under the road there is hidden by it: the tyre stays on the road.
  world.lay(flat(ground - 1));
  expect(world.drawn_lift(p.x, p.z)).toBe(under[0]);
});
