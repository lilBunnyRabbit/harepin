import { build_chunks, JITTER_LEVELS, TERRAIN_BASES, type MeshTones } from "../src/worldgen/chunks";
import { sample } from "../src/worldgen/field";
import { BYPASS, challenge_outer, challenge_pieces, DECK_DRIFT, face_end, flight, GATE_CLEAR, ITEMS, ramp_local, ramp_world, RUN_DRIFT } from "../src/worldgen/jumps";
import { seed_of } from "../src/rng";
import { spur_edges } from "../src/worldgen/graph";
import { generate } from "../src/worldgen/index";
import { APPROACH } from "../src/worldgen/route";
import { SPAWN_INDEX, SPUR_GRADE, ROAD_HALF, type Challenge, type Ramp, type RoadEdge, type RoadPoint, type Solid, type WorldData } from "../src/worldgen/types";

const SEEDS = [...Array(Number(process.argv[2] ?? 100)).keys(), seed_of("lobby")];
const GROUND = 0.3;
const GRADE_RUN = 5;
const SMALL = 2;
const T_ANGLE = 0.5;
const PAD_STEP = 2;
/** Terrain may rise this far above the road mesh before it shows through; the surface rides 0.07-0.09 m up. */
const POKE = 0.05;
const POKE_STEPS = 6;
/** Float32 positions leave slivers this big (m^2) with either winding. */
const FOLD_AREA = 1e-4;
// Each tone is a tag: the check reads the layer of every triangle back from its red channel.
const ASPHALT = 1;
const TAGS: MeshTones = {
  terrain: new Float32Array(TERRAIN_BASES * JITTER_LEVELS * 3),
  asphalt: [ASPHALT, 0, 0],
  sidewalk: [2, 0, 0],
  line: [3, 0, 0],
  edge_line: [4, 0, 0],
  walls: [[0, 0, 0]],
  roofs: [[0, 0, 0]],
  roof_flat: [0, 0, 0],
  landmark: { pale: [0, 0, 0], band: [0, 0, 0], cap: [0, 0, 0], stone: [0, 0, 0], stone_shade: [0, 0, 0] },
  deck: { deck: [0, 0, 0], side: [0, 0, 0], rail: [0, 0, 0], joint: [0, 0, 0], pad: [0, 0, 0], chevron: [0, 0, 0] },
};
const LAYER = ["", "asphalt", "sidewalk", "centre line", "edge line"];

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
  const spurs = spur_edges(data.graph, data.circuit);

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
      const on_circuit = data.circuit.includes(other.id);
      if (other === spur || (!on_circuit && [other.a, other.b].some((n) => n === spur.a || n === spur.b))) continue;
      if (crossing(spur, other)) fail(`spur ${spur.id} crosses ${on_circuit ? "the ring" : `edge ${other.id}`} without a junction`);
    }
  }

  for (const solid of data.solids) {
    if (solid.kind === "circle") {
      const off = sample(h, solid.x, solid.z) - solid.y;
      if (Math.abs(off) > GROUND) fail(`circle solid at ${solid.x.toFixed(0)},${solid.z.toFixed(0)} base ${off.toFixed(2)} m off the ground`);
      continue;
    }
    if (solid.bottom !== undefined) continue;
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

  check_road_mesh(data, fail);
  check_jumps(data, fail);
}

const RAMP_ROAD = 2;
const RUNUP = 25;
/** Body reach below and above the car's centre of mass, with margin, that has to fit the opening on the design flight. */
const BODY_LOW = 0.35;
const BODY_HIGH = 1;

