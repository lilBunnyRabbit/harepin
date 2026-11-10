import * as THREE from "three";
import { by_chunk, soup_geometry, town_chunks, type TownChunk } from "../world/buildings";
import { JumpsView } from "../world/jumps";
import { LandmarksView } from "../world/landmarks";
import { color, lighten, linear, mix, tones } from "../theme/palette";
import { SIZE, World, type RoadPoint, type Tree } from "../world/world";
import { CHUNK, Ground, JITTER_LEVELS, type ChunkBuffers, type MeshTones } from "../worldgen/chunks";
import { TreeKind } from "../worldgen/biomes";
import type { Lab } from "../theme/theme";
import type { WorldData, WorldKind } from "../worldgen/types";
import type { GenRequest, GenResult } from "../worldgen/worker";

const JITTER_LIGHTNESS = 0.035;
const STONE_SHADE = 0.06;
// Scrub is a broadleaf crown squashed to a bush and sunk to the ground, so it costs no draw of its own.
const SCRUB_SQUASH = 0.35;
const SCRUB_SINK = 0.5;
const LANE_WIDTH = 3;
const FAR = 600;
const MOBILE_FAR = 300;
const MOBILE_TREES = 300;
function jitter(i: number, j: number): number {
  const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - Math.floor(h) - 0.5;
}

// Jitter is quantised so each tone converts OKLab to linear once per level, not per vertex; 64 levels is ~0.0003 L error.
function terrain_lut(): Float32Array {
  const surface: Record<Ground, Lab> = {
    [Ground.GRASS]: tones.grass,
    [Ground.DRY]: mix(tones.grass, tones.grass_dry, 0.55),
    [Ground.SAND]: tones.sand,
    [Ground.FOREST]: tones.forest_floor,
    [Ground.UPLAND]: tones.grass_dry,
    [Ground.DUNE]: mix(tones.sand, tones.grass_dry, 0.5),
    [Ground.DIRT]: tones.dirt,
  };
  const surfaces = Object.values(Ground).map((g) => surface[g]);
  const bases = [...surfaces, ...surfaces.map((t) => mix(tones.rock, t, 0.5)), tones.rock, tones.snow];
  const lut = new Float32Array(bases.length * JITTER_LEVELS * 3);
  bases.forEach((tone, b) => {
    for (let l = 0; l < JITTER_LEVELS; l++)
      lut.set(linear(lighten(tone, ((l + 0.5) / JITTER_LEVELS - 0.5) * JITTER_LIGHTNESS)), (b * JITTER_LEVELS + l) * 3);
  });
  return lut;
}

export function mesh_tones(): MeshTones {
  return {
    terrain: terrain_lut(),
    asphalt: linear(tones.asphalt),
    sidewalk: linear(tones.sidewalk),
    line: linear(tones.line),
    edge_line: linear(tones.edge_line),
    walls: [tones.wall, tones.wall_warm, tones.wall_cool].map(linear),
    roofs: [tones.roof, tones.roof_slate].map(linear),
    roof_flat: linear(tones.roof_flat),
    landmark: { pale: linear(tones.post), band: linear(tones.roof), cap: linear(tones.trim), stone: linear(tones.rock), stone_shade: linear(lighten(tones.rock, -STONE_SHADE)) },
    deck: { deck: linear(tones.deck), side: linear(tones.deck_side), rail: linear(tones.deck), joint: linear(tones.joint), pad: linear(tones.pad), chevron: linear(tones.chevron) },
  };
}

export interface LoadedWorld {
  world: World;
  data: WorldData;
  chunks: ChunkBuffers[];
  gen_ms: number;
  mesh_ms: number;
}

export function load_world(seed: number, kind: WorldKind): Promise<LoadedWorld> {
  const worker = new Worker(new URL("../worldgen/worker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    worker.addEventListener("message", (event: MessageEvent<GenResult>) => {
      worker.terminate();
      const { data, chunks, gen_ms, mesh_ms } = event.data;
      resolve({ world: new World(seed, data), data, chunks, gen_ms, mesh_ms });
    });
    worker.addEventListener("error", (event) => {
      worker.terminate();
      reject(new Error(`world worker: ${event.message}`));
    });
    const request: GenRequest = { seed, kind, tones: mesh_tones() };
    worker.postMessage(request);
  });
}

