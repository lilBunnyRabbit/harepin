import { describe, expect, test } from "bun:test";
import { CARS, COUPE, FORMULA } from "./cars";
import { tach } from "./tach";

describe("tach", () => {
  test("coupe keeps its 6600 hot and 6700 shift points", () => {
    expect(tach(6600, COUPE).hot).toBe(false);
    expect(tach(6601, COUPE).hot).toBe(true);
    expect(tach(6700, COUPE).shift).toBe(false);
    expect(tach(6701, COUPE).shift).toBe(true);
    expect(tach(7300, COUPE).fill).toBe(1);
  });

  test("formula car does not pin or flash at coupe revs", () => {
    const at = tach(7300, FORMULA);
    expect(at.fill).toBeLessThan(0.6);
    expect(at.hot).toBe(false);
    expect(at.shift).toBe(false);
    expect(tach(12000, FORMULA).shift).toBe(true);
  });

  test("every car lights the shift light before its upshift and below redline", () => {
    for (const spec of Object.values(CARS)) {
      expect(tach(spec.upshift, spec).shift).toBe(true);
      expect(tach(spec.redline * 0.8, spec).shift).toBe(false);
    }
  });
});
