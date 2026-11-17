import * as THREE from "three";
import { linear } from "../theme/palette";
import type { Tree } from "../world/world";
import { TreeKind } from "../worldgen/biomes";
import type { TreeKit } from "./scene";
import { cast_instanced } from "./shadow-depth";

// Scrub is a crown squashed to a bush and sunk to the ground: it rides with the crowns, with no trunk.
const SCRUB_SQUASH = 0.35;
const SCRUB_SINK = 0.5;
/** Starting instance room of a pool whose world streams its trees in; it doubles when a chunk would overflow it. */
const STREAMED_ROOM = 4096;
const MATRIX_SIZE = 16;
const COLOUR_SIZE = 3;

function jitter(i: number, j: number): number {
  const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - Math.floor(h) - 0.5;
}

export interface Planted {
  readonly bark: number[];
  /** By crown shape. */
  readonly leaf: number[][];
}

/**
 * Every tree of one shape in one instanced draw. A batched mesh draws each tree as a draw of its own in WebGL: 46 000
 * a frame on the mainland, with the shadow pass. The instances that draw are the first `shown`; hidden ones sit behind
 * them, so hiding or freeing a tree swaps two instances and rewrites nothing else.
 */
export class TreePool {
  readonly mesh: THREE.InstancedMesh;
  private readonly slot_of: number[] = [];
  private readonly id_at: number[] = [];
  private readonly spare: number[] = [];
  private used = 0;
  private room: number;
  private low = Infinity;
  private high = -1;

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, room: number, coloured: boolean) {
    this.room = Math.max(1, room);
    this.mesh = new THREE.InstancedMesh(geometry, material, this.room);
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (coloured) this.mesh.instanceColor = this.colours(new Float32Array(this.room * COLOUR_SIZE));
    // The bounds are computed once and never follow the instances, and culling per tree would walk every one on each
    // pass (camera and shadow).
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    cast_instanced(this.mesh);
  }

  get shown(): number {
    return this.mesh.count;
  }

  get size(): number {
    return this.used;
  }

  get capacity(): number {
    return this.room;
  }

  add(matrix: THREE.Matrix4, tint: THREE.Color | null): number {
    if (this.used === this.room) this.grow(this.room * 2);
    const id = this.spare.pop() ?? this.slot_of.length;
    const slot = this.mesh.count;
    if (slot < this.used) this.move(slot, this.used);
    matrix.toArray(this.mesh.instanceMatrix.array, slot * MATRIX_SIZE);
    if (tint && this.mesh.instanceColor) tint.toArray(this.mesh.instanceColor.array, slot * COLOUR_SIZE);
    this.seat(id, slot);
    this.mesh.count++;
    this.used++;
    return id;
  }

  remove(id: number) {
    this.show(id, false);
    const slot = this.slot_of[id];
    const last = --this.used;
    if (slot < last) this.move(last, slot);
    this.slot_of[id] = -1;
    this.spare.push(id);
  }

  show(id: number, shown: boolean) {
    const slot = this.slot_of[id];
    if (slot < this.mesh.count === shown) return;
    const edge = shown ? this.mesh.count++ : --this.mesh.count;
    if (slot !== edge) this.swap(slot, edge);
  }

  is_shown(id: number): boolean {
    return this.slot_of[id] < this.mesh.count;
  }

  reserve(more: number) {
    const need = this.used + more;
    if (need > this.room) this.grow(Math.max(need, this.room * 2));
  }

  flush() {
    if (this.high < this.low) return;
    const count = this.high - this.low + 1;
    const { instanceMatrix, instanceColor } = this.mesh;
    instanceMatrix.addUpdateRange(this.low * MATRIX_SIZE, count * MATRIX_SIZE);
    instanceMatrix.needsUpdate = true;
    if (instanceColor) {
      instanceColor.addUpdateRange(this.low * COLOUR_SIZE, count * COLOUR_SIZE);
      instanceColor.needsUpdate = true;
    }
    this.low = Infinity;
    this.high = -1;
  }

  private seat(id: number, slot: number) {
    this.slot_of[id] = slot;
    this.id_at[slot] = id;
    if (slot < this.low) this.low = slot;
    if (slot > this.high) this.high = slot;
  }

  private move(from: number, to: number) {
    const { instanceMatrix, instanceColor } = this.mesh;
    instanceMatrix.array.copyWithin(to * MATRIX_SIZE, from * MATRIX_SIZE, (from + 1) * MATRIX_SIZE);
    instanceColor?.array.copyWithin(to * COLOUR_SIZE, from * COLOUR_SIZE, (from + 1) * COLOUR_SIZE);
    this.seat(this.id_at[from], to);
  }

  private swap(a: number, b: number) {
    const id = this.id_at[a];
    const matrix = this.mesh.instanceMatrix.array;
    const colour = this.mesh.instanceColor?.array;
    for (let i = 0; i < MATRIX_SIZE; i++) {
      const kept = matrix[a * MATRIX_SIZE + i];
      matrix[a * MATRIX_SIZE + i] = matrix[b * MATRIX_SIZE + i];
      matrix[b * MATRIX_SIZE + i] = kept;
    }
    if (colour)
      for (let i = 0; i < COLOUR_SIZE; i++) {
        const kept = colour[a * COLOUR_SIZE + i];
        colour[a * COLOUR_SIZE + i] = colour[b * COLOUR_SIZE + i];
        colour[b * COLOUR_SIZE + i] = kept;
      }
    this.seat(this.id_at[b], a);
    this.seat(id, b);
  }

  private colours(array: Float32Array): THREE.InstancedBufferAttribute {
    const attribute = new THREE.InstancedBufferAttribute(array, COLOUR_SIZE);
    attribute.setUsage(THREE.DynamicDrawUsage);
    return attribute;
  }

  private grow(room: number) {
    const { mesh } = this;
    const matrix = new Float32Array(room * MATRIX_SIZE);
    matrix.set(mesh.instanceMatrix.array);
    const colour = mesh.instanceColor && new Float32Array(room * COLOUR_SIZE);
    if (colour && mesh.instanceColor) colour.set(mesh.instanceColor.array);
    // The renderer keeps a GPU buffer per attribute and lets go of an instanced mesh's only on its dispose.
    mesh.dispose();
    mesh.instanceMatrix = new THREE.InstancedBufferAttribute(matrix, MATRIX_SIZE);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (colour) mesh.instanceColor = this.colours(colour);
    this.room = room;
    this.low = Infinity;
    this.high = -1;
  }
}

