import * as THREE from "three";
import { box, merge, tint } from "./geometry";
import { brand, color, mix, tones } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { ROAD_HALF } from "../worldgen/types";
import type { GateKit } from "./trackside";

export const GateLook = { BANNER: "a", POSTS: "b", LINE: "c" } as const;
export type GateLook = (typeof GateLook)[keyof typeof GateLook];

/** Where the plan's gate solids stand, so every look keeps its uprights on them. */
const POST = ROAD_HALF + 1.7;
/** The cue's emissive share while the gate is not the next one: a faint strip, never off. */
const REST = 0.12;
/** The cue's own paint sits most of the way to the dark, so the unlit strip is faint and the light alone says "next". */
const CUE = mix(brand.accent, tones.check_dark, 0.65);

function part(geometry: THREE.BufferGeometry, tone: Lab, glow = 0): THREE.BufferGeometry {
  const flat = tint(geometry, color(tone));
  flat.setAttribute("glow", new THREE.BufferAttribute(new Float32Array(flat.getAttribute("position").count).fill(glow), 1));
  return flat;
}

/** Vertex colours, with the material's emissive kept to the vertices marked `glow`: body and cue in one draw. */
function cue_material(ground: boolean): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: new THREE.Color(0, 0, 0), polygonOffset: ground, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
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

function checker(columns: number, rows: number, tile: number, place: (x: number, row: number) => THREE.BufferGeometry): THREE.BufferGeometry[] {
  const tiles: THREE.BufferGeometry[] = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) tiles.push(part(place((col - (columns - 1) / 2) * tile, row), (row + col) % 2 ? tones.check_dark : tones.check_light));
  return tiles;
}

function kit(body: THREE.BufferGeometry[], start: THREE.BufferGeometry[], ground = false): GateKit {
  const white = new THREE.Color(1, 1, 1);
  return {
    frame: merge(body),
    start_frame: merge(body, start),
    material: () => cue_material(ground),
    cue: { lit: white, unlit: white, glow: color(brand.accent), rest: REST },
  };
}

function banner(): GateKit {
  const span = POST * 2;
  const body = [
    ...[-1, 1].flatMap((side) => [part(box(0.3, 6, 0.3, side * POST, 3, 0), tones.wall_trim), part(box(0.8, 0.4, 0.8, side * POST, 0.2, 0), tones.tyre)]),
    part(box(span + 0.3, 1.1, 0.12, 0, 5.45, 0), tones.check_dark),
    part(box(3.2, 0.56, 0.18, 0, 5.45, 0), brand.accent),
    ...[-1, 1].map((side) => part(box(1.8, 0.56, 0.18, side * 4.6, 5.45, 0), brand.primary)),
    part(box(span - 0.3, 0.22, 0.2, 0, 4.74, 0), CUE, 1),
  ];
  return kit(body, checker(22, 2, 0.7, (x, row) => box(0.7, 0.35, 0.14, x, 6.2 + row * 0.35, 0)));
}

function split_posts(): GateKit {
  const body = [-1, 1].flatMap((side) => [
    part(box(0.9, 0.5, 0.9, side * POST, 0.25, 0), tones.tyre),
    part(box(0.5, 5.3, 0.5, side * POST, 3.15, 0), tones.wall_trim),
    part(box(0.22, 4.2, 0.58, side * POST, 3.3, 0), CUE, 1),
    part(box(0.58, 4.2, 0.22, side * POST, 3.3, 0), CUE, 1),
    part(box(0.7, 0.2, 0.7, side * POST, 5.9, 0), tones.check_dark),
  ]);
  const flags = [-1, 1].flatMap((side) => checker(3, 2, 0.5, (x, row) => box(0.5, 0.5, 0.12, side * (POST - 1.1) + x, 4.85 + row * 0.5, 0)));
  return kit(body, flags);
}

function ground_line(): GateKit {
  const pylon = (side: number) => [
    part(new THREE.CylinderGeometry(0.22, 0.5, 2, 4).rotateY(Math.PI / 4).translate(side * POST, 1, 0), tones.wall_trim),
    part(new THREE.CylinderGeometry(0.36, 0.43, 0.5, 4).rotateY(Math.PI / 4).translate(side * POST, 1.25, 0), CUE, 1),
    part(box(0.56, 0.14, 0.56, side * POST, 2.07, 0), tones.check_dark),
  ];
  const body = [...pylon(-1), ...pylon(1), part(box(POST * 2 - 1, 0.06, 1.2, 0, 0.1, 0), CUE, 1)];
  return kit(body, checker(12, 2, 1, (x, row) => box(1, 0.06, 0.6, x, 0.1, 0.95 + row * 0.6)), true);
}

export const GATE_LOOKS: Record<GateLook, () => GateKit> = { a: banner, b: split_posts, c: ground_line };

export function gate_look_of(value: string | null): GateLook | null {
  return value !== null && value in GATE_LOOKS ? (value as GateLook) : null;
}
