import * as THREE from "three";
import { by_chunk, soup_geometry, TownChunks, type TownChunk } from "../world/buildings";
import { JumpsView } from "../world/jumps";
import { LandmarksView } from "../world/landmarks";
import { color, lighten, linear, mix, tones } from "../theme/palette";
import { World, type RoadPoint, type Tree } from "../world/world";
import { CHUNK } from "../worldgen/chunk-grid";
import { fog_reach } from "./lighting";
import { Ground, JITTER_LEVELS, terrain_bases, type ChunkBuffers, type MeshTones } from "../worldgen/chunks";
import { TreeKind } from "../worldgen/biomes";
import { SEA_LEVEL } from "../worldgen/water";
import { crown_tone } from "./crowns";
import type { Lab } from "../theme/theme";

const JITTER_LIGHTNESS = 0.035;
const STONE_SHADE = 0.06;
/** Dry pans read as pale clay against the dunes: sand warmed by dirt, never rock, which reads cool grey under the noon sun. */
const PAN_CLAY = 0.3;
const PAN_LIGHTEN = 0.12;
/** Snow kit rows: packed snow greys toward rock where wheels compact it, ice takes the water's blue, slush the mud under it. */
const PACKED_GREY = 0.3;
const ICE_BLUE = 0.55;
const SLUSH_MUD = 0.35;
// Scrub is a broadleaf crown squashed to a bush and sunk to the ground, so it costs no draw of its own.
const SCRUB_SQUASH = 0.35;
const SCRUB_SINK = 0.5;
/** Packed snow over a winter road's asphalt. */
const ROAD_SNOW = 0.35;
const LANE_WIDTH = 3;
const FAR = 600;
const MOBILE_FAR = 200;
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
    [Ground.PAN]: lighten(mix(tones.sand, tones.dirt, PAN_CLAY), PAN_LIGHTEN),
    [Ground.SNOW]: tones.snow,
    [Ground.PACKED_SNOW]: mix(tones.rock, tones.snow, PACKED_GREY),
    [Ground.ICE]: mix(tones.water, tones.snow, ICE_BLUE),
    [Ground.SLUSH]: mix(tones.dirt, tones.snow, SLUSH_MUD),
  };
  const bases = terrain_bases(surface, (t) => mix(tones.rock, t, 0.5), tones.rock, tones.snow);
  const lut = new Float32Array(bases.length * JITTER_LEVELS * 3);
  bases.forEach((tone, b) => {
    for (let l = 0; l < JITTER_LEVELS; l++)
      lut.set(linear(lighten(tone, ((l + 0.5) / JITTER_LEVELS - 0.5) * JITTER_LIGHTNESS)), (b * JITTER_LEVELS + l) * 3);
  });
  return lut;
}

export function mesh_tones(snowy = false): MeshTones {
  return {
    terrain: terrain_lut(),
    asphalt: linear(snowy ? mix(tones.snow, tones.asphalt, ROAD_SNOW) : tones.asphalt),
    water: linear(tones.water),
    sidewalk: linear(tones.sidewalk),
    line: linear(tones.line),
    edge_line: linear(tones.edge_line),
    walls: [tones.wall, tones.wall_warm, tones.wall_cool].map(linear),
    roofs: [tones.roof, tones.roof_slate].map(linear),
    roof_flat: linear(tones.roof_flat),
    landmark: { pale: linear(tones.post), band: linear(tones.roof), cap: linear(tones.trim), stone: linear(tones.rock), stone_shade: linear(lighten(tones.rock, -STONE_SHADE)), plant: linear(tones.leaf), plant_shade: linear(tones.leaf_dark) },
    deck: { deck: linear(tones.deck), side: linear(tones.deck_side), rail: linear(tones.deck), joint: linear(tones.joint), pad: linear(tones.pad), chevron: linear(tones.chevron) },
  };
}

