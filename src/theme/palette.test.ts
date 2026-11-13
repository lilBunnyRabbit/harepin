import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { LAVA_GLOW } from "../render/lava";
import { dusk_lava_glow, dusk_of, glow, noon_lava_glow } from "./palette";
import { THEMES, type Lab, type Theme, type Token } from "./theme";

const oklch = (L: number, C: number, H: number): Lab => [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)];

// The lava inputs are plain oklch, or derived themes' `oklch(from var(--primary) l C H)`; fake-dom can't resolve either.
function token(theme: Theme, name: Token): Lab {
  const plain = theme[name].match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/);
  if (plain) return oklch(+plain[1], +plain[2], +plain[3]);
  const derived = theme[name].match(/^oklch\(from var\(--primary\) l ([\d.]+) ([\d.]+)\)$/);
  if (derived) return oklch(token(theme, "primary")[0], +derived[1], +derived[2]);
  throw new Error(`unresolved ${name}: ${theme[name]}`);
}

test.each(Object.keys(THEMES))("%s lava glows orange-red under the bloom", (name) => {
  const theme = THEMES[name];
  const [error, warning] = [token(theme, "error"), token(theme, "warning")];
  const tone = dusk_of(token(theme, "background")) ? dusk_lava_glow(error, warning) : noon_lava_glow(error, warning);
  const { r, g, b } = glow(tone, LAVA_GLOW);
  const hue = (60 * (g - b)) / (r - Math.min(g, b));
  expect(r).toBeGreaterThan(g);
  expect(g).toBeGreaterThan(b);
  expect(hue).toBeGreaterThan(3);
  expect(hue).toBeLessThan(30);
  expect(0.299 * r + 0.587 * g + 0.114 * b).toBeLessThanOrEqual(LAVA_GLOW + 1e-9);
});
