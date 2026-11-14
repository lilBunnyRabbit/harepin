import * as THREE from "three";
import type { Design } from "./designs";
import { merge, parts, tint } from "./geometry";
import type { CarView } from "./models";
import { flame_sway } from "./nitro-look";
import { brand, color, glow, lighten, tones } from "../theme/palette";

const HEAD_GLOW = 1.2;

// Brake emissive runs 0.5 at rest and 2.2 braking (`sync_car_view`, remotes): only the braking glow clears bloom.
const BRAKE_GLOW = 0.5;

// A dusk theme's error is a light salmon; the lamp lens sits deeper so it reads red at rest, braking or not.
const TAIL_L = 0.55;
const tail = lighten(brand.error, Math.min(0, TAIL_L - brand.error[0]));

export type HeadMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;

export interface Lamps {
  heads: HeadMesh;
  tails: THREE.Mesh;
  brake: THREE.MeshLambertMaterial;
}

export function lamps(d: Design): Lamps {
  const head_material = new THREE.MeshLambertMaterial({ color: color(tones.head), emissive: glow(tones.head), emissiveIntensity: HEAD_GLOW });
  const brake = new THREE.MeshLambertMaterial({ color: color(tail), emissive: glow(tail, BRAKE_GLOW), emissiveIntensity: 0.5 });
  const heads = new THREE.Mesh(merge(parts(d.heads)), head_material);
  return { heads, tails: new THREE.Mesh(merge(parts(d.tails)), brake), brake };
}

export interface Popup {
  /** Swings on the hinge line; holds the pods and the headlamps riding in them. */
  pivot: THREE.Group;
  /** `Design.popups.lift`. */
  lift: number;
}

/** The pods and `heads` hung on the design's hinge, or null for fixed lamps. */
export function popup(d: Design, heads: HeadMesh, paint: THREE.Color, material: THREE.Material): Popup | null {
  if (!d.popups) return null;
  const { pods, hinge: [z, y], lift } = d.popups;
  const pivot = new THREE.Group();
  pivot.position.set(0, y, z);
  const pod = new THREE.Mesh(merge(parts(pods).map((g) => tint(g, paint))), material);
  pod.castShadow = true;
  for (const part of [pod, heads]) part.position.set(0, -y, -z);
  pivot.add(pod, heads);
  return { pivot, lift };
}

/** Headlamp glow and pop-up pods; tail lamps keep running and braking either way. */
export function set_lights(view: CarView, on: boolean) {
  view.lights = on;
  view.heads.material.emissiveIntensity = on ? HEAD_GLOW : 0;
  if (view.popup) view.popup.pivot.rotation.x = on ? -view.popup.lift : 0;
}

const SWAY_STEP = 0.1;

/** Shows or hides the nitro flame; `time` in seconds drives its flicker, `yaw_rate` in rad/s (positive turning left) its sway. */
export function show_flame(view: CarView, on: boolean, time: number, yaw_rate: number) {
  const { flame } = view;
  const { sway, flicker } = view.jet;
  flame.visible = on;
  if (on) {
    flicker.value = Math.sin(time * 61) * Math.sin(time * 23 + 1);
    sway.value = flame_sway(sway.value, yaw_rate, Math.min(SWAY_STEP, Math.max(0, time - view.sway_at)));
  } else sway.value = 0;
  view.sway_at = time;
}
