import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import * as THREE from "three";
import type { Tree } from "../world/world";
import { TreeKind } from "../worldgen/biomes";
import { tree_kit } from "./scene";
import { charred_kit } from "./snags";
import { TreeBatch, TreePool } from "./tree-batch";

const grove = (n: number, kind: TreeKind): Tree[] => Array.from({ length: n }, (_, i) => ({ x: i * 7, y: 0, z: i * 3, scale: 1, kind }));
const at = (x: number) => new THREE.Matrix4().makeTranslation(x, 0, 0);
const tone = (x: number) => new THREE.Color(x / 100, 0, 0);
const pool = (room: number) => new TreePool(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), room, true);
/** The x of every instance that draws, sorted, read back from the buffers the renderer uploads. */
function drawn(from: TreePool): number[] {
  const out: number[] = [];
  const matrix = new THREE.Matrix4();
  const colour = new THREE.Color();
  for (let i = 0; i < from.shown; i++) {
    from.mesh.getMatrixAt(i, matrix);
    from.mesh.getColorAt(i, colour);
    expect(colour.r).toBeCloseTo(matrix.elements[12] / 100, 5);
    out.push(matrix.elements[12]);
  }
  return out.sort((a, b) => a - b);
}

test("scrub takes a crown and no trunk", () => {
  const batch = new TreeBatch(tree_kit(false), []);
  const planted = batch.plant([...grove(3, TreeKind.PINE), ...grove(2, TreeKind.SCRUB)], null);
  expect(planted.bark.length).toBe(3);
  expect(planted.leaf.flat().length).toBe(5);
  expect(batch.bark.shown).toBe(3);
});

test("a kind without a crown of its own draws the broadleaf one", () => {
  const batch = new TreeBatch(charred_kit(), []);
  const planted = batch.plant(grove(2, TreeKind.SCRUB), null);
  expect(planted.leaf[TreeKind.BROADLEAF].length).toBe(2);
});

test("a batch grows past its room and takes freed room again", () => {
  const batch = new TreeBatch(charred_kit(), grove(4, TreeKind.BROADLEAF));
  const first = batch.plant(grove(10, TreeKind.BROADLEAF), null);
  const leaf = batch.leaf[TreeKind.BROADLEAF];
  expect(leaf.capacity).toBeGreaterThanOrEqual(10);
  expect(leaf.mesh.instanceMatrix.count).toBe(leaf.capacity);
  expect(leaf.mesh.instanceColor?.count).toBe(leaf.capacity);
  batch.free(first);
  expect(leaf.size).toBe(0);
  expect(leaf.shown).toBe(0);
  const room = leaf.capacity;
  batch.plant(grove(10, TreeKind.BROADLEAF), null);
  expect(leaf.capacity).toBe(room);
  expect(leaf.shown).toBe(10);
});

test("show hides and shows a chunk's instances", () => {
  const batch = new TreeBatch(tree_kit(true), []);
  const kept = batch.plant(grove(3, TreeKind.PINE), null);
  const planted = batch.plant(grove(4, TreeKind.PINE), null);
  const leaf = batch.leaf[TreeKind.PINE];
  batch.show(planted, false);
  expect(planted.leaf[TreeKind.PINE].every((id) => !leaf.is_shown(id))).toBe(true);
  expect(planted.bark.every((id) => !batch.bark.is_shown(id))).toBe(true);
  expect(kept.leaf[TreeKind.PINE].every((id) => leaf.is_shown(id))).toBe(true);
  expect(leaf.shown).toBe(3);
  batch.show(planted, true);
  expect(planted.leaf[TreeKind.PINE].every((id) => leaf.is_shown(id))).toBe(true);
  expect(leaf.shown).toBe(7);
});

test("a pool keeps each instance's matrix and colour through hides, frees and growth", () => {
  const trees = pool(2);
  const ids = new Map<number, number>();
  const shown = new Set<number>();
  const add = (x: number) => {
    ids.set(x, trees.add(at(x), tone(x)));
    shown.add(x);
  };
  const show = (x: number, on: boolean) => {
    trees.show(ids.get(x) ?? -1, on);
    if (on) shown.add(x);
    else shown.delete(x);
  };
  const free = (x: number) => {
    trees.remove(ids.get(x) ?? -1);
    ids.delete(x);
    shown.delete(x);
  };
  const check = () => expect(drawn(trees)).toEqual([...shown].sort((a, b) => a - b));

  for (let x = 1; x <= 6; x++) add(x);
  check();
  show(2, false);
  show(5, false);
  check();
  add(7);
  check();
  free(1);
  free(5);
  check();
  show(2, true);
  show(2, true);
  check();
  for (let x = 8; x <= 20; x++) add(x);
  show(9, false);
  free(20);
  free(3);
  check();
  expect(trees.size).toBe(ids.size);
  show(9, true);
  check();
  for (const x of [...ids.keys()]) free(x);
  expect(trees.size).toBe(0);
  expect(trees.shown).toBe(0);
});

test("a pool hands the renderer only the instances it touched", () => {
  const trees = pool(8);
  for (let x = 1; x <= 6; x++) trees.add(at(x), tone(x));
  trees.flush();
  const { instanceMatrix } = trees.mesh;
  instanceMatrix.clearUpdateRanges();
  const last = trees.add(at(7), tone(7));
  trees.flush();
  expect(instanceMatrix.updateRanges).toEqual([{ start: 6 * 16, count: 16 }]);
  instanceMatrix.clearUpdateRanges();
  trees.remove(last);
  trees.flush();
  expect(instanceMatrix.updateRanges).toEqual([]);
});

test("each pool has room for its own kind of tree", () => {
  const batch = new TreeBatch(tree_kit(false), [...grove(5, TreeKind.PINE), ...grove(2, TreeKind.SCRUB), ...grove(1, TreeKind.BROADLEAF)]);
  expect(batch.bark.capacity).toBe(6);
  expect(batch.leaf[TreeKind.PINE].capacity).toBe(5);
  expect(batch.leaf[TreeKind.SCRUB].capacity + batch.leaf[TreeKind.BROADLEAF].capacity).toBe(3);
});
