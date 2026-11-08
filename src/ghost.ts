import * as THREE from "three";
import type { Car } from "./car";
import { car_view, type CarView } from "./models";
import { brand, color } from "./palette";

const KEY = "harepin:ghost";
const STRIDE = 8;
const EVERY_MS = 100;

function is_lap(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length < STRIDE || value.length % STRIDE !== 0) return false;
  if (!value.every((v) => typeof v === "number" && Number.isFinite(v))) return false;
  for (let i = STRIDE; i < value.length; i += STRIDE) if (value[i] < value[i - STRIDE]) return false;
  return true;
}

function load(): number[] | null {
  let saved: string | null;
  try {
    saved = localStorage.getItem(KEY);
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

export class Ghost {
  visible = true;
  private recording: number[] = [];
  private best: number[] | null = null;
  private view: CarView;
  private a = new THREE.Quaternion();
  private b = new THREE.Quaternion();

  constructor(scene: THREE.Scene) {
    this.best = load();
    this.view = car_view(color(brand.cottontail));
    this.view.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = false;
      object.material = (object.material as THREE.Material).clone();
      Object.assign(object.material, { transparent: true, opacity: 0.32, depthWrite: false });
    });
    this.view.wheels.forEach((wheel, i) => wheel.position.set(i % 2 === 0 ? 0.84 : -0.84, -0.15, i < 2 ? 1.3 : -1.3));
    this.view.root.visible = false;
    scene.add(this.view.root);
  }

  start() {
    this.recording = [];
  }

  record(lap_ms: number, car: Car) {
    const last = this.recording.length ? this.recording[this.recording.length - STRIDE] : -Infinity;
    if (lap_ms - last < EVERY_MS) return;
    this.recording.push(lap_ms, car.pos.x, car.pos.y, car.pos.z, car.quat.x, car.quat.y, car.quat.z, car.quat.w);
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
      localStorage.setItem(KEY, JSON.stringify(this.best.map((v) => Math.round(v * 1000) / 1000)));
    } catch (error) {
      console.warn("ghost: best lap not saved", error);
    }
  }

  update(lap_ms: number | null) {
    const best = this.best;
    const root = this.view.root;
    if (!best || lap_ms === null || !this.visible || lap_ms > best[best.length - STRIDE]) {
      root.visible = false;
      return;
    }
    let lo = 0;
    let hi = best.length / STRIDE - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (best[mid * STRIDE] <= lap_ms) lo = mid;
      else hi = mid;
    }
    const i = lo * STRIDE;
    const j = hi * STRIDE;
    const k = best[j] > best[i] ? Math.max(0, Math.min(1, (lap_ms - best[i]) / (best[j] - best[i]))) : 0;
    root.position.set(
      best[i + 1] + (best[j + 1] - best[i + 1]) * k,
      best[i + 2] + (best[j + 2] - best[i + 2]) * k,
      best[i + 3] + (best[j + 3] - best[i + 3]) * k,
    );
    this.a.set(best[i + 4], best[i + 5], best[i + 6], best[i + 7]);
    this.b.set(best[j + 4], best[j + 5], best[j + 6], best[j + 7]);
    root.quaternion.copy(this.a.slerp(this.b, k));
    root.visible = true;
  }
}
