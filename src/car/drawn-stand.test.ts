/// <reference types="bun" />
import { expect, test } from "bun:test";
import * as THREE from "three";
import { stand_on_drawn } from "./drawn-stand";

function view(turn: THREE.Quaternion) {
  const root = new THREE.Group();
  root.position.set(10, 2, 30);
  root.quaternion.copy(turn);
  const wheels = [
    [0.8, -0.3, 1.3],
    [-0.8, -0.3, 1.3],
    [0.8, -0.3, -1.3],
    [-0.8, -0.3, -1.3],
  ].map(([x, y, z]) => {
    const wheel = new THREE.Group();
    wheel.position.set(x, y, z);
    root.add(wheel);
    return wheel;
  });
  return { root, wheels };
}

const world_y = (v: ReturnType<typeof view>) => v.wheels.map((w) => w.getWorldPosition(new THREE.Vector3()).y);

test("a car astride a line: the body rises by the mean lift, each tyre by its own lift over the ground", () => {
  const level = view(new THREE.Quaternion());
  const before = world_y(level);
  stand_on_drawn(level, { drawn_lift: (x) => (x > 10 ? 0.045 : 0.03) });
  level.root.updateMatrixWorld(true);
  expect(level.root.position.y).toBeCloseTo(2.0375, 12);
  world_y(level).forEach((y, i) => expect(y - before[i]).toBeCloseTo(i % 2 === 0 ? 0.045 : 0.03, 12));
});

test("on a tilted car the wheel offsets still go straight up, and each wheel asks the lift at its own spot", () => {
  const tilted = view(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.7, -0.15)));
  tilted.root.updateMatrixWorld(true);
  const before = tilted.wheels.map((w) => w.getWorldPosition(new THREE.Vector3()));
  const asked: number[] = [];
  const lift = (x: number, z: number) => 0.01 * (x - 10) + 0.002 * (z - 30) + 0.05;
  stand_on_drawn(tilted, { drawn_lift: (x, z) => (asked.push(x, z), lift(x, z)) });
  tilted.root.updateMatrixWorld(true);
  tilted.wheels.forEach((w, i) => {
    const after = w.getWorldPosition(new THREE.Vector3());
    expect(asked[i * 2]).toBeCloseTo(before[i].x, 12);
    expect(asked[i * 2 + 1]).toBeCloseTo(before[i].z, 12);
    expect([after.x - before[i].x, after.z - before[i].z]).toEqual([expect.closeTo(0, 12), expect.closeTo(0, 12)]);
    expect(after.y - before[i].y).toBeCloseTo(lift(before[i].x, before[i].z), 12);
  });
});

test("standing every frame does not drift once the wheels are put back at their spot", () => {
  const v = view(new THREE.Quaternion());
  for (let k = 0; k < 5; k++) {
    v.root.position.y = 2;
    v.wheels.forEach((w, i) => w.position.set(i % 2 === 0 ? 0.8 : -0.8, -0.3, i < 2 ? 1.3 : -1.3));
    stand_on_drawn(v, { drawn_lift: (x) => (x > 10 ? 0.06 : 0) });
  }
  expect([v.root.position.y, v.wheels[0].position.y, v.wheels[1].position.y]).toEqual([2.03, expect.closeTo(-0.27, 12), expect.closeTo(-0.33, 12)]);
});
