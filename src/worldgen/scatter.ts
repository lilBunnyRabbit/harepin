import { biome_at, type BiomeCuts } from "./biomes";
import { sample, up } from "./field";
import { hash } from "./noise";
import type { ScatterRule } from "./recipe";
import { TRAIL_HALF } from "./stamp";
import { ORIGIN, ROAD_HALF, PropKind, type Prop, type Solid, type Terrain } from "./types";

/** Footprint radius and height of each strewn prop at scale 1, metres; the mesh in landmark-mesh.ts is drawn to them. */
export const SCATTER_SHAPE: Partial<Record<PropKind, { radius: number; height: number }>> = {
  [PropKind.CACTUS]: { radius: 0.45, height: 4.6 },
  [PropKind.BOULDER]: { radius: 1.6, height: 1.5 },
  [PropKind.SPIRE]: { radius: 2.4, height: 13 },
  [PropKind.TANK]: { radius: 1.8, height: 6.4 },
};

const ROAD_CLEAR = ROAD_HALF + 8;
const FLAT = 0.85;
const SCALE = [0.75, 1.3];
/** Trail points sit 2 m apart, so the nearest one is at most a metre further than the trail itself. */
const TRAIL_STEP_SLACK = 1;

export function prop_solid(prop: Prop): Solid {
  const shape = SCATTER_SHAPE[prop.kind] ?? { radius: 1, height: 1 };
  return { kind: "circle", x: prop.x, y: prop.y, z: prop.z, radius: shape.radius * prop.scale, height: shape.height * prop.scale };
}

/** Furthest any part of the prop's solids reaches from its centre. */
export function reach(prop: Prop): number {
  return (SCATTER_SHAPE[prop.kind]?.radius ?? 1) * prop.scale;
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
        const prop: Prop = { x: px, y, z: pz, angle: hash(x, z, seed + 4) * Math.PI * 2, kind: rule.kind, scale: SCALE[0] + roll * (SCALE[1] - SCALE[0]) };
        const clear = TRAIL_HALF + reach(prop) + TRAIL_STEP_SLACK;
        if (trails.some((p) => (p.x - px) * (p.x - px) + (p.z - pz) * (p.z - pz) < clear * clear)) continue;
        out.props.push(prop);
        out.solids.push(prop_solid(prop));
      }
  });
  return out;
}
