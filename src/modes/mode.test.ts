/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Quaternion, Vector3 } from "three";
import { COUPE } from "../car/cars";
import { pose_of } from "./mode";

test("pose: a car dropping onto its spawn stands still", () => {
  const car = { pos: new Vector3(3, 10, 4), vel: new Vector3(0, -6, 0), quat: new Quaternion(), heading: 1, spec: COUPE };
  expect(pose_of(car)).toEqual({ x: 3, z: 4, heading: 1, speed: 0 });
  car.vel.set(3, -6, 4);
  expect(pose_of(car).speed).toBe(5);
});
