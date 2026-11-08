import * as THREE from "three";
import { color, lighten, linear, mix, tones } from "./palette";
import { CELL, N, ROAD_HALF, SIDEWALK, SIZE, World, fbm, type RoadPoint } from "./world";

const JITTER_LIGHTNESS = 0.035;
const JITTER_LEVELS = 64;
const LANE_WIDTH = 3;
const ROCK_HALF = 3;
const ROCK = 6;
const SNOW = 7;
const SURFACE_LIFT = 0.07;
// Spurs sit a hair above streets and sidewalks so their mouth covers the street's sidewalk at the town gate.
const SPUR_LIFT = 0.09;
const MARK_LIFT = 0.1;
const MARK_HALF = 0.15;
const EDGE_INSET = 0.3;
const EDGE_WIDTH = 0.25;
const DASH = 6;
const DASH_ON = 3;
const SPUR_MARK_CLEAR = 8;
const SPUR_MOUTH = 30;

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

type Rgb = [number, number, number];

function strip(world: World, positions: number[], road: RoadPoint[], closed: boolean, from: number, to: number, lift: number, keep: (s: number) => boolean, colors?: number[], rgb?: Rgb) {
  const segments = closed ? road.length : road.length - 1;
  const lanes = Math.ceil((to - from) / LANE_WIDTH);
  for (let s = 0; s < segments; s++) {
    if (!keep(s)) continue;
    const a = road[s];
    const b = road[(s + 1) % road.length];
    for (let lane = 0; lane < lanes; lane++) {
      const l0 = from + ((to - from) * lane) / lanes;
      const l1 = from + ((to - from) * (lane + 1)) / lanes;
      quad(world, positions, a, b, l0, l1, lift);
      if (colors && rgb) for (let v = 0; v < 6; v++) colors.push(...rgb);
    }
  }
}

function quad(world: World, positions: number[], a: RoadPoint, b: RoadPoint, from: number, to: number, lift: number) {
  const at = (p: RoadPoint, side: number) => {
    const x = p.x - p.tz * side;
    const z = p.z + p.tx * side;
    return [x, world.height(x, z) + lift, z];
  };
  const a0 = at(a, from);
  const a1 = at(a, to);
  const b0 = at(b, from);
  const b1 = at(b, to);
  positions.push(...a0, ...a1, ...b0, ...b0, ...a1, ...b1);
}

/** With `colors` the vertex colours are the tone and `tone` is ignored. */
function strip_mesh(positions: number[], tone: THREE.Color | null, offset: number, colors?: number[]): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (colors) geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ ...(tone && !colors ? { color: tone } : {}), vertexColors: !!colors, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

export function ribbon(world: World, from: number, to: number, lift: number, keep: (s: number) => boolean, tone: THREE.Color, offset: number): THREE.Mesh {
  const positions: number[] = [];
  strip(world, positions, world.road, true, from, to, lift, keep);
  return strip_mesh(positions, tone, offset);
}

// Streets run node to node; stretching each end by its half width fills the crossing square.
function extended(points: RoadPoint[], by: number): RoadPoint[] {
  const a = points[0];
  const b = points[points.length - 1];
  return [{ ...a, x: a.x - a.tx * by, z: a.z - a.tz * by }, ...points, { ...b, x: b.x + b.tx * by, z: b.z + b.tz * by }];
}

export function road_meshes(world: World): THREE.Object3D {
  const group = new THREE.Group();
  const junctions = world.graph.nodes.filter((n) => n.kind === "junction" && world.graph.edges.some((e) => e.kind === "highway" && !e.closed && e.b === n.id));
  const mouths = junctions.map((n) => world.road.indexOf(world.nearest_road(n.x, n.z)));
  const clear_of_mouths = (s: number) => mouths.every((m) => Math.abs(((s - m + world.road.length * 1.5) % world.road.length) - world.road.length / 2) > 5);
  group.add(ribbon(world, -ROAD_HALF, ROAD_HALF, 0.08, () => true, color(tones.asphalt), -2));
  group.add(ribbon(world, -0.15, 0.15, 0.1, (s) => s % 6 < 3, color(tones.line), -4));
  group.add(ribbon(world, ROAD_HALF - 0.55, ROAD_HALF - 0.3, 0.1, clear_of_mouths, color(tones.edge_line), -4));
  group.add(ribbon(world, -ROAD_HALF + 0.3, -ROAD_HALF + 0.55, 0.1, clear_of_mouths, color(tones.edge_line), -4));
  // Streets, sidewalks, spurs and all their markings: two vertex-coloured meshes, so towns add no draws.
  const asphalt = linear(tones.asphalt);
  const walk = linear(tones.sidewalk);
  const centre = linear(tones.line);
  const edge_line = linear(tones.edge_line);
  const surface: number[] = [];
  const surface_rgb: number[] = [];
  const marks: number[] = [];
  const marks_rgb: number[] = [];
  // Spurs only come near streets where they leave their town's gate.
  const gates = world.graph.edges.filter((e) => e.kind === "highway" && !e.closed).flatMap((e) => e.points.slice(0, SPUR_MOUTH));
  const under_spur = (p: RoadPoint, reach: number) => gates.some((q) => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < reach * reach);
  const edge_lines = (points: RoadPoint[], half: number, keep: (s: number) => boolean) => {
    for (const side of [-1, 1]) {
      const at = side * (half - EDGE_INSET - EDGE_WIDTH / 2);
      strip(world, marks, points, false, at - EDGE_WIDTH / 2, at + EDGE_WIDTH / 2, MARK_LIFT, keep, marks_rgb, edge_line);
    }
  };
  for (const edge of world.graph.edges) {
    if (edge.closed) continue;
    const { points, half } = edge;
    const last = points.length - 1;
    if (edge.kind === "highway") {
      strip(world, surface, points, false, -half, half, SPUR_LIFT, () => true, surface_rgb, asphalt);
      const open = (s: number) => s > SPUR_MARK_CLEAR && s < last - SPUR_MARK_CLEAR;
      strip(world, marks, points, false, -MARK_HALF, MARK_HALF, MARK_LIFT, (s) => open(s) && s % DASH < DASH_ON, marks_rgb, centre);
      edge_lines(points, half, open);
      continue;
    }
    // Streets run node to node: stretching each end by the half width fills the crossing square, and sidewalks start
    // at the crossing street's edge, so two sidewalks only ever overlap in the same colour at a block corner.
    strip(world, surface, extended(points, half), false, -half, half, SURFACE_LIFT, () => true, surface_rgb, asphalt);
    const step = Math.hypot(points[1].x - points[0].x, points[1].z - points[0].z) || 1;
    const ends = Math.ceil(half / step);
    const clear = Math.ceil((half + SIDEWALK) / step);
    const near_spur = points.map((p) => under_spur(p, half + SIDEWALK + 6));
    const walkway = (s: number) => s >= ends && s < last - ends;
    const marked = (s: number) => s >= clear && s < last - clear && !near_spur[s] && !near_spur[s + 1];
    strip(world, surface, points, false, -half - SIDEWALK, -half, SURFACE_LIFT, walkway, surface_rgb, walk);
    strip(world, surface, points, false, half, half + SIDEWALK, SURFACE_LIFT, walkway, surface_rgb, walk);
    edge_lines(points, half, marked);
    strip(world, marks, points, false, -MARK_HALF, MARK_HALF, MARK_LIFT, (s) => marked(s) && s % DASH < DASH_ON, marks_rgb, centre);
  }
  group.add(strip_mesh(surface, null, -2, surface_rgb));
  group.add(strip_mesh(marks, null, -4, marks_rgb));
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
