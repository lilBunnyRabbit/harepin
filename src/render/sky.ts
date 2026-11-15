import * as THREE from "three";
import { brand, color, dark, glow, lighten, mix } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { fbm, type World } from "../world/world";

const FLOOR_PUFFS = 120;
const FLOOR_REACH = 1000;
const FLOOR_BELOW = 80;
// In day light the floor's sunlit tops clipped to white and bloomed over the deck; the shaded puffs keep the sea's form.
const FLOOR_DAY_GLOW = 0.15;
const FLOOR_LIT = dark ? 0.35 : 0;

export const SUN_DIR = new THREE.Vector3(-0.42, dark ? 0.17 : 0.55, 0.89).normalize();

interface SkyTones {
  zenith: Lab;
  upper: Lab;
  horizon_sun: Lab;
  horizon_away: Lab;
  sun: Lab;
  sunlight: Lab;
  skylight: Lab;
  cloud: Lab;
  cloud_lit: Lab;
  /** Cloud faces turned away from the sun and the sky: the underside tone. */
  cloud_shade: Lab;
}

/** `tone` with a share of its own lightness taken off: a dusk shade of a token that stays above black in every theme. */
const dim = (tone: Lab, share: number): Lab => lighten(tone, -tone[0] * share);

// Dusk is an ember sky: an orange glow at the sun under a lavender band, cumulus in dusk lavender with peach sun faces.
const ember = mix(brand.error, brand.warning, 0.5);

export const sky_tones: SkyTones = dark
  ? {
      zenith: brand.background_darkest,
      upper: mix(dim(brand.secondary, 0.54), brand.background_dark, 0.5),
      horizon_sun: dim(ember, 0.19),
      horizon_away: dim(brand.secondary, 0.46),
      sun: mix(brand.cottontail, brand.accent, 0.35),
      sunlight: mix(brand.accent, brand.foreground, 0.4),
      skylight: mix(brand.secondary, brand.foreground, 0.35),
      cloud: dim(brand.secondary, 0.35),
      cloud_lit: lighten(brand.accent, 0.04),
      cloud_shade: dim(brand.secondary, 0.54),
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
      cloud_shade: mix(brand.info, brand.background_lightest, 0.3),
    };

/** Luma cap for the sky dome and the cloud floor, set from the mood's bloom threshold: neither may bloom into a wash. */
export const sky_ceiling = { value: 1 };

export const FOG = color(mix(sky_tones.horizon_sun, sky_tones.horizon_away, 0.45));

/** Luma of the sun disc: the one part of the sky that blooms. */
const SUN_DISC = 1.6;
/** Angular radius of the sun disc, radians; a hard edge keeps the area over the bloom threshold the same in every theme. */
const SUN_RADIUS = 0.018;

const vec3 = (c: THREE.Color | THREE.Vector3) => ("r" in c ? `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})` : `vec3(${c.x.toFixed(5)}, ${c.y.toFixed(5)}, ${c.z.toFixed(5)})`);

/**
 * GLSL `vec3 sky_color(vec3 d)`: the sky without its sun disc toward the unit direction `d`, in linear light. The dome,
 * the fog and the clouds' haze all call it, so far ground fades into exactly the sky behind it. Tones, sun and ceiling
 * are baked in: read it after `Lighting` has set `SUN_DIR` and `sky_ceiling`.
 */
export function sky_glsl(): string {
  const flat = new THREE.Vector2(SUN_DIR.x, SUN_DIR.z).normalize();
  return `
    vec3 sky_color(vec3 d) {
      // normalize(0) at the zenith and a dot of -1.0000001 straight away from the sun both give NaN on some GPUs.
      float flat_len = length(d.xz);
      float toward = flat_len > 1e-5 ? clamp(dot(d.xz / flat_len, vec2(${flat.x.toFixed(5)}, ${flat.y.toFixed(5)})) * 0.5 + 0.5, 0.0, 1.0) : 0.5;
      vec3 c = mix(${vec3(color(sky_tones.horizon_away))}, ${vec3(color(sky_tones.horizon_sun))}, pow(toward, 2.2));
      float h = max(d.y, 0.0);
      c = mix(c, ${vec3(color(sky_tones.upper))}, smoothstep(0.0, 0.35, h));
      c = mix(c, ${vec3(color(sky_tones.zenith))}, smoothstep(0.18, 0.75, h));
      float s = max(dot(d, ${vec3(SUN_DIR)}), 0.0);
      c += ${vec3(glow(sky_tones.sun))} * (pow(s, 24.0) * 0.2 + pow(s, 5.0) * 0.06);
      // The halo stays under the bloom threshold, or a bright sky blooms into a screen-wide wash.
      return c * min(1.0, ${sky_ceiling.value.toFixed(4)} / max(dot(c, vec3(0.299, 0.587, 0.114)), 1e-4));
    }
  `;
}

