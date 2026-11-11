/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { DEFAULT_BUILD, DEFAULT_PARTS, SLOTS, SLOT_NAMES } from "./build";
import { CARS, type CarId } from "./cars";

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
