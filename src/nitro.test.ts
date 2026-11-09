/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Nitro, type NitroSense } from "./nitro";

const DT = 1 / 360;
const cruise: NitroSense = { slide: 0, speed: 20, airborne: false };

function run(nitro: Nitro, seconds: number, want: boolean, sense: NitroSense = cruise) {
  for (let t = 0; t < seconds; t += DT) nitro.step(DT, want, sense);
}

test("no tank never boosts", () => {
  const nitro = new Nitro(0);
  expect(nitro.step(DT, true, cruise)).toBe(false);
  expect(nitro.level).toBe(0);
});

test("a full tank drains in about its capacity and then stops boosting", () => {
  const nitro = new Nitro(4);
  expect(nitro.level).toBe(1);
  run(nitro, 3, true);
  expect(nitro.boosting).toBe(true);
  run(nitro, 1.5, true);
  expect(nitro.fill).toBeLessThan(0.05);
  expect(nitro.step(DT, true, cruise)).toBe(false);
  run(nitro, 2, true);
  expect(nitro.boosting).toBe(false);
});

test("drifting and airtime refill far faster than the trickle, and the tank caps at full", () => {
  const empty = () => Object.assign(new Nitro(4), { fill: 0 });
  const [trickle, drift, air, slow] = [empty(), empty(), empty(), empty()];
  run(trickle, 2, false);
  run(drift, 2, false, { ...cruise, slide: -0.5 });
  run(air, 2, false, { ...cruise, airborne: true });
  run(slow, 2, false, { slide: 0.5, speed: 4, airborne: true });
  expect(trickle.fill).toBeGreaterThan(0);
  expect(drift.fill).toBeGreaterThan(trickle.fill * 5);
  expect(air.fill).toBeGreaterThan(trickle.fill * 5);
  expect(slow.fill).toBeCloseTo(trickle.fill);
  run(drift, 30, false, { ...cruise, slide: 0.5 });
  expect(drift.fill).toBe(4);
});

test("a near miss pays once when the pass ends clean, never when it touched or was slow", () => {
  const nitro = Object.assign(new Nitro(4), { fill: 0 });
  for (let i = 0; i < 20; i++) nitro.pass(true, false, 30);
  expect(nitro.fill).toBe(0);
  nitro.pass(false, false, 30);
  const paid = nitro.fill;
  expect(paid).toBeGreaterThan(0);
  nitro.pass(false, false, 30);
  expect(nitro.fill).toBe(paid);
  nitro.pass(true, false, 30);
  nitro.pass(true, true, 30);
  nitro.pass(false, false, 30);
  expect(nitro.fill).toBe(paid);
  nitro.pass(true, false, 5);
  nitro.pass(false, false, 5);
  expect(nitro.fill).toBe(paid);
});
