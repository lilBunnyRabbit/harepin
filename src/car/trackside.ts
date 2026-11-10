import * as THREE from "three";
import { merge, tint } from "./geometry";
import { brand, color, tones } from "../theme/palette";
import { ribbon, ribbon_material } from "../render/scene";
import { ROAD_HALF, World } from "../world/world";
import { chunk_of } from "../worldgen/chunk-grid";
import { ring_mouths, road_junctions } from "../worldgen/road-layers";
import type { Solid } from "../worldgen/types";

export interface Gate {
  group: THREE.Group;
  material: THREE.MeshLambertMaterial;
}

interface GateKit {
  frame: THREE.BufferGeometry;
  checker: THREE.Mesh;
}

function gate_kit(): GateKit {
  const frame = merge(
    [-1, 1].map((side) => new THREE.BoxGeometry(0.7, 6.4, 0.7).translate(side * (ROAD_HALF + 1.7), 3.2, 0)),
    new THREE.BoxGeometry(ROAD_HALF * 2 + 3.4, 0.5, 0.5).translate(0, 6.2, 0),
  );
  const columns = 14;
  const tiles: THREE.BufferGeometry[] = [];
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < columns; col++) {
      const tile = new THREE.BoxGeometry(1, 0.55, 0.3).translate((col - (columns - 1) / 2) * 1, 6.9 + row * 0.55, 0);
      tiles.push(tint(tile, color((row + col) % 2 ? tones.check_dark : tones.check_light)));
    }
  return { frame, checker: new THREE.Mesh(merge(...tiles), new THREE.MeshLambertMaterial({ vertexColors: true })) };
}

function gate(world: World, kit: GateKit, index: number): Gate {
  const cp = world.checkpoints[index];
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: color(tones.gate), emissive: new THREE.Color(0, 0, 0) });
  const mesh = new THREE.Mesh(kit.frame, material);
  mesh.castShadow = true;
  group.add(mesh);
  if (index === 0) group.add(kit.checker);
  group.position.set(cp.x, world.height(cp.x, cp.z), cp.z);
  group.rotation.y = cp.heading;
  return { group, material };
}

export function gates(world: World): Gate[] {
  const kit = gate_kit();
  return world.checkpoints.map((_, index) => gate(world, kit, index));
}

function curvature(world: World, s: number): number {
  const road = world.road;
  const a = road[(s - 6 + road.length) % road.length];
  const b = road[(s + 6) % road.length];
  return Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz);
}

/** Circuit samples past a patch's mouth still kept clear: a post there would stand on the curb's last bend. */
const MOUTH_MARGIN = 2;
/** Circuit samples either side of a junction too sharp for a patch, where the side road just overlaps the circuit. */
const LOOSE_CLEAR = 7;

// Ring samples a road leaves the loop across; curbs and posts there would wall off the side road.
function mouths(world: World): Set<number> {
  const n = world.road.length;
  const junctions = road_junctions(world);
  const inside = ring_mouths(world, junctions);
  const clear = new Set<number>();
  const around = (s: number, reach: number) => {
    for (let k = -reach; k <= reach; k++) clear.add((s + k + n) % n);
  };
  inside.forEach((v, s) => v && around(s, MOUTH_MARGIN));
  for (const s of junctions.loose) around(s, LOOSE_CLEAR);
  return clear;
}

interface RoadsideMarks {
  clear: Set<number>;
  /** Circuit sample to the side of the curb on the inside of its bend. */
  inside: Map<number, number>;
}

function roadside_marks(world: World): RoadsideMarks {
  const inside = new Map<number, number>();
  for (let s = 0; s < world.road.length; s++) {
    const k = curvature(world, s);
    if (Math.abs(k) > 0.09) inside.set(s, Math.sign(k));
  }
  return { clear: mouths(world), inside };
}

/** Curb materials, post and cap shapes and materials: one set for the world, shared by every chunk's roadside. */
export interface RoadsideKit {
  curbs: readonly THREE.Material[];
  post: THREE.BufferGeometry;
  cap: THREE.BufferGeometry;
  post_material: THREE.Material;
  cap_material: THREE.Material;
}

const CURB_TONES = [brand.accent, tones.check_light] as const;

function roadside_kit(): RoadsideKit {
  const reflector = color(tones.reflector);
  return {
    curbs: CURB_TONES.map((tone) => ribbon_material(color(tone), -5)),
    post: new THREE.BoxGeometry(0.14, 1.0, 0.14).translate(0, 0.5, 0),
    cap: new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(0, 1.05, 0),
    post_material: new THREE.MeshLambertMaterial({ color: color(tones.post) }),
    cap_material: new THREE.MeshLambertMaterial({ color: reflector, emissive: reflector, emissiveIntensity: 0.9 }),
  };
}

const POST_SPACING = 12;

