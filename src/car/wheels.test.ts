/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { SLOTS } from "./build";
import { CARS } from "./cars";
import { DESIGNS } from "./designs";
import { STOCK_TYRE, wheel_geometry } from "./wheels";

test("no tyre on any car reaches past the rolling radius the physics stands it on, nor sits more than 2 cm inside it", () => {
  const looks = [STOCK_TYRE, ...SLOTS.tyres.parts.flatMap((part) => (part.look?.tyre ? [part.look.tyre] : []))];
  for (const spec of Object.values(CARS)) {
    const d = DESIGNS[spec.body.style];
    for (const look of [...looks, ...(d.tread ? [{ ...STOCK_TYRE, tread: d.tread }] : [])]) {
      const position = wheel_geometry(spec.wheel.radius, d.tyre[1], d.rim, look, d.round).getAttribute("position");
      let reach = 0;
      for (let i = 0; i < position.count; i++) reach = Math.max(reach, Math.hypot(position.getY(i), position.getZ(i)));
      expect(reach).toBeLessThanOrEqual(spec.wheel.radius + 1e-6);
      expect(reach).toBeGreaterThan(spec.wheel.radius - 0.02);
    }
  }
});
