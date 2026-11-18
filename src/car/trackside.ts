import * as THREE from "three";
import { brand, color, tones } from "../theme/palette";
import { freeze, ribbon, ribbon_material } from "../render/scene";
import { cast_instanced } from "../render/shadow-depth";
import { ROAD_HALF, World } from "../world/world";
import { chunk_of } from "../worldgen/chunk-grid";
import { KERB_OUT } from "../worldgen/road-layers";
import { KERB_IN, type KerbMarks } from "../world/kerbs";
import type { Solid } from "../worldgen/types";
import { cos, sin } from "../sim-math";
import { GATE_POST, GATE_TOP, gate_kit, type GateKit } from "./gate-kit";

export interface Gate {
  group: THREE.Group;
  material: THREE.MeshLambertMaterial;
}

/** A gate at the origin facing +z; the start line's carries the checker flags. */
export function gate_view(kit: GateKit, start: boolean): Gate {
  const group = new THREE.Group();
  const material = kit.material();
  const mesh = new THREE.Mesh(start ? kit.start : kit.frame, material);
  mesh.castShadow = true;
  group.add(mesh);
  return { group, material };
}

function gate(world: World, kit: GateKit, index: number): Gate {
  const cp = world.checkpoints[index];
  const view = gate_view(kit, index === 0);
  view.group.position.set(cp.x, world.height(cp.x, cp.z), cp.z);
  view.group.rotation.y = cp.heading;
  freeze(view.group);
  return view;
}

/** `gantry`: the world stands its own start gantry over gate 0, which keeps only its cue. */
export function gates(world: World, gantry = false): Gate[] {
  const kit = gate_kit(gantry);
  return world.checkpoints.map((_, index) => gate(world, kit, index));
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

const every_sample = (world: World): number[] => world.road.map((_, s) => s);

/** Curbs along circuit `samples` (ascending): all of them on a compact world, one chunk's on a streamed one. */
export function curbs(world: World, marks: KerbMarks = world.kerbs, kit: RoadsideKit = roadside_kit(), samples: readonly number[] = every_sample(world)): THREE.Group {
  const group = new THREE.Group();
  const { clear, inside } = marks;
  CURB_TONES.forEach((_, parity) => {
    for (const side of [-1, 1]) {
      const from = side > 0 ? KERB_IN : -KERB_OUT;
      const to = side > 0 ? KERB_OUT : -KERB_IN;
      // Positive curvature bends toward the +side offset, so matching signs put the curb on the inside of the bend.
      const here = samples.filter((s) => inside.get(s) === side && s % 2 === parity && !clear.has(s));
      if (here.length) group.add(ribbon(world, from, to, 0.12, here, kit.curbs[parity]));
    }
  });
  return group;
}

/** Marker posts with reflector caps down both sides of circuit `samples`. */
export function posts(world: World, marks: KerbMarks = world.kerbs, kit: RoadsideKit = roadside_kit(), samples: readonly number[] = every_sample(world)): THREE.Group {
  const group = new THREE.Group();
  const spots = samples.filter((s) => s % POST_SPACING === 0 && !marks.clear.has(s));
  if (!spots.length) return group;
  const count = spots.length * 2;
  const stems = new THREE.InstancedMesh(kit.post, kit.post_material, count);
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
      stems.setMatrixAt(n, m);
      caps.setMatrixAt(n, m);
      n++;
    }
  }
  cast_instanced(stems);
  group.add(stems, caps);
  return group;
}

/** Curbs and posts along circuit `samples`. */
export function roadside(world: World, marks: KerbMarks = world.kerbs, kit: RoadsideKit = roadside_kit(), samples: readonly number[] = every_sample(world)): THREE.Group {
  const group = new THREE.Group();
  group.add(...curbs(world, marks, kit, samples).children, ...posts(world, marks, kit, samples).children);
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
  const tx = sin(cp.heading);
  const tz = cos(cp.heading);
  return [-1, 1].map((side) => {
    const off = side * GATE_POST;
    const x = cp.x - tz * off;
    const z = cp.z + tx * off;
    return { kind: "circle", x, y: world.height(x, z), z, radius: 0.5, height: GATE_TOP };
  });
}

/**
 * A streamed world's curbs, posts and gates, built per chunk once the chunk and its eight neighbours are in (a strip
 * at a border reads the next tile's heights) and taken down when the chunk goes. `gates` keeps checkpoint order.
 */
export class ChunkTrackside {
  readonly root = new THREE.Group();
  readonly gates: (Gate | undefined)[];
  private readonly kit: GateKit;
  private readonly roadside_kit = roadside_kit();
  private readonly marks: KerbMarks;
  /** Circuit samples per chunk, ascending. */
  private readonly samples = new Map<number, number[]>();
  /** Checkpoints per chunk. */
  private readonly checkpoints = new Map<number, number[]>();
  private readonly built = new Map<number, { part: THREE.Group; gates: number[]; unplace: (() => void)[] }>();

  constructor(private readonly world: World, gantry = false) {
    this.kit = gate_kit(gantry);
    this.root.matrixAutoUpdate = false;
    const { ext } = world.tiles;
    this.marks = world.kerbs;
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
    freeze(part);
  }
}

function push(map: Map<number, number[]>, key: number, value: number) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
