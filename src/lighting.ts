import * as THREE from "three";
import { brand, color, dark, mix, tones } from "./palette";
import { FOG, SUN_DIR, sky_tones } from "./sky";
import type { Lab } from "./theme";

export const Mood = {
  GOLDEN: "a",
  BLUE: "b",
  NIGHT: "c",
} as const;
export type Mood = (typeof Mood)[keyof typeof Mood];

type SkyKey = "zenith" | "upper" | "horizon_sun" | "horizon_away";

interface MoodSpec {
  /** Height of the sun direction; below 0 puts it under the horizon, leaving only its glow. */
  sun_y: number;
  key_dir?: THREE.Vector3;
  key: Lab;
  key_intensity: number;
  hemi_sky: Lab;
  hemi_ground: Lab;
  hemi_intensity: number;
  fog: Lab;
  fog_near: number;
  head_intensity: number;
  head_range: number;
  cloud_glow: number;
  bloom: number;
  bloom_threshold: number;
  sky?: Partial<Record<SkyKey, Lab>>;
}

const fog_tone = mix(sky_tones.horizon_sun, sky_tones.horizon_away, 0.45);
const moon = new THREE.Vector3(0.45, 0.75, -0.5).normalize();

const DUSK: Record<Mood, MoodSpec> = {
  [Mood.GOLDEN]: {
    sun_y: 0.26,
    key: sky_tones.sunlight,
    key_intensity: 4,
    hemi_sky: sky_tones.skylight,
    hemi_ground: brand.background_darkest,
    hemi_intensity: 1.3,
    fog: fog_tone,
    fog_near: 120,
    head_intensity: 140,
    head_range: 90,
    cloud_glow: 0.35,
    bloom: 0.6,
    bloom_threshold: 0.9,
  },
  [Mood.BLUE]: {
    sun_y: -0.05,
    key_dir: moon,
    key: mix(brand.secondary, brand.foreground, 0.5),
    key_intensity: 1.6,
    hemi_sky: mix(brand.secondary, brand.foreground, 0.3),
    hemi_ground: brand.background_darkest,
    hemi_intensity: 1.1,
    fog: mix(brand.secondary, brand.background_dark, 0.25),
    fog_near: 60,
    head_intensity: 260,
    head_range: 110,
    cloud_glow: 0.12,
    bloom: 0.85,
    bloom_threshold: 0.8,
    sky: {
      zenith: brand.background_darkest,
      upper: mix(brand.secondary, brand.background_dark, 0.22),
      horizon_away: mix(brand.secondary, brand.background, 0.4),
      horizon_sun: mix(brand.accent, brand.background, 0.45),
    },
  },
  [Mood.NIGHT]: {
    sun_y: -0.3,
    key_dir: moon,
    key: mix(brand.secondary, brand.foreground, 0.6),
    key_intensity: 0.9,
    hemi_sky: mix(brand.secondary, brand.background_lightest, 0.4),
    hemi_ground: brand.background_darkest,
    hemi_intensity: 0.8,
    fog: brand.background_darkest,
    fog_near: 30,
    head_intensity: 520,
    head_range: 140,
    cloud_glow: 0,
    bloom: 1.1,
    bloom_threshold: 0.7,
    sky: {
      zenith: brand.background_darkest,
      upper: brand.background_darkest,
      horizon_away: brand.background_darker,
      horizon_sun: brand.background_dark,
    },
  },
};

