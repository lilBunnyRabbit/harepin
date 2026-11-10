/// <reference types="bun" />
import { expect, test } from "bun:test";
import { road_junctions } from "./chunks";
import { generate } from "./index";
import { junction_patch, type Arm, type Patch } from "./junction";

const STEP = 2;
const LENGTH = 30;

function arm(degrees: number, half: number, radius = 8): Arm {
  const a = (degrees * Math.PI) / 180;
  const tx = Math.cos(a);
  const tz = Math.sin(a);
  const points = Array.from({ length: LENGTH }, (_, k) => ({ x: tx * k * STEP, y: 0, z: tz * k * STEP, tx, tz }));
  return { points, reach: points.map(() => [-Infinity, Infinity]), half, clear: half, radius, rank: 0, lift: 0.03, lined: true };
}

function faces_up({ centre: c, outline }: Patch): boolean {
  return outline.every((b, q) => {
    const a = outline[(q + 1) % outline.length];
    return (a.z - c.z) * (b.x - c.x) - (a.x - c.x) * (b.z - c.z) > 0;
  });
}

test("a corner sharper than 50 degrees gets no patch", () => {
  expect(junction_patch(0, 0, [arm(0, 5), arm(40, 4), arm(200, 5)])).toBeNull();
  expect(junction_patch(0, 0, [arm(0, 5), arm(60, 4), arm(200, 5)])).not.toBeNull();
});

test("a crossroads of mixed widths faces up, and each mouth clears where its neighbours' rims cross", () => {
  const arms = [arm(0, 6), arm(80, 4), arm(180, 5), arm(265, 4)];
  const patch = junction_patch(0, 0, arms);
  if (!patch) throw new Error("no patch");
  expect(faces_up(patch)).toBe(true);
  arms.forEach((a, i) => {
    const prev = arms[(i + arms.length - 1) % arms.length];
    const next = arms[(i + 1) % arms.length];
    const cross = (b: Arm, gap: number) => (b.half + a.half * Math.cos(gap)) / Math.sin(gap);
    const gap_prev = Math.atan2(a.points[1].z, a.points[1].x) - Math.atan2(prev.points[1].z, prev.points[1].x);
    const gap_next = Math.atan2(next.points[1].z, next.points[1].x) - Math.atan2(a.points[1].z, a.points[1].x);
    const wrap = (g: number) => (g + 2 * Math.PI) % (2 * Math.PI);
    expect(patch.mouths[i] * STEP).toBeGreaterThanOrEqual(Math.max(cross(prev, wrap(gap_prev)), cross(next, wrap(gap_next))) + a.radius - 1e-6);
  });
});

test("a straight road through a T keeps its far rim: the patch walks it point for point", () => {
  const arms = [arm(0, 6), arm(90, 5), arm(180, 6)];
  arms[1].rank = -1;
  const patch = junction_patch(0, 0, arms);
  if (!patch) throw new Error("no patch");
  const far = patch.outline.filter((p) => p.z < -5);
  expect(far.length).toBeGreaterThan(0);
  for (const p of far) expect(p.z).toBeCloseTo(-6, 9);
  expect(patch.minor).toEqual([1]);
});

test("every spur junction on seeds 0-2 gets a patch, and each faces up", () => {
  for (const seed of [0, 1, 2]) {
    const data = generate(seed);
    const { patched } = road_junctions(data);
    const spurs = data.graph.edges.filter((e) => e.kind === "highway" && !data.circuit.includes(e.id)).length;
    expect(patched.filter((j) => j.arms.some((a) => a.rank === 2)).length).toBe(spurs);
    for (const { patch } of patched) expect(faces_up(patch)).toBe(true);
  }
});
