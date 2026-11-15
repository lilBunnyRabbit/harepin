import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mix, tones } from "../theme/palette";
import { TreeKind } from "../worldgen/biomes";
import type { Lab } from "../theme/theme";

// Pines hold the most snow on their tiers, broadleaf crowns the least; scrub sits half buried.
const SNOWY_CROWNS: Record<TreeKind, number> = { [TreeKind.PINE]: 0.55, [TreeKind.BROADLEAF]: 0.35, [TreeKind.SCRUB]: 0.6 };

// Scrub is a bush on dry ground: mostly leaf, so it never reads as a tan rock, with enough dry grass to sit apart from the trees.
const SCRUB_LEAF = 0.8;

const tier = (r: number, h: number, base: number, sides: number, open: boolean) => new THREE.ConeGeometry(r, h, sides, 1, open).translate(0, base + h / 2, 0);
// A flat underside fanned from one rim point: sides - 2 triangles, not the centre fan's sides.
const cap = (r: number, base: number, sides: number) => {
  const rim = Array.from({ length: sides }, (_, i) => new THREE.Vector2(r * Math.sin((i / sides) * Math.PI * 2), r * Math.cos((i / sides) * Math.PI * 2)));
  return new THREE.ShapeGeometry(new THREE.Shape(rim)).rotateX(Math.PI / 2).translate(0, base, 0);
};
const band = (r_top: number, r_low: number, y0: number, y1: number, sides: number) => new THREE.CylinderGeometry(r_top, r_low, y1 - y0, sides, 1, true).translate(0, (y0 + y1) / 2, 0);
const join = (...parts: THREE.BufferGeometry[]) => mergeGeometries(parts.map((part) => part.toNonIndexed()));

/** Crowns by tree kind, 20 / 25 / 15 triangles: a two-tier fir closed underneath, a domed canopy tucked in under, a low dome. The batch squashes and sinks scrub, so its bush is modelled tall. */
export function crown_shapes(): THREE.BufferGeometry[] {
  return [
    join(tier(2.3, 3.4, 1.5, 6, true), cap(2.3, 1.5, 6), tier(1.6, 3.6, 3.6, 6, true), cap(1.6, 3.6, 6)),
    join(band(2.2, 0.3, 2.0, 3.2, 5), band(1.9, 2.2, 3.2, 4.7, 5), tier(1.9, 1.3, 4.7, 5, true)),
    join(band(1.7, 1.3, 1.4, 3.0, 5), tier(1.7, 2.4, 3.0, 5, true)),
  ];
}

/** Open ends, 10 triangles: the foot is in the ground, the top inside the crown. */
export const trunk_shape = () => new THREE.CylinderGeometry(0.25, 0.35, 2.2, 5, 1, true).translate(0, 1.1, 0);

/** A crown's tone: leaf mixed by its `shade` jitter, with the kind's share of snow on a snowy map. */
export function crown_tone(kind: TreeKind, shade: number, snowy: boolean): Lab {
  const leafy = kind === TreeKind.SCRUB ? mix(tones.leaf, tones.grass_dry, SCRUB_LEAF + shade * 0.3) : mix(tones.leaf, tones.leaf_dark, 0.5 + shade * 1.6);
  return snowy ? mix(tones.snow, leafy, SNOWY_CROWNS[kind]) : leafy;
}
