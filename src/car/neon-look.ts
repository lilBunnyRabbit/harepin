import * as THREE from "three";
import { NEONS, NEON_TONES, type Build, type Neon } from "./build";
import { DECAL_ORDER, ground_fade, lay_on_ground, type ContactShadow } from "./contact-shadow";
import type { Design } from "./designs";
import { paint_lab } from "./paint";
import { brand, color, dark, in_gamut } from "../theme/palette";
import type { Lab } from "../theme/theme";
import type { World } from "../world/world";
import { exp } from "../sim-math";

type Lit = Exclude<Neon, "none">;

export interface NeonLook {
  style: Lit;
  tone: Lab;
}

/** Metres the light reaches past the body's outline. */
const SPILL: Record<Lit, number> = { pool: 1.15, ring: 0.7 };
const STRENGTH: Record<Lit, number> = { pool: 1.2, ring: 1.3 };
// Additive light on a sunlit road has little left to add: by day the glow is a faint tint, and no gain makes it more.
const DAY_GAIN = 1.4;
const POOL_ORDER = DECAL_ORDER + 0.5;
/** Metres of road that carry the ring's bright band once round. */
const BAND_METRES = 9;
/** The glow's level while the nitro fires, against 1, and how fast it gets there, per second. */
const FLARE = 1.6;
const FLARE_RATE = 9;
const LIGHT_STEP = 0.1;
/** Lightness a tone is raised to on a light page: nothing there is brighter than the page white, so the glow is the tone as a pastel, not the tone itself, which is darker than the page and stains it. */
const PAGE_GLOW = 0.86;

export interface NeonView {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  phase: THREE.IUniform<number>;
  level: THREE.IUniform<number>;
  /** `level` of the glow at rest on the ground. */
  gain: number;
  /** Height of the car origin over the ground where the glow starts to fade. */
  ride: number;
  /** 1 on the ground, 0 once the car is too high to light it. */
  fade: number;
  flare: number;
  /** Time in seconds `light_neon` last ran. */
  at: number;
}

const VERTEX = `
uniform float centre;
varying vec2 at;
void main() {
  at = vec2(position.x, position.z - centre);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = `
uniform vec3 tone;
uniform vec2 half_size;
uniform float spill;
uniform float level;
uniform float phase;
varying vec2 at;
void main() {
  float corner = 0.35;
  vec2 q = abs(at) - half_size + corner;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - corner;
  float out_fall = exp(-max(d, 0.0) / (spill * 0.33));
  float edge = 1.0 - smoothstep(spill * 0.55, spill, d);
#ifdef RING
  float line = exp(-pow((d - 0.16) / 0.07, 2.0));
  float band = pow(0.5 + 0.5 * cos(3.14159 * (at.y / half_size.y) + phase * 6.28318), 3.0);
  float light = (line + 0.16 * out_fall) * mix(0.3, 1.0, band);
#else
  float light = out_fall * mix(0.55, 1.0, smoothstep(-0.5, 0.0, d));
#endif
  gl_FragColor = vec4(tone, min(1.0, light * edge * level));
}`;

export function neon_look(build: Build): NeonLook | null {
  const style = NEONS[build.neon] ?? "none";
  if (style === "none") return null;
  const tone = NEON_TONES[build.neon_tone] ?? NEON_TONES[0];
  return { style, tone: tone === "paint" ? paint_lab(build.paint) : brand[tone] };
}

/** The light a car throws on the ground under it, one draw: it lies in the world, not in the car's root, so the caller adds `mesh` to the scene. */
export function neon_view(d: Design, look: NeonLook, ride: number): NeonView {
  const nose = d.outline[0][0];
  const tail = d.outline[d.outline.length - 1][0];
  const half_x = d.width / 2;
  const half_z = (nose - tail) / 2;
  const centre = (nose + tail) / 2;
  const spill = SPILL[look.style];
  const phase = { value: 0 };
  const level = { value: 0 };
  const material = new THREE.ShaderMaterial({
    uniforms: { tone: { value: color(look.tone) }, half_size: { value: new THREE.Vector2(half_x, half_z) }, spill: { value: spill }, centre: { value: centre }, level, phase },
    defines: look.style === "ring" ? { RING: 1 } : {},
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * (half_x + spill), 2 * (half_z + spill)).rotateX(-Math.PI / 2).translate(0, 0, centre), material);
  mesh.renderOrder = POOL_ORDER;
  return { mesh, phase, level, gain: STRENGTH[look.style] * (dark ? 1 : DAY_GAIN), ride, fade: 1, flare: 1, at: 0 };
}

/** On the ground patch `shadow` was just placed on, fading with it as the car leaves the ground. */
export function neon_under(neon: NeonView, shadow: ContactShadow) {
  neon.mesh.position.copy(shadow.mesh.position);
  neon.mesh.quaternion.copy(shadow.mesh.quaternion);
  neon.fade = shadow.material.opacity / shadow.strength;
}

/** For a car drawn without a contact shadow: on the ground under (`x`, `z`), as `place_contact_shadow` lays its patch. */
export function place_neon(neon: NeonView, x: number, y: number, z: number, heading: number, world: World) {
  neon.fade = ground_fade(lay_on_ground(neon.mesh, x, y, z, heading, world, world.drawn_lift(x, z, y)), neon.ride);
}

/** This frame's light: the ring's band runs back with the road at `speed` m/s, the glow flares while `boost` fires; `time` in seconds. */
export function light_neon(neon: NeonView, speed: number, boost: boolean, time: number, opacity = 1) {
  const dt = Math.min(LIGHT_STEP, Math.max(0, time - neon.at));
  neon.at = time;
  neon.phase.value = (neon.phase.value + (speed * dt) / BAND_METRES) % 1;
  neon.flare += ((boost ? FLARE : 1) - neon.flare) * (1 - exp(-FLARE_RATE * dt));
  neon.level.value = neon.gain * neon.fade * neon.flare * opacity;
}

/** Lit as under a standing car, for a view no frame loop drives: the garage stand, a review sheet. */
export function rest_neon(neon: NeonView, share = 1) {
  neon.level.value = neon.gain * share;
}

/** The glow's tone over a light page: its hue, no darker than `PAGE_GLOW`, its chroma cut to what sRGB holds that light. */
export const page_glow = (tone: Lab): Lab => in_gamut([Math.max(tone[0], PAGE_GLOW), tone[1], tone[2]]);

/** For a stand with no ground to add light to: the glow blends over a light page as `page_glow` of its tone, at `share` of its strength. */
export function tint_page(neon: NeonView, look: NeonLook, share: number) {
  neon.mesh.material.uniforms.tone.value = color(page_glow(look.tone));
  rest_neon(neon, share);
}

export function dispose_neon(neon: NeonView) {
  neon.mesh.geometry.dispose();
  neon.mesh.material.dispose();
}
