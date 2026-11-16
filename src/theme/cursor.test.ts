import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { arc_token, cursor_vars, HOLD_STEPS } from "./cursor";
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

    test(`${name}: hover and hold share the click point at the ring's centre`, () => {
      const spot = (value: string) => value.match(/\) (\d+ \d+), default$/)![1];
      expect(spot(vars["--cursor-hold-0"])).toBe(spot(vars["--cursor-hover"]));
      expect(vars["--cursor-hold-0"]).toBe(vars["--cursor-hover"]);
    });

    test(`${name}: the hold arc takes secondary, the token furthest from the cottontail ring`, () => {
      expect(arc_token(read)).toBe("secondary");
      expect(decodeURIComponent(vars["--cursor-hold-11"])).toContain("stroke-dasharray");
    });
  }

  test("style.css keys one keyframe per hold frame", () => {
    const css = readFileSync(join(import.meta.dir, "../style.css"), "utf8");
    expect(css.match(/--cursor-hover: var\(--cursor-hold-\d+\)/g)?.length).toBe(HOLD_STEPS);
  });
});
