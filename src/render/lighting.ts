import * as THREE from "three";
import { brand, color, dark, glow, mix, tones } from "../theme/palette";
import { FOG, SUN_DIR, sky_ceiling, sky_tones } from "./sky";
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
  cloud_glow: number;
  bloom: number;
  bloom_threshold: number;
}

// Near-flat falloff: an inverse-power light at the bumper outshines the sun by 10x on anything a few metres ahead and
// clips it white with no tone mapping; the range cutoff and grazing angle on the road give the far fade instead.
const HEAD_DECAY = 0.3;
/** Brightest the sky around the sun and the sky track's cloud floor may get, as a share of the bloom threshold. */
const SKY_CEILING = 0.9;
/** Half the side of the sun's shadow box, metres: the car's shadow keeps more texels per metre than a town-wide box gave. */
const SHADOW_REACH = 28;
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
  head_intensity: 7,
  head_range: 70,
  cloud_glow: 0.35,
  bloom: 0.6,
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
  cloud_glow: 0.55,
  bloom: 0.2,
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

export class Lighting {
  readonly sun: THREE.DirectionalLight;
  readonly bloom: { strength: number; threshold: number };
  private readonly spec: MoodSpec;
  private headlight: THREE.SpotLight | null = null;

  /** `radial` fogs on distance instead of view depth, so a phone's streamed chunks cover all the fog leaves visible. */
  constructor(scene: THREE.Scene, mood: MoodDelta, radial = false) {
    const spec = (this.spec = { ...(dark ? DUSK : DAY), ...mood });
    this.bloom = { strength: spec.bloom, threshold: spec.bloom_threshold };
    sky_ceiling.value = spec.bloom_threshold * SKY_CEILING;
    // The sky shader and clouds read SUN_DIR when built, so it is set before `sky()` and `clouds()` run.
    const flat = Math.hypot(SUN_DIR.x, SUN_DIR.z);
    const horizontal = Math.sqrt(1 - spec.sun_y * spec.sun_y);
    SUN_DIR.set((SUN_DIR.x / flat) * horizontal, spec.sun_y, (SUN_DIR.z / flat) * horizontal);

    scene.fog = new THREE.Fog(FOG, spec.fog_near, spec.fog_far);
    if (radial) THREE.ShaderChunk.fog_vertex = THREE.ShaderChunk.fog_vertex.replace("vFogDepth = - mvPosition.z;", "vFogDepth = length( mvPosition.xyz );");
    scene.add(new THREE.HemisphereLight(color(spec.hemi_sky), color(spec.hemi_ground), spec.hemi_intensity));
    this.sun = new THREE.DirectionalLight(color(spec.key), spec.key_intensity);
    Object.assign(this.sun.shadow.camera, { left: -SHADOW_REACH, right: SHADOW_REACH, top: SHADOW_REACH, bottom: -SHADOW_REACH, near: 1, far: 900 });
    this.sun.shadow.radius = SHADOW_SOFT;
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 0.015;
    scene.add(this.sun, this.sun.target);
  }

  dress(sky: THREE.Object3D, clouds: THREE.Object3D): THREE.Object3D[] {
    clouds.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial) o.material.emissiveIntensity = this.spec.cloud_glow;
    });
    return [sky, clouds];
  }

  mount(car_root: THREE.Object3D, on: boolean) {
    const headlight = (this.headlight = new THREE.SpotLight(glow(tones.head), 0, this.spec.head_range, 0.42, 0.55, HEAD_DECAY));
    headlight.position.set(0, 0.1, 2.0);
    headlight.target.position.set(0, -1.2, 14);
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
  }
}
