/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { SLOTS } from "./build";
import { CARS } from "./cars";
import { DESIGNS } from "./designs";
import { STOCK_CALIPER, STOCK_TYRE, brake_geometry, brake_room, wheel_geometry } from "./wheels";

test("no tyre on any car reaches past the rolling radius the physics stands it on, nor sits more than 2 cm inside it", () => {
  const looks = [STOCK_TYRE, ...SLOTS.tyres.parts.flatMap((part) => (part.look?.tyre ? [part.look.tyre] : []))];
  for (const spec of Object.values(CARS)) {
    const d = DESIGNS[spec.body.style];
    for (const look of [...looks, ...(d.tread ? [{ ...STOCK_TYRE, tread: d.tread }] : [])]) {
      const position = wheel_geometry(spec.wheel.radius, d.tyre[1], d.rim, look).getAttribute("position");
      let reach = 0;
      for (let i = 0; i < position.count; i++) reach = Math.max(reach, Math.hypot(position.getY(i), position.getZ(i)));
      expect(reach).toBeLessThanOrEqual(spec.wheel.radius + 1e-6);
      expect(reach).toBeGreaterThan(spec.wheel.radius - 0.02);
    }
  }
});

test("the brake stays inside the barrel, behind the spokes, and nothing the wheel spins enters its room", () => {
  const tyres = [STOCK_TYRE, ...SLOTS.tyres.parts.flatMap((part) => (part.look?.tyre ? [part.look.tyre] : []))];
  const calipers = [STOCK_CALIPER, ...SLOTS.brakes.parts.flatMap((part) => (part.look?.caliper ? [part.look.caliper] : []))];
  for (const spec of Object.values(CARS)) {
    const d = DESIGNS[spec.body.style];
    for (const rim of [d.rim, ...(d.kit?.rim ? [d.kit.rim] : [])])
      for (const width of [...d.tyre, ...(d.kit?.tyre ?? [])])
        for (const look of tyres) {
          const room = brake_room(spec.wheel.radius, width, rim, look);
          expect(room.front - room.back).toBeGreaterThan(0.02);
          for (const caliper of calipers) {
            const brake = brake_geometry(spec.wheel.radius, width, rim, look, caliper).getAttribute("position");
            let out = 0;
            for (let i = 0; i < brake.count; i++) out = Math.max(out, Math.hypot(brake.getY(i), brake.getZ(i)) - room.reach, room.back - brake.getX(i), brake.getX(i) - room.front);
            expect(out).toBeLessThanOrEqual(1e-6);
          }
          const wheel = wheel_geometry(spec.wheel.radius, width, rim, look).getAttribute("position");
          let inside = 0;
          for (let i = 0; i < wheel.count; i++) if (Math.hypot(wheel.getY(i), wheel.getZ(i)) < room.reach && wheel.getX(i) > room.back && wheel.getX(i) < room.front) inside++;
          expect(inside).toBe(0);
        }
  }
});
