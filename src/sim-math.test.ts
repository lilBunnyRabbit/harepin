import { expect, test } from "bun:test";
import { mulberry32 } from "./rng";
import { acos, asin, atan, atan2, cbrt, cos, exp, log, sin, tan } from "./sim-math";

const BITS = new Float64Array(1);
const WORDS = new BigInt64Array(BITS.buffer);

function ulps(a: number, b: number): number {
  if (a === b || (a !== a && b !== b)) return 0;
  BITS[0] = a;
  const x = WORDS[0];
  BITS[0] = b;
  const y = WORDS[0];
  const d = x > y ? x - y : y - x;
  return Number(d);
}

const CASES: [string, (x: number) => number, (x: number) => number, number][] = [
  ["sin", sin, Math.sin, 40],
  ["cos", cos, Math.cos, 40],
  ["tan", tan, Math.tan, 3],
  ["atan", atan, Math.atan, 1e4],
  ["asin", asin, Math.asin, 1],
  ["acos", acos, Math.acos, 1],
  ["exp", exp, Math.exp, 700],
  ["log", log, (x) => Math.log(x), 1e6],
  ["cbrt", cbrt, Math.cbrt, 1e6],
];

test("each function stays within 1 ulp of the engine's", () => {
  const random = mulberry32(7);
  for (const [name, own, native, range] of CASES) {
    let worst = 0;
    for (let i = 0; i < 20000; i++) {
      const x = name === "log" ? random() * range : (random() * 2 - 1) * range;
      worst = Math.max(worst, ulps(own(x), native(x)));
    }
    expect(`${name} ${worst}`).toBe(`${name} ${Math.min(worst, 1)}`);
  }
  let worst = 0;
  for (let i = 0; i < 20000; i++) {
    const y = (random() * 2 - 1) * 100;
    const x = (random() * 2 - 1) * 100;
    worst = Math.max(worst, ulps(atan2(y, x), Math.atan2(y, x)));
  }
  expect(worst).toBeLessThanOrEqual(1);
});

test("edges match the engine", () => {
  for (const x of [0, -0, 1, -1, Infinity, -Infinity, NaN, 1e-310, Math.PI, -Math.PI / 2]) {
    for (const [name, own, native] of CASES) if (!(name === "log" && x < 0)) expect(Object.is(own(x), native(x)) || ulps(own(x), native(x)) <= 1).toBe(true);
  }
  for (const y of [0, -0, 1, -1, Infinity, -Infinity]) for (const x of [0, -0, 1, -1, Infinity, -Infinity]) expect(atan2(y, x)).toBe(Math.atan2(y, x));
});
