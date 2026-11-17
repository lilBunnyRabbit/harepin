import { expect, test } from "bun:test";
import { NAV_ATTR, takes_enter, type EnterTarget } from "./enter-key";

class Stub implements EnterTarget {
  constructor(
    private readonly control: boolean,
    private readonly attrs: Record<string, string> = {},
    private readonly parent: Stub | null = null,
  ) {}

  closest(): EnterTarget | null {
    return this.control ? this : (this.parent?.closest() ?? null);
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }
}

test("nothing focused, or focus on the page itself, leaves Enter to the primary", () => {
  expect(takes_enter(null)).toBe(false);
  expect(takes_enter(new Stub(false))).toBe(false);
});

test("a focused row, chip, card or field takes Enter, also from a child of it", () => {
  const button = new Stub(true);
  expect(takes_enter(button)).toBe(true);
  expect(takes_enter(new Stub(false, {}, button))).toBe(true);
});

test("a link-style nav button leaves Enter to the primary, from its cap too", () => {
  const link = new Stub(true, { [NAV_ATTR]: "" });
  expect(takes_enter(link)).toBe(false);
  expect(takes_enter(new Stub(false, {}, link))).toBe(false);
});
