/// <reference types="bun" />
import "../../../scripts/fake-dom";
import { expect, test } from "bun:test";

test("the stand fits a car on its hull corners, not on every point of it", async () => {
  const THREE = await import("three");
  const { hull_corners } = await import("./car-stage");
  const box = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => new THREE.Vector3(x, y, z))));
  const inside = Array.from({ length: 200 }, (_, i) => new THREE.Vector3(Math.sin(i), Math.sin(2 * i), Math.sin(3 * i)).multiplyScalar(0.9));
  const corners = hull_corners([...inside, ...box]);
  expect(corners).toHaveLength(8);
  expect(new Set(corners)).toEqual(new Set(box));
});

test("corners found pile by pile are the corners of the whole cloud", async () => {
  const THREE = await import("three");
  const { hull_corners } = await import("./car-stage");
  const cloud = Array.from({ length: 900 }, (_, i) => new THREE.Vector3(Math.sin(i * 1.7), Math.sin(i * 2.3 + 1), Math.sin(i * 3.1 + 2)));
  const piled = hull_corners([...hull_corners(cloud.slice(0, 400)), ...cloud.slice(400)]);
  expect(new Set(piled)).toEqual(new Set(hull_corners(cloud)));
});
