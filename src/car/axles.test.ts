/// <reference types="bun" />
import { expect, test } from "bun:test";
import { axle_index, axles_of } from "./axles";
import { Car } from "./car";
import { CARS, COUPE, type CarSpec } from "./cars";

const six_wheeler: CarSpec = {
  ...COUPE,
  drive: "awd",
  awd_split: 0.4,
  wheel: {
    ...COUPE.wheel,
    mounts: [...COUPE.wheel.mounts, [0.84, 0.1, -2.4], [-0.84, 0.1, -2.4]],
  },
};

test("every car pairs its four mounts front then rear", () => {
  for (const spec of Object.values(CARS)) {
    const [front, rear] = axles_of(spec);
    expect([front.wheels, rear.wheels, front.z, rear.z]).toEqual([[0, 1], [2, 3], spec.wheel.mounts[0][2], spec.wheel.mounts[2][2]]);
  }
});

test("more mounts make more rear axles, splitting the rear drive between them", () => {
  const axles = axles_of(six_wheeler);
  expect(axles.map((a) => [a.z, a.wheels, a.steer, a.handbrake])).toEqual([
    [1.3, [0, 1], true, false],
    [-1.3, [2, 3], false, true],
    [-2.4, [4, 5], false, true],
  ]);
  expect(axles.map((a) => a.drive_share)).toEqual([0.4, 0.3, 0.3]);
  expect(six_wheeler.wheel.mounts.map((_, i) => axle_index(axles, i))).toEqual([0, 0, 1, 1, 2, 2]);
  expect(new Car(six_wheeler).wheels).toHaveLength(6);
});

test("a lone mount on its own z is a broken spec", () => {
  const odd: CarSpec = { ...COUPE, wheel: { ...COUPE.wheel, mounts: [...COUPE.wheel.mounts, [0, 0.1, -2.4]] } };
  expect(() => axles_of(odd)).toThrow("1 wheels, not 2");
});
