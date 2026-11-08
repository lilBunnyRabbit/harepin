import * as THREE from "three";
import { color, lighten, linear, mix, tones } from "./palette";
import { CELL, N, ROAD_HALF, SIZE, World, fbm } from "./world";

const JITTER_LIGHTNESS = 0.035;
const JITTER_LEVELS = 64;
const ROCK_HALF = 3;
const ROCK = 6;
const SNOW = 7;

function jitter(i: number, j: number): number {
  const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - Math.floor(h) - 0.5;
}

// Jitter is quantised so each tone converts OKLab to linear once per level, not per vertex; 64 levels is ~0.0003 L error.
function terrain_lut(): Float32Array {
  const dry = mix(tones.grass, tones.grass_dry, 0.55);
  const surfaces = [tones.grass, dry, tones.sand];
  const bases = [...surfaces, ...surfaces.map((t) => mix(tones.rock, t, 0.5)), tones.rock, tones.snow];
  const lut = new Float32Array(bases.length * JITTER_LEVELS * 3);
  bases.forEach((tone, b) => {
    for (let l = 0; l < JITTER_LEVELS; l++)
      lut.set(linear(lighten(tone, ((l + 0.5) / JITTER_LEVELS - 0.5) * JITTER_LIGHTNESS)), (b * JITTER_LEVELS + l) * 3);
  });
  return lut;
}

export function terrain_mesh(world: World): THREE.Mesh {
  const count = (N + 1) * (N + 1);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const normal = new THREE.Vector3();
  const lut = terrain_lut();
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const k = j * (N + 1) + i;
      const x = -SIZE / 2 + i * CELL;
      const z = -SIZE / 2 + j * CELL;
      const y = world.heights[k];
      positions[k * 3] = x;
      positions[k * 3 + 1] = y;
      positions[k * 3 + 2] = z;
      world.normal(x, z, normal);
      let base = y < 2.2 ? 2 : fbm(x / 140, z / 140, world.seed + 21, 3) > 0.55 ? 1 : 0;
      if (normal.y < 0.8 || y > 120) base = normal.y < 0.7 || y > 135 ? ROCK : base + ROCK_HALF;
      if (y > 165) base = SNOW;
      const level = Math.min(JITTER_LEVELS - 1, Math.floor((jitter(i, j) + 0.5) * JITTER_LEVELS));
      const o = (base * JITTER_LEVELS + level) * 3;
      colors[k * 3] = lut[o];
      colors[k * 3 + 1] = lut[o + 1];
      colors[k * 3 + 2] = lut[o + 2];
    }
  const index = new Uint32Array(N * N * 6);
  let o = 0;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i;
      const b = a + 1;
      const c = a + N + 1;
      const d = c + 1;
      index.set([a, c, b, b, c, d], o);
      o += 6;
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.receiveShadow = true;
  return mesh;
}

export function ribbon(world: World, from: number, to: number, lift: number, keep: (s: number) => boolean, tone: THREE.Color, offset: number): THREE.Mesh {
  const positions: number[] = [];
  const road = world.road;
  for (let s = 0; s < road.length; s++) {
    if (!keep(s)) continue;
    const a = road[s];
    const b = road[(s + 1) % road.length];
    const quad = [
      [a, from],
      [a, to],
      [b, from],
      [b, to],
    ].map(([p, side]) => {
      const pt = p as (typeof road)[number];
      const x = pt.x - pt.tz * (side as number);
      const z = pt.z + pt.tx * (side as number);
      return [x, world.height(x, z) + lift, z];
    });
    positions.push(...quad[0], ...quad[1], ...quad[2], ...quad[2], ...quad[1], ...quad[3]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ color: tone, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

export function road_meshes(world: World): THREE.Object3D {
  const group = new THREE.Group();
  group.add(ribbon(world, -ROAD_HALF, ROAD_HALF, 0.08, () => true, color(tones.asphalt), -2));
  group.add(ribbon(world, -0.15, 0.15, 0.1, (s) => s % 6 < 3, color(tones.line), -4));
  group.add(ribbon(world, ROAD_HALF - 0.55, ROAD_HALF - 0.3, 0.1, () => true, color(tones.edge_line), -4));
  group.add(ribbon(world, -ROAD_HALF + 0.3, -ROAD_HALF + 0.55, 0.1, () => true, color(tones.edge_line), -4));
  return group;
}

export function water_mesh(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(SIZE * 4, SIZE * 4, 1, 1).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: color(tones.water), transparent: true, opacity: 0.9 }));
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  return mesh;
}

export function tree_meshes(world: World): THREE.Object3D {
  const group = new THREE.Group();
  const trunk = new THREE.CylinderGeometry(0.25, 0.35, 2.2, 5).translate(0, 1.1, 0);
  const pine = new THREE.ConeGeometry(2.1, 6, 6).translate(0, 4.6, 0);
  const round = new THREE.IcosahedronGeometry(2.4, 0).translate(0, 4.2, 0);
  const crowns = [pine, round];
  const trunks = new THREE.InstancedMesh(trunk, new THREE.MeshLambertMaterial({ color: color(tones.trunk), flatShading: true }), world.trees.length);
  const leaf = new THREE.MeshLambertMaterial({ flatShading: true });
  const crown_meshes = crowns.map((g, kind) => new THREE.InstancedMesh(g, leaf, world.trees.filter((t) => t.kind === kind).length));
  const filled = [0, 0];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const tint = new THREE.Color();
  world.trees.forEach((tree, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (tree.x * 13.37) % (Math.PI * 2));
    s.setScalar(tree.scale);
    p.set(tree.x, tree.y - 0.2, tree.z);
    m.compose(p, q, s);
    trunks.setMatrixAt(i, m);
    const mesh = crown_meshes[tree.kind];
    const slot = filled[tree.kind]++;
    mesh.setMatrixAt(slot, m);
    const [r, g, b] = linear(mix(tones.leaf, tones.leaf_dark, 0.5 + jitter(i, tree.kind) * 1.6));
    mesh.setColorAt(slot, tint.setRGB(r, g, b));
  });
  for (const mesh of [trunks, ...crown_meshes]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }
  return group;
}
