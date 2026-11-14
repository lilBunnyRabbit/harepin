/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";

test("the ghost stands on the drawn ground: its view rises by the lift under it, like the player's car", async () => {
  const THREE = await import("three");
  const { Ghost } = await import("./ghost");
  const scene = new THREE.Scene();
  const ghost = new Ghost(scene, { drawn_lift: (x, z) => (x === 10 && z === 30 ? 0.03 : 0) }, "harepin:ghost:test");
  ghost.use([0, 10, 2, 30, 0, 0, 0, 1, 1000, 10, 2, 30, 0, 0, 0, 1]);
  ghost.update(500, new THREE.Vector3(100, 0, 0));
  const root = scene.children[scene.children.length - 1];
  expect([root.visible, root.position.y]).toEqual([true, 2.03]);
});
