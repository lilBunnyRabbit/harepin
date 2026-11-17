/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import * as THREE from "three";
import type { DrawnGround } from "./marks";

const { RaceView } = await import("./race-view");

const EDGE = 100;
const STAND_IN = 40;

function heights(root: THREE.Object3D): number[] {
  const ys: number[] = [];
  for (const child of root.children) {
    if (child instanceof THREE.InstancedMesh) continue;
    if (child instanceof THREE.Mesh) {
      const at = child.geometry.getAttribute("position");
      for (let i = 0; i < at.count; i++) ys.push(at.getY(i));
    } else ys.push(child.position.y);
  }
  return ys;
}

test("paint laid on stand-in ground before its chunk streamed in goes down on the real ground once it arrives", () => {
  let arrived = false;
  const here = (x: number) => arrived || x < EDGE;
  const ground: DrawnGround = { height: (x) => (here(x) ? 0 : STAND_IN), drawn_lift: () => 0.05 };
  const line = Array.from({ length: 200 }, (_, i) => ({ x: i, z: 0, tx: 1, tz: 0 }));
  const view = new RaceView({ line, gates: [60, 150, 199], route: { closed: false, gate_hw: 5, road: [{ from: 0, half: 5 }], closure: [] } }, ground);
  expect(Math.max(...heights(view.root))).toBeGreaterThan(STAND_IN);
  arrived = true;
  view.ground_in((x) => x >= EDGE);
  expect(Math.max(...heights(view.root))).toBeLessThan(1);
  view.dispose();
});
