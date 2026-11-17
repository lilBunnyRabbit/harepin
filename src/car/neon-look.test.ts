/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import type { Lab } from "../theme/theme";

test("on a light page a dark tone glows as its pastel, a tone already light stays", async () => {
  const { page_glow } = await import("./neon-look");
  const dark: Lab = [0.45, 0.12, -0.08];
  const [l, a, b] = page_glow(dark);
  expect(l).toBeGreaterThan(0.8);
  expect([a, b]).toEqual([dark[1], dark[2]]);
  const light: Lab = [0.92, 0.05, 0.02];
  expect(page_glow(light)).toEqual(light);
});
