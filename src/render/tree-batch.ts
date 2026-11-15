import * as THREE from "three";
import { linear } from "../theme/palette";
import type { Tree } from "../world/world";
import { TreeKind } from "../worldgen/biomes";
import type { TreeKit } from "./scene";
import { cast_batched } from "./shadow-depth";

// Scrub is a crown squashed to a bush and sunk to the ground: it rides in the leaf batch, with no trunk.
const SCRUB_SQUASH = 0.35;
const SCRUB_SINK = 0.5;
/** Starting instance room of a batch whose world streams its trees in; it doubles when a chunk would overflow it. */
const STREAMED_ROOM = 4096;

function jitter(i: number, j: number): number {
  const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - Math.floor(h) - 0.5;
}

export interface Planted {
  readonly bark: number[];
  readonly leaf: number[];
}

/** A batch takes one index layout for every geometry: a mix goes non-indexed. */
function one_layout(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  if (geometries.every((geometry) => geometry.index !== null)) return geometries;
  return geometries.map((geometry) => (geometry.index ? geometry.toNonIndexed() : geometry));
}

function batch(geometries: THREE.BufferGeometry[], material: THREE.Material, room: number): { mesh: THREE.BatchedMesh; ids: number[] } {
  const vertices = geometries.reduce((sum, geometry) => sum + geometry.getAttribute("position").count, 0);
  const indices = geometries.reduce((sum, geometry) => sum + (geometry.index?.count ?? 0), 0);
  const mesh = new THREE.BatchedMesh(room, vertices, indices, material);
  const ids = geometries.map((geometry) => mesh.addGeometry(geometry));
  // The batch's own bounds are computed once and never follow added instances. Culling or sorting per tree walks every
  // instance on each pass (camera and shadow): measured 2-3x the CPU frame time on mainland. Unculled, the draw list is
  // rebuilt only when a chunk's trees come, go or hide.
  mesh.frustumCulled = false;
  mesh.perObjectFrustumCulled = false;
  mesh.sortObjects = false;
  mesh.receiveShadow = true;
  return { mesh, ids };
}

export class TreeBatch {
  readonly bark: THREE.BatchedMesh;
  readonly leaf: THREE.BatchedMesh;
  private readonly trunk: number;
  private readonly crowns: number[];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0, 1, 0);
  private readonly tint = new THREE.Color();

  constructor(private readonly kit: TreeKit, room: number) {
    const size = Math.max(1, room || STREAMED_ROOM);
    const bark = batch([kit.trunk], kit.bark, size);
    const leaf = batch(one_layout(kit.crowns), kit.leaf, size);
    this.bark = bark.mesh;
    this.leaf = leaf.mesh;
    this.trunk = bark.ids[0];
    this.crowns = leaf.ids;
    cast_batched(this.bark, false);
    cast_batched(this.leaf, true);
  }

  get meshes(): THREE.BatchedMesh[] {
    return [this.bark, this.leaf];
  }

  /** `order` keys each tree's shade jitter to its place in the world's list; without it, to its position. */
  plant(here: readonly Tree[], order: Map<Tree, number> | null): Planted {
    const planted: Planted = { bark: [], leaf: [] };
    if (!here.length) return planted;
    this.make_room(this.bark, here.length);
    this.make_room(this.leaf, here.length);
    const { m, q, s, p } = this;
    for (const tree of here) {
      q.setFromAxisAngle(this.axis, (tree.x * 13.37) % (Math.PI * 2));
      const shade = jitter(order ? (order.get(tree) ?? 0) : tree.x + tree.z * 0.37, tree.kind);
      const [r, g, b] = linear(this.kit.tone(tree.kind as TreeKind, shade));
      this.tint.setRGB(r, g, b);
      if (tree.kind === TreeKind.SCRUB) m.compose(p.set(tree.x, tree.y - SCRUB_SINK, tree.z), q, s.set(tree.scale, tree.scale * SCRUB_SQUASH, tree.scale));
      else {
        m.compose(p.set(tree.x, tree.y - 0.2, tree.z), q, s.setScalar(tree.scale));
        const id = this.bark.addInstance(this.trunk);
        this.bark.setMatrixAt(id, m);
        if (this.kit.one_tone) this.bark.setColorAt(id, this.tint);
        planted.bark.push(id);
      }
      const id = this.leaf.addInstance(this.crowns[tree.kind] ?? this.crowns[TreeKind.BROADLEAF]);
      this.leaf.setMatrixAt(id, m);
      this.leaf.setColorAt(id, this.tint);
      planted.leaf.push(id);
    }
    return planted;
  }

  show(planted: Planted, shown: boolean) {
    for (const id of planted.bark) this.bark.setVisibleAt(id, shown);
    for (const id of planted.leaf) this.leaf.setVisibleAt(id, shown);
  }

  free(planted: Planted) {
    for (const id of planted.bark) this.bark.deleteInstance(id);
    for (const id of planted.leaf) this.leaf.deleteInstance(id);
  }

  private make_room(mesh: THREE.BatchedMesh, more: number) {
    const need = mesh.instanceCount + more;
    if (need > mesh.maxInstanceCount) mesh.setInstanceCount(Math.max(need, mesh.maxInstanceCount * 2));
  }
}
