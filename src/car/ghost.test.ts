/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";

test("the ghost stands on the drawn ground: its view rises by the mean lift under its wheels, like the player's car", async () => {
  const THREE = await import("three");
  const { Ghost } = await import("./ghost");
  const scene = new THREE.Scene();
  // Astride a line at x = 10: the left wheels (+x, the car faces +z) on one lift, the right ones on another.
  const ghost = new Ghost(scene, { drawn_lift: (x) => (x > 10 ? 0.05 : 0.01) }, "harepin:ghost:test");
  ghost.use([0, 10, 2, 30, 0, 0, 0, 1, 1000, 10, 2, 30, 0, 0, 0, 1]);
  for (let k = 0; k < 3; k++) ghost.update(500, new THREE.Vector3(100, 0, 0));
  const root = scene.children[scene.children.length - 1];
  expect(root.visible).toBe(true);
  expect(root.position.y).toBeCloseTo(2.03, 9);
});