interface ChunkView {
  x0: number;
  z0: number;
  group: THREE.Group;
  terrain: THREE.BufferGeometry | null;
  full: number;
  trees: THREE.Object3D[];
  town: TownChunk | undefined;
  far: boolean | null;
  trees_shown: boolean | null;
}

/** The island as CHUNK-sized pieces with real bounds, so frustum culling works, plus distance LOD driven by `update`. */
export class WorldView {
  readonly root = new THREE.Group();
  readonly jumps: JumpsView;
  private readonly landmarks: LandmarksView;
  private readonly views: ChunkView[];

  constructor(world: World, chunks: ChunkBuffers[], private readonly mobile: boolean) {
    const terrain = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const road = [-2, -4].map((offset) => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset, side: THREE.DoubleSide }));
    const trees = tree_chunks(world.trees);
    const towns = town_chunks(world, chunks);
    this.views = chunks.map((chunk) => {
      const group = new THREE.Group();
      let ground: THREE.BufferGeometry | null = null;
      if (chunk.terrain) {
        ground = soup_geometry(chunk.terrain);
        ground.setIndex(new THREE.BufferAttribute(chunk.terrain.index, 1));
        ground.setDrawRange(0, chunk.terrain.full);
        const ground_mesh = new THREE.Mesh(ground, terrain);
        ground_mesh.receiveShadow = true;
        group.add(ground_mesh);
      }
      if (chunk.road) {
        const geometry = soup_geometry(chunk.road);
        geometry.addGroup(0, chunk.road.surface, 0);
        geometry.addGroup(chunk.road.surface, Infinity, 1);
        const mesh = new THREE.Mesh(geometry, road);
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      const here = trees.get(chunk.index) ?? [];
      const town = towns.get(chunk.index);
      if (here.length) group.add(...here);
      if (town) group.add(...town.objects);
      this.root.add(group);
      return { x0: chunk.x0, z0: chunk.z0, group, terrain: ground, full: chunk.terrain?.full ?? 0, trees: here, town, far: null, trees_shown: null };
    });
    this.jumps = new JumpsView(world, (x, z) => world.height(x, z));
    this.root.add(this.jumps.root);
    this.landmarks = new LandmarksView(world.props);
    this.root.add(this.landmarks.root);
  }

  /** `fog_far` is where linear fog ends: a chunk past it at every angle the camera sees is pure fog, so it is not drawn. */
  update(camera: THREE.PerspectiveCamera, fog_far: number) {
    const { x, z } = camera.position;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Fog runs on view depth, not distance; toward a frustum corner depth is distance divided by this.
    const corner = Math.sqrt(1 + tan * tan * (1 + camera.aspect * camera.aspect));
    const far_at = this.mobile ? MOBILE_FAR : FAR;
    this.jumps.cull(camera, fog_far);
    this.landmarks.update(performance.now() / 1000);
    for (const view of this.views) {
      const dx = Math.max(view.x0 - x, 0, x - view.x0 - CHUNK);
      const dz = Math.max(view.z0 - z, 0, z - view.z0 - CHUNK);
      const d = Math.sqrt(dx * dx + dz * dz);
      view.group.visible = d < fog_far * corner;
      const far = d > far_at;
      if (far !== view.far) {
        view.far = far;
        if (far) view.terrain?.setDrawRange(view.full, Infinity);
        else view.terrain?.setDrawRange(0, view.full);
        view.town?.far(far);
      }
      const trees_shown = !this.mobile || d <= MOBILE_TREES;
      if (trees_shown !== view.trees_shown) {
        view.trees_shown = trees_shown;
        for (const tree of view.trees) tree.visible = trees_shown;
      }
    }
  }
}