const DAY: Record<Mood, MoodSpec> = {
  [Mood.GOLDEN]: {
    sun_y: 0.45,
    key: sky_tones.sunlight,
    key_intensity: 3.1,
    hemi_sky: sky_tones.skylight,
    hemi_ground: mix(brand.foreground, brand.background_darkest, 0.4),
    hemi_intensity: 1.1,
    fog: fog_tone,
    fog_near: 150,
    head_intensity: 30,
    head_range: 90,
    cloud_glow: 0.55,
    bloom: 0.2,
    bloom_threshold: 0.98,
  },
  [Mood.BLUE]: {
    sun_y: 0.32,
    key: mix(brand.info, brand.background_lightest, 0.15),
    key_intensity: 1.4,
    hemi_sky: mix(brand.info, brand.background_lightest, 0.2),
    hemi_ground: brand.background_light,
    hemi_intensity: 2.5,
    fog: mix(sky_tones.horizon_away, brand.background_lightest, 0.5),
    fog_near: 30,
    head_intensity: 30,
    head_range: 90,
    cloud_glow: 0.8,
    bloom: 0.15,
    bloom_threshold: 0.98,
    sky: {
      zenith: mix(brand.info, brand.background_lightest, 0.32),
      upper: mix(brand.info, brand.background_lightest, 0.18),
      horizon_away: mix(sky_tones.horizon_away, brand.background_lightest, 0.5),
      horizon_sun: brand.background_lightest,
    },
  },
  [Mood.NIGHT]: {
    sun_y: 0.14,
    key: mix(brand.warning, brand.background_lightest, 0.5),
    key_intensity: 3.4,
    hemi_sky: mix(brand.secondary, brand.background_lightest, 0.3),
    hemi_ground: mix(brand.foreground, brand.background_darkest, 0.5),
    hemi_intensity: 0.9,
    fog: mix(brand.warning, brand.background_lightest, 0.3),
    fog_near: 120,
    head_intensity: 30,
    head_range: 90,
    cloud_glow: 0.7,
    bloom: 0.3,
    bloom_threshold: 0.95,
    sky: {
      horizon_sun: mix(brand.warning, brand.background_lightest, 0.45),
      horizon_away: mix(brand.secondary, brand.background_lightest, 0.3),
    },
  },
};

export class Lighting {
  readonly sun: THREE.DirectionalLight;
  readonly bloom: { strength: number; threshold: number };
  private readonly spec: MoodSpec;
  private key_dir: THREE.Vector3;

  constructor(scene: THREE.Scene, mood: Mood) {
    const spec = (this.spec = (dark ? DUSK : DAY)[mood]);
    this.bloom = { strength: spec.bloom, threshold: spec.bloom_threshold };
    // The sky shader and clouds read SUN_DIR when built, so it is set before `sky()` and `clouds()` run.
    const flat = Math.hypot(SUN_DIR.x, SUN_DIR.z);
    const horizontal = Math.sqrt(1 - spec.sun_y * spec.sun_y);
    SUN_DIR.set((SUN_DIR.x / flat) * horizontal, spec.sun_y, (SUN_DIR.z / flat) * horizontal);
    this.key_dir = spec.key_dir ?? SUN_DIR;

    scene.fog = new THREE.Fog(spec.fog === fog_tone ? FOG : color(spec.fog), spec.fog_near, 1300);
    scene.add(new THREE.HemisphereLight(color(spec.hemi_sky), color(spec.hemi_ground), spec.hemi_intensity));
    this.sun = new THREE.DirectionalLight(color(spec.key), spec.key_intensity);
    Object.assign(this.sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 900 });
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 0.015;
    scene.add(this.sun, this.sun.target);
  }

  dress(sky: THREE.Object3D, clouds: THREE.Object3D): THREE.Object3D[] {
    sky.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.ShaderMaterial)) return;
      const uniforms = o.material.uniforms;
      for (const [key, tone] of Object.entries(this.spec.sky ?? {})) uniforms[key]?.value.copy(color(tone));
    });
    clouds.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial) o.material.emissiveIntensity = this.spec.cloud_glow;
    });
    return [sky, clouds];
  }

  mount(car_root: THREE.Object3D) {
    const headlight = new THREE.SpotLight(color(tones.head), this.spec.head_intensity, this.spec.head_range, 0.42, 0.55, 1.4);
    headlight.position.set(0, 0.1, 2.0);
    headlight.target.position.set(0, -1.2, 14);
    car_root.add(headlight, headlight.target);
  }

  follow(at: THREE.Vector3) {
    this.sun.position.copy(at).addScaledVector(this.key_dir, 400);
    this.sun.target.position.copy(at);
  }
}
