import * as THREE from "three";
import { merge, tint } from "./geometry";
import { brand, color, tones } from "../theme/palette";
import { ribbon } from "../render/scene";
import { ROAD_HALF, World } from "../world/world";
import { chunk_of } from "../worldgen/chunk-grid";
import { ring_mouths, road_junctions } from "../worldgen/road-layers";

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

/** Curbs and posts along the circuit samples `keep` takes: all of them on a compact world, one chunk's on a streamed one. */
export function roadside(world: World, marks: RoadsideMarks = roadside_marks(world), keep: (s: number) => boolean = () => true): THREE.Group {
  const group = new THREE.Group();
  const { clear, inside } = marks;
  for (const [tone, parity] of [
    [brand.accent, 0],
    [tones.check_light, 1],
  ] as const) {
    for (const side of [-1, 1]) {
      const from = side > 0 ? ROAD_HALF - 0.1 : -ROAD_HALF - 0.9;
      const to = side > 0 ? ROAD_HALF + 0.9 : -ROAD_HALF + 0.1;
      // Positive curvature bends toward the +side offset, so matching signs put the curb on the inside of the bend.
      const curb = ribbon(world, from, to, 0.12, (s) => inside.get(s) === side && s % 2 === parity && !clear.has(s) && keep(s), color(tone), -5);
      if (curb.geometry.getAttribute("position").count) group.add(curb);
    }
  }

  const spacing = 12;
  const spots: number[] = [];
  for (let s = 0; s < world.road.length; s += spacing) if (!clear.has(s) && keep(s)) spots.push(s);
  if (!spots.length) return group;
  const count = spots.length * 2;
  const posts = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.14, 1.0, 0.14).translate(0, 0.5, 0),
    new THREE.MeshLambertMaterial({ color: color(tones.post) }),
    count,
  );
  const reflector = color(tones.reflector);
  const caps = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(0, 1.05, 0),
    new THREE.MeshLambertMaterial({ color: reflector, emissive: reflector, emissiveIntensity: 0.9 }),
    count,
  );
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

function dispose(object: THREE.Object3D) {
  object.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    (o.material as THREE.Material).dispose();
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
  private readonly marks: RoadsideMarks;
  /** Chunk of each circuit sample. */
  private readonly owner: Int32Array;
  private readonly built = new Map<number, THREE.Group>();

  constructor(private readonly world: World) {
    const { ext } = world.tiles;
    this.marks = roadside_marks(world);
    this.owner = Int32Array.from(world.road, (p) => chunk_of(p.x, p.z, ext));
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
    const part = this.built.get(index);
    if (!part) return;
    this.root.remove(part);
    this.built.delete(index);
    for (const child of part.children) if (!this.gates.some((g) => g?.group === child)) dispose(child);
    this.gates.forEach((g, at) => {
      if (!g || this.chunk_of_gate(at) !== index) return;
      g.material.dispose();
      this.gates[at] = undefined;
    });
  }

  private chunk_of_gate(at: number): number {
    const cp = this.world.checkpoints[at];
    return chunk_of(cp.x, cp.z, this.world.tiles.ext);
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
    if (this.built.has(index) || !this.ready(index)) return;
    const part = roadside(this.world, this.marks, (s) => this.owner[s] === index);
    this.world.checkpoints.forEach((_, at) => {
      if (this.chunk_of_gate(at) !== index) return;
      const g = gate(this.world, this.kit, at);
      this.gates[at] = g;
      part.add(g.group);
    });
    this.built.set(index, part);
    this.root.add(part);
  }
}
