import * as THREE from "three";
import { brand, color, dark, glow, mix, tones } from "../theme/palette";
import { FOG, SUN_DIR, sky_ceiling, sky_glsl, sky_tones } from "./sky";
import type { Lab } from "../theme/theme";

export interface MoodSpec {
  /** Height of the sun direction; below 0 puts it under the horizon, leaving only its glow. */
  sun_y: number;
  key: Lab;
  key_intensity: number;
  hemi_sky: Lab;
  hemi_ground: Lab;
  hemi_intensity: number;
  fog_near: number;
  fog_far: number;
  head_intensity: number;
  head_range: number;
  bloom: number;
  /** UnrealBloomPass radius, 0-1: how far a glow spreads past its lamp. */
  bloom_radius: number;
  bloom_threshold: number;
}

// Near-flat falloff: an inverse-power light outshines the sun by 10x on anything a few metres ahead and clips it white
// with no tone mapping; the range cutoff and the angle the beam meets the road at give the far fade instead.
const HEAD_DECAY = 0.3;
/**
 * The beam's source, metres over the car's origin, above any real lamp: from bumper height the beam met the road at a
 * few degrees and left no pool, while a wall still took it head on. From up here the road takes the beam at about 15
 * degrees, and tilted down by `HEAD_TILT` (radians) the cone's soft top edge fades out before far walls and trees.
 */
const HEAD_LIFT = 2.4;
const HEAD_TILT = 0.3;
const HEAD_CONE = 0.42;
const HEAD_SOFT = 0.55;
/** Brightest the sky around the sun and the sky track's cloud floor may get, as a share of the bloom threshold. */
const SKY_CEILING = 0.9;
/** Half the side of the sun's shadow box, metres: the car's shadow keeps more texels per metre than a town-wide box gave. */
const SHADOW_REACH = 28;
/**
 * Lowest the sun stands for its shadow, as the height of its unit direction. A shadow texel smears along the light by
 * 1 / sin of the angle the light meets the ground at: the dusk sun (15 degrees) on a slope falling away from it met the
 * ground at a few degrees and dragged the car's shadow metres downhill in jagged streaks. The shading keeps the true sun.
 */
const SHADOW_SUN_Y = 0.6;
/** PCF blur radius in shadow texels, so the car's shadow edge reads soft rather than stepped. */
const SHADOW_SOFT = 2.5;

const DUSK: MoodSpec = {
  sun_y: 0.26,
  key: sky_tones.sunlight,
  key_intensity: 4,
  hemi_sky: sky_tones.skylight,
  hemi_ground: brand.background_darkest,
  hemi_intensity: 1.3,
  fog_near: 120,
  fog_far: 1300,
  head_intensity: 22,
  head_range: 40,
  // Bloom adds in proportion to a lamp's colour: at 0.6 a wide braking tail washed the whole rear of the car red.
  bloom: 0.2,
  bloom_radius: 0,
  bloom_threshold: 0.9,
};

/** What a world kind may shift over its theme's mood; the theme stays the main look control. */
export type MoodDelta = Partial<Pick<MoodSpec, "sun_y" | "key" | "hemi_sky" | "fog_near" | "fog_far" | "hemi_ground">>;

const DAY: MoodSpec = {
  sun_y: 0.45,
  key: sky_tones.sunlight,
  key_intensity: 3.1,
  hemi_sky: sky_tones.skylight,
  hemi_ground: mix(brand.foreground, brand.background_darkest, 0.4),
  hemi_intensity: 1.1,
  fog_near: 150,
  fog_far: 1300,
  head_intensity: 1.5,
  head_range: 70,
  bloom: 0.2,
  bloom_radius: 0.45,
  bloom_threshold: 0.98,
};

/**
 * Farthest ground distance, in metres, that is not pure fog. Linear fog runs on view depth, which toward the sides of a
 * wide screen reaches well past `fog_far`; radial fog runs on distance and ends at `fog_far` in every direction.
 */
export function fog_reach(camera: THREE.PerspectiveCamera, fog_far: number, radial: boolean): number {
  if (radial) return fog_far;
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return fog_far * Math.sqrt(1 + tan * tan * (1 + camera.aspect * camera.aspect));
}

/**
 * Fog fades to the sky behind each vertex instead of one flat colour: the horizon is warm toward the sun and cool away
 * from it, and one fog colour left far ground as a grey band under both. Worked out per vertex, so a fragment pays
 * nothing more. `radial` fogs on distance instead of view depth.
 */
