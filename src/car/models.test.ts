/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DEFAULT_BUILD, DEFAULT_PARTS, SLOTS, SLOT_NAMES } from "./build";
import { CARS, type CarId } from "./cars";

// palette.ts resolves theme tokens through the browser's CSS and a canvas at import; everything after that is plain
// geometry, so this stands in for those few DOM calls with one mid grey and builds the real meshes.
function stub_dom() {
  const element = () => ({ style: { setProperty() {} }, remove() {}, getContext: () => ({ clearRect() {}, fillRect() {}, getImageData: () => ({ data: [128, 128, 128, 255] }) }) });
  Object.assign(globalThis, {
    location: { search: "" },
    localStorage: { getItem: () => null },
    getComputedStyle: () => ({ color: "grey" }),
    document: { documentElement: element(), body: { append() {} }, createElement: element },
  });
}

test("every part of every slot builds a car view on every car", async () => {
  stub_dom();
  const { build_view, dispose_car_view } = await import("./models");
  for (const car of Object.keys(CARS) as CarId[])
    for (const slot of SLOT_NAMES)
      SLOTS[slot].parts.forEach((_, index) => {
        const view = build_view({ ...DEFAULT_BUILD, car, parts: { ...DEFAULT_PARTS, [slot]: index } });
        expect(view.wheels).toHaveLength(4);
        dispose_car_view(view);
      });
});
