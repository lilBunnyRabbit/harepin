import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cursor_vars, HOLD_STEPS, hold_token } from "./cursor";
import { THEMES, TOKENS, type Lab, type Theme, type Token } from "./theme";

const oklch_lab = (value: string): Lab => {
  const [l, c, h] = value.match(/[\d.]+/g)!.map(Number);
  return [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
};
const read_of = (theme: Theme) => Object.fromEntries(TOKENS.filter((t) => theme[t].startsWith("oklch(")).map((t) => [t, oklch_lab(theme[t])])) as Record<Token, Lab>;

describe("cursor", () => {
  for (const name of ["Brand Dark", "Brand Light"]) {
    const read = read_of(THEMES[name]);
    const vars = cursor_vars(read, "background_darkest");

    test(`${name}: arrow, hover and every hold frame`, () => {
      expect(Object.keys(vars)).toEqual(["--cursor", "--cursor-hover", ...Array.from({ length: HOLD_STEPS }, (_, step) => `--cursor-hold-${step}`)]);
      for (const value of Object.values(vars)) expect(value).toMatch(/^image-set\(url\("data:image\/svg\+xml,[^"]+"\) 1x, url\("data:image\/svg\+xml,[^"]+"\) 2x\) \d+ \d+, default$/);
    });

    test(`${name}: every state keeps the arrow's tip as the click point`, () => {
      const spot = (value: string) => value.match(/\) (\d+ \d+), default$/)![1];
      for (const value of Object.values(vars)) expect(spot(value)).toBe(spot(vars["--cursor"]));
      expect(vars["--cursor-hold-0"]).toBe(vars["--cursor-hover"]);
    });

    test(`${name}: hover swaps the arrow's fill and ring, and the hold fill rises from the tail`, () => {
      const fills = (value: string) => [...decodeURIComponent(value).matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
      expect(fills(vars["--cursor-hover"])).toEqual(fills(vars["--cursor"]).reverse());
      expect(hold_token(read)).toBe("secondary");
      const tops = Array.from({ length: HOLD_STEPS - 1 }, (_, step) => Number(decodeURIComponent(vars[`--cursor-hold-${step + 1}`]).match(/<rect x="0" y="([\d.]+)"/)![1]));
      expect(tops).toEqual([...tops].sort((a, b) => b - a));
    });
  }

  test("style.css keys one keyframe per hold frame", () => {
    const css = readFileSync(join(import.meta.dir, "../style.css"), "utf8");
    expect(css.match(/--cursor-hover: var\(--cursor-hold-\d+\)/g)?.length).toBe(HOLD_STEPS);
  });
});
