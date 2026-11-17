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
