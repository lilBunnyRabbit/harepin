import type { SpeedZoom } from "../menu/prefs";

const DEG = Math.PI / 180;
export const GRAVITY = 9.81;
export const BASE_FOV = 64;
// A teleport or a reset reads as one frame of huge acceleration; past this it is not a feel, it is a jump.
const G_CLAMP = 1.5;
const G_RATE = 5;
const TILT_RATE = 4;
const PITCH_PER_G = 1.2 * DEG;
const PITCH_MAX = 1.5 * DEG;
const ROLL_PER_G = 1.5 * DEG;
const ROLL_MAX = 2 * DEG;

/** Full amounts, reached at `full_speed` (m/s): `fov` and `boost` in degrees, `back`, `rise` and `pull` in metres (`pull` at 9 m/s² of acceleration). */
export interface SpeedZoomDef {
  readonly full_speed: number;
  readonly fov: number;
  readonly back: number;
  readonly rise: number;
  readonly pull: number;
  readonly boost: number;
  /** speed / full_speed (0..1) to the share of the full amount. */
  readonly curve: (t: number) => number;
}

const linear = (t: number) => t;
const smooth = (t: number) => t * t * (3 - 2 * t);

export const SPEED_ZOOM: Record<SpeedZoom, SpeedZoomDef> = {
  off: { full_speed: 1, fov: 0, back: 0, rise: 0, pull: 0, boost: 0, curve: linear },
  subtle: { full_speed: 75, fov: 7, back: 0.6, rise: 0.1, pull: 0.35, boost: 4, curve: smooth },
  strong: { full_speed: 80, fov: 24, back: 1.76, rise: 0.48, pull: 0.7, boost: 6, curve: linear },
};

export function zoom_share(def: SpeedZoomDef, speed: number): number {
  return def.curve(Math.min(1, Math.max(0, speed / def.full_speed)));
}

export function speed_fov(def: SpeedZoomDef, speed: number, boost: boolean): number {
  return BASE_FOV + def.fov * zoom_share(def, speed) + (boost ? def.boost : 0);
}

/**
 * Chase camera pitch and roll from the car's acceleration, in radians: braking dips the view, accelerating lifts it, cornering rolls it outward with the body.
 * Two first-order lags in a row (g, then angle) settle without overshoot, so the view never pumps, and smooth out the frame-to-frame jitter of raw step velocities.
 */
export class Tilt {
  pitch = 0;
  roll = 0;
  private g_forward = 0;
  private g_left = 0;

  reset() {
    this.pitch = this.roll = this.g_forward = this.g_left = 0;
  }

  /** `forward`, `left`: acceleration along the car's own axes, m/s². */
  update(dt: number, forward: number, left: number, on: boolean) {
    const g_ease = 1 - Math.exp(-dt * G_RATE);
    this.g_forward += ((on ? clamp(forward / GRAVITY, G_CLAMP) : 0) - this.g_forward) * g_ease;
    this.g_left += ((on ? clamp(left / GRAVITY, G_CLAMP) : 0) - this.g_left) * g_ease;
    const ease = 1 - Math.exp(-dt * TILT_RATE);
    this.pitch += (clamp(this.g_forward * PITCH_PER_G, PITCH_MAX) - this.pitch) * ease;
    this.roll += (clamp(-this.g_left * ROLL_PER_G, ROLL_MAX) - this.roll) * ease;
  }
}

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
