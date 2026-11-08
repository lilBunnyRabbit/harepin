import { sample } from "../src/worldgen/field";
import { generate } from "../src/worldgen/index";
import { APPROACH } from "../src/worldgen/route";
import { SPUR_GRADE, type RoadEdge, type RoadPoint, type WorldData } from "../src/worldgen/types";

const SEEDS = Number(process.argv[2] ?? 100);
const GROUND = 0.3;
const GRADE_RUN = 5;
const SMALL = 2;
const T_ANGLE = 0.5;
const PAD_STEP = 2;

interface Failure {
  seed: number;
  what: string;
}

function crosses(a: RoadPoint, b: RoadPoint, c: RoadPoint, d: RoadPoint): boolean {
  const o = (p: RoadPoint, q: RoadPoint, r: RoadPoint) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

function local(frame: { x: number; z: number; fx: number; fz: number }, lx: number, lz: number): [number, number] {
  return [frame.x + frame.fz * lx + frame.fx * lz, frame.z - frame.fx * lx + frame.fz * lz];
}

function check(seed: number, data: WorldData, fail: (what: string) => void) {
  const h = data.terrain.heights;
  const { edges, nodes } = data.graph;
  const spurs = edges.filter((e) => e.kind === "highway" && !e.closed);

  for (const spur of spurs) {
    const p = spur.points;
    const along = [0];
    for (let i = 1; i < p.length; i++) along.push(along[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z));
    let worst = 0;
    for (let i = GRADE_RUN; i < p.length; i++) worst = Math.max(worst, Math.abs(p[i].y - p[i - GRADE_RUN].y) / (along[i] - along[i - GRADE_RUN]));
    if (worst > SPUR_GRADE) fail(`spur ${spur.id} grade ${(worst * 100).toFixed(0)}%`);
    const gate = nodes[spur.a];
    if (Math.abs(p[0].y - gate.y) > 0.01) fail(`spur ${spur.id} starts ${(p[0].y - gate.y).toFixed(2)} m off its gate`);
    const end = p[p.length - 1];
    const back = p[p.length - 1 - Math.round(APPROACH / 4)];
    const ring = data.road.reduce((best, q) => (Math.hypot(q.x - end.x, q.z - end.z) < Math.hypot(best.x - end.x, best.z - end.z) ? q : best));
    const dx = end.x - back.x;
    const dz = end.z - back.z;
    if (Math.abs(dx * ring.tx + dz * ring.tz) / Math.hypot(dx, dz) > T_ANGLE) fail(`spur ${spur.id} meets the ring at a shallow angle`);
    for (const other of edges) {
      if (other === spur || [other.a, other.b].some((n) => n === spur.a || n === spur.b)) continue;
      if (crossing(spur, other)) fail(`spur ${spur.id} crosses ${other.closed ? "the ring" : `edge ${other.id}`} without a junction`);
    }
  }

  for (const solid of data.solids) {
    if (solid.kind === "circle") {
      const off = sample(h, solid.x, solid.z) - solid.y;
      if (Math.abs(off) > GROUND) fail(`circle solid at ${solid.x.toFixed(0)},${solid.z.toFixed(0)} base ${off.toFixed(2)} m off the ground`);
      continue;
    }
    const ys = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => sample(h, solid.x + (sx * solid.hw * solid.cos + sz * solid.hd * solid.sin), solid.z + (-sx * solid.hw * solid.sin + sz * solid.hd * solid.cos))));
    const low = Math.min(...ys) - solid.y;
    const high = Math.max(...ys, sample(h, solid.x, solid.z)) - solid.y;
    if (low < -GROUND) fail(`box solid at ${solid.x.toFixed(0)},${solid.z.toFixed(0)} floats ${(-low).toFixed(2)} m`);
    if (solid.height < SMALL && high > GROUND) fail(`box solid at ${solid.x.toFixed(0)},${solid.z.toFixed(0)} buried ${high.toFixed(2)} m`);
  }

  for (const b of data.buildings) {
    let low = Infinity;
    for (const [lx, lz] of [
      [-b.hw, -b.hd],
      [b.hw, -b.hd],
      [-b.hw, b.hd],
      [b.hw, b.hd],
    ])
      low = Math.min(low, sample(h, ...local(b, lx, lz)) - b.y);
    if (low < -GROUND) fail(`building of lot ${b.lot} corner floats ${(-low).toFixed(2)} m`);
  }

  for (const lot of data.parking) {
    const frame = data.lots[lot.lot];
    const { w, d } = lot.size;
    const corner = (lx: number, lz: number) => sample(h, ...local(frame, lx, lz));
    const c00 = corner(-w / 2, -d / 2);
    const c10 = corner(w / 2, -d / 2);
    const c01 = corner(-w / 2, d / 2);
    const c11 = corner(w / 2, d / 2);
    let worst = 0;
    for (let lz = -d / 2; lz <= d / 2; lz += PAD_STEP)
      for (let lx = -w / 2; lx <= w / 2; lx += PAD_STEP) {
        const u = lx / w + 0.5;
        const v = lz / d + 0.5;
        const pad = (c00 * (1 - u) + c10 * u) * (1 - v) + (c01 * (1 - u) + c11 * u) * v;
        worst = Math.max(worst, sample(h, ...local(frame, lx, lz)) - pad);
      }
    if (worst > GROUND) fail(`parking pad of lot ${lot.lot} buried ${worst.toFixed(2)} m`);
  }
}

