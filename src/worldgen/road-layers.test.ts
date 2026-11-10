/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { plan_mainland } from "./mainland";
import { KERB_OUT, ring_mouths, road_junctions, roadside_clear } from "./road-layers";
import { ROAD_HALF } from "./types";

const POST_OFF = ROAD_HALF + 1.6;
// Room qa7ml: the circuit kinks where a road between towns meets a town's street, and the kerb folded over it there.
const KINKED = 3516535473;

function inside(outline: readonly { x: number; z: number }[], x: number, z: number): boolean {
  let hit = false;
  for (let a = 0, b = outline.length - 1; a < outline.length; b = a++) {
    const p = outline[a];
    const q = outline[b];
    if (p.z > z !== q.z > z && x < ((q.x - p.x) * (z - p.z)) / (q.z - p.z) + p.x) hit = !hit;
  }
  return hit;
}

// The mainland circuit drives about half its edges from b to a.
for (const seed of [...sweep(3), KINKED])
  test(`mainland ${seed}: the circuit's asphalt stops only under a junction patch, and no curb or post stands in one or folds back`, () => {
    const { data } = plan_mainland(seed);
    const junctions = road_junctions(data);
    const outlines = junctions.patched.map((j) => j.patch.outline);
    const covered = (x: number, z: number) => outlines.some((o) => inside(o, x, z));
    const { road } = data;
    const n = road.length;
    expect([...junctions.ring_at.values()].some((span) => !span.forward)).toBe(true);
    ring_mouths(data, junctions).forEach((v, s) => {
      if (!v) return;
      const a = road[s];
      const b = road[(s + 1) % n];
      expect(covered((a.x + b.x) / 2, (a.z + b.z) / 2)).toBe(true);
    });
    const clear = roadside_clear(data, junctions);
    road.forEach((p, s) => {
      if (clear.has(s)) return;
      for (const off of [-POST_OFF, -KERB_OUT, 0, KERB_OUT, POST_OFF]) expect(covered(p.x - p.tz * off, p.z + p.tx * off)).toBe(false);
      const q = road[(s + 1) % n];
      if (clear.has((s + 1) % n)) return;
      for (const off of [-KERB_OUT, KERB_OUT]) {
        const ahead = (q.x - q.tz * off - (p.x - p.tz * off)) * p.tx + (q.z + q.tx * off - (p.z + p.tx * off)) * p.tz;
        expect(ahead).toBeGreaterThan(0);
      }
    });
  });
