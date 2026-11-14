import * as THREE from "three";
import type { Design } from "./designs";
import { merge, parts, slab, tint } from "./geometry";
import type { CarView } from "./models";
import { flame_sway } from "./nitro-look";
import { POPUP_LIT, popup_ease, popup_step } from "./popup-swing";
import { brand, color, glow, lighten, tones } from "../theme/palette";

const HEAD_GLOW = 1.2;

// The longest step a swing takes, so the first frame after a stall or a hidden tab does not jump the pods.
const SWING_STEP = 0.1;

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
  /** How far through its swing, 0 shut to 1 open, linear in time; the pose eases it through `popup_ease`. */
  open: number;
  /** Time in seconds `swing_popups` last moved the pods. */
  at: number;
}

/** The pods and `heads` hung on the design's hinge, or null for fixed lamps. */
export function popup(d: Design, heads: HeadMesh, paint: THREE.Color, trim: THREE.Color, material: THREE.Material): Popup | null {
  if (!d.popups) return null;
  const { pods, shells = [], bezels = [], hinge: [z, y], lift } = d.popups;
  const pivot = new THREE.Group();
  pivot.position.set(0, y, z);
  const pod = new THREE.Mesh(merge([...parts(pods), ...shells.flatMap((s) => slab(s.points, s.from, s.to))].map((g) => tint(g, paint)), parts(bezels).map((g) => tint(g, trim))), material);
  pod.castShadow = true;
  for (const part of [pod, heads]) part.position.set(0, -y, -z);
  pivot.add(pod, heads);
  return { pivot, lift, open: 0, at: 0 };
}

/** Headlamps on or off; pop-up pods then swing there through `swing_popups`. Tail lamps keep running and braking either way. */
export function set_lights(view: CarView, on: boolean) {
  view.lights = on;
  pose_lamps(view);
}

/** `set_lights` with the pods already where it sends them: a fresh car, not a switch the player sees. */
export function snap_lights(view: CarView, on: boolean) {
  if (view.popup) view.popup.open = on ? 1 : 0;
  set_lights(view, on);
}

/** Moves pop-up pods toward `view.lights`; `time` in seconds. True while they are still swinging. */
export function swing_popups(view: CarView, time: number): boolean {
  const { popup } = view;
  if (!popup) return false;
  const dt = Math.min(SWING_STEP, Math.max(0, time - popup.at));
  popup.at = time;
  if (popup.open === (view.lights ? 1 : 0)) return false;
  popup.open = popup_step(popup.open, view.lights, dt);
  pose_lamps(view);
  return true;
}

function pose_lamps(view: CarView) {
  const { popup } = view;
  if (popup) popup.pivot.rotation.x = -popup.lift * popup_ease(popup.open);
  view.heads.material.emissiveIntensity = view.lights && (!popup || popup.open >= POPUP_LIT) ? HEAD_GLOW : 0;
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
