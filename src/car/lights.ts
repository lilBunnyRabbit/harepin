import * as THREE from "three";
import type { Design } from "./designs";
import { merge, parts, tint } from "./geometry";
import type { CarView } from "./models";
import { brand, color, glow, tones } from "../theme/palette";

// Brake emissive runs 0.5 at rest and 2.2 braking (`sync_car_view`, remotes): only the braking glow clears bloom.
const BRAKE_GLOW = 0.5;

const FLAME_LENGTH = 1;

export interface Lamps {
  heads: THREE.Mesh;
  tails: THREE.Mesh;
  brake: THREE.MeshLambertMaterial;
}

export function lamps(d: Design): Lamps {
  const head_material = new THREE.MeshLambertMaterial({ color: color(tones.head), emissive: glow(tones.head), emissiveIntensity: 1.2 });
  const brake = new THREE.MeshLambertMaterial({ color: color(brand.error), emissive: glow(brand.error, BRAKE_GLOW), emissiveIntensity: 0.5 });
  const heads = new THREE.Mesh(merge(parts(d.heads)), head_material);
  return { heads, tails: new THREE.Mesh(merge(parts(d.tails)), brake), brake };
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