function crossing(spur: RoadEdge, other: RoadEdge): boolean {
  const P = other.points;
  const Q = spur.points;
  const segments = other.closed ? P.length : P.length - 1;
  for (let j = 1; j < Q.length - 2; j++)
    for (let i = 0; i < segments; i++) if (crosses(P[i], P[(i + 1) % P.length], Q[j], Q[j + 1])) return true;
  return false;
}

const failures: Failure[] = [];
let slowest = 0;
let slowest_seed = 0;
let total = 0;
let towns = 0;
let linked = 0;
let lots = 0;
let buildings = 0;
const stages = new Map<string, number>();
const t0 = performance.now();
for (let seed = 0; seed < SEEDS; seed++) {
  const t = performance.now();
  const data = generate(seed);
  const ms = performance.now() - t;
  total += ms;
  if (ms > slowest) {
    slowest = ms;
    slowest_seed = seed;
  }
  for (const [stage, stage_ms] of data.timings) stages.set(stage, Math.max(stages.get(stage) ?? 0, stage_ms));
  towns += data.towns.length;
  linked += data.graph.edges.filter((e) => e.kind === "highway" && !e.closed).length;
  lots += data.lots.length;
  buildings += data.buildings.length;
  check(seed, data, (what) => failures.push({ seed, what }));
}
console.log(
  `${SEEDS} seeds in ${((performance.now() - t0) / 1000).toFixed(1)} s, gen mean ${(total / SEEDS).toFixed(0)} ms, slowest ${slowest.toFixed(0)} ms (seed ${slowest_seed}); stage max ms: ${[...stages].map(([s, ms]) => `${s} ${ms.toFixed(0)}`).join(", ")}`,
);
console.log(`towns ${towns}, with spur ${linked}, lots ${lots}, buildings ${buildings}`);
const kinds = new Map<string, number>();
for (const f of failures) {
  const kind = f.what.replace(/[-\d.,]+/g, "#");
  kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
}
for (const [kind, count] of kinds) console.log(`  ${count} x ${kind}  e.g. seed ${failures.find((f) => f.what.replace(/[-\d.,]+/g, "#") === kind)?.seed}: ${failures.find((f) => f.what.replace(/[-\d.,]+/g, "#") === kind)?.what}`);
if (failures.length) throw new Error(`${failures.length} world checks failed`);
console.log("all world checks pass");
