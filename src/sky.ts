import * as THREE from "three";
import { brand, color, dark, mix } from "./palette";
import { fbm } from "./world";

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

export const FOG = color(mix(sky_tones.horizon_sun, sky_tones.horizon_away, 0.45));

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
      sun_color: { value: color(sky_tones.sun) },
      sun_dir: { value: SUN_DIR },
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
      varying vec3 v_dir;
      void main() {
        vec3 d = normalize(v_dir);
        float toward = dot(normalize(d.xz), normalize(sun_dir.xz)) * 0.5 + 0.5;
        vec3 horizon = mix(horizon_away, horizon_sun, pow(toward, 2.2));
        float h = max(d.y, 0.0);
        vec3 c = mix(horizon, upper, smoothstep(0.0, 0.22, h));
        c = mix(c, zenith, smoothstep(0.18, 0.75, h));
        if (d.y < 0.0) c = horizon;
        float s = max(dot(d, sun_dir), 0.0);
        c += sun_color * (pow(s, 900.0) * 1.6 + pow(s, 24.0) * 0.28 + pow(s, 5.0) * 0.08);
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

export function clouds(): THREE.Object3D {
  const puff = new THREE.IcosahedronGeometry(1, 1);
  const material = new THREE.MeshLambertMaterial({ flatShading: true, fog: false, transparent: true, opacity: 0.85, emissive: color(sky_tones.cloud_lit), emissiveIntensity: dark ? 0.08 : 0.55 });
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
    const a = (c / 30) * Math.PI * 2 + fbm(c, 0.5, 71) * 2;
    const r = 1300 + fbm(c, 1.5, 72) * 900;
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    const cy = 380 + fbm(c, 2.5, 73) * 260;
    const toward = Math.max(0, (cx * SUN_DIR.x + cz * SUN_DIR.z) / r);
    for (let i = 0; i < 5; i++) {
      const size = 40 + fbm(c, i + 3.5, 74) * 60;
      p.set(cx + (i - 2) * 55 + fbm(c, i, 75) * 40, cy + fbm(c, i, 76) * 25, cz + fbm(c, i, 77) * 50);
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
