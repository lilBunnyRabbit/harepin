import { describe, expect, test } from "bun:test";
import { axis_value, DEFAULT_PAD_RESPONSE, fit_zone, INNER_MAX, linearity_exponent, MIN_GAP, OUTER_MIN, pad_response, type AxisResponse } from "./pad-curve";

const sweep = (step = 0.001) => Array.from({ length: Math.round(1 / step) + 1 }, (_, i) => i * step);

const CASES: AxisResponse[] = [
  DEFAULT_PAD_RESPONSE.steer,
  DEFAULT_PAD_RESPONSE.throttle,
  { inner: 0.2, outer: 0.7, exponent: 1 },
  { inner: 0, outer: 0.5, exponent: 3 },
  { inner: 0.3, outer: 1, exponent: 2.2 },
  { inner: 0.5, outer: 0.6, exponent: 1.4 },
];

describe("axis_value", () => {
  test("the default steer is the old fixed curve, bit for bit", () => {
    for (const x of sweep()) {
      for (const raw of [x, -x]) {
        const old = Math.sign(raw) * (Math.max(0, Math.abs(raw) - 0.08) / 0.92) ** 1.4;
        expect(axis_value(raw, DEFAULT_PAD_RESPONSE.steer)).toBe(old);
      }
    }
  });

  test("the default triggers pass the raw value through", () => {
    for (const x of sweep()) {
      expect(axis_value(x, DEFAULT_PAD_RESPONSE.throttle)).toBe(x);
      expect(axis_value(x, DEFAULT_PAD_RESPONSE.brake)).toBe(x);
    }
  });

  test("0 inside the inner deadzone, 1 from the outer one on, monotonic and symmetric between", () => {
    for (const curve of CASES) {
      let last = 0;
      for (const x of sweep()) {
        const value = axis_value(x, curve);
        if (x <= curve.inner) expect(value).toBe(0);
        if (x >= curve.outer) expect(value).toBe(1);
        expect(value).toBeGreaterThanOrEqual(last);
        expect(value).toBeLessThanOrEqual(1);
        expect(axis_value(-x, curve) + value).toBe(0);
        last = value;
      }
    }
  });

  test("an illegal pair reads as its nearest legal one: never a switch, never full lock from drift, never dead", () => {
    const pairs: [AxisResponse, AxisResponse][] = [
      [{ inner: 0.4, outer: 0.2, exponent: 1 }, { inner: 0.4, outer: 0.5, exponent: 1 }],
      [{ inner: 0.45, outer: 0.45, exponent: 1 }, { inner: 0.45, outer: 0.55, exponent: 1 }],
      [{ inner: 0, outer: 0, exponent: 1 }, { inner: 0, outer: 0.5, exponent: 1 }],
      [{ inner: 1, outer: 1, exponent: 1 }, { inner: 0.5, outer: 1, exponent: 1 }],
    ];
    for (const [bad, legal] of pairs) for (const x of sweep()) expect(axis_value(x, bad)).toBe(axis_value(x, legal));
    for (const [bad] of pairs) {
      const ramp = sweep().map((x) => axis_value(x, bad)).filter((value) => value > 0 && value < 1);
      expect(ramp.length).toBeGreaterThanOrEqual(MIN_GAP * 10 - 1);
      expect(axis_value(1, bad)).toBe(1);
    }
    expect(axis_value(0.01, { inner: 0, outer: 0, exponent: 1 })).toBeCloseTo(0.02, 12);
  });

  test("linearity 0 is a straight line and more linearity steers finer near centre", () => {
    const at = (linearity: number, raw: number) =>
      axis_value(raw, pad_response({ steer_inner: 0, steer_outer: 100, steer_linearity: linearity, throttle_inner: 0, throttle_outer: 100, brake_inner: 0, brake_outer: 100 }).steer);
    for (const x of sweep(0.01)) expect(at(0, x)).toBeCloseTo(x, 12);
    for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      let last = Infinity;
      for (const linearity of [0, 20, 50, 100]) {
        const value = at(linearity, x);
        expect(value).toBeLessThan(last);
        last = value;
      }
    }
    expect(at(100, 0.5)).toBeCloseTo(0.125, 12);
  });

  test("linearity maps to the curve's exponent", () => {
    expect(linearity_exponent(0)).toBe(1);
    expect(linearity_exponent(20)).toBe(1.4);
    expect(linearity_exponent(50)).toBe(2);
    expect(linearity_exponent(100)).toBe(3);
  });
});

describe("fit_zone", () => {
  test("legal pairs stay as they are", () => {
    expect(fit_zone(8, 100, "inner")).toEqual([8, 100]);
    expect(fit_zone(0, 50, "outer")).toEqual([0, 50]);
    expect(fit_zone(40, 50, "inner")).toEqual([40, 50]);
  });

  test("each side clamps to its range", () => {
    expect(fit_zone(80, 100, "inner")).toEqual([INNER_MAX, 100]);
    expect(fit_zone(0, 10, "outer")).toEqual([0, OUTER_MIN]);
    expect(fit_zone(-5, 140, "inner")).toEqual([0, 100]);
  });

  test("the side just set pushes the other to keep the gap", () => {
    expect(fit_zone(50, 55, "inner")).toEqual([50, 60]);
    expect(fit_zone(45, 50, "outer")).toEqual([40, 50]);
    for (let inner = -10; inner <= 110; inner += 5) {
      for (let outer = -10; outer <= 110; outer += 5) {
        for (const keep of ["inner", "outer"] as const) {
          const [i, o] = fit_zone(inner, outer, keep);
          expect(i).toBeGreaterThanOrEqual(0);
          expect(i).toBeLessThanOrEqual(INNER_MAX);
          expect(o).toBeGreaterThanOrEqual(OUTER_MIN);
          expect(o).toBeLessThanOrEqual(100);
          expect(o - i).toBeGreaterThanOrEqual(MIN_GAP);
        }
      }
    }
  });
});
