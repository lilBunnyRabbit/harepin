import { expect, test } from "bun:test";
import { FULL, sweep } from "../../sweep";
import { chunk_of, extent } from "../chunk-grid";
import { sample } from "../field";
import { build_tile } from "../ground";
import { MAINLAND_SIZE } from "../mainland";
import { TileStore } from "../tiles";
import { WorldKind, type WorldData } from "../types";
import { generate_world, KINDS } from "./kinds";

/** Streets ride a town plane tilted up to 5%; anything past that across a road is accidental. */
const MAX_TILT = 0.06;
/** Where another road comes within this of a road's edge the two meet at a junction, which may fall across it. */
const JUNCTION_CLEAR = 8;
/** Hills at their top level: a trail cut there once shaped its bank across the circuit at 46%. */
const STEEP_ISLAND = 49;
/** A road's own grade plus what easing off a junction's flat band adds; a mouth stepping onto its road climbed 30-140%. */
const MAX_MOUTH = 0.2;
/** How far from each end a road is checked: a mouth's ease stays well inside it. */
const MOUTH_RUN = 60;
/** Its spurs once stepped 1-2 m onto their own height at the circuit's band. */
const STEPPED_ISLAND = 2;
const TIMEOUT = 300_000;

/** Ground height under the roads: the island kinds hold it whole, mainland streams it by tile. */
function ground(world: WorldData): (x: number, z: number) => number {
  if (world.kind !== WorldKind.MAINLAND) return (x, z) => sample(world.terrain.heights, x, z);
  const ext = extent(MAINLAND_SIZE);
  const store = new TileStore(ext);
  const built = new Set<number>();
  return (x, z) => {
    const index = chunk_of(x, z, ext);
    for (const near of [-1, 0, 1].flatMap((dj) => [-1, 0, 1].map((di) => index + dj * ext.side + di)))
      if (near >= 0 && near < ext.side * ext.side && !built.has(near)) {
        built.add(near);
        store.add(near, build_tile(world.ground, near, ext));
      }
    return store.height(x, z);
  };
}

/** Every road sample tilted past MAX_TILT across, as "edge id at x,z: tilt". */
function tilted(world: WorldData): string[] {
  const out: string[] = [];
  const height = ground(world);
  for (const edge of world.graph.edges) {
    const others = world.graph.edges.filter((o) => o.id !== edge.id);
    const off = edge.half - 0.5;
    for (const p of edge.points) {
      if (others.some((o) => o.points.some((q) => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < (edge.half + o.half + JUNCTION_CLEAR) ** 2))) continue;
      const left = height(p.x - p.tz * off, p.z + p.tx * off);
      const mid = height(p.x, p.z);
      const right = height(p.x + p.tz * off, p.z - p.tx * off);
      const tilt = Math.max(Math.abs(left - mid), Math.abs(mid - right)) / off;
      if (tilt > MAX_TILT) out.push(`edge ${edge.id} at ${p.x.toFixed(0)},${p.z.toFixed(0)}: ${tilt.toFixed(3)}`);
    }
  }
  return out;
}

/** Every rise past MAX_MOUTH along a road's first MOUTH_RUN metres from either end, as "edge id at x,z: grade". */
function stepped(world: WorldData): string[] {
  const out: string[] = [];
  // Mainland stamps streets by id, so a local laid first holds a street crossing it: those dips predate the mouths.
  if (world.kind === WorldKind.MAINLAND) return out;
  const height = ground(world);
  for (const edge of world.graph.edges) {
    if (edge.closed) continue;
    for (const points of [edge.points, edge.points.toReversed()]) {
      let run = 0;
      for (let i = 1; i < points.length && run < MOUTH_RUN; i++) {
        const a = points[i - 1];
        const b = points[i];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        run += len;
        const grade = Math.abs(height(b.x, b.z) - height(a.x, a.z)) / len;
        if (grade > MAX_MOUTH) out.push(`edge ${edge.id} at ${b.x.toFixed(0)},${b.z.toFixed(0)}: ${grade.toFixed(3)}`);
      }
    }
  }
  return out;
}

test.skipIf(!FULL)("no road tilts across past a town plane's grade or steps up at a junction mouth, on any kind", () => {
  const failed: string[] = [];
  for (const kind of Object.values(WorldKind))
    for (const seed of sweep(10)) {
      const world = generate_world(seed, kind);
      failed.push(...[...tilted(world), ...stepped(world)].map((at) => `${kind} ${seed} ${at}`));
    }
  expect(failed).toEqual([]);
}, TIMEOUT);

test("a road's mouth meets the band of the road it joins without a step", () => {
  expect(stepped(generate_world(STEPPED_ISLAND, WorldKind.ISLAND))).toEqual([]);
}, TIMEOUT);

test("a trail's bank stops short of the asphalt it runs beside", () => {
  const levels = KINDS.island.options.map((o) => (o.field === "H" ? o.labels.length - 1 : o.normal));
  expect(tilted(generate_world(STEEP_ISLAND, WorldKind.ISLAND, levels))).toEqual([]);
}, TIMEOUT);
