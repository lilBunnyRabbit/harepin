import * as THREE from "three";
import type { Design } from "./designs";
import { merge, parts, tint } from "./geometry";
import type { CarView } from "./models";
import { brand, color, glow, lighten, tones } from "../theme/palette";

const HEAD_GLOW = 1.2;

// Brake emissive runs 0.5 at rest and 2.2 braking (`sync_car_view`, remotes): only the braking glow clears bloom.
const BRAKE_GLOW = 0.5;

const FLAME_LENGTH = 1;
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

export function flame_mesh(d: Design): THREE.Mesh {
  const [x, y, z] = d.exhaust;
  const outer = color(brand.info);
  const core = color(brand.cottontail);
  const cone = (r: number, length: number, side: number, tone: THREE.Color) =>
    tint(new THREE.ConeGeometry(r, length, 8).rotateX(-Math.PI / 2).translate(side * x, y, -length / 2), tone);
  const geometry = merge((x === 0 ? [1] : [-1, 1]).flatMap((side) => [cone(0.15, FLAME_LENGTH, side, outer), cone(0.07, FLAME_LENGTH * 0.6, side, core)]));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  mesh.position.z = z - 0.16;
  mesh.visible = false;
  return mesh;
}

/** Shows or hides the nitro flame; `time` in seconds drives its flicker. */
export function show_flame(view: CarView, on: boolean, time: number) {
  const { flame } = view;
  flame.visible = on;
  if (!on) return;
  const flicker = Math.sin(time * 61) * Math.sin(time * 23 + 1);
  flame.scale.set(1 + 0.15 * flicker, 1 + 0.15 * flicker, 0.75 + 0.25 * flicker);
}
