import { extent } from "./chunk-grid";
import { BIG_DUNES } from "./recipe";
import { crossing_route } from "./routes";
import { dune_wind, land_height } from "./terrain";
import { CELL, WorldKind, type RoadPoint, type Route, type WorldData } from "./types";

export const DUNE_SEA_SIZE = 8192;
/** The spawn search walks rings this far apart out from the middle, to this far, for ground this flat. */
const SPAWN_STEP = 16;
const SPAWN_REACH = 1200;
const SPAWN_FLAT = 0.04;
const SPAWN_PAD = 8;

/**
 * The crossing runs downwind through the middle: it starts on the lowest ground this far upwind (give or take the reach)
 * and finishes on the tallest crest this far downwind, both well inside the dune wall.
 */
const CROSSING_HALF = 1500;
const CROSSING_REACH = 300;
const CROSSING_STEP = 2;
/** A crest: rising at least this up to `CREST_RUN` metres short of it, falling at least this as far past it. */
const CREST_RISE = 0.08;
const CREST_FALL = 0.3;
const CREST_RUN = 6;
/** Metres a crest gate keeps from the gate before it, and the longest stretch left without one. */
const GATE_GAP = 100;
const GATE_FILL = 450;
const CROSSING_GATE_HW = 10;
// Fitted to scripts/races.ts --world dunes: loose sand drags every car far under drive_time's road pace, the slowest most.
const CROSSING_SHARE = 3.7;

type Height = (x: number, z: number) => number;

function flat(height: Height, x: number, z: number): boolean {
  const h = height(x, z);
  for (const [dx, dz] of [[SPAWN_PAD, 0], [-SPAWN_PAD, 0], [0, SPAWN_PAD], [0, -SPAWN_PAD]]) if (Math.abs(height(x + dx, z + dz) - h) > SPAWN_FLAT * SPAWN_PAD) return false;
  return true;
}

function spawn_spot(height: Height): [number, number] {
  for (let r = 0; r <= SPAWN_REACH; r += SPAWN_STEP)
    for (let k = -r; k <= r; k += SPAWN_STEP)
      for (const [x, z] of [[k, -r], [k, r], [-r, k], [r, k]]) if (flat(height, x, z)) return [x, z];
  return [0, 0];
}

/** Whether point `i` of `ys` is a crest: the highest within `CREST_RUN`, a windward behind it and a slip face ahead. */
function crest_at(ys: readonly number[], i: number): boolean {
  const k = CREST_RUN / CROSSING_STEP;
  if (i < 2 * k || i >= ys.length - 2 * k) return false;
  for (let d = -k; d <= k; d++) if (ys[i + d] > ys[i]) return false;
  return (ys[i - k] - ys[i - 2 * k]) / CREST_RUN > CREST_RISE && (ys[i + 2 * k] - ys[i + k]) / CREST_RUN < -CREST_FALL;
}

/**
 * One way downwind across the dune sea, a straight line through the middle: from a corridor floor up and over every
 * dune in between, a gate on each crest, to the finish on the tallest crest at the far end. Every slip face on it is a
 * natural crest the dune sea's own tests land every car off.
 */
export function crossing(height: Height, wind: { x: number; z: number }): Route {
  const from = -CROSSING_HALF - CROSSING_REACH;
  const count = Math.round((2 * (CROSSING_HALF + CROSSING_REACH)) / CROSSING_STEP) + 1;
  const all: RoadPoint[] = [];
  for (let k = 0; k < count; k++) {
    const a = from + k * CROSSING_STEP;
    const x = wind.x * a;
    const z = wind.z * a;
    all.push({ x, y: height(x, z), z, tx: wind.x, tz: wind.z });
  }
  const ys = all.map((p) => p.y);
  const reach = (2 * CROSSING_REACH) / CROSSING_STEP;
  let start = 0;
  for (let i = 1; i <= reach; i++) if (ys[i] < ys[start]) start = i;
  let end = -1;
  for (let i = count - 1 - reach; i < count; i++) if (crest_at(ys, i) && (end < 0 || ys[i] > ys[end])) end = i;
  const points = all.slice(start, (end < 0 ? count - 1 : end) + 1);
  const gap = GATE_GAP / CROSSING_STEP;
  const fill = GATE_FILL / CROSSING_STEP;
  const gates: number[] = [];
  const last = points.length - 1;
  for (let i = gap; i <= last - gap; i++) {
    if (!crest_at(ys, i + start)) continue;
    const before = gates.at(-1) ?? 0;
    if (i - before < gap) continue;
    if (i - before > fill) gates.push(before + Math.round((i - before) / 2));
    gates.push(i);
  }
  const before = gates.at(-1) ?? 0;
  if (last - before > fill) gates.push(before + Math.round((last - before) / 2));
  return crossing_route(points, gates, CROSSING_GATE_HW, CROSSING_SHARE);
}

/**
 * The car starts on the flattest ground near the middle, facing downwind: up the next windward slope to a crest. The
 * "road" is that one spawn point: a single point draws no road, kerb or post, and there are no edges. The one route is
 * the crossing, raced over open sand.
 */
export function generate_dune_sea(seed: number): WorldData {
  const recipe = BIG_DUNES;
  const t0 = performance.now();
  const height = land_height(seed, recipe.terrain);
  const dunes = recipe.terrain.find((layer) => layer.kind === "dunes");
  const wind = dunes?.kind === "dunes" ? dune_wind(seed, dunes.seed) : { x: 0, z: 1 };
  const [x, z] = spawn_spot(height);
  const road: RoadPoint[] = [{ x, y: height(x, z), z, tx: wind.x, tz: wind.z }];
  const t1 = performance.now();
  const route = crossing(height, wind);
  const ext = extent(DUNE_SEA_SIZE);
  const empty = new Float32Array(0);
  return {
    kind: WorldKind.BIG_DUNES,
    deck: null,
    terrain: { seed, size: ext.size, cell: CELL, n: ext.n, heights: empty, road_dist: new Float32Array(0), surface: new Uint8Array(0) },
    ground: { base: { kind: "terrain", seed, shape: recipe.terrain }, ops: [] },
    graph: { nodes: [], edges: [] },
    towns: [],
    lots: [],
    buildings: [],
    props: [],
    parking: [],
    trees: [],
    solids: [],
    ramps: [],
    items: [],
    challenges: [],
    checkpoints: [],
    circuit: [],
    road,
    routes: [route],
    canyon: null,
    timings: [
      ["plan", t1 - t0],
      ["route", performance.now() - t1],
    ],
  };
}
