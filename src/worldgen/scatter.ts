import { biome_at, type BiomeCuts } from "./biomes";
import { sample, up } from "./field";
import { hash } from "./noise";
import type { ScatterRule } from "./recipe";
import { TRAIL_HALF } from "./stamp";
import { ORIGIN, ROAD_HALF, PropKind, type Prop, type Solid, type Terrain } from "./types";

/** One circle solid of a strewn prop at scale 1: centre in the prop's frame (x across, z along), radius and height, metres. */
interface Part {
  x: number;
  z: number;
  radius: number;
  height: number;
}

// The meshes in landmark-mesh.ts are drawn to these parts: a cactus's trunk and arms, a boulder's body and side lobe.
const TRUNK: Part = { x: 0, z: 0, radius: 0.45, height: 4.6 };
const RIGHT_ARM: Part = { x: 0.95, z: 0, radius: 0.3, height: 3.5 };
const LEFT_ARM: Part = { x: -0.95, z: 0, radius: 0.27, height: 2.8 };
const PARTS: Partial<Record<PropKind, readonly Part[]>> = {
  [PropKind.BOULDER]: [
    { x: 0, z: 0, radius: 1.6, height: 1.5 },
    { x: 1.5, z: 0.4, radius: 0.7, height: 0.8 },
  ],
  [PropKind.SPIRE]: [{ x: 0, z: 0, radius: 2.4, height: 13 }],
  [PropKind.TANK]: [{ x: 0, z: 0, radius: 1.8, height: 6.4 }],
};

/** The bigger half of the cacti grow a second, lower arm, so the mesh and its solids agree without a stored flag. */
export function two_arms(prop: Prop): boolean {
  return prop.scale >= (SCALE[0] + SCALE[1]) / 2;
}

/**
 * The eight headings a strewn prop may face, k * 45 degrees, as (sin, cos): exact constants, so solids placed in them are
 * bit-exact for every peer while the mesh turns by `angle`.
 */
export const HEADINGS: readonly [number, number][] = [
  [0, 1],
  [Math.SQRT1_2, Math.SQRT1_2],
  [1, 0],
  [Math.SQRT1_2, -Math.SQRT1_2],
  [0, -1],
  [-Math.SQRT1_2, -Math.SQRT1_2],
  [-1, 0],
  [-Math.SQRT1_2, Math.SQRT1_2],
];

/** Heading index from a 0-1 roll, and the prop angle it stands for. */
export function heading(roll: number): { k: number; angle: number } {
  const k = Math.min(HEADINGS.length - 1, Math.floor(roll * HEADINGS.length));
  return { k, angle: (k * Math.PI) / 4 };
}

function parts(prop: Prop): readonly Part[] {
  if (prop.kind === PropKind.CACTUS) return two_arms(prop) ? [TRUNK, RIGHT_ARM, LEFT_ARM] : [TRUNK, RIGHT_ARM];
  return PARTS[prop.kind] ?? [];
}

const ROAD_CLEAR = ROAD_HALF + 8;
const FLAT = 0.85;
const SCALE = [0.75, 1.3];
/** Trail points sit 2 m apart, so the nearest one is at most a metre further than the trail itself. */
const TRAIL_STEP_SLACK = 1;

/** Each part's circle with the prop facing HEADINGS[k], standing on the ground under its own centre. */
export function prop_solids(prop: Prop, k: number, heights: Float32Array): Solid[] {
  const [fx, fz] = HEADINGS[k];
  const s = prop.scale;
  return parts(prop).map((p) => {
    const x = prop.x + (fz * p.x + fx * p.z) * s;
    const z = prop.z + (-fx * p.x + fz * p.z) * s;
    return { kind: "circle", x, y: p.x || p.z ? sample(heights, x, z) : prop.y, z, radius: p.radius * s, height: p.height * s };
  });
}

/** Furthest any part of the prop's solids reaches from its centre. */
export function reach(prop: Prop): number {
  return Math.max(0, ...parts(prop).map((p) => (Math.sqrt(p.x * p.x + p.z * p.z) + p.radius) * prop.scale));
}

export interface Scattered {
  props: Prop[];
  solids: Solid[];
}

/** `free` rules out ground taken by lots, towns, jumps and landmarks, as for trees; `trails` are the trail centrelines. */
export function scatter(cuts: BiomeCuts, land: Terrain, rules: readonly ScatterRule[], free: (x: number, z: number) => boolean, trails: readonly { x: number; z: number }[]): Scattered {
  const { heights, road_dist } = land;
  const out: Scattered = { props: [], solids: [] };
  rules.forEach((rule, r) => {
    const seed = cuts.seed + 300 + r * 8;
    const limit = -ORIGIN - rule.spacing;
    for (let z = ORIGIN + rule.spacing; z < limit; z += rule.spacing)
      for (let x = ORIGIN + rule.spacing; x < limit; x += rule.spacing) {
        if (hash(x, z, seed) >= rule.odds) continue;
        const px = x + (hash(x, z, seed + 1) - 0.5) * rule.spacing * 0.8;
        const pz = z + (hash(x, z, seed + 2) - 0.5) * rule.spacing * 0.8;
        const y = sample(heights, px, pz);
        if (!rule.biomes.includes(biome_at(cuts, px, pz, y))) continue;
        if (sample(road_dist, px, pz) < ROAD_CLEAR || up(heights, px, pz) < FLAT || !free(px, pz)) continue;
        const roll = hash(x, z, seed + 3);
        const { k, angle } = heading(hash(x, z, seed + 4));
        const prop: Prop = { x: px, y, z: pz, angle, kind: rule.kind, scale: SCALE[0] + roll * (SCALE[1] - SCALE[0]) };
        const clear = TRAIL_HALF + reach(prop) + TRAIL_STEP_SLACK;
        if (trails.some((p) => (p.x - px) * (p.x - px) + (p.z - pz) * (p.z - pz) < clear * clear)) continue;
        out.props.push(prop);
        out.solids.push(...prop_solids(prop, k, heights));
      }
  });
  return out;
}
