import type { Triple } from "../car/cars";
import { DEFAULT_FOV, settled_cam, type Cam } from "./view-state";

// A box's bounding sphere runs well past a car's own outline, so it fits under 1.
const MARGIN = 0.85;
const DEG = Math.PI / 180;

export const SNAPS = {
  front: { label: "Front", yaw: 0, pitch: 8, low: false },
  "3/4": { label: "3/4", yaw: 35, pitch: 14, low: false },
  side: { label: "Side", yaw: 90, pitch: 5, low: false },
  rear: { label: "Rear", yaw: 180, pitch: 10, low: false },
  // From behind, so the nose points up the screen.
  top: { label: "Top", yaw: 180, pitch: 89, low: false },
  low: { label: "Low", yaw: 40, pitch: 1, low: true },
} as const;
export type Snap = keyof typeof SNAPS;

export interface Frame {
  centre: Triple;
  radius: number;
}

export function cam_position(cam: Cam): Triple {
  const yaw = cam.yaw * DEG;
  const pitch = cam.pitch * DEG;
  const [tx, ty, tz] = cam.target;
  return [tx + Math.sin(yaw) * Math.cos(pitch) * cam.dist, ty + Math.sin(pitch) * cam.dist, tz + Math.cos(yaw) * Math.cos(pitch) * cam.dist];
}

export function fit_distance(radius: number, fov: number, aspect: number): number {
  const half = Math.atan(Math.tan((fov * DEG) / 2) * Math.min(1, aspect));
  return (radius * MARGIN) / Math.sin(half);
}

export function snap_cam(snap: Snap, frame: Frame, aspect: number, fov = DEFAULT_FOV): Cam {
  const s = SNAPS[snap];
  const [x, y, z] = frame.centre;
  // Low sits the camera at sill height, so the arch gaps and the ride height read against the floor.
  const target: Triple = s.low ? [x, y * 0.45, z] : [x, y, z];
  return settled_cam({ yaw: s.yaw, pitch: s.pitch, dist: fit_distance(frame.radius, fov, aspect) * (s.low ? 0.85 : 1), target, fov });
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Between two cams at `t` 0-1, yaw the short way round. */
export function blend_cam(a: Cam, b: Cam, t: number): Cam {
  const k = ease(Math.max(0, Math.min(1, t)));
  const turn = ((((b.yaw - a.yaw) % 360) + 540) % 360) - 180;
  const lerp = (p: number, q: number) => p + (q - p) * k;
  return {
    yaw: a.yaw + turn * k,
    pitch: lerp(a.pitch, b.pitch),
    dist: Math.exp(lerp(Math.log(a.dist), Math.log(b.dist))),
    target: [lerp(a.target[0], b.target[0]), lerp(a.target[1], b.target[1]), lerp(a.target[2], b.target[2])],
    fov: lerp(a.fov, b.fov),
  };
}