export function sky(): THREE.Object3D {
  const group = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 v_dir;
      void main() {
        v_dir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: `
      varying vec3 v_dir;
      ${sky_glsl()}
      void main() {
        vec3 d = normalize(v_dir);
        vec3 c = sky_color(d);
        float s = max(dot(d, ${vec3(SUN_DIR)}), 0.0);
        c = mix(c, ${vec3(glow(sky_tones.sun))} * ${SUN_DISC.toFixed(2)}, smoothstep(${Math.cos(SUN_RADIUS * 1.25).toFixed(7)}, ${Math.cos(SUN_RADIUS).toFixed(7)}, s));
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
  const star_points = new THREE.Points(star_geometry, new THREE.PointsMaterial({ color: color(mix(brand.foreground, sky_tones.zenith, 0.7)), size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false }));
  star_points.frustumCulled = false;
  // Opaque and ahead of the clouds in the sky's draw order: as a blended pass the stars shone through every cloud.
  star_points.renderOrder = -9.5;
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

const CLOUDS = 28;
const LUMPS = 5;
/** Share of the sky's own colour a cloud takes on at the horizon, and the elevation (as sin) where it is clear of it. */
const HAZE = dark ? 0.55 : 0.4;
const HAZE_CLEAR = 0.3;

/**
 * The sky's clouds: scattered cumulus as one instanced draw of flat-based lumps, shaded per facet from the sun's side.
 * Add them to the dome: they ride with the camera and draw as part of the sky, behind everything and without depth, so
 * they stay overhead on a map wider than their ring and never cut into a mountain.
 */
export function clouds(seed = 0): THREE.Object3D {
  const lump = new THREE.IcosahedronGeometry(1, 1);
  const at = lump.getAttribute("position");
  // The lower half flattens into the cloud's base.
  for (let v = 0; v < at.count; v++) if (at.getY(v) < 0) at.setY(v, at.getY(v) * 0.12);
  lump.deleteAttribute("normal");
  lump.deleteAttribute("uv");
  const material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 v_at;
      void main() {
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        v_at = world.xyz - cameraPosition;
        vec4 p = projectionMatrix * viewMatrix * world;
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: `
      varying vec3 v_at;
      ${sky_glsl()}
      void main() {
        vec3 n = normalize(cross(dFdx(v_at), dFdy(v_at)));
        vec3 c = mix(${vec3(color(sky_tones.cloud_shade))}, ${vec3(color(sky_tones.cloud))}, smoothstep(-0.5, 0.6, n.y));
        c = mix(c, ${vec3(color(sky_tones.cloud_lit))}, smoothstep(${dark ? "0.05, 0.75" : "-0.3, 0.7"}, dot(n, ${vec3(SUN_DIR)})));
        vec3 d = normalize(v_at);
        c = mix(c, sky_color(d), ${HAZE.toFixed(2)} * (1.0 - smoothstep(0.0, ${HAZE_CLEAR.toFixed(2)}, d.y)));
        c *= min(1.0, ${sky_ceiling.value.toFixed(4)} / max(dot(c, vec3(0.299, 0.587, 0.114)), 1e-4));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.InstancedMesh(lump, material, CLOUDS * LUMPS);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  // A flat base, the tallest lump in the middle, smaller ones stepping down to both sides.
  const lumps: { bearing: number; reach: number; base: number; wide: number; tall: number; deep: number }[] = [];
  for (let c = 0; c < CLOUDS; c++) {
    const bearing = (c / CLOUDS) * Math.PI * 2 + fbm(c, 0.5, seed + 71) * 2;
    const reach = 1300 + fbm(c, 1.5, seed + 72) * 900;
    const base = 300 + fbm(c, 2.5, seed + 73) * 320;
    const size = 70 + fbm(c, 3.5, seed + 74) * 70;
    for (let i = 0; i < LUMPS; i++) {
      const off = i - (LUMPS - 1) / 2;
      const k = 1 - Math.abs(off) * (0.2 + fbm(c, i + 4.5, seed + 75) * 0.15);
      lumps.push({ bearing: bearing + (off * size * 0.9) / reach, reach: reach + (fbm(c, i, seed + 76) - 0.5) * size, base, wide: size * k * 1.1, tall: size * k * (0.55 + fbm(c, i, seed + 77) * 0.35), deep: size * k * 0.9 });
    }
  }
  // Far lumps first: without depth the draw order is what puts a near lump over a far one.
  lumps.sort((a, b) => b.reach - a.reach);
  lumps.forEach(({ bearing, reach, base, wide, tall, deep }, i) => {
    p.set(Math.cos(bearing) * reach, base, Math.sin(bearing) * reach);
    // Local x lies along the tangent, so a lump's long side faces the camera.
    q.setFromAxisAngle(up, Math.PI / 2 - bearing);
    mesh.setMatrixAt(i, m.compose(p, q, s.set(wide, tall, deep)));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = -9;
  return mesh;
}

/** A sea of puffs under the sky track, spread over its bounds; unlike the sky's clouds it takes fog, so it fades out below. */
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
