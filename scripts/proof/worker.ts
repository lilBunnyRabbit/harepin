import { car_spec } from "../../src/car/cars";
import { World } from "../../src/world/world";
import { build_chunks } from "../../src/worldgen/chunks";
import { generate_world, KINDS } from "../../src/worldgen/kinds/kinds";
import type { WorldKind } from "../../src/worldgen/types";
import { world_digest, type Digest } from "./digest";
import { circuit_lap, drive_spurs, sky_lap, type Outcome } from "./drives";
import { MESH_TONES } from "./tones";
import { check_world } from "./world-checks";

declare const self: Worker;

const SPEC = car_spec("coupe");

export interface ProofJob {
  kind: WorldKind;
  seed: number;
  /** Map option code; empty for the plain map. */
  opts?: string;
  /** World rules (land kinds only), on top of the digest. */
  checks: boolean;
  /** Spur drives and a circuit lap on a land kind, a lap on the sky track. */
  drives: boolean;
}

export interface ProofResult {
  kind: WorldKind;
  seed: number;
  opts: string;
  digest: Digest;
  gen_ms: number;
  mesh_ms: number;
  stages: [string, number][];
  world: string[] | null;
  spurs: Outcome[] | null;
  lap: Outcome | null;
}

self.onmessage = (event: MessageEvent<ProofJob>) => {
  const { kind, seed, opts = "", checks, drives } = event.data;
  const t0 = performance.now();
  const data = generate_world(seed, kind, opts);
  const t1 = performance.now();
  const chunks = build_chunks(data, MESH_TONES);
  const mesh_ms = performance.now() - t1;
  const digest = world_digest(data, chunks);
  const land = KINDS[kind].ground;
  let world: string[] | null = null;
  if (checks && land) {
    const found: string[] = [];
    check_world(data, chunks, (what) => found.push(what));
    world = found;
  }
  let spurs: Outcome[] | null = null;
  let lap: Outcome | null = null;
  if (drives) {
    const live = new World(seed, data);
    spurs = land ? drive_spurs(live, SPEC) : null;
    lap = land ? circuit_lap(live, SPEC) : sky_lap(live, SPEC);
  }
  const result: ProofResult = { kind, seed, opts, digest, gen_ms: t1 - t0, mesh_ms, stages: data.timings, world, spurs, lap };
  postMessage(result);
};
