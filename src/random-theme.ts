// Mirrors webos src/lib/core/api/services/settings/random-theme.ts; theme.test.ts checks the two give the same themes.
import type { Theme, ThemeBase } from "./theme";

export const Harmony = {
  ANALOGOUS: "analogous",
  COMPLEMENTARY: "complementary",
  TRIADIC: "triadic",
  SPLIT: "split",
} as const;
export type Harmony = (typeof Harmony)[keyof typeof Harmony];

/** Hue offsets for primary, secondary and accent around the base hue. */
const HARMONIES: Record<Harmony, [number, number, number]> = {
  analogous: [0, 30, -30],
  complementary: [0, 180, 30],
  triadic: [0, 120, 240],
  split: [0, 150, 210],
};

export type ThemeMode = "dark" | "light" | "any";

export interface GenerateOptions {
  mode: ThemeMode;
  harmony: Harmony | "any";
  /** 0 muted, 1 vivid: the chroma of the colours and the tint of the background. */
  vibrance: number;
  /** 0 soft, 1 strong: how far the background sits from the text, never under the readable minimum. */
  contrast: number;
  /** Colours kept as they are; the rest are placed around them. */
  locked?: Partial<ThemeBase>;
}

export const DEFAULT_GENERATE: Omit<GenerateOptions, "mode"> = { harmony: "any", vibrance: 0.5, contrast: 0.5 };

export const MIN_TEXT_CONTRAST = 0.55;
export const MIN_COLOUR_CONTRAST = 0.35;

interface Oklch {
  l: number;
  c: number;
  h: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * clamp(t, 0, 1);
const format = ({ l, c, h }: Oklch) => `oklch(${l.toFixed(3)} ${c.toFixed(4)} ${(((h % 360) + 360) % 360).toFixed(2)})`;

/** An `oklch(…)` value's channels, `null` for anything else. */
export function parse_oklch(value: string): Oklch | null {
  const match = value.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/);
  if (!match) return null;
  return { l: Number(match[1]) / (match[2] ? 100 : 1), c: Number(match[3]), h: Number(match[4]) };
}

/** Lightness of an `oklch(…)` value, `null` for anything else. */
export function oklch_lightness(value: string): number | null {
  const match = value.match(/^oklch\(\s*([\d.]+)(%?)/);
  if (!match) return null;
  return Number(match[1]) / (match[2] ? 100 : 1);
}

/** Dark unless the background is clearly light; values the parser can't read count as dark, the brand default. */
export function is_dark(theme: Pick<Theme, "background">): boolean {
  return (oklch_lightness(theme.background) ?? 0) < 0.6;
}

const gap = (token: keyof ThemeBase) => (token === "foreground" ? MIN_TEXT_CONTRAST : MIN_COLOUR_CONTRAST);
const OTHERS = ["foreground", "primary", "secondary", "accent"] as const;

/** Whether a background exists in that mode that keeps every locked text and colour readable. */
function fits(locked: Partial<ThemeBase>, dark: boolean): boolean {
  return OTHERS.every((token) => {
    const l = locked[token] ? oklch_lightness(locked[token]) : null;
    return l === null || (dark ? l - gap(token) >= 0 : l + gap(token) <= 1);
  });
}

/**
 * Five base colours under rules (ADR-015 revision): one base hue and a harmony place primary, secondary and accent; the
 * background is a tint of the base hue, the foreground a near-neutral of the opposite hue. Generated colours always keep
 * text 0.55+ and colours 0.35+ lightness from the background. Locked colours win: a lock that only fits the other mode flips
 * it, and a lock that fits neither stays as given.
 */
export function generate_theme(options: GenerateOptions, rand: () => number = Math.random): ThemeBase {
  const locked = options.locked ?? {};
  const read = (token: keyof ThemeBase) => (locked[token] ? parse_oklch(locked[token]) : null);
  const locked_background = read("background");
  const preferred = options.mode === "any" ? rand() < 0.5 : options.mode === "dark";
  const dark = locked_background ? locked_background.l < 0.6 : fits(locked, preferred) || !fits(locked, !preferred) ? preferred : !preferred;

  const names = Object.keys(HARMONIES) as Harmony[];
  const harmony = options.harmony === "any" ? names[Math.floor(rand() * names.length)] : options.harmony;
  const [p, s, a] = HARMONIES[harmony];
  const hue = read("primary")?.h ?? locked_background?.h ?? rand() * 360;
  const { vibrance, contrast } = options;
  const jitter = (spread: number) => (rand() - 0.5) * spread;

  const colour = (offset: number): Oklch => ({
    l: dark ? lerp(0.66, 0.82, rand()) : lerp(0.42, 0.56, rand()),
    c: lerp(0.05, 0.3, vibrance) * lerp(0.8, 1.2, rand()),
    h: hue + offset + jitter(16),
  });
  const generated = {
    background: {
      l: dark ? clamp(lerp(0.3, 0.12, contrast) + jitter(0.04), 0.1, 0.3) : clamp(lerp(0.9, 0.98, contrast) + jitter(0.02), 0.9, 0.985),
      c: lerp(0.008, 0.07, vibrance) * lerp(0.5, 1, rand()),
      h: hue,
    },
    foreground: {
      l: dark ? clamp(lerp(0.86, 0.97, contrast) + jitter(0.03), 0.86, 0.98) : clamp(lerp(0.34, 0.16, contrast) + jitter(0.03), 0.12, 0.34),
      c: lerp(0.005, 0.03, rand()),
      h: hue + 180,
    },
    primary: colour(p),
    secondary: colour(s),
    accent: colour(a),
  };

  // The background moves away from locked text and colours, then the generated ones move away from the background.
  if (!locked_background) {
    for (const token of OTHERS) {
      const kept = read(token);
      if (!kept) continue;
      generated.background.l = dark ? Math.min(generated.background.l, kept.l - gap(token)) : Math.max(generated.background.l, kept.l + gap(token));
    }
    generated.background.l = clamp(generated.background.l, 0, 1);
  }
  const background_l = locked_background?.l ?? generated.background.l;
  for (const token of OTHERS) {
    const value = generated[token];
    value.l = dark ? clamp(Math.max(value.l, background_l + gap(token)), 0, 0.99) : clamp(Math.min(value.l, background_l - gap(token)), 0.02, 1);
  }

  const pick = (token: keyof ThemeBase) => locked[token] ?? format(generated[token]);
  return {
    background: pick("background"),
    foreground: pick("foreground"),
    primary: pick("primary"),
    secondary: pick("secondary"),
    accent: pick("accent"),
  };
}
