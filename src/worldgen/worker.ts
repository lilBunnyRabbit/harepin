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
  opts?: string;
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

export type WorkerRequest = GenRequest | FocusRequest | ChunkRequest;

export type WorkerReply =
  /** Everything but the terrain grids, which arrive tile by tile. */
  | { type: "plan"; data: WorldData }
  | { type: "chunk"; index: number; tile: Tile; chunk: ChunkBuffers | null }
  /** Generation or meshing threw: before the plan the load fails, after it every wait on a missing chunk does. */
  | { type: "error"; message: string };

let focus: [number, number] = [0, 0];
let world: { ext: Extent; build: (index: number) => { tile: Tile; chunk: ChunkBuffers | null } } | null = null;
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

function open({ seed, kind, opts = "", tones }: GenRequest) {
  const data = generate_world(seed, kind, opts);
  const spawn = data.road.at(SPAWN_INDEX) ?? data.road[0];
  if (spawn) focus = [spawn.x, spawn.z];
  const empty = { heights: new Float32Array(0), road_dist: new Float32Array(0), surface: new Uint8Array(0) };
  postMessage({ type: "plan", data: { ...data, terrain: { ...data.terrain, ...empty }, ground: { ...data.ground, ops: [] } } } satisfies WorkerReply);
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
  return (index: number) => ({ tile: slice_tile(data.terrain, index), chunk: mesh(index) });
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
    const { tile, chunk } = world.build(index);
    postMessage({ type: "chunk", index, tile, chunk } satisfies WorkerReply, { transfer: [...tile_transfers(tile), ...(chunk ? chunk_transfers([chunk]) : [])] });
  }
  pumping = false;
}

addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "focus") focus = [request.x, request.z];
    else if (request.type === "chunk") {
      left.push(request.index);
    } else open(request);
    pump().catch(fail);
  } catch (error) {
    fail(error);
  }
});
