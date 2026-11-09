import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_GENERATE, generate_theme, type GenerateOptions } from "./random-theme";
import { DEFAULT_DESKTOP, THEMES, TOKENS, derive_theme, find_theme, parse_saved_themes, theme_name_problem, with_saved, without_saved, type Theme } from "./theme";

// CSS.supports is browser-only; this stand-in accepts the colour syntaxes the themes use, so a junk value is refused.
const supports = (value: string) => /^(oklch|color-mix|var)\(.*\)$/.test(value);

const generated: Theme = derive_theme({
  background: "oklch(0.200 0.0300 200.00)",
  foreground: "oklch(0.900 0.0100 20.00)",
  primary: "oklch(0.750 0.1500 200.00)",
  secondary: "oklch(0.750 0.1500 320.00)",
  accent: "oklch(0.750 0.1500 80.00)",
});

describe("saved themes", () => {
  test("keeps valid entries as stored", () => {
    expect(parse_saved_themes([{ name: " Night run ", theme: generated }], supports)).toEqual([{ name: "Night run", theme: generated }]);
  });

  test("anything but an array is no themes", () => {
    for (const raw of [null, undefined, "x", 3, { name: "a", theme: generated }]) expect(parse_saved_themes(raw, supports)).toEqual([]);
  });

  test("drops entries with a bad shape, a bad colour or a missing token", () => {
    const { accent: _, ...missing } = generated;
    const raw = [
      null,
      "Night run",
      { name: 4, theme: generated },
      { name: "No theme" },
      { name: "Junk", theme: { ...generated, primary: "red; background: url(x)" } },
      { name: "Number", theme: { ...generated, primary: 4 } },
      { name: "Missing", theme: missing },
      { name: "Good", theme: generated },
    ];
    expect(parse_saved_themes(raw, supports).map((entry) => entry.name)).toEqual(["Good"]);
  });

  test("fills a missing desktop and drops unknown tokens", () => {
    const { desktop: _, ...old } = generated;
    const [entry] = parse_saved_themes([{ name: "Old", theme: { ...old, extra: "oklch(0 0 0)" } }], supports);
    expect(entry.theme.desktop).toBe(DEFAULT_DESKTOP);
    expect(Object.keys(entry.theme)).toEqual([...TOKENS]);
  });

  test("drops preset names, empty and overlong names, and repeats", () => {
    const raw = ["brand dark", "", "   ", "x".repeat(40), "Mine", "MINE "].map((name) => ({ name, theme: generated }));
    expect(parse_saved_themes(raw, supports).map((entry) => entry.name)).toEqual(["Mine"]);
  });

  test("names: presets taken, case and spaces ignored", () => {
    expect(theme_name_problem("Brand Light")).not.toBeNull();
    expect(theme_name_problem(" neon black ")).not.toBeNull();
    expect(theme_name_problem("")).not.toBeNull();
    expect(theme_name_problem("Dusk drive")).toBeNull();
  });

  test("saving a name again replaces it in place; delete ignores case", () => {
    const one = with_saved([], "Mine", generated);
    const two = with_saved(one, "Other", generated);
    const replaced = with_saved(two, "mine", THEMES["Brand Dark"]);
    expect(replaced.map((entry) => entry.name)).toEqual(["mine", "Other"]);
    expect(replaced[0].theme).toEqual(THEMES["Brand Dark"]);
    expect(without_saved(replaced, "MINE").map((entry) => entry.name)).toEqual(["Other"]);
  });

  test("a name finds a preset first, then a saved theme", () => {
    const saved = with_saved([], "Mine", generated);
    expect(find_theme("Brand Dark", saved)).toBe(THEMES["Brand Dark"]);
    expect(find_theme("mine", saved)).toEqual(generated);
    expect(find_theme("Nope", saved)).toBeUndefined();
  });
});

// The owner's checkout layout; elsewhere the parity checks skip. Both webos modules import only types, so Bun runs them.
const WEBOS = join(import.meta.dir, "../../../orgs/lilbunnyrabbit/webos/src/lib/core/api/services/settings");
const has_webos = existsSync(join(WEBOS, "themes.ts")) && existsSync(join(WEBOS, "random-theme.ts"));

describe.skipIf(!has_webos)("webos parity", () => {
  test("every preset matches webos, name, order and value", async () => {
    const { THEME_PRESETS } = (await import(join(WEBOS, "themes.ts"))) as { THEME_PRESETS: { name: string; theme: Theme }[] };
    expect(Object.keys(THEMES)).toEqual(THEME_PRESETS.map((preset) => preset.name));
    for (const preset of THEME_PRESETS) expect(THEMES[preset.name]).toEqual(preset.theme);
  });

  test("the generator gives the same themes as webos", async () => {
    const webos = (await import(join(WEBOS, "random-theme.ts"))) as { generate_theme: typeof generate_theme };
    const seeded = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const cases: GenerateOptions[] = [
      { mode: "any", ...DEFAULT_GENERATE },
      { mode: "dark", harmony: "triadic", vibrance: 1, contrast: 0 },
      { mode: "light", harmony: "split", vibrance: 0, contrast: 1 },
      { mode: "light", ...DEFAULT_GENERATE, locked: { background: "oklch(0.250 0.0300 200.00)", primary: "oklch(0.750 0.1500 40.00)" } },
      { mode: "dark", ...DEFAULT_GENERATE, locked: { foreground: "oklch(0.200 0.0100 90.00)" } },
    ];
    for (const [at, options] of cases.entries()) {
      const ours = seeded(at + 1);
      const theirs = seeded(at + 1);
      for (let run = 0; run < 20; run++) expect(generate_theme(options, ours)).toEqual(webos.generate_theme(options, theirs));
    }
  });
});
