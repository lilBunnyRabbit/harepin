import * as THREE from "three";
import type { CarView } from "./models";

/** Ground a car view stands on: how far the road or paving drawn at (`x`, `z`) stands over the ground the wheels feel, asked from height `y`. */
export interface DrawnLift {
  drawn_lift(x: number, z: number, y?: number): number;
}

const at = new THREE.Vector3();
const up = new THREE.Vector3();
const unturn = new THREE.Quaternion();
const lifts: number[] = [];

/** The drawn lift under each wheel of `view`, its wheels at their spots in a root placed at `position` / `quaternion`, into `out` by wheel. */
export function wheel_lifts(view: Pick<CarView, "wheels">, position: THREE.Vector3, quaternion: THREE.Quaternion, ground: DrawnLift, out: number[]) {
  const { wheels } = view;
  for (let i = 0; i < wheels.length; i++) {
    at.copy(wheels[i].position).applyQuaternion(quaternion).add(position);
    out[i] = ground.drawn_lift(at.x, at.z, at.y);
  }
}

/** Stands a placed view on `lifts`, one per wheel: the body rises by their mean and each wheel by its own over that, along world up. */
export function stand_on_lifts(view: Pick<CarView, "root" | "wheels">, lifts: readonly number[]) {
  const { root, wheels } = view;
  let sum = 0;
  for (let i = 0; i < wheels.length; i++) sum += lifts[i];
  const mean = sum / wheels.length;
  root.position.y += mean;
  up.set(0, 1, 0).applyQuaternion(unturn.copy(root.quaternion).invert());
  for (let i = 0; i < wheels.length; i++) wheels[i].position.addScaledVector(up, lifts[i] - mean);
}

/**
 * Stands a placed view on the drawn ground: the body rises by the mean lift under its wheels and each wheel by its own
 * over that, so a car astride a road edge, a painted line or a pad keeps every tyre on the mesh. Wheels must already be
 * at this frame's spot in the root's frame; the offset goes along world up.
 */
export function stand_on_drawn(view: Pick<CarView, "root" | "wheels">, ground: DrawnLift) {
  wheel_lifts(view, view.root.position, view.root.quaternion, ground, lifts);
  stand_on_lifts(view, lifts);
}
