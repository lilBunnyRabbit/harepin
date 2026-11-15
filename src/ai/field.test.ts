/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { personalities } from "./field";

describe("AI field personalities", () => {
  test("level 3 is the default field, and the levels move aggression and mistakes apart", () => {
    expect(personalities(7, 6, 3, 3)).toEqual(personalities(7, 6));
    const timid = personalities(7, 20, 1, 1);
    const bold = personalities(7, 20, 5, 5);
    for (const p of timid) {
      expect(p.aggression).toBeLessThanOrEqual(0.6);
      expect(p.mistakes).toBeLessThanOrEqual(0.1);
    }
    for (const p of bold) {
      expect(p.aggression).toBeGreaterThanOrEqual(0.6);
      expect(p.mistakes).toBeGreaterThanOrEqual(0.2);
    }
    expect(personalities(7, 6, 9, 0)).toEqual(personalities(7, 6, 5, 1));
  });
});
