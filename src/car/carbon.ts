import * as THREE from "three";
import { color } from "../theme/palette";
import type { Lab } from "../theme/theme";

/** A 2x2 twill painted over the body in the shader: the hull has no UVs, so each face takes the box plane it faces most. */
export interface Weave {
  /** Tow width, metres. */
  tow: number;
  /** 0-1, how much a tow darkens as the view runs along it: the checker that flips as the car turns. */
  sheen: number;
  base: Lab;
  thread: Lab;
}

/** How tightly the darkening hugs the view running along a tow. */
const SHEEN_POWER = 6;
/** Share of a tow's light its crossing ends lose, where it dips under the next. */
const TOW_DIP = 0.2;
/** Pixels per tow over which the weave fades to its mean: wider and the chase camera sees moire. */
const FADE_FROM = 0.35;
const FADE_TO = 0.85;
const TOW_MEAN = 0.5;
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
float weave_lit(vec3 tow, vec3 view) {
  float along = dot(normalize(tow), view);
  return mix(1.0, pow(1.0 - along * along, ${SHEEN_POWER.toFixed(1)}), weave_sheen);
}
`;

const FRAGMENT_BODY = `#include <color_fragment>
  vec3 weave_view = normalize(vViewPosition);
  vec2 weave_g = v_weave / weave_tow;
  vec2 weave_cell = floor(weave_g);
  vec2 weave_f = fract(weave_g);
  bool weave_warp = mod(weave_cell.x - weave_cell.y, 4.0) < 2.0;
  float weave_across = weave_warp ? weave_f.x : weave_f.y;
  float weave_along = weave_warp ? weave_f.y : weave_f.x;
  float weave_round = sqrt(sin(3.14159 * weave_across)) * (${(1 - TOW_DIP).toFixed(2)} + ${TOW_DIP.toFixed(2)} * sin(3.14159 * weave_along));
  float weave_level = weave_round * weave_lit(weave_warp ? v_tow_v : v_tow_u, weave_view);
  vec2 weave_px = fwidth(weave_g);
  weave_level = mix(weave_level, ${TOW_MEAN.toFixed(2)}, smoothstep(${FADE_FROM.toFixed(2)}, ${FADE_TO.toFixed(2)}, max(weave_px.x, weave_px.y)));
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
  shader.fragmentShader = `${FRAGMENT_HEAD}${shader.fragmentShader
    .replace("#include <color_fragment>", FRAGMENT_BODY)
    .replace("#include <lights_fragment_end>", GLINT)}`;
}

/** Program cache key: a weave hull compiles its own program, apart from the plain metal one. */
export const WEAVE_KEY = "weave";