/** Curbs and posts along circuit `samples` (ascending): all of them on a compact world, one chunk's on a streamed one. */
export function roadside(world: World, marks: RoadsideMarks = roadside_marks(world), kit: RoadsideKit = roadside_kit(), samples: readonly number[] = world.road.map((_, s) => s)): THREE.Group {
  const group = new THREE.Group();
  const { clear, inside } = marks;
  CURB_TONES.forEach((_, parity) => {
    for (const side of [-1, 1]) {
      const from = side > 0 ? ROAD_HALF - 0.1 : -ROAD_HALF - 0.9;
      const to = side > 0 ? ROAD_HALF + 0.9 : -ROAD_HALF + 0.1;
      // Positive curvature bends toward the +side offset, so matching signs put the curb on the inside of the bend.
      const here = samples.filter((s) => inside.get(s) === side && s % 2 === parity && !clear.has(s));
      if (here.length) group.add(ribbon(world, from, to, 0.12, here, kit.curbs[parity]));
    }
  });

  const spots = samples.filter((s) => s % POST_SPACING === 0 && !clear.has(s));
  if (!spots.length) return group;
  const count = spots.length * 2;
  const posts = new THREE.InstancedMesh(kit.post, kit.post_material, count);
  const caps = new THREE.InstancedMesh(kit.cap, kit.cap_material, count);
  const m = new THREE.Matrix4();
  let n = 0;
  for (const s of spots) {
    const p = world.road[s];
    for (const side of [-1, 1]) {
      const off = side * (ROAD_HALF + 1.6);
      const x = p.x - p.tz * off;
      const z = p.z + p.tx * off;
      m.makeTranslation(x, world.height(x, z), z);
      posts.setMatrixAt(n, m);
      caps.setMatrixAt(n, m);
      n++;
    }
  }
  posts.castShadow = true;
  group.add(posts, caps);
  return group;
}

/** Frees what one chunk's roadside owns: its curb strips and its post instances, not the kit they share. */
function dispose_roadside(part: THREE.Group) {
  for (const child of part.children) {
    if (child instanceof THREE.InstancedMesh) child.dispose();
    else if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
}

/** Gate posts as solids, as the island's plan puts them down. */
function gate_solids(world: World, at: number): Solid[] {
  const cp = world.checkpoints[at];
  const tx = Math.sin(cp.heading);
  const tz = Math.cos(cp.heading);
  return [-1, 1].map((side) => {
    const off = side * (ROAD_HALF + 1.7);
    const x = cp.x - tz * off;
    const z = cp.z + tx * off;
    return { kind: "circle", x, y: world.height(x, z), z, radius: 0.5, height: 7 };
  });
}

/**
 * A streamed world's curbs, posts and gates, built per chunk once the chunk and its eight neighbours are in (a strip
 * at a border reads the next tile's heights) and taken down when the chunk goes. `gates` keeps checkpoint order.
 */
export class ChunkTrackside {
  readonly root = new THREE.Group();
  readonly gates: (Gate | undefined)[];
  private readonly kit = gate_kit();
  private readonly roadside_kit = roadside_kit();
  private readonly marks: RoadsideMarks;
  /** Circuit samples per chunk, ascending. */
  private readonly samples = new Map<number, number[]>();
  /** Checkpoints per chunk. */
  private readonly checkpoints = new Map<number, number[]>();
  private readonly built = new Map<number, { part: THREE.Group; gates: number[]; unplace: (() => void)[] }>();

  constructor(private readonly world: World) {
    const { ext } = world.tiles;
    this.marks = roadside_marks(world);
    world.road.forEach((p, s) => push(this.samples, chunk_of(p.x, p.z, ext), s));
    world.checkpoints.forEach((cp, at) => push(this.checkpoints, chunk_of(cp.x, cp.z, ext), at));
    this.gates = world.checkpoints.map(() => undefined);
  }

  /** Chunk `index` arrived: it and each neighbour now complete are built. */
  add(index: number) {
    const { side } = this.world.tiles.ext;
    const ci = index % side;
    const cj = Math.floor(index / side);
    for (let j = Math.max(0, cj - 1); j <= Math.min(side - 1, cj + 1); j++)
      for (let i = Math.max(0, ci - 1); i <= Math.min(side - 1, ci + 1); i++) this.build(j * side + i);
  }

  drop(index: number) {
    const built = this.built.get(index);
    if (!built) return;
    this.root.remove(built.part);
    this.built.delete(index);
    dispose_roadside(built.part);
    for (const at of built.gates) {
      this.gates[at]?.material.dispose();
      this.gates[at] = undefined;
    }
    for (const unplace of built.unplace) unplace();
  }

  private ready(index: number): boolean {
    const { tiles } = this.world;
    const { side } = tiles.ext;
    const ci = index % side;
    const cj = Math.floor(index / side);
    for (let j = Math.max(0, cj - 1); j <= Math.min(side - 1, cj + 1); j++)
      for (let i = Math.max(0, ci - 1); i <= Math.min(side - 1, ci + 1); i++) if (!tiles.get(j * side + i)) return false;
    return true;
  }

  private build(index: number) {
    const samples = this.samples.get(index);
    if (!samples || this.built.has(index) || !this.ready(index)) return;
    const part = roadside(this.world, this.marks, this.roadside_kit, samples);
    const gates = this.checkpoints.get(index) ?? [];
    const unplace: (() => void)[] = [];
    for (const at of gates) {
      const g = gate(this.world, this.kit, at);
      this.gates[at] = g;
      part.add(g.group);
      unplace.push(this.world.place(gate_solids(this.world, at)));
    }
    this.built.set(index, { part, gates, unplace });
    this.root.add(part);
  }
}

function push(map: Map<number, number[]>, key: number, value: number) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
