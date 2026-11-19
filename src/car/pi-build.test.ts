/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { parse_build } from "./build";
import { pi } from "./pi";
import { build_at_pi, upgrade_steps } from "./pi-build";

const RALLY = "rally.4.2.0.4.1.0.7.3";

describe("builds at a rating", () => {
  test("the ladder climbs: no step rates under the one before, and the rally keeps its tyres, aero and suspension", () => {
    const rally = parse_build(RALLY);
    if (!rally) throw new Error("bad code");
    const steps = upgrade_steps(rally);
    const rated = steps.map(pi);
    expect(rated).toEqual([...rated].sort((a, b) => a - b));
    for (const step of steps) expect([step.parts.tyres, step.parts.aero, step.parts.suspension]).toEqual([rally.parts.tyres, rally.parts.aero, rally.parts.suspension]);
  });

  test("the nearest step to the target inside the range, the same every time; the base when none fits", () => {
    const rally = parse_build(RALLY);
    if (!rally) throw new Error("bad code");
    const built = build_at_pi(rally, 560, 500, 599);
    expect(Math.abs(pi(built) - 560)).toBeLessThanOrEqual(15);
    expect(build_at_pi(rally, 560, 500, 599)).toEqual(built);
    for (const target of [500, 540, 599]) {
      const rated = pi(build_at_pi(rally, target, 500, 599));
      expect(rated).toBeGreaterThanOrEqual(500);
      expect(rated).toBeLessThanOrEqual(599);
    }
    expect(build_at_pi(rally, 950, 900, 999)).toBe(rally);
  });
});
