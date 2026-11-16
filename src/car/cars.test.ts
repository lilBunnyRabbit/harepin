import { expect, test } from "bun:test";
import { BODIES, CARS, FRAMES, car_sized, spec_hash, type CarId } from "./cars";

const ids = Object.keys(BODIES) as CarId[];

test("every frame carries a body", () => {
  expect(Object.keys(FRAMES).filter((frame) => !ids.some((id) => BODIES[id].frame === frame))).toEqual([]);
});

test("bodies on one frame share its physics key and its size class", () => {
  for (const id of ids) {
    const mate = ids.find((other) => BODIES[other].frame === BODIES[id].frame);
    if (!mate) continue;
    expect([id, spec_hash(CARS[id]), car_sized(CARS[id])]).toEqual([id, spec_hash(CARS[mate]), car_sized(CARS[mate])]);
  }
});

test("the Kaze is a body on the Coupe frame", () => {
  expect(BODIES.kaze.frame).toBe("coupe");
  expect(spec_hash(CARS.kaze)).toBe(spec_hash(CARS.coupe));
});
