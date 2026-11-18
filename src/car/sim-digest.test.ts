import { expect, test } from "bun:test";
import { car_digest, maths_digest } from "./sim-digest";

// Recorded in headless Chromium by `node scripts/sim-digest.mjs`: Bun (JSC) must give the bits a Chrome player gets.
test("the shared maths and the car step give the bits Chrome gives", () => {
  expect(maths_digest()).toBe("8ad84cdc");
  expect(car_digest()).toBe("47323c00");
});
