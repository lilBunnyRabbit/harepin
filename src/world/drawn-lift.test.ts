/// <reference types="bun" />
import { expect, test } from "bun:test";
import { drawn_roads, paved_lots, paving_lift } from "./drawn-lift";
import { World } from "./world";
import { build_world } from "../worldgen/kinds/kinds";
import { LIFT } from "../worldgen/lifts";
import { road_junctions } from "../worldgen/road-layers";
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
