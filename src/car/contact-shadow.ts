import * as THREE from "three";
import { oversize, type CarSpec } from "./cars";
import { color, dark, tones } from "../theme/palette";
import type { World } from "../world/world";

let blob: THREE.CanvasTexture | null = null;

function blob_texture(): THREE.CanvasTexture {
  if (blob) return blob;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  gradient.addColorStop(0, "rgb(255 255 255 / 1)");
  gradient.addColorStop(0.55, "rgb(255 255 255 / 0.75)");
  gradient.addColorStop(1, "rgb(255 255 255 / 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  blob = new THREE.CanvasTexture(canvas);
  return blob;
}

export interface ContactShadow {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  strength: number;
  /** Height of the car origin over the ground where the patch starts to fade. */
  ride: number;
}

const RIDE = 0.5;

// The sun's shadow lands metres away at a low sun and blurs out, so without a dark patch right under the body the car
// reads as hovering; this is that patch, tinted from the theme rather than black. It multiplies what is under it: a plain
// blend toward the darkest token comes out lighter than lit asphalt of that same token.
export function contact_shadow(): ContactShadow {
  const strength = dark ? 0.7 : 0.4;
  const material = new THREE.MeshBasicMaterial({
    color: color(tones.skid),
    alphaMap: blob_texture(),
    transparent: true,
    opacity: strength,
    premultipliedAlpha: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -8,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 5.0).rotateX(-Math.PI / 2), material);
  mesh.renderOrder = 1;
  return { mesh, material, strength, ride: RIDE };
}

/** Sizes the patch to `spec`'s body: a car keeps the stock patch, a bigger body stretches it. */
export function fit_contact_shadow(shadow: ContactShadow, spec: CarSpec) {
  const size = oversize(spec);
  shadow.mesh.scale.set(size.width, 1, size.length);
  shadow.ride = RIDE * size.height;
}

const up = new THREE.Vector3(0, 1, 0);
const ground_normal = new THREE.Vector3();
const tilt = new THREE.Quaternion();
const yaw = new THREE.Quaternion();

export function place_contact_shadow(shadow: ContactShadow, x: number, y: number, z: number, heading: number, world: World) {
  const ground = world.height(x, z, y);
  world.normal(x, z, ground_normal, y);
  shadow.mesh.position.set(x, ground + 0.05, z);
  tilt.setFromUnitVectors(up, ground_normal);
  yaw.setFromAxisAngle(up, heading);
  shadow.mesh.quaternion.copy(tilt).multiply(yaw);
  const lift = Math.max(0, y - ground - shadow.ride);
  shadow.material.opacity = shadow.strength * Math.max(0, 1 - lift / 3);
}
