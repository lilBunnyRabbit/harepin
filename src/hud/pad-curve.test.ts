import { describe, expect, test } from "bun:test";
import { axis_value, DEFAULT_PAD_RESPONSE, linearity_exponent, pad_response, type AxisResponse } from "./pad-curve";

const sweep = (step = 0.001) => Array.from({ length: Math.round(1 / step) + 1 }, (_, i) => i * step);

const CASES: AxisResponse[] = [
  DEFAULT_PAD_RESPONSE.steer,
  DEFAULT_PAD_RESPONSE.throttle,
  { inner: 0.2, outer: 0.7, exponent: 1 },
  { inner: 0, outer: 0.5, exponent: 3 },
  { inner: 0.3, outer: 1, exponent: 2.2 },
  { inner: 0.5, outer: 0.5, exponent: 1.4 },
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
        if (x >= Math.max(curve.outer, curve.inner + 0.01)) expect(value).toBe(1);
        expect(value).toBeGreaterThanOrEqual(last);
        expect(value).toBeLessThanOrEqual(1);
        expect(axis_value(-x, curve) + value).toBe(0);
        last = value;
      }
    }
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
