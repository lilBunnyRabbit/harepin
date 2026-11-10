import * as THREE from "three";
import type { QualityMode, QualityTier } from "./menu/prefs";

export interface Tier {
  max_ratio: number;
  bloom: boolean;
  /** Sun shadow map size in px; 0 turns shadow mapping off. */
  shadow_size: number;
  fog_far: number;
}

const DESKTOP: Tier[] = [
  { max_ratio: 1.75, bloom: true, shadow_size: 2048, fog_far: 1300 },
  { max_ratio: 1, bloom: true, shadow_size: 1024, fog_far: 1300 },
  { max_ratio: 1, bloom: false, shadow_size: 0, fog_far: 1300 },
];

// The contact shadow already grounds the car, so phones skip the shadow pass and bloom entirely.
// Phones run without MSAA, so render scale is what keeps edges from stair-stepping on 2.5-3x screens.
const MOBILE: Tier[] = [
  { max_ratio: 2, bloom: false, shadow_size: 0, fog_far: 700 },
  { max_ratio: 1.4, bloom: false, shadow_size: 0, fog_far: 700 },
  { max_ratio: 0.85, bloom: false, shadow_size: 0, fog_far: 700 },
];

const DESKTOP_LEVELS: Record<QualityTier, number> = { high: 0, medium: 1, low: 2 };
const MOBILE_LEVELS: Record<QualityTier, number> = { high: 0, medium: 1, low: 2 };

const SLOW_FRAME = 1 / 45;
const WINDOW_SECONDS = 3;
const SLOW_SHARE = 0.6;
const WARMUP_SECONDS = 4;

export class Quality {
  /** Decided before the renderer exists: `antialias` is fixed at WebGL context creation. */
  readonly mobile: boolean;
  level = 0;
  private tiers: Tier[];
  private sampled = -WARMUP_SECONDS;
  private slow_time = 0;
  private mode: QualityMode = "auto";

  constructor(params: URLSearchParams, mode: QualityMode) {
    this.mobile = params.get("quality") === "low" || matchMedia("(pointer: coarse)").matches;
    this.tiers = this.mobile ? MOBILE : DESKTOP;
    this.set_mode(mode);
  }

  /** A fixed tier stops adapting; auto starts again from the top and steps down when frames run slow. */
  set_mode(mode: QualityMode) {
    this.mode = mode;
    this.level = mode === "auto" ? 0 : (this.mobile ? MOBILE_LEVELS : DESKTOP_LEVELS)[mode];
    this.sampled = -WARMUP_SECONDS;
    this.slow_time = 0;
  }

  get tier_name(): QualityTier {
    return this.level === 0 ? "high" : this.level === 1 ? "medium" : "low";
  }

  get tier(): Tier {
    return this.tiers[this.level];
  }

  get antialias() {
    return !this.mobile;
  }

  get ratio() {
    return Math.min(devicePixelRatio, this.tier.max_ratio);
  }

  step(): boolean {
    if (this.level >= this.tiers.length - 1) return false;
    this.level++;
    return true;
  }

  adapt(dt: number): boolean {
    if (this.mode !== "auto" || this.level >= this.tiers.length - 1) return false;
    this.sampled += dt;
    if (this.sampled < 0) return false;
    if (dt > SLOW_FRAME) this.slow_time += dt;
    if (this.sampled < WINDOW_SECONDS) return false;
    // Step down only when most of a window ran under 45 fps, so one hitch (tab switch, GC) doesn't degrade it.
    const slow = this.slow_time / this.sampled > SLOW_SHARE;
    this.sampled = this.slow_time = 0;
    return slow && this.step();
  }

  apply(renderer: THREE.WebGLRenderer, scene: THREE.Scene, sun: THREE.DirectionalLight) {
    const { tier } = this;
    const shadows = tier.shadow_size > 0;
    if (renderer.shadowMap.enabled !== shadows) {
      renderer.shadowMap.enabled = shadows;
      // Lit shaders bake the shadow-map define in at compile time, so every material has to recompile.
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) for (const material of [object.material].flat()) material.needsUpdate = true;
      });
    }
    sun.castShadow = shadows;
    if (!shadows) {
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    } else if (sun.shadow.mapSize.x !== tier.shadow_size) {
      sun.shadow.mapSize.set(tier.shadow_size, tier.shadow_size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    if (scene.fog instanceof THREE.Fog) scene.fog.far = tier.fog_far;
  }
}
