import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { EVENTS } from "../career/career";
import { event_map } from "../career/career-store";
import { next_label, next_ticket, result_press, stamp_text } from "./result";

const at = (id: string) => EVENTS.find((event) => event.id === id)!;

test("the next event's ticket names its tier place and map, and the primary names the event or the map to travel to", () => {
  const here = event_map(at("r1"));
  const same = next_ticket(at("r2"), here, "Gymkhana");
  expect(same).toMatchObject({ tier: 1, eyebrow: "Next up · Rookie 2 of 7", title: at("r2").name, mode: "Gymkhana", place: { here: true } });
  expect(next_label(same)).toBe(`Next: ${at("r2").name}`);
  const away = next_ticket(at("r6"), here, "Duel");
  expect(away.place.here).toBe(false);
  expect(away.kind).toBe(event_map(at("r6")).kind);
  expect(next_label(away)).toMatch(/^Travel to Sky · /);
});

test("the stamp says the place where cars raced, else the title", () => {
  expect(stamp_text({ title: "1st of 7 · Harbour", stars: 3, lines: [], place: 1 })).toBe("1st");
  expect(stamp_text({ title: "Out in 12th", stars: 1, lines: [], place: 12 })).toBe("12th");
  expect(stamp_text({ title: "Harbour · new best", stars: 2, lines: [] })).toBe("Harbour · new best");
});

const press = (code: string, more: Partial<Pick<KeyboardEvent, "repeat" | "ctrlKey" | "metaKey" | "altKey">> = {}) => ({ code, repeat: false, ctrlKey: false, metaKey: false, altKey: false, ...more });

test("Enter with nothing focused is Next, not a key left for the chat; a focused control keeps its own Enter", () => {
  expect(result_press(press("Enter"), "none", true)).toBe("next");
  expect(result_press(press("NumpadEnter"), "none", true)).toBe("next");
  expect(result_press(press("Enter"), "page", true)).toBeNull();
  expect(result_press(press("Enter"), "none", false)).toBeNull();
  expect(result_press(press("Enter", { ctrlKey: true }), "none", true)).toBeNull();
  expect(result_press(press("Enter", { repeat: true }), "none", true)).toBeNull();
});

test("Escape leaves from the page; under a menu or in another panel the page takes no key", () => {
  expect(result_press(press("Escape"), "none", false)).toBe("leave");
  expect(result_press(press("Escape"), "page", true)).toBe("leave");
  expect(result_press(press("Escape"), "away", true)).toBeNull();
  expect(result_press(press("Enter"), "away", true)).toBeNull();
  expect(result_press(press("KeyR"), "none", true)).toBeNull();
});
