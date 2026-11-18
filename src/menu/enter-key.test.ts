import { expect, test } from "bun:test";
import { takes_enter, type EnterTarget } from "./enter-key";

class Stub implements EnterTarget {
  constructor(
    private readonly control: boolean,
    private readonly parent: Stub | null = null,
  ) {}

  closest(): EnterTarget | null {
    return this.control ? this : (this.parent?.closest() ?? null);
  }
}

test("nothing focused, or focus on the page itself, leaves Enter to the primary", () => {
  expect(takes_enter(null)).toBe(false);
  expect(takes_enter(new Stub(false))).toBe(false);
});

test("a focused control takes Enter itself, also from a child of it", () => {
  const button = new Stub(true);
  expect(takes_enter(button)).toBe(true);
  expect(takes_enter(new Stub(false, button))).toBe(true);
});
