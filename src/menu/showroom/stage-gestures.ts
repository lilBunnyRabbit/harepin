export interface Pose {
  yaw: number;
  /** Tilt added to the stand's camera angle by a drag, radians. */
  pitch: number;
  zoom: number;
}

/** How far a drag tilts the view above and below the stand's usual angle, radians. */
export const PITCH_MIN = -0.25;
export const PITCH_MAX = 0.55;
/** Zoom over the whole-car fit; 1 is the most a pinch or the wheel backs out. */
export const ZOOM_MAX = 2.6;
const DRAG_YAW = 0.01;
const DRAG_PITCH = 0.006;
const WHEEL_ZOOM = 0.0015;
/** A press that travels no further than this, CSS px, and lifts within TAP_MS is a tap, not a drag. */
const TAP_SLOP = 10;
const TAP_MS = 300;
/** Two taps this close in time and place are a double tap. */
const DOUBLE_MS = 350;
const DOUBLE_SLOP = 40;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Turns `pose` by a drag of (`dx`, `dy`) CSS px: across spins the car, down tilts the view within its limits. */
export function drag_pose(pose: Pose, dx: number, dy: number) {
  pose.yaw += dx * DRAG_YAW;
  pose.pitch = clamp(pose.pitch + dy * DRAG_PITCH, PITCH_MIN, PITCH_MAX);
}

export function zoom_pose(pose: Pose, factor: number) {
  pose.zoom = clamp(pose.zoom * factor, 1, ZOOM_MAX);
}

/** The zoom factor of one wheel step: rolling away from you (negative `delta_y`) zooms in. */
export const wheel_factor = (delta_y: number) => Math.exp(-delta_y * WHEEL_ZOOM);

/** The zoom factor of a pinch whose fingers went from `before` to `after` CSS px apart. */
export const pinch_factor = (before: number, after: number) => (before > 0 ? after / before : 1);

export interface Press {
  /** Where and when the pointer went down, CSS px and ms. */
  x: number;
  y: number;
  at: number;
  /** The furthest it got from there, so a drag out and back is no tap. */
  travel: number;
}

export interface Tap {
  x: number;
  y: number;
  at: number;
}

export const is_tap = (press: Press, lifted_at: number) => press.travel <= TAP_SLOP && lifted_at - press.at <= TAP_MS;

export const is_double_tap = (first: Tap | null, second: Tap) =>
  first !== null && second.at - first.at <= DOUBLE_MS && Math.hypot(second.x - first.x, second.y - first.y) <= DOUBLE_SLOP;
