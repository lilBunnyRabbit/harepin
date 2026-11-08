// Mirrors webos src/lib/core/api/services/settings/themes.ts (presets, derive_theme, surface ladder); no shared package,
// keep in sync by hand.
export const TOKENS = [
  "background_lightest",
  "background_lighter",
  "background_light",
  "background",
  "background_dark",
  "background_darker",
  "background_darkest",
  "foreground",
  "primary",
  "secondary",
  "tertiary",
  "accent",
  "cottontail",
  "success",
  "warning",
  "error",
  "info",
] as const;
export type Token = (typeof TOKENS)[number];
export type Theme = Record<Token, string>;

const BRAND_DARK: Theme = {
  background_lightest: "oklch(0.357 0.0326 230.47)",
  background_lighter: "oklch(0.323 0.0295 230.47)",
  background_light: "oklch(0.289 0.0264 230.47)",
  background: "oklch(0.255 0.0233 230.47)",
  background_dark: "oklch(0.221 0.0202 230.47)",
  background_darker: "oklch(0.187 0.0171 230.47)",
  background_darkest: "oklch(0.153 0.014 230.47)",
  foreground: "oklch(0.745 0.0078 50.47)",
  primary: "oklch(0.745 0.0699 122.47)",
  secondary: "oklch(0.745 0.0466 302.47)",
  tertiary: "oklch(0.745 0.0233 176.47)",
  accent: "oklch(0.745 0.0932 50.47)",
  cottontail: "oklch(0.949 0.0939 122.47)",
  success: "oklch(0.745 0.1398 140)",
  warning: "oklch(0.745 0.1398 70)",
  error: "oklch(0.745 0.1398 30)",
  info: "oklch(0.745 0.1398 240)",
};

const BRAND_LIGHT: Theme = {
  background_lightest: "oklch(1 0 0)",
  background_lighter: "oklch(0.983 0.0086 86.47)",
  background_light: "oklch(0.966 0.0172 86.47)",
  background: "oklch(0.949 0.0259 86.47)",
  background_dark: "oklch(0.8907 0.0566 86.47)",
  background_darker: "oklch(0.8325 0.0777 86.47)",
  background_darkest: "oklch(0.7742 0.0723 86.47)",
  foreground: "oklch(0.3982 0.0233 266.47)",
  primary: "oklch(0.4743 0.0778 50.47)",
  secondary: "oklch(0.4743 0.0519 190)",
  tertiary: "oklch(0.4743 0.0259 302.47)",
  accent: "oklch(0.4743 0.1037 338.47)",
  cottontail: "oklch(0.5002 0.1314 50.47)",
  success: "oklch(0.4745 0.1538 140.32)",
  warning: "oklch(0.4761 0.1064 113.24)",
  error: "oklch(0.4743 0.1556 30)",
  info: "oklch(0.4829 0.1244 246.07)",
};

const WHILE_TRUE: Theme = {
  background_lightest: "oklch(1 0 0)",
  background_lighter: "oklch(1 0 0)",
  background_light: "oklch(0.995 0.004 66.05)",
  background: "oklch(0.985 0.012 66.05)",
  background_dark: "oklch(0.94 0.04 62)",
  background_darker: "oklch(0.86 0.1 58)",
  background_darkest: "oklch(0.787 0.1433 55.27)",
  foreground: "oklch(0.15 0.0339 281.52)",
  primary: "oklch(0.15 0.0339 281.52)",
  secondary: "oklch(0.6 0.17 48)",
  tertiary: "oklch(0.45 0.12 276)",
  accent: "oklch(0.55 0.16 276)",
  cottontail: "oklch(0.15 0.0339 281.52)",
  success: "oklch(0.4745 0.1538 140.32)",
  warning: "oklch(0.4761 0.1064 113.24)",
  error: "oklch(0.4743 0.1556 30)",
  info: "oklch(0.4829 0.1244 246.07)",
};

const SURFACE_STEPS: Partial<Record<Token, number>> = {
  background_lightest: 3,
  background_lighter: 2,
  background_light: 1,
  background_dark: -1,
  background_darker: -2,
  background_darkest: -3,
};

