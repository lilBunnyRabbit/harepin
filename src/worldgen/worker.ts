import { CHUNK, CHUNKS } from "./chunk-grid";
import { chunk_meshes, chunk_transfers, type ChunkBuffers, type MeshTones } from "./chunks";
import { generate_world } from "./kinds/kinds";
import { build_tile } from "./ground";
import { tile_transfers, type Tile } from "./tiles";
import { ORIGIN, SPAWN_INDEX, type WorldData, type WorldKind } from "./types";

export interface GenRequest {
  type: "gen";
  seed: number;
  kind: WorldKind;
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
let world: { data: WorldData; build: (index: number) => ChunkBuffers | null } | null = null;
const left: number[] = [];
let pumping = false;

function nearest(): number {
  let best = 0;
  let dist = Infinity;
  left.forEach((index, at) => {
    const dx = ORIGIN + ((index % CHUNKS) + 0.5) * CHUNK - focus[0];
    const dz = ORIGIN + (Math.floor(index / CHUNKS) + 0.5) * CHUNK - focus[1];
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

function open({ seed, kind, tones }: GenRequest) {
  const data = generate_world(seed, kind);
  const spawn = data.road.at(SPAWN_INDEX) ?? data.road[0];
  if (spawn) focus = [spawn.x, spawn.z];
  const empty = { heights: new Float32Array(0), road_dist: new Float32Array(0), surface: new Uint8Array(0) };
  postMessage({ type: "plan", data: { ...data, terrain: { ...data.terrain, ...empty }, ground: { ...data.ground, ops: [] } } } satisfies WorkerReply);
  world = { data, build: chunk_meshes(data, tones) };
  for (let index = 0; index < CHUNKS * CHUNKS; index++) left.push(index);
}

// Each tile is rebuilt from the plan, so a chunk dropped on the main side can be asked for again at any time.
async function pump() {
  if (pumping || !world) return;
  pumping = true;
  while (left.length) {
    const index = nearest();
    const tile = build_tile(world.data.ground, index);
    const chunk = world.build(index);
    postMessage({ type: "chunk", index, tile, chunk } satisfies WorkerReply, { transfer: [...tile_transfers(tile), ...(chunk ? chunk_transfers([chunk]) : [])] });
    // A turn of the event loop between chunks lets a focus or chunk request reorder what is left.
    await new Promise((next) => setTimeout(next, 0));
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
