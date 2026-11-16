/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { build_spec, parse_build } from "../car/build";
import { COUPE, CARS } from "../car/cars";
import { capability, plan_scale } from "./capability";

const preset = (code: string) => {
  const build = parse_build(code);
  if (!build) throw new Error(`${code} no longer parses`);
  return build_spec(build);
};

describe("car capability", () => {
  test("the stock coupe plans on exactly the tuned numbers", () => {
    for (const v of Object.values(plan_scale(COUPE))) expect(v).toBe(1);
  });

  test("measured once per spec: the same build twice is the same object", () => {
    expect(capability(preset("rally.4.2.0.4.1.0.7.3"))).toBe(capability(preset("rally.4.2.0.4.1.0.7.3")));
  });

  test("a formula car out-grips and out-brakes the coupe, the bus falls short of it everywhere", () => {
    const formula = plan_scale(CARS.formula);
    expect(formula.slow).toBeGreaterThan(1);
    expect(formula.brake).toBeGreaterThan(1);
    const bus = plan_scale(CARS.bus);
    for (const v of Object.values(bus)) expect(v).toBeLessThan(1);
  });

  test("better tyres on the same car measure more grip", () => {
    const stock = capability(CARS.coupe);
    const slicks = capability(preset("coupe.4.0.0.1.0.0.0.6"));
    expect(slicks.slow).toBeGreaterThan(stock.slow);
  });
});