export class TreeBatch {
  readonly bark: TreePool;
  readonly leaf: readonly TreePool[];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0, 1, 0);
  private readonly tint = new THREE.Color();

  /** An empty `known` is a world that streams its trees in: every pool starts at `STREAMED_ROOM`. */
  constructor(private readonly kit: TreeKit, known: readonly Tree[]) {
    const crowns = kit.crowns.map(() => 0);
    let trunks = 0;
    for (const tree of known) {
      crowns[this.crown_of(tree.kind)]++;
      if (tree.kind !== TreeKind.SCRUB) trunks++;
    }
    const room = (count: number) => (known.length ? count : STREAMED_ROOM);
    this.bark = new TreePool(kit.trunk, kit.bark, room(trunks), kit.one_tone);
    this.leaf = kit.crowns.map((crown, i) => new TreePool(crown, kit.leaf, room(crowns[i]), true));
  }

  private crown_of(kind: number): number {
    return kind < this.kit.crowns.length ? kind : TreeKind.BROADLEAF;
  }

  get meshes(): THREE.InstancedMesh[] {
    return [this.bark.mesh, ...this.leaf.map((pool) => pool.mesh)];
  }

  /** `order` keys each tree's shade jitter to its place in the world's list; without it, to its position. */
  plant(here: readonly Tree[], order: Map<Tree, number> | null): Planted {
    const planted: Planted = { bark: [], leaf: this.leaf.map(() => []) };
    if (!here.length) return planted;
    this.bark.reserve(here.length);
    for (const pool of this.leaf) pool.reserve(here.length);
    const { m, q, s, p } = this;
    for (const tree of here) {
      q.setFromAxisAngle(this.axis, (tree.x * 13.37) % (Math.PI * 2));
      const shade = jitter(order ? (order.get(tree) ?? 0) : tree.x + tree.z * 0.37, tree.kind);
      const [r, g, b] = linear(this.kit.tone(tree.kind as TreeKind, shade));
      this.tint.setRGB(r, g, b);
      if (tree.kind === TreeKind.SCRUB) m.compose(p.set(tree.x, tree.y - SCRUB_SINK, tree.z), q, s.set(tree.scale, tree.scale * SCRUB_SQUASH, tree.scale));
      else {
        m.compose(p.set(tree.x, tree.y - 0.2, tree.z), q, s.setScalar(tree.scale));
        planted.bark.push(this.bark.add(m, this.tint));
      }
      const crown = this.crown_of(tree.kind);
      planted.leaf[crown].push(this.leaf[crown].add(m, this.tint));
    }
    this.flush();
    return planted;
  }

  show(planted: Planted, shown: boolean) {
    for (const id of planted.bark) this.bark.show(id, shown);
    planted.leaf.forEach((ids, crown) => {
      for (const id of ids) this.leaf[crown].show(id, shown);
    });
    this.flush();
  }

  free(planted: Planted) {
    for (const id of planted.bark) this.bark.remove(id);
    planted.leaf.forEach((ids, crown) => {
      for (const id of ids) this.leaf[crown].remove(id);
    });
    this.flush();
  }

  private flush() {
    this.bark.flush();
    for (const pool of this.leaf) pool.flush();
  }
}
