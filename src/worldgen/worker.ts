import type { Planted } from "./biomes";
import { chunk_corner, CHUNK, extent, type Extent } from "./chunk-grid";
import { chunk_meshes, chunk_transfers, type ChunkBuffers, type MeshTones } from "./chunks";
import { generate_world, KINDS } from "./kinds/kinds";
import { TileMesher } from "./tile-mesher";
import { slice_tile, tile_transfers, type Tile } from "./tiles";
import { SPAWN_INDEX, type WorldData, type WorldKind } from "./types";

export interface GenRequest {
  type: "gen";
  seed: number;
  kind: WorldKind;
}

/** The plan needs no colours, so it starts before the page has read its theme; chunks wait for these. */
export interface TonesRequest {
  type: "tones";
  tones: MeshTones;
}

export interface FocusRequest {
  type: "focus";
  x: number;
  z: number;
}

/** A chunk again, after the main side dropped it. */
export interface ChunkRequest {
  type: "chunk";
  index: number;
}

export type WorkerRequest = GenRequest | TonesRequest | FocusRequest | ChunkRequest;

export type WorkerReply =
  /** Everything but the terrain grids, which arrive tile by tile. */
  | { type: "plan"; data: WorldData }
  /** `planted`: a streamed chunk's own trees and their solids; a compact world's come with its plan. */
  | { type: "chunk"; index: number; tile: Tile; chunk: ChunkBuffers | null; planted: Planted | null }
  /** Generation or meshing threw: before the plan the load fails, after it every wait on a missing chunk does. */
  | { type: "error"; message: string };

let focus: [number, number] = [0, 0];
let world: { ext: Extent; build: (index: number) => { tile: Tile; chunk: ChunkBuffers | null; planted: Planted | null } } | null = null;
let plan: { data: WorldData; kind: WorldKind } | null = null;
let tones: MeshTones | null = null;
const left: number[] = [];
let pumping = false;

function nearest(ext: Extent): number {
  let best = 0;
  let dist = Infinity;
  left.forEach((index, at) => {
    const [x0, z0] = chunk_corner(index, ext);
    const dx = x0 + CHUNK / 2 - focus[0];
    const dz = z0 + CHUNK / 2 - focus[1];
    const d = dx * dx + dz * dz;
    if (d < dist) {
      dist = d;
      best = at;
    }
  });
  return left.splice(best, 1)[0];
}

function fail(error: unknown) {
  postMessage({ type: "error", message: error instanceof Error ? (error.stack ?? error.message) : String(error) } satisfies WorkerReply);
}

function open({ seed, kind }: GenRequest) {
  const data = generate_world(seed, kind);
  const spawn = data.road.at(SPAWN_INDEX) ?? data.road[0];
  if (spawn) focus = [spawn.x, spawn.z];
  const empty = { heights: new Float32Array(0), road_dist: new Float32Array(0), surface: new Uint8Array(0) };
  postMessage({ type: "plan", data: { ...data, terrain: { ...data.terrain, ...empty }, ground: { ...data.ground, ops: [] } } } satisfies WorkerReply);
  plan = { data, kind };
  mesh();
}

function mesh() {
  if (!plan || !tones) return;
  const { data, kind } = plan;
  plan = null;
  const ext = extent(KINDS[kind].size);
  if (!data.terrain.heights.length) world = { ext, build: streamed(data, ext, tones) };
  else {
    world = { ext, build: compact(data, tones) };
    for (let index = 0; index < ext.side * ext.side; index++) left.push(index);
  }
}

// A compact kind keeps its whole grid, so slicing is free; a streamed one (mainland) builds each tile from its plan.
function compact(data: WorldData, tones: MeshTones) {
  const mesh = chunk_meshes(data, tones);
  return (index: number) => ({ tile: slice_tile(data.terrain, index), chunk: mesh(index), planted: null });
}

function streamed(data: WorldData, ext: Extent, tones: MeshTones) {
  const mesher = new TileMesher(data, ext, tones);
  return (index: number) => mesher.build(index);
}

async function pump() {
  if (pumping || !world) return;
  pumping = true;
  // A turn of the event loop before each chunk lets a focus or a batch of chunk requests reorder what is left.
  for (;;) {
    await new Promise((next) => setTimeout(next, 0));
    if (!left.length) break;
    const index = nearest(world.ext);
    const { tile, chunk, planted } = world.build(index);
    postMessage({ type: "chunk", index, tile, chunk, planted } satisfies WorkerReply, { transfer: [...tile_transfers(tile), ...(chunk ? chunk_transfers([chunk]) : [])] });
  }
  pumping = false;
}

addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "focus") focus = [request.x, request.z];
    else if (request.type === "chunk") {
      left.push(request.index);
    } else if (request.type === "tones") {
      tones = request.tones;
      mesh();
    } else open(request);
    pump().catch(fail);
  } catch (error) {
    fail(error);
  }
});
