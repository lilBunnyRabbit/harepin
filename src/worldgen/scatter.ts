import { biome_at, type BiomeCuts } from "./biomes";
import { sample, up } from "./field";
import { hash } from "./noise";
import type { ScatterRule } from "./recipe";
import { DIRT, ORIGIN, ROAD_HALF, PropKind, type Prop, type Solid, type Terrain } from "./types";

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

export function prop_solid(prop: Prop): Solid {
  const shape = SCATTER_SHAPE[prop.kind] ?? { radius: 1, height: 1 };
  return { kind: "circle", x: prop.x, y: prop.y, z: prop.z, radius: shape.radius * prop.scale, height: shape.height * prop.scale };
}

export interface Scattered {
  props: Prop[];
  solids: Solid[];
}

/** `free` rules out ground taken by lots, towns, jumps and landmarks, as for trees. */
export function scatter(cuts: BiomeCuts, land: Terrain, rules: readonly ScatterRule[], free: (x: number, z: number) => boolean): Scattered {
  const { heights, road_dist, surface } = land;
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
        const i = Math.round((px - ORIGIN) / land.cell);
        const j = Math.round((pz - ORIGIN) / land.cell);
        if (surface[j * (land.n + 1) + i] === DIRT) continue;
        const roll = hash(x, z, seed + 3);
        const prop: Prop = { x: px, y, z: pz, angle: hash(x, z, seed + 4) * Math.PI * 2, kind: rule.kind, scale: SCALE[0] + roll * (SCALE[1] - SCALE[0]) };
        out.props.push(prop);
        out.solids.push(prop_solid(prop));
      }
  });
  return out;
}
