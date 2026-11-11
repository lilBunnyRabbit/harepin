import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { mix, tones } from "../theme/palette";
import { TreeKind } from "../worldgen/biomes";
import { crown_tone } from "./crowns";

test("a summer crown keeps its leaf tone; a snowy one is the kind's share of snow over it", () => {
  for (const shade of [-0.2, 0, 0.3]) {
    expect(crown_tone(TreeKind.PINE, shade, false)).toEqual(mix(tones.leaf, tones.leaf_dark, 0.5 + shade * 1.6));
    expect(crown_tone(TreeKind.SCRUB, shade, false)).toEqual(mix(tones.leaf, tones.grass_dry, 0.45 + shade * 0.5));
  }
  const leaf = crown_tone(TreeKind.PINE, 0, false);
  const pine = crown_tone(TreeKind.PINE, 0, true);
  const broadleaf = crown_tone(TreeKind.BROADLEAF, 0, true);
  const off = (a: readonly number[]) => Math.abs(a[0] - tones.snow[0]);
  expect(off(pine)).toBeLessThan(off(leaf));
  expect(off(pine)).toBeLessThan(off(broadleaf));
});
