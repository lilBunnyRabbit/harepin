import * as THREE from "three";
import { brand, color, dark, glow, mix, tones } from "./theme/palette";
import { FOG, SUN_DIR, sky_tones } from "./sky";
import type { Lab } from "./theme/theme";

interface MoodSpec {
  /** Height of the sun direction; below 0 puts it under the horizon, leaving only its glow. */
  sun_y: number;
  key: Lab;
  key_intensity: number;
  hemi_sky: Lab;
  hemi_ground: Lab;
  hemi_intensity: number;
  fog_near: number;
  head_intensity: number;
  head_range: number;
  cloud_glow: number;
  bloom: number;
  bloom_threshold: number;
}

// Near-flat falloff: an inverse-power light at the bumper outshines the sun by 10x on anything a few metres ahead and
// clips it white with no tone mapping; the range cutoff and grazing angle on the road give the far fade instead.
const HEAD_DECAY = 0.3;
/** Brightest the sky may get around the sun, as a share of the bloom threshold. */
const SKY_CEILING = 0.9;

const DUSK: MoodSpec = {
  sun_y: 0.26,
  key: sky_tones.sunlight,
  key_intensity: 4,
  hemi_sky: sky_tones.skylight,
  hemi_ground: brand.background_darkest,
  hemi_intensity: 1.3,
  fog_near: 120,
  head_intensity: 5,
  head_range: 70,
  cloud_glow: 0.35,
  bloom: 0.6,
  bloom_threshold: 0.9,
};

const DAY: MoodSpec = {
  sun_y: 0.45,
  key: sky_tones.sunlight,
  key_intensity: 3.1,
  hemi_sky: sky_tones.skylight,
  hemi_ground: mix(brand.foreground, brand.background_darkest, 0.4),
  hemi_intensity: 1.1,
  fog_near: 150,
  head_intensity: 1.5,
  head_range: 70,
  cloud_glow: 0.55,
  bloom: 0.2,
  bloom_threshold: 0.98,
};

export class Lighting {
  readonly sun: THREE.DirectionalLight;
  readonly bloom: { strength: number; threshold: number };
  private readonly spec: MoodSpec;

  constructor(scene: THREE.Scene) {
    const spec = (this.spec = dark ? DUSK : DAY);
    this.bloom = { strength: spec.bloom, threshold: spec.bloom_threshold };
    // The sky shader and clouds read SUN_DIR when built, so it is set before `sky()` and `clouds()` run.
    const flat = Math.hypot(SUN_DIR.x, SUN_DIR.z);
    const horizontal = Math.sqrt(1 - spec.sun_y * spec.sun_y);
    SUN_DIR.set((SUN_DIR.x / flat) * horizontal, spec.sun_y, (SUN_DIR.z / flat) * horizontal);

    scene.fog = new THREE.Fog(FOG, spec.fog_near, 1300);
    scene.add(new THREE.HemisphereLight(color(spec.hemi_sky), color(spec.hemi_ground), spec.hemi_intensity));
    this.sun = new THREE.DirectionalLight(color(spec.key), spec.key_intensity);
    Object.assign(this.sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 900 });
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 0.015;
    scene.add(this.sun, this.sun.target);
  }

  dress(sky: THREE.Object3D, clouds: THREE.Object3D): THREE.Object3D[] {
    sky.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.ShaderMaterial && o.material.uniforms.ceiling) o.material.uniforms.ceiling.value = this.spec.bloom_threshold * SKY_CEILING;
    });
    clouds.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial) o.material.emissiveIntensity = this.spec.cloud_glow;
    });
    return [sky, clouds];
  }

  mount(car_root: THREE.Object3D) {
    const headlight = new THREE.SpotLight(glow(tones.head), this.spec.head_intensity, this.spec.head_range, 0.42, 0.55, HEAD_DECAY);
    headlight.position.set(0, 0.1, 2.0);
    headlight.target.position.set(0, -1.2, 14);
    car_root.add(headlight, headlight.target);
  }

  follow(at: THREE.Vector3) {
    this.sun.position.copy(at).addScaledVector(SUN_DIR, 400);
    this.sun.target.position.copy(at);
  }
}