function sky_fog(radial: boolean) {
  const chunk = THREE.ShaderChunk;
  if (chunk.fog_pars_vertex.includes("vFogColor")) return;
  const patch = (name: "fog_pars_vertex" | "fog_vertex" | "fog_pars_fragment" | "fog_fragment", from: string, to: string) => {
    if (!chunk[name].includes(from)) throw new Error(`three's ${name} chunk changed; the fog does not follow the sky`);
    chunk[name] = chunk[name].replace(from, to);
  };
  patch("fog_pars_vertex", "varying float vFogDepth;", `varying float vFogDepth; varying vec3 vFogColor; ${sky_glsl()}`);
  patch("fog_vertex", "vFogDepth = - mvPosition.z;", `vFogDepth = ${radial ? "length( mvPosition.xyz )" : "- mvPosition.z"}; vFogColor = sky_color( normalize( mvPosition.xyz * mat3( viewMatrix ) ) );`);
  patch("fog_pars_fragment", "varying float vFogDepth;", "varying float vFogDepth; varying vec3 vFogColor;");
  // three fogs after its colour space conversion: drawn straight to the canvas (no composer, as on phones) the linear
  // sky colour went in unconverted, and far ground stood dark against the sky instead of fading into it.
  patch("fog_fragment", "mix( gl_FragColor.rgb, fogColor, fogFactor )", "mix( gl_FragColor.rgb, linearToOutputTexel( vec4( vFogColor, 1.0 ) ).rgb, fogFactor )");
}

export class Lighting {
  readonly sun: THREE.DirectionalLight;
  readonly bloom: { strength: number; radius: number; threshold: number };
  private readonly spec: MoodSpec;
  private headlight: THREE.SpotLight | null = null;
  /** Where the shadow is cast from: the sun's bearing, never lower than `SHADOW_SUN_Y`. */
  private readonly shadow_dir = new THREE.Vector3();
  private readonly shadow_from = new THREE.Object3D();

  /** `radial` fogs on distance instead of view depth, so a phone's streamed chunks cover all the fog leaves visible. */
  constructor(scene: THREE.Scene, mood: MoodDelta, radial = false) {
    const spec = (this.spec = { ...(dark ? DUSK : DAY), ...mood });
    this.bloom = { strength: spec.bloom, radius: spec.bloom_radius, threshold: spec.bloom_threshold };
    sky_ceiling.value = spec.bloom_threshold * SKY_CEILING;
    // The sky shader and clouds read SUN_DIR when built, so it is set before `sky()` and `clouds()` run.
    const flat = Math.hypot(SUN_DIR.x, SUN_DIR.z);
    const horizontal = Math.sqrt(1 - spec.sun_y * spec.sun_y);
    SUN_DIR.set((SUN_DIR.x / flat) * horizontal, spec.sun_y, (SUN_DIR.z / flat) * horizontal);

    scene.fog = new THREE.Fog(FOG, spec.fog_near, spec.fog_far);
    sky_fog(radial);
    scene.add(new THREE.HemisphereLight(color(spec.hemi_sky), color(spec.hemi_ground), spec.hemi_intensity));
    this.sun = new THREE.DirectionalLight(color(spec.key), spec.key_intensity);
    Object.assign(this.sun.shadow.camera, { left: -SHADOW_REACH, right: SHADOW_REACH, top: SHADOW_REACH, bottom: -SHADOW_REACH, near: 1, far: 900 });
    this.sun.shadow.radius = SHADOW_SOFT;
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 0.015;
    scene.add(this.sun, this.sun.target);
    const shadow_y = Math.max(spec.sun_y, SHADOW_SUN_Y);
    const shadow_flat = Math.sqrt(1 - shadow_y * shadow_y);
    this.shadow_dir.set((SUN_DIR.x / horizontal) * shadow_flat, shadow_y, (SUN_DIR.z / horizontal) * shadow_flat);
    const { sun, shadow_from } = this;
    const update = sun.shadow.updateMatrices.bind(sun.shadow);
    // three reads only the light's world position and its target here; the stand-in carries the raised position.
    sun.shadow.updateMatrices = () => update(Object.assign(shadow_from, { target: sun.target }) as unknown as THREE.DirectionalLight);
  }

  /** `nose` is how far ahead of the car's origin its front ends, metres. */
  mount(car_root: THREE.Object3D, on: boolean, nose: number) {
    const headlight = (this.headlight = new THREE.SpotLight(glow(tones.head), 0, this.spec.head_range, HEAD_CONE, HEAD_SOFT, HEAD_DECAY));
    headlight.position.set(0, HEAD_LIFT, nose);
    headlight.target.position.set(0, HEAD_LIFT - Math.sin(HEAD_TILT), nose + Math.cos(HEAD_TILT));
    car_root.add(headlight, headlight.target);
    this.beam(on);
  }

  // Dimmed rather than hidden: a hidden light changes the scene's light count, which recompiles every shader.
  beam(on: boolean) {
    if (this.headlight) this.headlight.intensity = on ? this.spec.head_intensity : 0;
  }

  follow(at: THREE.Vector3) {
    this.sun.position.copy(at).addScaledVector(SUN_DIR, 400);
    this.sun.target.position.copy(at);
    this.shadow_from.position.copy(at).addScaledVector(this.shadow_dir, 400);
    this.shadow_from.updateMatrixWorld();
  }
}
