/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Car, type Controls, type Ground } from "../car/car";
import { CARS } from "../car/cars";
import { PAD_ACCEL, PAD_MAX, PAD_TIME, PadTimer } from "./sky-pads";
import { World } from "./world";
import { GAP_FAST, generate_sky, PAD_GAP_CLEAR } from "../worldgen/sky";
import { DECK_STRIDE } from "../worldgen/types";

const DT = 1 / 360;
const coast: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
const flat: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };
const data = generate_sky(3);
const world = new World(3, data);

/** Rolls a car in neutral from 10 m before the first pad at `speed` for 2 s; `kick` false leaves the pads out. */
function over_pad(speed: number, kick: boolean): { end: number; peak: number } {
  const deck = data.deck;
  if (!deck) throw new Error("sky world without a deck");
  const pad = deck.pads[0];
  const i = data.road.findIndex((_, k) => deck.line[k * DECK_STRIDE + 8] >= pad.s0 - 10);
  const p = data.road[i];
  const car = new Car(CARS.coupe);
  car.place(p.x, p.y + 0.75, p.z, Math.atan2(p.tx, p.tz));
  car.vel.set(p.tx * speed, 0, p.tz * speed);
  car.gear = 0;
  const pads = new PadTimer();
  let peak = 0;
  for (let t = 0; t < 2; t += DT) {
    car.step(DT, coast, world);
    if (kick) pads.step(DT, car, world);
    peak = Math.max(peak, car.vel.length());
  }
  return { end: car.vel.length(), peak };
}

test("driving over a pad kicks the car about PAD_ACCEL * PAD_TIME faster, the same every run", () => {
  const gain = over_pad(20, true).end - over_pad(20, false).end;
  expect(gain).toBeGreaterThan(PAD_ACCEL * PAD_TIME * 0.85);
  expect(gain).toBeLessThan(PAD_ACCEL * PAD_TIME * 1.05);
  expect(over_pad(20, true).end).toBe(over_pad(20, true).end);
});

test("a pad adds nothing past PAD_MAX, and nothing to a car in the air", () => {
  const fast = over_pad(PAD_MAX - 2, true);
  expect(fast.end).toBeGreaterThan(over_pad(PAD_MAX - 2, false).end);
  expect(fast.peak).toBeLessThan(PAD_MAX + PAD_ACCEL * DT * 2);
  const deck = data.deck;
  if (!deck) throw new Error("sky world without a deck");
  const p = data.road[data.road.findIndex((_, k) => deck.line[k * DECK_STRIDE + 8] >= deck.pads[0].s0 + 2)];
  const car = new Car(CARS.coupe);
  car.place(p.x, p.y + 5, p.z, Math.atan2(p.tx, p.tz));
  const pads = new PadTimer();
  pads.step(DT, car, world);
  expect(pads.left).toBe(0);
  expect(car.vel.length()).toBe(0);
});

test(`every car kicked to PAD_MAX coasts back under GAP_FAST within ${PAD_GAP_CLEAR} m, even rolling in neutral`, () => {
  for (const [id, spec] of Object.entries(CARS)) {
    const car = new Car(spec);
    car.place(0, 0.75, 0, 0);
    car.vel.set(0, 0, PAD_MAX);
    car.gear = 0;
    for (let t = 0; t < 30 && car.vel.length() >= GAP_FAST; t += DT) car.step(DT, coast, flat);
    expect(car.pos.z, id).toBeLessThan(PAD_GAP_CLEAR);
  }
});
