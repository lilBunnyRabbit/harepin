import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cast_instanced } from "../render/shadow-depth";
import { color, dark, glow, linear, tones } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { LAMPS, type LampKind, type Pools, type PoolTones } from "../worldgen/lamps";
import { PropKind } from "../worldgen/types";

interface Cone {
  y: number;
  z: number;
  radius: number;
  strength: number;
}

interface Look {
  tone: Lab;
  /** Post and head, foot at the origin, +z toward the road. */
  parts(height: number): [THREE.BufferGeometry, THREE.BufferGeometry];
  cone?: Cone;
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

const LOOKS: Record<LampKind, Look> = {
  [PropKind.STREET_LIGHT]: {
    tone: tones.clear,
    parts: (h) => [mergeGeometries([box(0.11, h, 0.11, 0, h / 2, 0), box(0.09, 0.07, 2.1, 0, h, 1.0)]), box(0.2, 0.05, 1.1, 0, h - 0.06, 1.45)],
  },
  [PropKind.ROAD_LAMP]: {
    tone: tones.shop_glow,
    parts: (h) => [
      mergeGeometries([new THREE.CylinderGeometry(0.08, 0.22, h, 6, 1, true).translate(0, h / 2, 0).toNonIndexed(), box(0.13, 0.13, 3.5, 0, h, 1.6).toNonIndexed()]),
      box(0.55, 0.16, 1.1, 0, h - 0.12, 2.9),
    ],
    cone: { y: 10.4, z: 2.9, radius: 5.2, strength: 0.05 },
  },
};

const HEAD_GLOW = dark ? 1.2 : 0.35;

export const pool_tones = (): PoolTones | null => (dark ? { [PropKind.STREET_LIGHT]: linear(LOOKS.street_light.tone), [PropKind.ROAD_LAMP]: linear(LOOKS.road_lamp.tone) } : null);

export interface Spot {
  x: number;
  y: number;
  z: number;
  /** Turns the lamp's +z toward the road. */
  angle: number;
}

interface Kit {
  post: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  cone: THREE.BufferGeometry | null;
  head_material: THREE.Material;
}

/** One set for the world: every chunk's lamps instance these shapes and share these materials. */
export interface LampKit {
  kinds: Record<LampKind, Kit>;
  post_material: THREE.Material;
  light_material: THREE.Material;
}

// Fog mixes a lit pixel toward the fog colour; light added to the frame fades out instead, or a far pool glows fog-white.
function light_material(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <fog_fragment>",
      "#ifdef USE_FOG\n#ifdef FOG_EXP2\nfloat fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);\n#else\nfloat fogFactor = smoothstep(fogNear, fogFar, vFogDepth);\n#endif\ngl_FragColor.rgb *= 1.0 - fogFactor;\n#endif",
    );
  };
  material.customProgramCacheKey = () => "road_light";
  return material;
}

function cone_geometry(cone: Cone, rgb: readonly number[]): THREE.BufferGeometry {
  const shape = new THREE.CylinderGeometry(0.25, cone.radius, cone.y, 14, 1, true).translate(0, cone.y / 2, cone.z);
  const at = shape.getAttribute("position");
  const colors = new Float32Array(at.count * 3);
  for (let i = 0; i < at.count; i++) if (at.getY(i) > cone.y / 2) for (let c = 0; c < 3; c++) colors[i * 3 + c] = rgb[c] * cone.strength;
  shape.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return shape;
}

function kit_of(kind: LampKind): Kit {
  const look = LOOKS[kind];
  const [post, head] = look.parts(LAMPS[kind].height);
  return {
    post,
    head,
    cone: look.cone ? cone_geometry(look.cone, linear(look.tone)) : null,
    head_material: new THREE.MeshLambertMaterial({ color: color(look.tone), emissive: glow(look.tone), emissiveIntensity: HEAD_GLOW }),
  };
}

export function lamp_kit(): LampKit {
  return {
    kinds: { [PropKind.STREET_LIGHT]: kit_of(PropKind.STREET_LIGHT), [PropKind.ROAD_LAMP]: kit_of(PropKind.ROAD_LAMP) },
    post_material: new THREE.MeshLambertMaterial({ color: color(tones.gate), flatShading: true }),
    light_material: light_material(),
  };
}

/** Post and head instances, and at dusk the cone of light under a head that has one. */
export function lamps(kit: LampKit, kind: LampKind, spots: readonly Spot[]): THREE.InstancedMesh[] {
  if (!spots.length) return [];
  const { post, head, cone, head_material } = kit.kinds[kind];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const instanced = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
    spots.forEach((spot, i) => mesh.setMatrixAt(i, m.compose(p.set(spot.x, spot.y, spot.z), q.setFromAxisAngle(up, spot.angle), s)));
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  };
  const posts = instanced(post, kit.post_material);
  cast_instanced(posts);
  const out = [posts, instanced(head, head_material)];
  if (dark && cone) out.push(instanced(cone, kit.light_material));
  return out;
}

export function pool_mesh(kit: LampKit, pools: Pools): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pools.positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(pools.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(pools.index, 1));
  const [x, y, z, r] = pools.sphere;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(x, y, z), r);
  return new THREE.Mesh(geometry, kit.light_material);
}
