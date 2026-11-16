import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { EVENTS } from "../career/career";
import { event_map } from "../career/career-store";
import { go_label, next_ticket, stamp_text } from "./result";

const at = (id: string) => EVENTS.find((event) => event.id === id)!;

test("the next event's ticket names its tier place and map, and Go or Travel follows the map", () => {
  const here = event_map(at("r1"));
  const same = next_ticket(at("r2"), here, "Gymkhana");
  expect(same).toMatchObject({ tier: 1, eyebrow: "Next up · Rookie 2 of 7", title: at("r2").name, mode: "Gymkhana", place: { here: true } });
  expect(go_label(same.place)).toBe("Go");
  const away = next_ticket(at("r6"), here, "Duel");
  expect(away.place.here).toBe(false);
  expect(away.kind).toBe(event_map(at("r6")).kind);
  expect(go_label(away.place)).toMatch(/^Travel to Sky · /);
});

test("the stamp says the place where cars raced, else the title", () => {
  expect(stamp_text({ title: "1st of 7 · Harbour", stars: 3, lines: [], place: 1 })).toBe("1st");
  expect(stamp_text({ title: "Out in 12th", stars: 1, lines: [], place: 12 })).toBe("12th");
  expect(stamp_text({ title: "Harbour · new best", stars: 2, lines: [] })).toBe("Harbour · new best");
});
