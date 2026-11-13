/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { DEFAULT_BUILD, DEFAULT_PARTS, SLOTS, SLOT_NAMES } from "./build";
import { CARS, type CarId } from "./cars";
import type { Design } from "./designs";

test("every part of every slot builds a car view on every car", async () => {
  const { build_view, dispose_car_view } = await import("./models");
  for (const car of Object.keys(CARS) as CarId[])
    for (const slot of SLOT_NAMES)
      SLOTS[slot].parts.forEach((_, index) => {
        const view = build_view({ ...DEFAULT_BUILD, car, parts: { ...DEFAULT_PARTS, [slot]: index } });
        expect(view.wheels).toHaveLength(4);
        dispose_car_view(view);
      });
});

test("lights switch the headlamp glow, swing pop-up pods and leave the tail lamps running", async () => {
  const THREE = await import("three");
  const { build_view, dispose_car_view } = await import("./models");
  const { popup, set_lights } = await import("./lights");
  const { DESIGNS } = await import("./designs");
  const view = build_view(DEFAULT_BUILD);
  const [glow, tail] = [view.heads.material.emissiveIntensity, view.brake.emissiveIntensity];
  expect([view.lights, view.popup, glow > 0]).toEqual([true, null, true]);
  set_lights(view, false);
  expect([view.lights, view.heads.material.emissiveIntensity, view.brake.emissiveIntensity]).toEqual([false, 0, tail]);
  set_lights(view, true);
  expect(view.heads.material.emissiveIntensity).toBe(glow);
  const design: Design = { ...DESIGNS.coupe, popups: { pods: [{ size: [0.3, 0.1, 0.3], at: [0.6, 0.7, 1.9] }], hinge: [1.75, 0.72], lift: 0.6 } };
  const pods = popup(design, view.heads, new THREE.Color(), view.heads.material);
  expect(pods?.pivot.children).toContain(view.heads);
  set_lights({ ...view, popup: pods }, true);
  expect(pods?.pivot.rotation.x).toBeCloseTo(-0.6);
  set_lights({ ...view, popup: pods }, false);
  expect(pods?.pivot.rotation.x).toBe(0);
  dispose_car_view(view);
});