function derive_theme([background, foreground, primary, secondary, accent]: [string, string, string, string, string]): Theme {
  const surfaces = Object.fromEntries(
    Object.entries(SURFACE_STEPS).map(([token, step]) => [
      token,
      step! < 0
        ? `oklch(from var(--background) calc(l - min(${-step! * 0.034}, l * ${-step! * 0.3})) c h)`
        : `oklch(from var(--background) calc(max(l, 0.12) + min(${step! * 0.034}, (1 - max(l, 0.12)) * ${step! * 0.3})) c h)`,
    ]),
  );
  return {
    ...(surfaces as Pick<Theme, "background_lightest" | "background_lighter" | "background_light" | "background_dark" | "background_darker" | "background_darkest">),
    background,
    foreground,
    primary,
    secondary,
    accent,
    tertiary: "color-mix(in oklch, var(--primary), var(--secondary))",
    cottontail: "oklch(from var(--primary) calc(l + 0.2) calc(c * 1.34) h)",
    success: "oklch(from var(--primary) l 0.14 140)",
    warning: "oklch(from var(--primary) l 0.14 70)",
    error: "oklch(from var(--primary) l 0.14 30)",
    info: "oklch(from var(--primary) l 0.14 240)",
  };
}

export const THEMES: Record<string, Theme> = {
  "Brand Dark": BRAND_DARK,
  "Brand Light": BRAND_LIGHT,
  "Light Pastel Blue": derive_theme(["oklch(0.98 0.01 250)", "oklch(0.22 0.02 80)", "oklch(0.7 0.09 200)", "oklch(0.7 0.09 20)", "oklch(0.7 0.09 320)"]),
  "Red & Black": derive_theme(["oklch(0.45 0.22 29)", "oklch(0.15 0.01 0)", "oklch(0.85 0.02 29)", "oklch(0.7 0.13 80)", "oklch(0.7 0.13 340)"]),
  "Dark Warm": derive_theme(["oklch(0.15 0.03 40)", "oklch(0.85 0.02 120)", "oklch(0.65 0.1 60)", "oklch(0.65 0.1 240)", "oklch(0.65 0.1 180)"]),
  "Dark Purple": derive_theme(["oklch(0.35 0.04 300)", "oklch(0.9 0.015 60)", "oklch(0.8 0.08 270)", "oklch(0.8 0.08 90)", "oklch(0.8 0.08 180)"]),
  "Mid-tone Green": derive_theme(["oklch(0.5 0.06 120)", "oklch(0.95 0.01 300)", "oklch(0.7 0.12 30)", "oklch(0.7 0.12 210)", "oklch(0.7 0.12 330)"]),
  "Dark Cool": derive_theme(["oklch(0.22 0.025 270)", "oklch(0.8 0.02 180)", "oklch(0.6 0.09 350)", "oklch(0.6 0.09 170)", "oklch(0.6 0.09 90)"]),
  "Warm Sunset": derive_theme(["oklch(0.18 0.04 30)", "oklch(0.92 0.01 50)", "oklch(0.7 0.15 40)", "oklch(0.65 0.13 320)", "oklch(0.75 0.14 60)"]),
  "Ocean Breeze": derive_theme(["oklch(0.95 0.02 220)", "oklch(0.2 0.03 240)", "oklch(0.6 0.14 210)", "oklch(0.65 0.1 190)", "oklch(0.7 0.12 160)"]),
  "Forest Night": derive_theme(["oklch(0.2 0.04 160)", "oklch(0.88 0.015 140)", "oklch(0.65 0.13 145)", "oklch(0.7 0.1 110)", "oklch(0.75 0.11 80)"]),
  "Lavender Dream": derive_theme(["oklch(0.96 0.025 310)", "oklch(0.28 0.04 290)", "oklch(0.68 0.14 285)", "oklch(0.72 0.11 310)", "oklch(0.65 0.13 340)"]),
  "Monochrome Dark": derive_theme(["oklch(0.18 0.01 0)", "oklch(0.85 0.01 0)", "oklch(0.5 0.02 0)", "oklch(0.4 0.015 0)", "oklch(0.65 0.02 0)"]),
  "Vibrant Coral": derive_theme(["oklch(0.25 0.03 350)", "oklch(0.93 0.01 30)", "oklch(0.7 0.18 15)", "oklch(0.65 0.16 340)", "oklch(0.75 0.17 50)"]),
  "Neon Black": derive_theme(["oklch(0.0 0 0)", "oklch(1.0 0 0)", "oklch(0.75 0.3 145)", "oklch(0.75 0.3 330)", "oklch(0.75 0.3 60)"]),
  "Electric White": derive_theme(["oklch(1.0 0 0)", "oklch(0.0 0 0)", "oklch(0.55 0.35 265)", "oklch(0.6 0.32 340)", "oklch(0.65 0.33 100)"]),
  "Deep Neon": derive_theme(["oklch(0.05 0 0)", "oklch(0.98 0.01 0)", "oklch(0.8 0.28 195)", "oklch(0.8 0.28 310)", "oklch(0.8 0.28 45)"]),
  Cyberpunk: derive_theme(["oklch(0.1 0.05 290)", "oklch(0.95 0.03 180)", "oklch(0.7 0.35 325)", "oklch(0.75 0.32 200)", "oklch(0.8 0.3 55)"]),
  "Terminal Green": derive_theme(["oklch(0.0 0 0)", "oklch(0.85 0.22 145)", "oklch(0.75 0.25 145)", "oklch(0.65 0.2 145)", "oklch(0.8 0.28 85)"]),
  "High Visibility": derive_theme(["oklch(0.98 0.005 80)", "oklch(0.15 0.01 280)", "oklch(0.45 0.35 260)", "oklch(0.5 0.3 30)", "oklch(0.4 0.32 340)"]),
  "Black & White": derive_theme(["oklch(0.0 0 0)", "oklch(1.0 0 0)", "oklch(0.6 0 0)", "oklch(0.4 0 0)", "oklch(0.8 0 0)"]),
  "Speed Reader Light": derive_theme(["oklch(0.976 0.022 80.58)", "oklch(0.586 0.0467 242.26)", "oklch(0.75 0.0905 55.2)", "oklch(0.836 0.1393 129.45)", "oklch(0.679 0.1263 20.92)"]),
  "Speed Reader Dark": derive_theme(["oklch(0.278 0.0269 229.12)", "oklch(0.775 0.0171 95.16)", "oklch(0.863 0.0575 65.19)", "oklch(0.907 0.0926 128.53)", "oklch(0.803 0.078 18.92)"]),
  "While True": WHILE_TRUE,
};

