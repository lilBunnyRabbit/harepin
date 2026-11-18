import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CARS } from "../../src/car/cars";
import { car_frames, closure } from "./cache";

const CARS_TS = new URL("../../src/car/cars.ts", import.meta.url);

test("closure keys cars.ts on its frames' physics, not its text", () => {
  const key = closure([CARS_TS]);
  expect(key).toContain(car_frames());
  expect(key).not.toContain(readFileSync(CARS_TS, "utf8"));
});

test("a body's name keeps the frames' key; a frame number moves it", () => {
  const renamed = { ...CARS, coupe: { ...CARS.coupe, name: "Renamed" } };
  expect(car_frames(renamed)).toBe(car_frames());
  const heavier = { ...CARS, coupe: { ...CARS.coupe, mass: CARS.coupe.mass + 1 } };
  expect(car_frames(heavier)).not.toBe(car_frames());
});
