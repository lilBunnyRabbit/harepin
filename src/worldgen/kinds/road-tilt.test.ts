import { expect, test } from "bun:test";
import { sweep } from "../../sweep";
import { sample } from "../field";
import { WorldKind, type WorldData } from "../types";
import { generate_world, KINDS } from "./kinds";

/** Streets ride a town plane tilted up to 5%; anything past that across a road is accidental. */
const MAX_TILT = 0.06;
/** Where another road comes within this of a road's edge the two meet at a junction, which may fall across it. */
const JUNCTION_CLEAR = 8;
/** Hills at their top level: a trail cut there once shaped its bank across the circuit at 46%. */
const STEEP_ISLAND = 49;
const TIMEOUT = 300_000;

/** Every road sample tilted past MAX_TILT across, as "edge id at x,z: tilt". */
function tilted(world: WorldData): string[] {
  const out: string[] = [];
  const height = (x: number, z: number) => sample(world.terrain.heights, x, z);
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

test("no road tilts across past a town plane's grade, on any kind", () => {
  const failed: string[] = [];
  for (const kind of Object.values(WorldKind)) for (const seed of sweep(10)) failed.push(...tilted(generate_world(seed, kind)).map((at) => `${kind} ${seed} ${at}`));
  expect(failed).toEqual([]);
}, TIMEOUT);

test("a trail's bank stops short of the asphalt it runs beside", () => {
  const levels = KINDS.island.options.map((o) => (o.field === "H" ? o.labels.length - 1 : o.normal));
  expect(tilted(generate_world(STEEP_ISLAND, WorldKind.ISLAND, levels))).toEqual([]);
}, TIMEOUT);
