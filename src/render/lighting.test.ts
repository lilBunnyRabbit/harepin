/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import * as THREE from "three";

const { Lighting } = await import("./lighting");

function lights(scene: THREE.Scene): number {
  let count = 0;
  scene.traverseVisible((object) => {
    if (object instanceof THREE.Light) count++;
  });
  return count;
}

test("hiding the car or swapping it keeps the scene's light count, which keys every shader", () => {
  const scene = new THREE.Scene();
  const light = new Lighting(scene, {});
  const car = new THREE.Group();
  scene.add(car);
  light.mount(car, true, 2);
  const count = lights(scene);
  car.visible = false;
  expect(lights(scene)).toBe(count);
  const next = new THREE.Group();
  scene.remove(car);
  scene.add(next);
  light.mount(next, true, 2);
  expect(lights(scene)).toBe(count);
});

test("the headlight rides at the car's pose and goes dark with a hidden car", () => {
  const scene = new THREE.Scene();
  const light = new Lighting(scene, {});
  const car = new THREE.Group();
  scene.add(car);
  light.mount(car, true, 2);
  car.position.set(10, 1, -4);
  car.rotation.y = 1;
  light.follow(car.position);
  scene.updateMatrixWorld(true);
  const lamp = scene.getObjectByProperty("isSpotLight", true as unknown as string) as THREE.SpotLight;
  expect(lamp.getWorldPosition(new THREE.Vector3()).distanceTo(car.localToWorld(lamp.position.clone()))).toBeLessThan(1e-9);
  expect(lamp.intensity).toBeGreaterThan(0);
  light.show(false);
  expect(lamp.intensity).toBe(0);
  light.show(true);
  expect(lamp.intensity).toBeGreaterThan(0);
  light.beam(false);
  expect(lamp.intensity).toBe(0);
});
