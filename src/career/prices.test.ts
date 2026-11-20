import { expect, test } from "bun:test";
import { DEFAULT_PARTS, SLOTS, SLOT_NAMES } from "../car/build";
import { PART_PRICES } from "./prices";

test("every part has a price, stock and the first part of each slot are free", () => {
  for (const slot of SLOT_NAMES) {
    expect(PART_PRICES[slot].length).toBe(SLOTS[slot].parts.length);
    expect(PART_PRICES[slot][0]).toBe(0);
    expect(PART_PRICES[slot][DEFAULT_PARTS[slot]]).toBe(0);
    for (const price of PART_PRICES[slot]) expect(Number.isInteger(price) && price >= 0).toBe(true);
  }
  expect(SLOT_NAMES.reduce((sum, slot) => sum + PART_PRICES[slot].reduce((a, b) => a + b, 0), 0)).toBe(107_500);
});
