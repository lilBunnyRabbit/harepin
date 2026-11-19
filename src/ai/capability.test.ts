/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { build_spec, parse_build } from "../car/build";
import { COUPE, CARS, FRAMES, spec_hash } from "../car/cars";
import { capability, measure, plan_scale, tabled_specs, warm } from "./capability";
import { MEASURED } from "./capability-table";

/** It measures every stock car and preset: seconds idle, several times that beside a heavy run. */
const TABLE_TIMEOUT = 60_000;

const preset = (code: string) => {
  const build = parse_build(code);
  if (!build) throw new Error(`${code} no longer parses`);
  return build_spec(build);
};

describe("car capability", () => {
  test("the stock coupe plans on exactly the tuned numbers", () => {
    const { car: _car, jump, pull_bend, ...scale } = plan_scale(COUPE);
    for (const v of Object.values(scale)) expect(v).toBe(1);
    expect(jump).toBe(Infinity);
    expect(pull_bend).toBe(0);
  });

  test("measured once per spec: the same build twice is the same object", () => {
    expect(capability(preset("rally.4.2.0.4.1.0.7.3"))).toBe(capability(preset("rally.4.2.0.4.1.0.7.3")));
  });

  test("a formula car out-grips and out-brakes the coupe, the bus falls short of it everywhere", () => {
    const formula = plan_scale({ ...CARS.formula, ai: undefined });
    expect(formula.slow).toBeGreaterThan(1);
    expect(formula.brake).toBeGreaterThan(1);
    const bus = plan_scale(CARS.bus);
    for (const [k, v] of Object.entries(bus)) if (k !== "car" && k !== "model" && k !== "jump") expect(v).toBeLessThan(1);
  });

  test("better tyres on the same car measure more grip", () => {
    const stock = capability(CARS.coupe);
    const slicks = capability(preset("coupe.4.0.0.1.0.0.0.6"));
    expect(slicks.slow).toBeGreaterThan(stock.slow);
  });

  test("the table holds every stock car and preset as it measures today: rerun scripts/ai-capability.ts when it fails", () => {
    for (const { name, spec } of tabled_specs()) expect([name, MEASURED[spec_hash(spec)]]).toEqual([name, measure(spec)]);
  }, TABLE_TIMEOUT);

  test("no frame inherits another frame's ai block through a spread", () => {
    const blocks = Object.values(FRAMES).flatMap((spec) => (spec.ai ? [spec.ai] : []));
    expect(new Set(blocks).size).toBe(blocks.length);
  });

  test("a build warmed at mode load plans without measuring: the field's start reads it in a frame", () => {
    const custom = { ...CARS.rally, mass: CARS.rally.mass + 1 };
    let at = performance.now();
    measure(custom);
    const cold = performance.now() - at;
    warm([custom]);
    at = performance.now();
    plan_scale(custom);
    expect(performance.now() - at).toBeLessThan(cold / 10);
  });

  test("a car's ai block scales its measured grip and braking, never its drive", () => {
    const trimmed = plan_scale({ ...CARS.hatch, ai: { slow: 0.5, fast: 2, brake: 0.8 } });
    const stock = plan_scale({ ...CARS.hatch, ai: undefined });
    expect(trimmed).toEqual({ ...stock, slow: stock.slow * 0.5, fast: stock.fast * 2, brake: stock.brake * 0.8 });
  });
});
