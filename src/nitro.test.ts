/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Nitro, peer_pass, type NitroSense } from "./nitro";

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

const POST_A = {};
const POST_B = {};

test("a near miss pays once when the pass ends clean, never when it touched or was slow", () => {
  const nitro = Object.assign(new Nitro(4), { fill: 0 });
  for (let i = 0; i < 20; i++) nitro.pass(POST_A, false, 30);
  expect(nitro.fill).toBe(0);
  nitro.pass(null, false, 30);
  const paid = nitro.fill;
  expect(paid).toBeGreaterThan(0);
  nitro.pass(null, false, 30);
  expect(nitro.fill).toBe(paid);
  run(nitro, 2, false, { ...cruise, speed: 0 });
  const later = nitro.fill;
  nitro.pass(POST_B, false, 30);
  nitro.pass(POST_B, true, 30);
  nitro.pass(null, false, 30);
  expect(nitro.fill).toBe(later);
  nitro.pass(POST_B, false, 5);
  nitro.pass(null, false, 5);
  expect(nitro.fill).toBe(later);
});

test("a row of close passes pays at most once per cooldown and never twice for the same solid soon after", () => {
  const nitro = Object.assign(new Nitro(10), { fill: 0 });
  const tick = (seconds: number) => run(nitro, seconds, false, { ...cruise, speed: 0 });
  const graze = (near: object) => {
    nitro.pass(near, false, 30);
    nitro.pass(null, false, 30);
  };
  graze(POST_A);
  const one = nitro.fill;
  tick(0.5);
  const base = nitro.fill;
  graze(POST_B);
  expect(nitro.fill).toBe(base);
  tick(1.2);
  const before = nitro.fill;
  graze(POST_A);
  expect(nitro.fill).toBe(before);
  graze(POST_B);
  expect(nitro.fill - before).toBeCloseTo(one);
  tick(3);
  const again = nitro.fill;
  graze(POST_A);
  expect(nitro.fill - again).toBeCloseTo(one);
});

test("a car rebuilt in the garage keeps its tank level, clamped to the new tank", () => {
  const small = Object.assign(new Nitro(4), { fill: 1.5 });
  const big = new Nitro(7);
  big.carry(small);
  expect(big.fill).toBe(1.5);
  const full = new Nitro(7);
  const back = new Nitro(4);
  back.carry(full);
  expect(back.fill).toBe(4);
  const none = new Nitro(0);
  none.carry(big);
  expect(none.fill).toBe(0);
});

test("refill and cut let go of the boost", () => {
  const nitro = new Nitro(4);
  run(nitro, 0.1, true);
  expect(nitro.boosting).toBe(true);
  nitro.cut();
  expect(nitro.boosting).toBe(false);
  run(nitro, 0.1, true);
  nitro.refill();
  expect(nitro.boosting).toBe(false);
  expect(nitro.fill).toBe(4);
});

test("a rewind snapshot puts back the tank and the near-miss cooldowns, both ways", () => {
  const nitro = Object.assign(new Nitro(10), { fill: 5 });
  const graze = (near: object) => {
    nitro.pass(near, false, 30);
    nitro.pass(null, false, 30);
  };
  const before = nitro.snapshot();
  graze(POST_A);
  run(nitro, 1, true);
  const after = nitro.snapshot();
  nitro.restore(before);
  expect(nitro.fill).toBe(5);
  expect(nitro.boosting).toBe(false);
  graze(POST_A);
  expect(nitro.fill).toBeCloseTo(5.6);
  nitro.restore(after);
  expect(nitro.fill).toBeCloseTo(after.fill);
  graze(POST_B);
  expect(nitro.fill).toBeCloseTo(after.fill);
});

test("a ghost peer is a near miss inside the gap, and touched inside a car width", () => {
  expect(peer_pass(6, 4)).toEqual({ close: false, touched: false });
  expect(peer_pass(3, 4)).toEqual({ close: true, touched: false });
  expect(peer_pass(1, 4)).toEqual({ close: true, touched: true });
  const nitro = Object.assign(new Nitro(4), { fill: 0 });
  const through = peer_pass(1, 4);
  nitro.pass("peer", through.touched, 30);
  nitro.pass(null, false, 30);
  expect(nitro.fill).toBe(0);
});
