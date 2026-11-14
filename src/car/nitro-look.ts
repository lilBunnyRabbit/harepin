import * as THREE from "three";
import type { Look } from "./build";
import type { Triple } from "./cars";
import { sculpt_factor } from "./body-shell";
import type { Design } from "./designs";
import { box, merge, tint } from "./geometry";
import { brand, color, mix, tones } from "../theme/palette";

type Bottle = Required<Look>["bottle"];

const JET_LENGTH = 1.6;
const SOFT_ALPHA = 0.4;
const JET_ALPHA = 0.85;
/** Sideways reach of the jet's tip per rad/s of yaw, as the x gained per metre squared behind the pipe. */
const SWAY_PER_YAW = 0.2;
const SWAY_MAX = 0.22;
const SWAY_RATE = 7;
const SWAY_KEY = "nitro-jet";
const GIRTH_FLICKER = 0.15;
const LENGTH_FLICKER = 0.25;
/** A pipe's end, where the flame starts, lies this far past its `exhaust` point along its `jet`. */
export const PIPE_REACH = 0.16;
const BACK: Triple = [0, 0, -1];

const pipe_sides = (d: Design) => (d.exhaust[0] === 0 ? [1] : [-1, 1]);

export function nitro_parts(d: Design, bottle: Bottle, twin_pipes: boolean, trim: THREE.Color): THREE.BufferGeometry[] {
  const [x, y, z] = d.exhaust;
  const w = (twin_pipes && x !== 0 ? 0.3 : 0.17) * bottle.size;
  const h = 0.14 * bottle.size;
  return pipe_sides(d).flatMap((side) => [tint(box(w, h, 0.07, side * x, y, z - 0.115), color(brand.info)), tint(box(w - 0.05, h - 0.05, 0.02, side * x, y, z - 0.145), trim)]);
}

function shade(geometry: THREE.BufferGeometry, tone: THREE.Color, alpha: number): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const count = flat.getAttribute("position").count;
  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) colors.set([tone.r, tone.g, tone.b, alpha], i * 4);
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  return flat;
}

// Both are drawn blowing straight back from the origin; `aimed` turns and places them.
const cone = (r: number, length: number, tone: THREE.Color, alpha: number) => shade(new THREE.ConeGeometry(r, length, 8).rotateX(-Math.PI / 2).translate(0, 0, -length / 2), tone, alpha);
const bead = (r: number, length: number, z: number, tone: THREE.Color) => shade(new THREE.OctahedronGeometry(1).scale(r, r, length / 2).translate(0, 0, z), tone, 1);

const turn = new THREE.Quaternion();
const behind = new THREE.Vector3(...BACK);
const along = new THREE.Vector3();

/** A jet shape turned to blow along `axis` from `nozzle`, each vertex carrying both for the shader. */
function aimed(geometry: THREE.BufferGeometry, nozzle: Triple, axis: Triple): THREE.BufferGeometry {
  geometry.applyQuaternion(turn.setFromUnitVectors(behind, along.set(...axis))).translate(...nozzle);
  const count = geometry.getAttribute("position").count;
  const nozzles = new Float32Array(count * 3);
  const axes = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    nozzles.set(nozzle, i * 3);
    axes.set(axis, i * 3);
  }
  geometry.setAttribute("nozzle", new THREE.BufferAttribute(nozzles, 3));
  geometry.setAttribute("axis", new THREE.BufferAttribute(axes, 3));
  return geometry;
}

/** The jet's uniforms: `sway` bends its tail sideways, `flicker` (-1 to 1) pulses its length and girth. */
export interface Jet {
  sway: THREE.IUniform<number>;
  flicker: THREE.IUniform<number>;
}

export function nitro_flame(d: Design, jet: Jet): THREE.Mesh {
  const [pipe, y, z] = d.exhaust;
  const [ax, ay, az] = d.jet ?? BACK;
  const x = (pipe + ax * PIPE_REACH) * sculpt_factor(d, y, z);
  const info = color(brand.info);
  const core = color(tones.head);
  const mid = color(mix(brand.info, tones.head, 0.5));
  const shapes = pipe_sides(d).flatMap((side) =>
    [
      cone(0.14, JET_LENGTH * 0.8, info, SOFT_ALPHA),
      cone(0.075, JET_LENGTH, info, JET_ALPHA),
      cone(0.045, JET_LENGTH * 0.65, mid, 1),
      bead(0.085, 0.24, -0.3, core),
      bead(0.07, 0.2, -0.62, core),
    ].map((shape) => aimed(shape, [side * x, y + ay * PIPE_REACH, z + az * PIPE_REACH], [side * ax, ay, az])),
  );
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  material.customProgramCacheKey = () => SWAY_KEY;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.sway = jet.sway;
    shader.uniforms.flicker = jet.flicker;
    // Every change grows from the nozzle, where the jet is anchored: girth about the pipe's axis, length along it,
    // and the sideways bend with the square of the distance from the pipe.
    shader.vertexShader = `uniform float sway;\nuniform float flicker;\nattribute vec3 nozzle;\nattribute vec3 axis;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
  vec3 from_nozzle = transformed - nozzle;
  float reach = dot(from_nozzle, axis);
  vec3 girth = (from_nozzle - axis * reach) * (1.0 + ${GIRTH_FLICKER} * flicker);
  reach *= ${1 - LENGTH_FLICKER} + ${LENGTH_FLICKER} * flicker;
  transformed = nozzle + girth + axis * reach;
  transformed.x += sway * reach * reach;`,
    );
  };
  const mesh = new THREE.Mesh(merge(shapes), material);
  mesh.visible = false;
  return mesh;
}

/** The sway `from` moved toward what `yaw_rate` (rad/s, positive turning left) asks for over `dt` seconds. */
export function flame_sway(from: number, yaw_rate: number, dt: number): number {
  const target = Math.max(-SWAY_MAX, Math.min(SWAY_MAX, yaw_rate * SWAY_PER_YAW));
  return from + (target - from) * (1 - Math.exp(-SWAY_RATE * dt));
}
