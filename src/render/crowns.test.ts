import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import type * as THREE from "three";
import { mix, tones } from "../theme/palette";
import { TreeKind } from "../worldgen/biomes";
import { crown_shapes, crown_tone, trunk_shape } from "./crowns";

test("a summer crown keeps its leaf tone; a snowy one is the kind's share of snow over it", () => {
  for (const shade of [-0.2, 0, 0.3]) {
    expect(crown_tone(TreeKind.PINE, shade, false)).toEqual(mix(tones.leaf, tones.leaf_dark, 0.5 + shade * 1.6));
  }
  const leaf = crown_tone(TreeKind.PINE, 0, false);
  const pine = crown_tone(TreeKind.PINE, 0, true);
  const broadleaf = crown_tone(TreeKind.BROADLEAF, 0, true);
  const off = (a: readonly number[]) => Math.abs(a[0] - tones.snow[0]);
  expect(off(pine)).toBeLessThan(off(leaf));
  expect(off(pine)).toBeLessThan(off(broadleaf));
});

test("scrub is mostly leaf, with dry grass in it", () => {
  const off = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (const shade of [-0.5, 0, 0.5]) {
    const scrub = crown_tone(TreeKind.SCRUB, shade, false);
    expect(off(scrub, tones.leaf)).toBeLessThan(off(scrub, tones.grass_dry));
    expect(off(scrub, tones.leaf)).toBeGreaterThan(0);
  }
});

test("a tree costs no more triangles than the cone, ball and closed trunk it replaced", () => {
  const triangles = (geometry: THREE.BufferGeometry) => (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
  const [pine, broadleaf, scrub] = crown_shapes().map(triangles);
  const trunk = triangles(trunk_shape());
  expect(pine + trunk).toBeLessThanOrEqual(12 + 20);
  expect(broadleaf + trunk).toBeLessThanOrEqual(20 + 20);
  expect(scrub).toBeLessThanOrEqual(20);
});
