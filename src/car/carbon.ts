import * as THREE from "three";
import { color } from "../theme/palette";
import type { Lab } from "../theme/theme";

export const WeavePattern = {
  TWILL: "twill",
  PLAIN: "plain",
  FORGED: "forged",
} as const;
export type WeavePattern = (typeof WeavePattern)[keyof typeof WeavePattern];

/** A weave painted over the body in the shader: the hull has no UVs, so each face takes the box plane it faces most. */
export interface Weave {
  pattern: WeavePattern;
  /** Tow width, metres; a forged flake spans about three. */
  tow: number;
  /** 0-1, how much a tow darkens as the view runs along it: the checker that flips as the car turns. */
  sheen: number;
  base: Lab;
  thread: Lab;
}

const PATTERN_ID: Record<WeavePattern, number> = { twill: 0, plain: 1, forged: 2 };
const FORGED_FLAKE = 3;
const GLINT_FLOOR = 0.15;
const GLINT_CAP = 0.3;

const VERTEX_HEAD = `varying vec2 v_weave;
varying vec3 v_tow_u;
varying vec3 v_tow_v;
`;

const VERTEX_BODY = `#include <begin_vertex>
  vec3 weave_n = abs(objectNormal);
  vec3 weave_u = weave_n.x >= weave_n.y && weave_n.x >= weave_n.z ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 weave_v = weave_n.y > weave_n.x && weave_n.y >= weave_n.z ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  v_weave = vec2(dot(transformed, weave_u), dot(transformed, weave_v));
  v_tow_u = normalize((modelViewMatrix * vec4(weave_u, 0.0)).xyz);
  v_tow_v = normalize((modelViewMatrix * vec4(weave_v, 0.0)).xyz);`;

const FRAGMENT_HEAD = `uniform vec3 weave_base;
uniform vec3 weave_thread;
uniform float weave_tow;
uniform float weave_sheen;
varying vec2 v_weave;
varying vec3 v_tow_u;
varying vec3 v_tow_v;
float weave_hash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float weave_lit(vec3 tow, vec3 view) {
  float along = dot(normalize(tow), view);
  return mix(1.0, pow(1.0 - along * along, 6.0), weave_sheen);
}
`;

// The tow pattern fades to its mean once a tow nears a pixel wide, or the chase camera sees moire instead of a weave.
const FRAGMENT_BODY = `#include <color_fragment>
  vec3 weave_view = normalize(vViewPosition);
  float weave_level;
#if WEAVE_PATTERN == 2
  vec2 weave_g = v_weave / (weave_tow * ${FORGED_FLAKE.toFixed(1)});
  vec2 weave_cell = floor(weave_g);
  float weave_near = 8.0;
  vec2 weave_id = weave_cell;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 c = weave_cell + vec2(float(x), float(y));
    vec2 p = c + vec2(weave_hash(c), weave_hash(c + 17.0));
    float d = length(weave_g - p);
    if (d < weave_near) { weave_near = d; weave_id = c; }
  }
  float weave_angle = weave_hash(weave_id + 41.0) * 3.14159;
  vec3 weave_dir = cos(weave_angle) * v_tow_u + sin(weave_angle) * v_tow_v;
  weave_level = (0.35 + 0.65 * weave_hash(weave_id + 7.0)) * weave_lit(weave_dir, weave_view);
  float weave_mean = 0.6;
#else
  vec2 weave_g = v_weave / weave_tow;
  vec2 weave_cell = floor(weave_g);
  vec2 weave_f = fract(weave_g);
#if WEAVE_PATTERN == 0
  bool weave_warp = mod(weave_cell.x - weave_cell.y, 4.0) < 2.0;
#else
  bool weave_warp = mod(weave_cell.x + weave_cell.y, 2.0) < 1.0;
#endif
  float weave_across = weave_warp ? weave_f.x : weave_f.y;
  float weave_along = weave_warp ? weave_f.y : weave_f.x;
  float weave_round = sqrt(sin(3.14159 * weave_across)) * (0.8 + 0.2 * sin(3.14159 * weave_along));
  weave_level = weave_round * weave_lit(weave_warp ? v_tow_v : v_tow_u, weave_view);
  float weave_mean = 0.5;
#endif
  vec2 weave_px = fwidth(weave_g);
  weave_level = mix(weave_level, weave_mean, smoothstep(0.35, 0.85, max(weave_px.x, weave_px.y)));
  diffuseColor.rgb = mix(weave_base, weave_thread, weave_level);`;

// A low sun's glint whited out the roof and hid the weave under it. Capped, the tows catch the glint and the resin
// between them takes only a share of it, so the highlight is where the weave reads best.
const GLINT = `#include <lights_fragment_end>
  float weave_glint = mix(${GLINT_FLOOR.toFixed(2)}, 1.0, weave_level);
  reflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(${GLINT_CAP.toFixed(2)})) * weave_glint;
  reflectedLight.indirectSpecular *= weave_glint;`;

export function weave_shader(shader: THREE.WebGLProgramParametersWithUniforms, weave: Weave) {
  shader.uniforms.weave_base = { value: color(weave.base) };
  shader.uniforms.weave_thread = { value: color(weave.thread) };
  shader.uniforms.weave_tow = { value: weave.tow };
  shader.uniforms.weave_sheen = { value: weave.sheen };
  shader.vertexShader = VERTEX_HEAD + shader.vertexShader.replace("#include <begin_vertex>", VERTEX_BODY);
  shader.fragmentShader = `#define WEAVE_PATTERN ${PATTERN_ID[weave.pattern]}\n${FRAGMENT_HEAD}${shader.fragmentShader
    .replace("#include <color_fragment>", FRAGMENT_BODY)
    .replace("#include <lights_fragment_end>", GLINT)}`;
}

export const weave_key = (weave: Weave) => `weave:${weave.pattern}`;