function check_jumps(data: WorldData, fail: (what: string) => void) {
  const { heights, road_dist } = data.terrain;
  const road = (x: number, z: number) => sample(road_dist, x, z);
  const gates = [...data.checkpoints, data.road[(SPAWN_INDEX + data.road.length) % data.road.length]];
  const own = (s: Solid, r: Ramp) => s.kind === "box" && s.bottom !== undefined && data.challenges.some((c) => c.ramp === r.id && Math.hypot(c.x - s.x, c.z - s.z) < 10);
  const reach = (s: Solid) => (s.kind === "circle" ? s.radius : Math.hypot(s.hw, s.hd));
  for (const r of data.ramps) {
    const at = `${r.kind} ramp ${r.id} at ${r.x.toFixed(0)},${r.z.toFixed(0)}`;
    const wide = r.hw + r.rise;
    const lip = r.length + r.rise;
    if (r.road) {
      const n = data.road.length;
      const toe = data.road.reduce((best, p, i) => (Math.hypot(p.x - r.x, p.z - r.z) < Math.hypot(data.road[best].x - r.x, data.road[best].z - r.z) ? i : best), 0);
      for (let k = -RUNUP; k < n; k++) {
        const p = data.road[(toe + k + n) % n];
        const [u, v] = ramp_local(r, p.x, p.z);
        if (v > r.length + r.landing) break;
        if (v < -RUNUP) continue;
        if (Math.abs(u) > (v >= 0 && v <= face_end(r) ? DECK_DRIFT : RUN_DRIFT) + 0.1) return fail(`${at} leaves the circuit ${Math.abs(u).toFixed(1)} m off its line`);
        if (gates.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < GATE_CLEAR - 1)) return fail(`${at} runs through a checkpoint or the start grid`);
      }
    } else
      for (let v = 0; v <= lip; v += 1)
        for (let u = -wide; u <= wide; u += 1) {
          const [x, z] = ramp_world(r, u, v);
          if (road(x, z) < ROAD_HALF + RAMP_ROAD) return fail(`${at} sits on the road`);
        }
    for (let v = lip; v <= r.length + r.landing; v += 1)
      for (let u = -r.hw - 3; u <= r.hw + 3; u += 1) {
        const [x, z] = ramp_world(r, u, v);
        if (!r.road && road(x, z) < ROAD_HALF + 1) return fail(`${at} lands on the road`);
        if (sample(heights, x, z) < 2.5) return fail(`${at} lands in water`);
      }
    for (const s of data.solids) {
      if (own(s, r)) continue;
      const [u, v] = ramp_local(r, s.x, s.z);
      const side = Math.abs(u) - reach(s);
      if (side < r.hw + 2 && v + reach(s) > -RUNUP && v - reach(s) < r.length + r.landing) return fail(`${at} has a solid in its run-up, flight or landing at ${s.x.toFixed(0)},${s.z.toFixed(0)}`);
    }
    for (const b of data.buildings) {
      const [u, v] = ramp_local(r, b.x, b.z);
      if (Math.abs(u) < r.hw + 2 + Math.hypot(b.hw, b.hd) && v > -RUNUP && v < r.length + r.landing) return fail(`${at} lands on a building`);
    }
  }
  for (const c of data.challenges) {
    const r = data.ramps[c.ramp];
    const [, v] = ramp_local(r, c.x, c.z);
    const com = flight(r, r.speed, v - r.length) - c.y;
    if (com - BODY_LOW < c.gap_bottom || com + BODY_HIGH > c.gap_top) fail(`${c.kind} challenge ${c.id}: the design flight (${com.toFixed(2)} m) misses its opening ${c.gap_bottom.toFixed(2)}-${c.gap_top.toFixed(2)} m`);
    if (r.road) {
      if ((c.kind === "wall" || c.kind === "bar") && !bypassed(data, c)) fail(`${c.kind} challenge ${c.id} closes the circuit with no way round`);
      continue;
    }
    for (const p of challenge_pieces(c))
      for (const lx of [p.lx - p.hw, p.lx + p.hw]) {
        const x = c.x + c.fz * lx;
        const z = c.z - c.fx * lx;
        if (road(x, z) < ROAD_HALF + RAMP_ROAD) fail(`${c.kind} challenge ${c.id} sits on the road`);
      }
  }
  for (const item of data.items) {
    const r = ITEMS[item.kind].r * item.scale;
    if (road(item.x, item.z) >= ROAD_HALF + r + 1) continue;
    if (!item.light) fail(`${item.kind} at ${item.x.toFixed(0)},${item.z.toFixed(0)} sits on the road`);
    else if (gates.some((c) => Math.hypot(c.x - item.x, c.z - item.z) < GATE_CLEAR - 1)) fail(`${item.kind} at ${item.x.toFixed(0)},${item.z.toFixed(0)} sits on the road at a checkpoint or the start grid`);
  }
}

