import * as THREE from "three";
import { box, merge, tint } from "./geometry";
import { brand, color, mix, tones } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { ROAD_HALF } from "../worldgen/types";

/** Where the plan's gate solids stand, so the posts stand on them. */
export const GATE_POST = ROAD_HALF + 1.7;
/** Top of a post's cap over the ground, the collider's height. */
export const GATE_TOP = 6;
/** The cue's emissive share while the gate is not the next one: a faint strip, never off. */
const REST = 0.12;
/** The cue's own paint sits most of the way to the dark, so the unlit strip is faint and the light alone says "next". */
const CUE = mix(brand.accent, tones.check_dark, 0.65);
const GLOW = color(brand.accent);

export interface GateKit {
  frame: THREE.BufferGeometry;
  /** Gate 0's geometry: the frame with its flags, or the cue alone under a world's own start gantry. */
  start: THREE.BufferGeometry;
  material: () => THREE.MeshLambertMaterial;
}

function part(geometry: THREE.BufferGeometry, tone: Lab, glow = 0): THREE.BufferGeometry {
  const flat = tint(geometry, color(tone));
  flat.setAttribute("glow", new THREE.BufferAttribute(new Float32Array(flat.getAttribute("position").count).fill(glow), 1));
  return flat;
}

/** Vertex colours, with the material's emissive kept to the vertices marked `glow`: body and cue in one draw. */
function cue_material(): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: new THREE.Color(0, 0, 0) });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float glow;\nvarying float v_glow;")
      .replace("#include <color_vertex>", "#include <color_vertex>\nv_glow = glow;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float v_glow;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= v_glow;");
  };
  material.customProgramCacheKey = () => "gate_cue";
  return material;
}

/** The cue strips down each post, lit when the gate is the next one. */
function cue(): THREE.BufferGeometry[] {
  return [-1, 1].flatMap((side) => [part(box(0.22, 4.2, 0.58, side * GATE_POST, 3.3, 0), CUE, 1), part(box(0.58, 4.2, 0.22, side * GATE_POST, 3.3, 0), CUE, 1)]);
}

/** Split posts either side of the road, a checker flag on each for the start line. */
export function gate_kit(gantry = false): GateKit {
  const posts = [-1, 1].flatMap((side) => [
    part(box(0.9, 0.5, 0.9, side * GATE_POST, 0.25, 0), tones.tyre),
    part(box(0.5, GATE_TOP - 0.7, 0.5, side * GATE_POST, 3.15, 0), tones.wall_trim),
    part(box(0.7, 0.2, 0.7, side * GATE_POST, GATE_TOP - 0.1, 0), tones.check_dark),
  ]);
  const flags = [-1, 1].flatMap((side) =>
    [0, 1].flatMap((row) => [-1, 0, 1].map((col) => part(box(0.5, 0.5, 0.12, side * (GATE_POST - 1.1) + col * 0.5, 4.85 + row * 0.5, 0), (row + col + 1) % 2 ? tones.check_dark : tones.check_light))),
  );
  const body = [...posts, ...cue()];
  return { frame: merge(body), start: gantry ? merge(cue()) : merge(body, flags), material: cue_material };
}

/** Lights a gate's cue: pulsing at `t` seconds while it is the next one, resting otherwise. */
export function light_gate(material: THREE.MeshLambertMaterial, next: boolean, t: number) {
  material.emissive.copy(GLOW).multiplyScalar(next ? 0.55 + Math.sin(t * 6) * 0.25 : REST);
}
