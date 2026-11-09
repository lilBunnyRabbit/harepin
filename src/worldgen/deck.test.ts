/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { Car, type Ground } from "../car";
import { COUPE } from "../cars";
import { DECK_UNDER, DeckIndex } from "./deck";
import { DECK_STRIDE, type Deck } from "./types";

const Y = 300;
const ABYSS = -2000;

function straight(bank = 0, half = 6): Deck {
  const points: number[] = [];
  for (let z = -200; z <= 200; z += 2) points.push(0, Y, z, 0, 1, bank, half, 1, z + 200);
  return { half, pieces: [], line: new Float64Array(points), pads: [] };
}

function ground_of(index: DeckIndex): Ground {
  return {
    height: (x, z, y) => index.surface(x, z, y)?.y ?? ABYSS,
    normal: (x, z, out) => {
      const s = index.surface(x, z);
      return s ? out.set(-s.gx, 1, -s.gz).normalize() : out.set(0, 1, 0);
    },
    grip: () => 1,
    roll: () => 1,
  };
}

test("the deck answers on its top, not off its edge or from under it", () => {
  const index = new DeckIndex(straight());
  expect(index.surface(0, 10)?.y).toBeCloseTo(Y, 9);
  expect(index.surface(5.9, 10)?.y).toBeCloseTo(Y, 9);
  expect(index.surface(6.1, 10)).toBeNull();
  expect(index.surface(0, 10, Y - DECK_UNDER + 0.01)).not.toBeNull();
  expect(index.surface(0, 10, Y - DECK_UNDER - 0.01)).toBeNull();
  expect(index.surface(400, 10)).toBeNull();
  expect(index.surface(0, 260)).toBeNull();
});

test("a banked deck tilts across the travel, left side up for a positive bank, with the normal that matches", () => {
  const bank = 0.4;
  const index = new DeckIndex(straight(bank));
  const left = index.surface(3, 0);
  expect(left?.y).toBeCloseTo(Y + 3 * Math.tan(bank), 9);
  const right = index.surface(-3, 0);
  expect(right?.y).toBeCloseTo(Y - 3 * Math.tan(bank), 9);
  const n = ground_of(index).normal(0, 0, new Vector3());
  expect(Math.atan2(-n.x, n.y)).toBeCloseTo(bank, 6);
  expect(n.z).toBeCloseTo(0, 9);
});

test("a car falling past the deck edge drops by it instead of getting shoved up through it", () => {
  const index = new DeckIndex(straight());
  const ground = ground_of(index);
  const car = new Car(COUPE);
  car.place(7.5, Y - 2, 0, 0);
  car.vel.set(-3, -2, 10);
  let y = car.pos.y;
  for (let i = 0; i < 360 * 2; i++) {
    car.step(1 / 360, { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: false }, ground);
    expect(car.pos.y).toBeLessThan(y + 0.05);
    y = car.pos.y;
  }
  expect(car.pos.y).toBeLessThan(Y - 6);
});

test("the index walks to the nearest sample from anywhere and reuses its last answer", () => {
  const index = new DeckIndex(straight());
  expect(index.nearest(0, 150)).toBe(175);
  expect(index.nearest(0, -150)).toBe(25);
  expect(index.nearest(1, -149)).toBe(25);
  expect(DECK_STRIDE).toBe(9);
});
