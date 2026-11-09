import { Color } from "three";
import { apply_theme, current_theme, read_tokens, type Lab } from "./theme";

export const theme_name = current_theme();
apply_theme(theme_name);
export const brand = read_tokens();
export const dark = brand.background[0] < 0.55;

export function mix(a: Lab, b: Lab, share: number): Lab {
  return [a[0] * share + b[0] * (1 - share), a[1] * share + b[1] * (1 - share), a[2] * share + b[2] * (1 - share)];
}

export function lighten(a: Lab, by: number): Lab {
  return [a[0] + by, a[1], a[2]];
}

export function linear([L, a, b]: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function color(lab: Lab): Color {
  const [r, g, b] = linear(lab);
  return new Color().setRGB(r, g, b);
}

/**
 * `color(lab)` scaled to `luma` (the bloom high-pass weights), so a lamp's emissive lands at the same brightness against
 * the bloom threshold in every theme.
 */
export function glow(lab: Lab, luma = 1): Color {
  const c = color(lab);
  return c.multiplyScalar(luma / Math.max(0.01, 0.299 * c.r + 0.587 * c.g + 0.114 * c.b));
}

export function rgba(lab: Lab, alpha = 1): string {
  const encode = (c: number) => Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
  const [r, g, b] = linear(lab).map(encode);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

// The ground keeps the theme's surface ladder but pulls it toward mid lightness: a sunlit 3D scene needs grass and rock
// that read in light and shade, which the flat UI extremes (near-black or near-white) don't.
const ground = dark ? brand.background_light : mix(brand.background_darker, brand.foreground, 0.75);

// Dusk value ladder, darkest up: asphalt, tree crowns, grass, road markings. At dusk light all four collapsed into one
// band, so each sits a fixed step apart in L.
const DUSK_GRASS_LIFT = 0.04;
const DUSK_CROWN_DROP = 0.06;
const grass = dark ? lighten(mix(brand.success, ground, 0.32), DUSK_GRASS_LIFT) : mix(brand.success, ground, 0.42);
const leaf_dark = mix(brand.success, dark ? brand.background : brand.foreground, 0.28);
const asphalt = dark ? brand.background_darkest : mix(brand.foreground, brand.background_darkest, 0.62);

// A share of the asphalt-to-foreground range, not a fixed L step: on near-black roads a fixed step still renders black.
const DUSK_TYRE_STEP = 0.3;
const DUSK_TRIM_STEP = 0.38;
const above_asphalt = (share: number) => lighten(asphalt, (brand.foreground[0] - asphalt[0]) * share);

export const tones = {
  grass,
  grass_dry: mix(brand.warning, ground, dark ? 0.26 : 0.36),
  sand: mix(brand.warning, brand.foreground, 0.35),
  rock: dark ? brand.background_lightest : mix(brand.foreground, brand.background_darkest, 0.35),
  snow: dark ? brand.foreground : brand.background_lightest,
  asphalt,
  skid: dark ? brand.background_darkest : brand.foreground,
  line: dark ? brand.foreground : brand.background_lightest,
  edge_line: dark ? mix(brand.foreground, asphalt, 0.7) : brand.background_light,
  water: mix(brand.info, brand.background, 0.4),
  leaf: mix(brand.success, dark ? brand.background : ground, 0.44),
  leaf_dark: dark ? lighten(leaf_dark, grass[0] - DUSK_CROWN_DROP - leaf_dark[0]) : leaf_dark,
  trunk: mix(brand.warning, brand.background_darkest, 0.25),
  glass: dark ? brand.background_darkest : brand.foreground,
  tyre: dark ? above_asphalt(DUSK_TYRE_STEP) : mix(brand.foreground, brand.background_darkest, 0.8),
  trim: dark ? above_asphalt(DUSK_TRIM_STEP) : brand.foreground,
  hub: brand.foreground,
  post: brand.background_lightest,
  gate: dark ? brand.background_lightest : brand.background_darkest,
  check_dark: dark ? brand.background_darkest : brand.foreground,
  check_light: dark ? brand.foreground : brand.background_lightest,
  head: dark ? mix(brand.foreground, brand.warning, 0.85) : brand.background_lightest,
  reflector: dark ? brand.cottontail : brand.background_lightest,
  wall: mix(brand.foreground, ground, 0.6),
  wall_warm: mix(brand.warning, brand.foreground, 0.35),
  wall_cool: mix(brand.info, brand.foreground, 0.3),
  roof: mix(brand.error, brand.background_darkest, 0.5),
  roof_flat: dark ? brand.background_light : mix(brand.foreground, brand.background_darkest, 0.5),
  roof_slate: mix(brand.info, brand.background_darkest, 0.35),
  sidewalk: dark ? mix(brand.foreground, brand.background_lightest, 0.18) : mix(brand.foreground, brand.background_darkest, 0.35),
  shopfront: dark ? mix(brand.info, brand.background, 0.35) : mix(brand.info, brand.background_lightest, 0.4),
  shop_glow: dark ? mix(brand.warning, brand.cottontail, 0.6) : mix(brand.background_darker, brand.background_lightest, 0.5),
};

export const car_paints = [brand.primary, brand.secondary, brand.accent, brand.tertiary, brand.info, brand.cottontail, brand.error];

// Dark themes have no neutral lighter than the paints (foreground sits at their lightness), so the light ink is lifted.
/** Build `ink` indices: the two neutrals first, then the paints. */
export const decal_inks = [dark ? lighten(brand.foreground, 0.18) : brand.background_lightest, tones.check_dark, ...car_paints];
export const NEUTRAL_INKS = 2;