interface ChunkView {
  x0: number;
  z0: number;
  group: THREE.Group;
  terrain: THREE.BufferGeometry | null;
  road: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
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
  /** By chunk index; a chunk not added yet, or dropped, is a hole. */
  private readonly views: (ChunkView | undefined)[] = [];
  private readonly terrain = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly road = [-2, -4].map((offset) => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset, side: THREE.DoubleSide }));
  // The sea plane's look, so a river meets the sea in one tone; pulled forward so a mouth just over the sea wins its depth test every frame.
  private readonly water = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  private readonly tree_kit: TreeKit;
  private readonly tree_lists: Map<number, Tree[]>;
  private readonly tree_order: Map<Tree, number>;
  private readonly town_kit: TownChunks;
  private readonly trees = new Map<number, THREE.InstancedMesh[]>();
  private readonly towns = new Map<number, TownChunk | undefined>();

  private readonly streamed: boolean;

  constructor(world: World, private readonly mobile: boolean) {
    this.streamed = world.tiles.streamed;
    this.tree_kit = tree_kit(world.snowy);
    this.tree_lists = by_chunk(world.trees, world.tiles.ext);
    this.tree_order = new Map(world.trees.map((tree, i) => [tree, i]));
    this.town_kit = new TownChunks(world);
    this.jumps = new JumpsView(world, (x, z) => world.height(x, z), world.tiles.ext);
    this.root.add(this.jumps.root);
    this.landmarks = new LandmarksView(world.props);
    this.root.add(this.landmarks.root);
  }

  add(chunk: ChunkBuffers, trees: readonly Tree[] | null = null) {
    this.drop(chunk.index);
    const group = new THREE.Group();
    let ground: THREE.BufferGeometry | null = null;
    let road: THREE.BufferGeometry | null = null;
    if (chunk.terrain) {
      ground = soup_geometry(chunk.terrain);
      ground.setIndex(new THREE.BufferAttribute(chunk.terrain.index, 1));
      ground.setDrawRange(0, chunk.terrain.full);
      const ground_mesh = new THREE.Mesh(ground, this.terrain);
      ground_mesh.receiveShadow = true;
      group.add(ground_mesh);
    }
    if (chunk.road) {
      road = soup_geometry(chunk.road);
      road.addGroup(0, chunk.road.surface, 0);
      road.addGroup(chunk.road.surface, Infinity, 1);
      const mesh = new THREE.Mesh(road, this.road);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    let water: THREE.BufferGeometry | null = null;
    if (chunk.water) {
      water = soup_geometry(chunk.water);
      const mesh = new THREE.Mesh(water, this.water);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    if (trees) this.trees.set(chunk.index, tree_meshes(this.tree_kit, trees, null));
    else if (!this.trees.has(chunk.index)) this.trees.set(chunk.index, tree_meshes(this.tree_kit, this.tree_lists.get(chunk.index) ?? [], this.tree_order));
    if (!this.towns.has(chunk.index)) this.towns.set(chunk.index, this.town_kit.build(chunk));
    const here = this.trees.get(chunk.index) ?? [];
    const town = this.towns.get(chunk.index);
    if (here.length) group.add(...here);
    if (town) group.add(...town.objects);
    this.root.add(group);
    this.views[chunk.index] = { x0: chunk.x0, z0: chunk.z0, group, terrain: ground, road, water, full: chunk.terrain?.full ?? 0, trees: here, town, far: null, trees_shown: null };
  }

  /** A compact world's trees and town objects stay built for the chunk's return; a streamed chunk's are rebuilt when it comes back. */
  drop(index: number) {
    const view = this.views[index];
    if (!view) return;
    this.root.remove(view.group);
    view.terrain?.dispose();
    view.road?.dispose();
    view.water?.dispose();
    if (this.streamed) {
      for (const tree of view.trees) if (tree instanceof THREE.InstancedMesh) tree.dispose();
      this.trees.delete(index);
      view.town?.dispose();
      this.towns.delete(index);
    }
    this.views[index] = undefined;
  }

  /** `fog_far` is where linear fog ends: a chunk past it at every angle the camera sees is pure fog, so it is not drawn. */
  update(camera: THREE.PerspectiveCamera, fog_far: number) {
    const { x, z } = camera.position;
    // Phones fog on distance (`Lighting`), so nothing past `fog_far` is drawn and the streamed chunks cover the rest.
    const reach = fog_reach(camera, fog_far, this.mobile);
    const far_at = this.mobile ? MOBILE_FAR : FAR;
    this.jumps.cull(camera, fog_far);
    this.landmarks.update(performance.now() / 1000);
    for (const view of this.views) {
      if (!view) continue;
      const dx = Math.max(view.x0 - x, 0, x - view.x0 - CHUNK);
      const dz = Math.max(view.z0 - z, 0, z - view.z0 - CHUNK);
      const d = Math.sqrt(dx * dx + dz * dz);
      view.group.visible = d < reach;
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

interface TreeKit {
  trunk: THREE.BufferGeometry;
  crowns: THREE.BufferGeometry[];
  bark: THREE.Material;
  leaf: THREE.Material;
  snowy: boolean;
}

function tree_kit(snowy: boolean): TreeKit {
  return {
    snowy,
    trunk: new THREE.CylinderGeometry(0.25, 0.35, 2.2, 5).translate(0, 1.1, 0),
    crowns: [new THREE.ConeGeometry(2.1, 6, 6).translate(0, 4.6, 0), new THREE.IcosahedronGeometry(2.4, 0).translate(0, 4.2, 0)],
    bark: new THREE.MeshLambertMaterial({ color: color(tones.trunk), flatShading: true }),
    leaf: new THREE.MeshLambertMaterial({ flatShading: true }),
  };
}

const crown_of = (kind: number) => (kind === TreeKind.SCRUB ? TreeKind.BROADLEAF : kind);

function tree_meshes({ trunk, crowns, bark, leaf, snowy }: TreeKit, here: readonly Tree[], order: Map<Tree, number> | null): THREE.InstancedMesh[] {
  if (!here.length) return [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  const trunks = new THREE.InstancedMesh(trunk, bark, Math.max(1, here.filter((t) => t.kind !== TreeKind.SCRUB).length));
  let trunk_count = 0;
  const kinds = crowns.map((geometry, kind) => new THREE.InstancedMesh(geometry, leaf, Math.max(1, here.filter((t) => crown_of(t.kind) === kind).length)));
  const filled = kinds.map(() => 0);
  here.forEach((tree) => {
    q.setFromAxisAngle(axis, (tree.x * 13.37) % (Math.PI * 2));
    const shade = jitter(order ? (order.get(tree) ?? 0) : tree.x + tree.z * 0.37, tree.kind);
    const scrub = tree.kind === TreeKind.SCRUB;
    if (scrub) m.compose(p.set(tree.x, tree.y - SCRUB_SINK, tree.z), q, s.set(tree.scale, tree.scale * SCRUB_SQUASH, tree.scale));
    else {
      m.compose(p.set(tree.x, tree.y - 0.2, tree.z), q, s.setScalar(tree.scale));
      trunks.setMatrixAt(trunk_count++, m);
    }
    const crown = kinds[crown_of(tree.kind)];
    const slot = filled[crown_of(tree.kind)]++;
    crown.setMatrixAt(slot, m);
    const [r, g, b] = linear(crown_tone(tree.kind as TreeKind, shade, snowy));
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
  return meshes;
}

function strip(world: World, positions: number[], road: RoadPoint[], from: number, to: number, lift: number, samples: readonly number[]) {
  const lanes = Math.ceil((to - from) / LANE_WIDTH);
  const at = (p: RoadPoint, side: number) => {
    const x = p.x - p.tz * side;
    const z = p.z + p.tx * side;
    return [x, world.height(x, z) + lift, z];
  };
  for (const s of samples) {
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

export function ribbon_material(tone: THREE.Color, offset: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: tone, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset, side: THREE.DoubleSide });
}

/** A strip along the race circuit, `from` to `to` metres across it, over circuit `samples` in ascending order. */
export function ribbon(world: World, from: number, to: number, lift: number, samples: readonly number[], material: THREE.Material): THREE.Mesh {
  const positions: number[] = [];
  strip(world, positions, world.road, from, to, lift, samples);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

export function water_mesh(size: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(size * 4, size * 4, 1, 1).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: color(tones.water), transparent: true, opacity: 0.9 }));
  mesh.position.y = SEA_LEVEL;
  mesh.receiveShadow = true;
  return mesh;
}
