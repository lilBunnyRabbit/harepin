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

export function rgba(lab: Lab, alpha = 1): string {
  const encode = (c: number) => Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
  const [r, g, b] = linear(lab).map(encode);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

// The ground keeps the theme's surface ladder but pulls it toward mid lightness: a sunlit 3D scene needs grass and rock
// that read in light and shade, which the flat UI extremes (near-black or near-white) don't.
const ground = dark ? brand.background_light : mix(brand.background_darker, brand.foreground, 0.75);

export const tones = {
  grass: mix(brand.success, ground, dark ? 0.32 : 0.42),
  grass_dry: mix(brand.warning, ground, dark ? 0.26 : 0.36),
  sand: mix(brand.warning, brand.foreground, 0.35),
  rock: dark ? brand.background_lightest : mix(brand.foreground, brand.background_darkest, 0.35),
  snow: dark ? brand.foreground : brand.background_lightest,
  asphalt: dark ? brand.background_dark : mix(brand.foreground, brand.background_darkest, 0.62),
  skid: dark ? brand.background_darkest : brand.foreground,
  line: dark ? brand.foreground : brand.background_lightest,
  edge_line: dark ? brand.cottontail : brand.background_light,
  water: mix(brand.info, brand.background, 0.4),
  leaf: mix(brand.success, dark ? brand.background : ground, 0.44),
  leaf_dark: mix(brand.success, dark ? brand.background : brand.foreground, 0.28),
  trunk: mix(brand.warning, brand.background_darkest, 0.25),
  glass: dark ? brand.background_darkest : brand.foreground,
  tyre: dark ? brand.background_darkest : mix(brand.foreground, brand.background_darkest, 0.8),
  trim: dark ? brand.background_darkest : brand.foreground,
  hub: brand.foreground,
  post: brand.background_lightest,
  gate: dark ? brand.background_lightest : brand.background_darkest,
  check_dark: dark ? brand.background_darkest : brand.foreground,
  check_light: dark ? brand.foreground : brand.background_lightest,
  head: dark ? brand.cottontail : brand.background_lightest,
  wall: mix(brand.foreground, ground, 0.6),
  wall_warm: mix(brand.warning, brand.foreground, 0.35),
  wall_cool: mix(brand.info, brand.foreground, 0.3),
  roof: mix(brand.error, brand.background_darkest, 0.5),
  roof_flat: dark ? brand.background_light : mix(brand.foreground, brand.background_darkest, 0.5),
  roof_slate: mix(brand.info, brand.background_darkest, 0.35),
  sidewalk: dark ? mix(brand.foreground, brand.background_lightest, 0.18) : mix(brand.foreground, brand.background_darkest, 0.35),
  shopfront: dark ? brand.background_darkest : mix(brand.foreground, brand.info, 0.8),
};

export const car_paints = [brand.primary, brand.secondary, brand.accent, brand.tertiary, brand.info, brand.cottontail, brand.error];
