import * as THREE from "three";
import type { Look } from "./build";
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

const pipe_sides = (d: Design) => (d.exhaust[0] === 0 ? [1] : [-1, 1]);

export function nitro_parts(d: Design, bottle: Bottle, twin_pipes: boolean, trim: THREE.Color): THREE.BufferGeometry[] {
  const [x, y, z] = d.exhaust;
  const w = (twin_pipes && x !== 0 ? 0.3 : 0.17) * bottle.size;
  const h = 0.14 * bottle.size;
  return pipe_sides(d).flatMap((side) => [tint(box(w, h, 0.07, side * x, y, z - 0.115), color(brand.info)), tint(box(w - 0.05, h - 0.05, 0.02, side * x, y, z - 0.145), trim)]);
}

function shade(geometry: THREE.BufferGeometry, x: number, y: number, tone: THREE.Color, alpha: number): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const count = flat.getAttribute("position").count;
  const colors = new Float32Array(count * 4);
  const nozzle = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    colors.set([tone.r, tone.g, tone.b, alpha], i * 4);
    nozzle.set([x, y], i * 2);
  }
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  flat.setAttribute("nozzle", new THREE.BufferAttribute(nozzle, 2));
  return flat;
}

const cone = (r: number, length: number, x: number, y: number, tone: THREE.Color, alpha: number) =>
  shade(new THREE.ConeGeometry(r, length, 8).rotateX(-Math.PI / 2).translate(x, y, -length / 2), x, y, tone, alpha);
const bead = (r: number, length: number, x: number, y: number, z: number, tone: THREE.Color) => shade(new THREE.OctahedronGeometry(1).scale(r, r, length / 2).translate(x, y, z), x, y, tone, 1);

/** The jet's uniforms: `sway` bends its tail sideways, `flicker` (-1 to 1) pulses its length and girth. */
export interface Jet {
  sway: THREE.IUniform<number>;
  flicker: THREE.IUniform<number>;
}

export function nitro_flame(d: Design, jet: Jet): THREE.Mesh {
  const [pipe, y, z] = d.exhaust;
  const x = pipe * sculpt_factor(d, y, z);
  const info = color(brand.info);
  const core = color(tones.head);
  const mid = color(mix(brand.info, tones.head, 0.5));
  const shapes = pipe_sides(d).flatMap((side) => [
    cone(0.14, JET_LENGTH * 0.8, side * x, y, info, SOFT_ALPHA),
    cone(0.075, JET_LENGTH, side * x, y, info, JET_ALPHA),
    cone(0.045, JET_LENGTH * 0.65, side * x, y, mid, 1),
    bead(0.085, 0.24, side * x, y, -0.3, core),
    bead(0.07, 0.2, side * x, y, -0.62, core),
  ]);
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  material.customProgramCacheKey = () => SWAY_KEY;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.sway = jet.sway;
    shader.uniforms.flicker = jet.flicker;
    // Every change grows from the nozzle, where z is 0 and the jet is anchored: girth about the pipe's axis, length
    // along -z, and the bend with the square of the distance behind it.
    shader.vertexShader = `uniform float sway;\nuniform float flicker;\nattribute vec2 nozzle;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
  transformed.xy = nozzle + (transformed.xy - nozzle) * (1.0 + ${GIRTH_FLICKER} * flicker);
  transformed.z *= ${1 - LENGTH_FLICKER} + ${LENGTH_FLICKER} * flicker;
  transformed.x += sway * transformed.z * transformed.z;`,
    );
  };
  const mesh = new THREE.Mesh(merge(shapes), material);
  mesh.position.z = z - 0.16;
  mesh.visible = false;
  return mesh;
}

/** The sway `from` moved toward what `yaw_rate` (rad/s, positive turning left) asks for over `dt` seconds. */
export function flame_sway(from: number, yaw_rate: number, dt: number): number {
  const target = Math.max(-SWAY_MAX, Math.min(SWAY_MAX, yaw_rate * SWAY_PER_YAW));
  return from + (target - from) * (1 - Math.exp(-SWAY_RATE * dt));
}
