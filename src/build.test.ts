/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DEFAULT_BUILD, apply_build, build_code, build_spec, parse_build } from "./build";
import { COUPE, RALLY } from "./cars";

test("codes round-trip", () => {
  const build = { car: "rally", paint: 12, decal: 3, spoiler: 2, suspension: 0, engine: 1 } as const;
  expect(build_code(build)).toBe("rally.12.3.2.0.1");
  expect(parse_build(build_code(build))).toEqual(build);
  expect(parse_build(build_code(DEFAULT_BUILD))).toEqual(DEFAULT_BUILD);
  expect(parse_build("kaze.3.1.0.2.0")).toEqual({ car: "kaze", paint: 3, decal: 1, spoiler: 0, suspension: 2, engine: 0 });
});

test("off-grammar codes are rejected", () => {
  for (const code of [
    "",
    "van.0.0.0.1.0",
    "coupe.0.0.0.1",
    "coupe.0.0.0.1.0.0",
    "coupe.16.0.0.1.0",
    "coupe.0.4.0.1.0",
    "coupe.0.0.3.1.0",
    "coupe.-1.0.0.1.0",
    "coupe.1e1.0.0.1.0",
    " coupe.0.0.0.1.0",
    "coupe.0.0.0.1.0\n",
    "constructor.0.0.0.1.0",
    "x".repeat(40),
    42,
    null,
    { car: "coupe" },
  ])
    expect(parse_build(code)).toBeNull();
});

test("the default build leaves the base spec unchanged", () => {
  expect(apply_build(COUPE, DEFAULT_BUILD)).toEqual(COUPE);
  expect(build_spec(DEFAULT_BUILD)).toEqual(COUPE);
});

test("options move the spec the documented way", () => {
  const spec = apply_build(RALLY, { car: "rally", paint: 0, decal: 0, spoiler: 2, suspension: 2, engine: 2 });
  expect(spec.downforce).toBeCloseTo(RALLY.downforce * 2.6);
  expect(spec.drag).toBeCloseTo(RALLY.drag + 0.09);
  expect(spec.rear_grip).toBeCloseTo(RALLY.rear_grip + 0.04);
  expect(spec.spring).toBeCloseTo(RALLY.spring * 1.3);
  expect(spec.arb_rear).toBeCloseTo(RALLY.arb_rear * 1.4);
  expect(spec.wheel.rest).toBeCloseTo(RALLY.wheel.rest - 0.03);
  expect(spec.redline).toBe(RALLY.redline + 600);
  expect(spec.mass).toBe(RALLY.mass + 30);
  expect(spec.torque[3][1]).toBeCloseTo(RALLY.torque[3][1] * 1.3);
  expect(RALLY.wheel.rest).toBeCloseTo(COUPE.wheel.rest + 0.04);
});