/** One side of the challenge has open, solid-free ground a car can drive round on. */
function bypassed(data: WorldData, c: Challenge): boolean {
  const outer = challenge_outer(c);
  return [-1, 1].some((side) => {
    const x = c.x + c.fz * side * (outer + BYPASS / 2);
    const z = c.z - c.fx * side * (outer + BYPASS / 2);
    if (sample(data.terrain.heights, x, z) < 2.5) return false;
    const blocked = data.solids.some((s) => {
      if (s.kind === "box" && s.bottom !== undefined && Math.hypot(s.x - c.x, s.z - c.z) < outer + 1) return false;
      const reach = s.kind === "circle" ? s.radius : Math.hypot(s.hw, s.hd);
      return Math.hypot(s.x - x, s.z - z) < BYPASS / 2 + reach;
    });
    return !blocked && !data.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < BYPASS / 2 + Math.hypot(b.hw, b.hd));
  });
}

// Every road triangle is wound the same way seen from above; one wound the other way is a ribbon folded over itself.
// Terrain is sampled across each asphalt triangle to catch it showing through the surface.
function check_road_mesh(data: WorldData, fail: (what: string) => void) {
  const h = data.terrain.heights;
  const folds = new Map<number, [number, number]>();
  let poke = { by: POKE, x: 0, z: 0 };
  for (const chunk of build_chunks(data, TAGS)) {
    if (!chunk.road) continue;
    const { positions: p, colors } = chunk.road;
    for (let o = 0; o < p.length; o += 9) {
      const area = (p[o + 3] - p[o]) * (p[o + 8] - p[o + 2]) - (p[o + 5] - p[o + 2]) * (p[o + 6] - p[o]);
      if (area > FOLD_AREA && !folds.has(colors[o])) folds.set(colors[o], [p[o], p[o + 2]]);
      if (colors[o] !== ASPHALT || area > -FOLD_AREA) continue;
      for (let s = 0; s <= POKE_STEPS; s++)
        for (let t = 0; s + t <= POKE_STEPS; t++) {
          const u = s / POKE_STEPS;
          const v = t / POKE_STEPS;
          const w = 1 - u - v;
          const x = p[o] * u + p[o + 3] * v + p[o + 6] * w;
          const z = p[o + 2] * u + p[o + 5] * v + p[o + 8] * w;
          const by = sample(h, x, z) - (p[o + 1] * u + p[o + 4] * v + p[o + 7] * w);
          if (by > poke.by) poke = { by, x, z };
        }
    }
  }
  for (const [tag, [x, z]] of folds) fail(`${LAYER[tag]} ribbon folds over itself at ${x.toFixed(0)},${z.toFixed(0)}`);
  if (poke.by > POKE) fail(`terrain pokes ${poke.by.toFixed(2)} m through the road at ${poke.x.toFixed(0)},${poke.z.toFixed(0)}`);
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
for (const seed of SEEDS) {
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
  linked += spur_edges(data.graph, data.circuit).length;
  lots += data.lots.length;
  buildings += data.buildings.length;
  check(seed, data, (what) => failures.push({ seed, what }));
}
console.log(
  `${SEEDS.length} seeds in ${((performance.now() - t0) / 1000).toFixed(1)} s, gen mean ${(total / SEEDS.length).toFixed(0)} ms, slowest ${slowest.toFixed(0)} ms (seed ${slowest_seed}); stage max ms: ${[...stages].map(([s, ms]) => `${s} ${ms.toFixed(0)}`).join(", ")}`,
);
console.log(`towns ${towns}, with spur ${linked}, lots ${lots}, buildings ${buildings}`);
const kinds = new Map<string, number>();
for (const f of failures) {
  const kind = f.what.replace(/[-\d.,]+/g, "#");
  kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
}
for (const [kind, count] of kinds) console.log(`  ${count} x ${kind}  e.g. seed ${failures.find((f) => f.what.replace(/[-\d.,]+/g, "#") === kind)?.seed}: ${failures.find((f) => f.what.replace(/[-\d.,]+/g, "#") === kind)?.what}`);
if (failures.length) console.log(`failing seeds: ${[...new Set(failures.map((f) => f.seed))].join(", ")}`);
if (process.argv.includes("--all")) for (const f of failures) console.log(`  seed ${f.seed}: ${f.what}`);
if (failures.length) throw new Error(`${failures.length} world checks failed`);
console.log("all world checks pass");