function tree_chunks(trees: Tree[]): Map<number, THREE.InstancedMesh[]> {
  const trunk = new THREE.CylinderGeometry(0.25, 0.35, 2.2, 5).translate(0, 1.1, 0);
  const crowns = [new THREE.ConeGeometry(2.1, 6, 6).translate(0, 4.6, 0), new THREE.IcosahedronGeometry(2.4, 0).translate(0, 4.2, 0)];
  const bark = new THREE.MeshLambertMaterial({ color: color(tones.trunk), flatShading: true });
  const leaf = new THREE.MeshLambertMaterial({ flatShading: true });
  const out = new Map<number, THREE.InstancedMesh[]>();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  const order = new Map(trees.map((tree, i) => [tree, i]));
  const crown_of = (kind: number) => (kind === TreeKind.SCRUB ? TreeKind.BROADLEAF : kind);
  for (const [key, here] of by_chunk(trees)) {
    const trunks = new THREE.InstancedMesh(trunk, bark, Math.max(1, here.filter((t) => t.kind !== TreeKind.SCRUB).length));
    let trunk_count = 0;
    const kinds = crowns.map((geometry, kind) => new THREE.InstancedMesh(geometry, leaf, Math.max(1, here.filter((t) => crown_of(t.kind) === kind).length)));
    const filled = kinds.map(() => 0);
    here.forEach((tree) => {
      q.setFromAxisAngle(axis, (tree.x * 13.37) % (Math.PI * 2));
      const shade = jitter(order.get(tree) ?? 0, tree.kind);
      const scrub = tree.kind === TreeKind.SCRUB;
      if (scrub) m.compose(p.set(tree.x, tree.y - SCRUB_SINK, tree.z), q, s.set(tree.scale, tree.scale * SCRUB_SQUASH, tree.scale));
      else {
        m.compose(p.set(tree.x, tree.y - 0.2, tree.z), q, s.setScalar(tree.scale));
        trunks.setMatrixAt(trunk_count++, m);
      }
      const crown = kinds[crown_of(tree.kind)];
      const slot = filled[crown_of(tree.kind)]++;
      crown.setMatrixAt(slot, m);
      const [r, g, b] = linear(scrub ? mix(tones.leaf, tones.grass_dry, 0.45 + shade * 0.5) : mix(tones.leaf, tones.leaf_dark, 0.5 + shade * 1.6));
      crown.setColorAt(slot, tint.setRGB(r, g, b));
    });
    trunks.count = trunk_count;
    kinds.forEach((mesh, kind) => (mesh.count = filled[kind]));
    const meshes = [trunks, ...kinds].filter((mesh) => mesh.count > 0);
    for (const mesh of meshes) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    out.set(key, meshes);
  }
  return out;
}

function strip(world: World, positions: number[], road: RoadPoint[], from: number, to: number, lift: number, keep: (s: number) => boolean) {
  const lanes = Math.ceil((to - from) / LANE_WIDTH);
  const at = (p: RoadPoint, side: number) => {
    const x = p.x - p.tz * side;
    const z = p.z + p.tx * side;
    return [x, world.height(x, z) + lift, z];
  };
  for (let s = 0; s < road.length; s++) {
    if (!keep(s)) continue;
    const a = road[s];
    const b = road[(s + 1) % road.length];
    for (let lane = 0; lane < lanes; lane++) {
      const l0 = from + ((to - from) * lane) / lanes;
      const l1 = from + ((to - from) * (lane + 1)) / lanes;
      const a0 = at(a, l0);
      const a1 = at(a, l1);
      const b0 = at(b, l0);
      const b1 = at(b, l1);
      positions.push(...a0, ...a1, ...b0, ...b0, ...a1, ...b1);
    }
  }
}

/** A strip along the race circuit, `from` to `to` metres across it. */
export function ribbon(world: World, from: number, to: number, lift: number, keep: (s: number) => boolean, tone: THREE.Color, offset: number): THREE.Mesh {
  const positions: number[] = [];
  strip(world, positions, world.road, from, to, lift, keep);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: tone, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  return mesh;
}

export function water_mesh(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(SIZE * 4, SIZE * 4, 1, 1).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: color(tones.water), transparent: true, opacity: 0.9 }));
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  return mesh;
}
