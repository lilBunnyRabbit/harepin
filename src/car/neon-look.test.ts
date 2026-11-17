/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { oklab_to_linear } from "../theme/oklab";
import type { Lab } from "../theme/theme";

const hue = ([, a, b]: Lab) => Math.atan2(b, a);

test("on a light page a dark tone glows as its pastel: lighter, the same hue, inside sRGB", async () => {
  const { page_glow } = await import("./neon-look");
  const vivid: Lab = [0.45, 0.35 * Math.cos(4.54), 0.35 * Math.sin(4.54)];
  for (const tone of [vivid, [0.45, 0.12, -0.08] as Lab]) {
    const glow = page_glow(tone);
    expect(glow[0]).toBeGreaterThan(0.8);
    expect(hue(glow)).toBeCloseTo(hue(tone), 6);
    for (const channel of oklab_to_linear(glow)) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  }
});

test("a tone already light and in gamut stays as it is", async () => {
  const { page_glow } = await import("./neon-look");
  const light: Lab = [0.92, 0.03, 0.02];
  expect(page_glow(light)).toEqual(light);
});
