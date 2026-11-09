import { describe, expect, test } from "bun:test";
import { DEFAULT_GENERATE, generate_theme, Harmony, is_dark, MIN_COLOUR_CONTRAST, MIN_TEXT_CONTRAST, oklch_lightness, parse_oklch } from "./random-theme";
import { THEMES, type ThemeBase } from "./theme";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function expect_readable(theme: ThemeBase) {
  const background = oklch_lightness(theme.background)!;
  expect(Math.abs(oklch_lightness(theme.foreground)! - background)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST - 1e-3);
  for (const colour of [theme.primary, theme.secondary, theme.accent]) {
    expect(Math.abs(oklch_lightness(colour)! - background)).toBeGreaterThanOrEqual(MIN_COLOUR_CONTRAST - 1e-3);
  }
}

describe("generate_theme", () => {
  test.each(["dark", "light"] as const)("keeps the mode and readable gaps at every setting (%s)", (mode) => {
    const rand = seeded(42);
    for (const vibrance of [0, 0.5, 1]) {
      for (const contrast of [0, 0.5, 1]) {
        for (let run = 0; run < 60; run++) {
          const theme = generate_theme({ mode, harmony: "any", vibrance, contrast }, rand);
          expect(is_dark(theme)).toBe(mode === "dark");
          expect_readable(theme);
        }
      }
    }
  });

  test("any mode gives both", () => {
    const rand = seeded(7);
    const modes = new Set(Array.from({ length: 40 }, () => is_dark(generate_theme({ mode: "any", ...DEFAULT_GENERATE }, rand))));
    expect(modes).toEqual(new Set([true, false]));
  });

  test("vibrance raises chroma", () => {
    const rand = seeded(3);
    const chroma = (vibrance: number) =>
      Array.from({ length: 50 }, () => parse_oklch(generate_theme({ mode: "dark", harmony: "any", vibrance, contrast: 0.5 }, rand).primary)!.c).reduce((a, b) => a + b) / 50;
    expect(chroma(1)).toBeGreaterThan(chroma(0) * 3);
  });

  test("a harmony places the colours around the base hue", () => {
    const theme = generate_theme({ mode: "dark", harmony: Harmony.COMPLEMENTARY, vibrance: 0.5, contrast: 0.5 }, seeded(9));
    const distance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
    expect(distance(parse_oklch(theme.secondary)!.h, parse_oklch(theme.primary)!.h)).toBeGreaterThan(160);
  });

  test("locked colours stay, and the rest are placed around them", () => {
    const rand = seeded(11);
    for (let run = 0; run < 100; run++) {
      const background = "oklch(0.250 0.0300 200.00)";
      const primary = "oklch(0.750 0.1500 40.00)";
      const theme = generate_theme({ mode: "light", ...DEFAULT_GENERATE, locked: { background, primary } }, rand);
      expect(theme.background).toBe(background);
      expect(theme.primary).toBe(primary);
      expect(is_dark(theme)).toBe(true);
      expect_readable(theme);
    }
  });

  test("a locked foreground pushes a generated background away", () => {
    const rand = seeded(5);
    for (let run = 0; run < 100; run++) {
      const theme = generate_theme({ mode: "dark", ...DEFAULT_GENERATE, locked: { foreground: "oklch(0.800 0.0100 90.00)" } }, rand);
      expect(oklch_lightness(theme.foreground)! - oklch_lightness(theme.background)!).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST - 1e-3);
    }
  });

  test("a lock that only fits the other mode flips it", () => {
    const rand = seeded(7);
    for (let run = 0; run < 100; run++) {
      const dark_text = generate_theme({ mode: "dark", ...DEFAULT_GENERATE, locked: { foreground: "oklch(0.200 0.0100 90.00)" } }, rand);
      expect(is_dark(dark_text)).toBe(false);
      expect_readable(dark_text);
      const pale = generate_theme({ mode: "light", ...DEFAULT_GENERATE, locked: { primary: "oklch(0.900 0.1000 40.00)" } }, rand);
      expect(is_dark(pale)).toBe(true);
      expect_readable(pale);
    }
  });

  test("a lock that fits neither mode keeps the asked one", () => {
    const rand = seeded(9);
    for (let run = 0; run < 20; run++) {
      const theme = generate_theme({ mode: "light", ...DEFAULT_GENERATE, locked: { foreground: "oklch(0.500 0.0100 90.00)" } }, rand);
      expect(is_dark(theme)).toBe(false);
    }
  });

  test("tells the brand themes apart, and reads percent lightness", () => {
    expect(is_dark(THEMES["Brand Dark"])).toBe(true);
    expect(is_dark(THEMES["Brand Light"])).toBe(false);
    expect(oklch_lightness("oklch(95% 0.01 80)")).toBe(0.95);
    expect(is_dark({ background: "#fff" })).toBe(true);
  });
});
