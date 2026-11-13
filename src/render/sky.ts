import * as THREE from "three";
import { brand, color, dark, glow, mix } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { fbm, type World } from "../world/world";

const FLOOR_PUFFS = 120;
const FLOOR_REACH = 1000;
const FLOOR_BELOW = 80;
// In day light the floor's sunlit tops clipped to white and bloomed over the deck; the shaded puffs keep the sea's form.
const FLOOR_DAY_GLOW = 0.15;
const FLOOR_LIT = dark ? 0.35 : 0;

export const SUN_DIR = new THREE.Vector3(-0.42, dark ? 0.17 : 0.55, 0.89).normalize();

export const sky_tones = dark
  ? {
      zenith: brand.background_darkest,
      upper: brand.background_dark,
      horizon_sun: mix(brand.accent, brand.background, 0.62),
      horizon_away: mix(brand.secondary, brand.background, 0.3),
      sun: mix(brand.cottontail, brand.accent, 0.35),
      sunlight: mix(brand.accent, brand.foreground, 0.4),
      skylight: mix(brand.secondary, brand.foreground, 0.35),
      cloud: mix(brand.secondary, brand.foreground, 0.3),
      cloud_lit: mix(brand.accent, brand.cottontail, 0.7),
    }
  : {
      zenith: mix(brand.info, brand.background_lightest, 0.5),
      upper: mix(brand.info, brand.background_lightest, 0.28),
      horizon_sun: mix(brand.warning, brand.background_lightest, 0.2),
      horizon_away: mix(brand.secondary, brand.background_lightest, 0.18),
      sun: brand.background_lightest,
      sunlight: mix(brand.warning, brand.background_lightest, 0.12),
      skylight: mix(brand.info, brand.background_lightest, 0.3),
      cloud: mix(brand.info, brand.background_lightest, 0.12),
      cloud_lit: brand.background_lightest,
    };

/** Luma cap for the sky dome and the cloud floor, set from the mood's bloom threshold: neither may bloom into a wash. */
export const sky_ceiling = { value: 1 };

export const FOG = color(mix(sky_tones.horizon_sun, sky_tones.horizon_away, 0.45));

/** Luma of the sun disc: the one part of the sky that blooms. */
const SUN_DISC = 1.6;
/** Angular radius of the sun disc, radians; a hard edge keeps the area over the bloom threshold the same in every theme. */
const SUN_RADIUS = 0.018;

export function sky(): THREE.Object3D {
  const group = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: color(sky_tones.zenith) },
      upper: { value: color(sky_tones.upper) },
      horizon_sun: { value: color(sky_tones.horizon_sun) },
      horizon_away: { value: color(sky_tones.horizon_away) },
      sun_color: { value: glow(sky_tones.sun) },
      sun_dir: { value: SUN_DIR },
      ceiling: sky_ceiling,
    },
    vertexShader: `
      varying vec3 v_dir;
      void main() {
        v_dir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: `
      uniform vec3 zenith, upper, horizon_sun, horizon_away, sun_color, sun_dir;
      uniform float ceiling;
      varying vec3 v_dir;
      void main() {
        vec3 d = normalize(v_dir);
        // normalize(0) at the zenith and a dot of -1.0000001 straight away from the sun both give NaN on some GPUs.
        float flat_len = length(d.xz);
        float toward = flat_len > 1e-5 ? clamp(dot(d.xz / flat_len, normalize(sun_dir.xz)) * 0.5 + 0.5, 0.0, 1.0) : 0.5;
        vec3 horizon = mix(horizon_away, horizon_sun, pow(toward, 2.2));
        float h = max(d.y, 0.0);
        vec3 c = mix(horizon, upper, smoothstep(0.0, 0.35, h));
        c = mix(c, zenith, smoothstep(0.18, 0.75, h));
        if (d.y < 0.0) c = horizon;
        float s = max(dot(d, sun_dir), 0.0);
        c += sun_color * (pow(s, 24.0) * 0.2 + pow(s, 5.0) * 0.06);
        // The halo stays under the bloom threshold, or a bright sky blooms into a screen-wide wash.
        c *= min(1.0, ceiling / max(dot(c, vec3(0.299, 0.587, 0.114)), 1e-4));
        c = mix(c, sun_color * ${SUN_DISC.toFixed(2)}, smoothstep(${Math.cos(SUN_RADIUS * 1.25).toFixed(7)}, ${Math.cos(SUN_RADIUS).toFixed(7)}, s));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), material);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  group.add(dome);

  const stars: number[] = [];
  for (let i = 0; i < 900; i++) {
    const u = Math.random();
    const theta = Math.random() * Math.PI * 2;
    const y = 0.25 + u * 0.75;
    const r = Math.sqrt(1 - y * y);
    const d = new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r);
    if (d.dot(SUN_DIR) > 0.2) continue;
    stars.push(d.x * 2300, d.y * 2300, d.z * 2300);
  }
  const star_geometry = new THREE.BufferGeometry();
  star_geometry.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
  const star_points = new THREE.Points(star_geometry, new THREE.PointsMaterial({ color: color(brand.foreground), size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 }));
  star_points.frustumCulled = false;
  if (dark) group.add(star_points);
  return group;
}

