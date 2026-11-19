/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { build_spec, parse_build } from "../car/build";
import { COUPE, CARS, FRAMES, spec_hash } from "../car/cars";
import { capability, measure, plan_scale, tabled_specs, warm } from "./capability";
import { MEASURED } from "./capability-table";

/** It measures every stock car and preset: seconds idle, several times that beside a heavy run. */
const TABLE_TIMEOUT = 60_000;
const TABLE_SAMPLE = 8;

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

  test("the table holds every build it should, and a sample measures as it does today: rerun scripts/ai-capability.ts when it fails", () => {
    const rows = tabled_specs();
    for (const { name, spec } of rows) expect([name, spec_hash(spec) in MEASURED]).toEqual([name, true]);
    // Every stock car, then every TABLE_SAMPLE-th upgrade step: a physics change moves them all, and measuring 130 rows took 10 s.
    const stock = new Set(Object.values(CARS).map(spec_hash));
    const sample = rows.filter(({ spec }, i) => stock.has(spec_hash(spec)) || i % TABLE_SAMPLE === 0);
    for (const { name, spec } of sample) expect([name, MEASURED[spec_hash(spec)]]).toEqual([name, measure(spec)]);
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

  test("a stock car plans on its own stop; race brakes on rally tyres plan only what the tyres hold, the race-kit formula keeps most of its own", () => {
    for (const spec of Object.values(CARS)) expect(plan_scale(spec).brake).toBe((Math.min(spec.ai?.stop ?? Infinity, capability(spec).brake) / capability(COUPE).brake) * (spec.ai?.brake ?? 1));
    const held = (code: string) => {
      const spec = preset(code);
      return plan_scale(spec).brake / ((capability(spec).brake / capability(COUPE).brake) * (spec.ai?.brake ?? 1));
    };
    expect(held("rally.4.2.0.4.2.0.7.3.2.2")).toBeLessThan(0.85);
    expect(held("formula.6.4.4.2.2.0.1.2.2.2.1.2")).toBeGreaterThan(0.85);
  });

  test("a car's ai block scales its measured grip and braking, never its drive", () => {
    const trimmed = plan_scale({ ...CARS.hatch, ai: { slow: 0.5, fast: 2, brake: 0.8 } });
    const stock = plan_scale({ ...CARS.hatch, ai: undefined });
    expect(trimmed).toEqual({ ...stock, slow: stock.slow * 0.5, fast: stock.fast * 2, brake: stock.brake * 0.8 });
  });
});
