import * as THREE from "three";
import { ride_height, type Car } from "./car";
import { COUPE, car_sized } from "./cars";
import { camera_fade, car_view, dispose_car_view, rest_wheels, type CarView } from "./models";
import { brand, color } from "../theme/palette";
import { world_key } from "../worldgen/kinds/kinds";
import { STRIDE, is_lap, lap_cap_ms } from "./ghost-cap";

const EVERY_MS = 100;
const GHOST_OPACITY = 0.32;
const GHOST_ORDER = 10;

function load(key: string): number[] | null {
  let saved: string | null;
  try {
    saved = localStorage.getItem(key);
  } catch (error) {
    console.warn("ghost: saved lap unreadable", error);
    return null;
  }
  if (!saved) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch (error) {
    console.warn("ghost: saved lap is not JSON, ignoring it", error);
    return null;
  }
  if (is_lap(parsed)) return parsed;
  console.warn("ghost: saved lap has the wrong shape, ignoring it");
  return null;
}

// The ghost is always drawn as a stock coupe, so a bigger body is recorded at the coupe's ride height: a bus lap's ghost
// runs on the road instead of floating a metre up.
export function ghost_frame(out: number[], lap_ms: number, car: Pick<Car, "pos" | "quat" | "spec">) {
  const y = car_sized(car.spec) ? car.pos.y : car.pos.y - (ride_height(car.spec) - ride_height(COUPE));
  out.push(lap_ms, car.pos.x, y, car.pos.z, car.quat.x, car.quat.y, car.quat.z, car.quat.w);
}

export const GHOST_EVERY_MS = EVERY_MS;

function lap_span(lap: readonly number[], lap_ms: number): [number, number, number] {
  let lo = 0;
  let hi = lap.length / STRIDE - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lap[mid * STRIDE] <= lap_ms) lo = mid;
    else hi = mid;
  }
  const i = lo * STRIDE;
  const j = hi * STRIDE;
  return [i, j, lap[j] > lap[i] ? Math.max(0, Math.min(1, (lap_ms - lap[i]) / (lap[j] - lap[i]))) : 0];
}

const from_quat = new THREE.Quaternion();
const to_quat = new THREE.Quaternion();

/** The lap's car at `lap_ms`, between its two nearest frames; false past the lap's end. */
export function lap_pose(lap: readonly number[], lap_ms: number, pos: THREE.Vector3, quat: THREE.Quaternion): boolean {
  if (lap_ms > lap[lap.length - STRIDE]) return false;
  const [i, j, k] = lap_span(lap, lap_ms);
  pos.set(lap[i + 1] + (lap[j + 1] - lap[i + 1]) * k, lap[i + 2] + (lap[j + 2] - lap[i + 2]) * k, lap[i + 3] + (lap[j + 3] - lap[i + 3]) * k);
  from_quat.set(lap[i + 4], lap[i + 5], lap[i + 6], lap[i + 7]);
  to_quat.set(lap[j + 4], lap[j + 5], lap[j + 6], lap[j + 7]);
  quat.copy(from_quat.slerp(to_quat, k));
  return true;
}

export class Ghost {
  visible = true;
  private recording: number[] = [];
  private best: number[] | null = null;
  private view: CarView;
  private readonly tint: THREE.MeshBasicMaterial;

  private readonly key: string;
  private readonly cap_ms: number;

  constructor(scene: THREE.Scene, seed = 0, key = `harepin:ghost:${world_key(seed)}`, lap_m = 0) {
    this.key = key;
    this.cap_ms = lap_cap_ms(lap_m);
    this.best = load(this.key);
    this.view = car_view(color(brand.cottontail));
    // Unlit and single-layer: a depth-only copy of every part draws first, so only the nearest face gets tinted.
    // Lit, emissive or stacked faces pushed the pale paint past the bloom threshold.
    const depth = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true });
    const tint = new THREE.MeshBasicMaterial({ color: color(brand.cottontail), transparent: true, opacity: GHOST_OPACITY });
    this.tint = tint;
    const meshes: THREE.Mesh[] = [];
    this.view.root.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    for (const mesh of meshes) {
      mesh.castShadow = false;
      mesh.material = tint;
      mesh.renderOrder = GHOST_ORDER + 1;
      const mask = new THREE.Mesh(mesh.geometry, depth);
      mask.renderOrder = GHOST_ORDER;
      mask.position.copy(mesh.position);
      mask.quaternion.copy(mesh.quaternion);
      mask.scale.copy(mesh.scale);
      mesh.parent?.add(mask);
    }
    rest_wheels(this.view);
    this.view.root.visible = false;
    scene.add(this.view.root);
  }

  start() {
    this.recording = [];
  }

  get has_best(): boolean {
    return this.best !== null;
  }

  /** The raced lap's time, null without one. */
  get best_ms(): number | null {
    return this.best ? this.best[this.best.length - STRIDE] : null;
  }

  /** Races a lap made elsewhere, such as a shipped dev ghost, until a run of the player's own replaces it. */
  use(lap: number[]) {
    this.best = lap;
  }

  record(lap_ms: number, car: Pick<Car, "pos" | "quat" | "spec">) {
    const last = this.recording.length ? this.recording[this.recording.length - STRIDE] : -Infinity;
    if (lap_ms - last < EVERY_MS || lap_ms > this.cap_ms) return;
    ghost_frame(this.recording, lap_ms, car);
  }

  rewind_to(lap_ms: number) {
    let end = this.recording.length;
    while (end > 0 && this.recording[end - STRIDE] > lap_ms) end -= STRIDE;
    this.recording.length = end;
  }

  finish(improved: boolean) {
    if (!improved || !this.recording.length) return;
    this.best = this.recording;
    try {
      localStorage.setItem(this.key, JSON.stringify(this.best.map((v) => Math.round(v * 1000) / 1000)));
    } catch (error) {
      console.warn("ghost: best lap not saved", error);
    }
  }

  position(lap_ms: number, out: THREE.Vector3): THREE.Vector3 | null {
    const best = this.best;
    if (!best || lap_ms > best[best.length - STRIDE]) return null;
    const [i, j, k] = lap_span(best, lap_ms);
    return out.set(best[i + 1] + (best[j + 1] - best[i + 1]) * k, best[i + 2] + (best[j + 2] - best[i + 2]) * k, best[i + 3] + (best[j + 3] - best[i + 3]) * k);
  }

  update(lap_ms: number | null, camera: THREE.Vector3) {
    const best = this.best;
    const root = this.view.root;
    if (!best || lap_ms === null || !this.visible || !lap_pose(best, lap_ms, root.position, root.quaternion)) {
      root.visible = false;
      return;
    }
    const fade = camera_fade(root.position, camera);
    this.tint.opacity = GHOST_OPACITY * fade;
    root.visible = fade > 0;
  }

  dispose() {
    this.view.root.removeFromParent();
    dispose_car_view(this.view);
  }
}
