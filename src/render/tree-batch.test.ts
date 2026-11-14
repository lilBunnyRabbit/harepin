import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import type { Tree } from "../world/world";
import { TreeKind } from "../worldgen/biomes";
import { tree_kit } from "./scene";
import { charred_kit } from "./snags";
import { TreeBatch } from "./tree-batch";

const grove = (n: number, kind: TreeKind): Tree[] => Array.from({ length: n }, (_, i) => ({ x: i * 7, y: 0, z: i * 3, scale: 1, kind }));

test("scrub takes a crown and no trunk", () => {
  const batch = new TreeBatch(tree_kit(false), 8);
  const planted = batch.plant([...grove(3, TreeKind.PINE), ...grove(2, TreeKind.SCRUB)], null);
  expect(planted.bark.length).toBe(3);
  expect(planted.leaf.length).toBe(5);
});

test("a batch grows past its room and reuses freed ids", () => {
  const batch = new TreeBatch(charred_kit(), 4);
  const first = batch.plant(grove(10, TreeKind.BROADLEAF), null);
  expect(batch.leaf.maxInstanceCount).toBeGreaterThanOrEqual(10);
  batch.free(first);
  expect(batch.leaf.instanceCount).toBe(0);
  const room = batch.leaf.maxInstanceCount;
  const again = batch.plant(grove(10, TreeKind.PINE), null);
  expect(batch.leaf.maxInstanceCount).toBe(room);
  expect(new Set(again.leaf)).toEqual(new Set(first.leaf));
});

test("show hides and shows a chunk's instances", () => {
  const batch = new TreeBatch(tree_kit(true), 0);
  const planted = batch.plant(grove(4, TreeKind.PINE), null);
  batch.show(planted, false);
  expect(planted.leaf.every((id) => !batch.leaf.getVisibleAt(id))).toBe(true);
  expect(planted.bark.every((id) => !batch.bark.getVisibleAt(id))).toBe(true);
  batch.show(planted, true);
  expect(planted.leaf.every((id) => batch.leaf.getVisibleAt(id))).toBe(true);
});