const STORAGE_KEY = "harepin:theme";
const DEFAULT_THEME = "Brand Dark";

export function current_theme(): string {
  const asked = new URLSearchParams(location.search).get("theme");
  if (asked && THEMES[asked]) return asked;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES[saved]) return saved;
  } catch {}
  return DEFAULT_THEME;
}

export function choose_theme(name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {}
}

export function apply_theme(name: string) {
  const theme = THEMES[name] ?? THEMES[DEFAULT_THEME];
  for (const token of TOKENS) document.documentElement.style.setProperty(`--${token.replaceAll("_", "-")}`, theme[token]);
}

export type Lab = [number, number, number];

function srgb_to_oklab(r: number, g: number, b: number): Lab {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

// Tokens can be relative colours (`oklch(from var(--primary) …)`) or color-mix, which only the browser resolves, so each
// one goes through a probe's computed colour and a 1-pixel canvas to land as plain sRGB whatever syntax it came back in.
export function read_tokens(): Record<Token, Lab> {
  const probe = document.createElement("div");
  probe.style.display = "none";
  document.body.append(probe);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const out = {} as Record<Token, Lab>;
  for (const token of TOKENS) {
    probe.style.color = `var(--${token.replaceAll("_", "-")})`;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(probe).color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    out[token] = srgb_to_oklab(r / 255, g / 255, b / 255);
  }
  probe.remove();
  return out;
}