/**
 * A puff with a lit top and a shaded underside, per face so the facets stay flat: the vertex colour scales each
 * instance's tint down to `cloud` below its middle, so a cloud reads as lit vapour rather than one solid tone.
 */
function puff_geometry(lit = color(sky_tones.cloud_lit), shade = color(sky_tones.cloud)): THREE.BufferGeometry {
  const puff = new THREE.IcosahedronGeometry(1, 1);
  const under = [shade.r / Math.max(lit.r, 1e-4), shade.g / Math.max(lit.g, 1e-4), shade.b / Math.max(lit.b, 1e-4)].map((v) => Math.min(1, v));
  const y = puff.getAttribute("position");
  const colors = new Float32Array(y.count * 3);
  for (let f = 0; f < y.count; f += 3) {
    const tone = y.getY(f) + y.getY(f + 1) + y.getY(f + 2) >= 0 ? [1, 1, 1] : under;
    for (let v = f; v < f + 3; v++) colors.set(tone, v * 3);
  }
  puff.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return puff;
}

export function clouds(seed = 0): THREE.Object3D {
  const puff = puff_geometry();
  const material = new THREE.MeshLambertMaterial({ flatShading: true, vertexColors: true, fog: false, transparent: true, opacity: 0.85, emissive: color(sky_tones.cloud_lit), emissiveIntensity: dark ? 0.08 : 0.55 });
  const count = 30 * 5;
  const mesh = new THREE.InstancedMesh(puff, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const tint = new THREE.Color();
  const lit = color(sky_tones.cloud_lit);
  const shade = color(sky_tones.cloud);
  let k = 0;
  for (let c = 0; c < 30; c++) {
    const a = (c / 30) * Math.PI * 2 + fbm(c, 0.5, seed + 71) * 2;
    const r = 1300 + fbm(c, 1.5, seed + 72) * 900;
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    const cy = 380 + fbm(c, 2.5, seed + 73) * 260;
    const toward = Math.max(0, (cx * SUN_DIR.x + cz * SUN_DIR.z) / r);
    for (let i = 0; i < 5; i++) {
      const size = 40 + fbm(c, i + 3.5, seed + 74) * 60;
      p.set(cx + (i - 2) * 55 + fbm(c, i, seed + 75) * 40, cy + fbm(c, i, seed + 76) * 25, cz + fbm(c, i, seed + 77) * 50);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a + i * 0.7);
      s.set(size * 2.2, size * 0.32, size * 1.3);
      mesh.setMatrixAt(k, m.compose(p, q, s));
      mesh.setColorAt(k, tint.copy(shade).lerp(lit, toward ** 2));
      k++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** A sea of puffs under the sky track, spread over its bounds; unlike the ring clouds it takes fog, so it fades out below. */
export function cloud_floor(world: World, lit_tone: Lab = sky_tones.cloud_lit, shade_tone: Lab = sky_tones.cloud): THREE.Object3D {
  const { road } = world;
  const low = Math.min(...road.map((p) => p.y));
  const lit = color(lit_tone);
  const shade = color(shade_tone);
  const puff = puff_geometry(lit, shade);
  const material = new THREE.MeshLambertMaterial({ flatShading: true, vertexColors: true, emissive: lit, emissiveIntensity: dark ? 0.08 : FLOOR_DAY_GLOW });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.ceiling = sky_ceiling;
    shader.fragmentShader = `uniform float ceiling;\n${shader.fragmentShader}`.replace(
      "#include <opaque_fragment>",
      "#include <opaque_fragment>\n  gl_FragColor.rgb *= min(1.0, ceiling / max(dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)), 1e-4));",
    );
  };
  const mesh = new THREE.InstancedMesh(puff, material, FLOOR_PUFFS);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const tint = new THREE.Color();
  const axis = new THREE.Vector3(0, 1, 0);
  const seed = world.seed;
  for (let i = 0; i < FLOOR_PUFFS; i++) {
    const x = (fbm(i, 0.5, seed + 81) * 2 - 1) * FLOOR_REACH + (((i * 37) % 23) - 11) * 90;
    const z = (fbm(i, 1.5, seed + 82) * 2 - 1) * FLOOR_REACH + (((i * 53) % 19) - 9) * 100;
    const size = 50 + fbm(i, 2.5, seed + 83) * 70;
    p.set(x, low - FLOOR_BELOW - fbm(i, 3.5, seed + 84) * 60, z);
    q.setFromAxisAngle(axis, i * 1.7);
    s.set(size * 2, size * 0.45, size * 1.4);
    mesh.setMatrixAt(i, m.compose(p, q, s));
    mesh.setColorAt(i, tint.copy(shade).lerp(lit, FLOOR_LIT + fbm(i, 4.5, seed + 85) * 0.5));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}
