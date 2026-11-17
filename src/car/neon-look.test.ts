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

const ring = async () => {
  const { neon_view } = await import("./neon-look");
  const { DESIGNS } = await import("./designs");
  return neon_view(DESIGNS.hatch, { style: "ring", tone: [0.7, 0.1, 0.1] }, 0.4);
};

test("the ring's band stands still under a car that does not move: a paused game redraws it with the clock still running", async () => {
  const { light_neon } = await import("./neon-look");
  const neon = await ring();
  neon.mesh.position.set(40, 2, -15);
  light_neon(neon, false, 10);
  neon.mesh.position.set(43, 2, -15);
  light_neon(neon, false, 10.1);
  const phase = neon.phase.value;
  expect(phase).toBeGreaterThan(0);
  for (let i = 2; i <= 20; i++) {
    light_neon(neon, false, 10 + i * 0.1);
    expect(neon.phase.value).toBe(phase);
    expect(neon.level.value).toBe(neon.gain);
  }
});

test("the band runs once round in the road it was built for, at any frame rate, and a car put elsewhere does not spin it", async () => {
  const { light_neon } = await import("./neon-look");
  for (const frames of [30, 144]) {
    const neon = await ring();
    for (let i = 0; i <= frames; i++) {
      neon.mesh.position.set((4.5 * i) / frames, 0, 0);
      light_neon(neon, false, i / frames);
    }
    expect(neon.phase.value).toBeCloseTo(0.5, 9);
    neon.mesh.position.set(500, 0, 300);
    light_neon(neon, false, 2);
    expect(neon.phase.value).toBeCloseTo(0.5, 9);
  }
});
