import { expect, test } from "bun:test";
import { DEFAULT_BUILD } from "../car/build";
import { car_shelves } from "../car/car-pick";
import { CarClass } from "../car/pi";
import { event_of, type CareerEvent } from "./career";
import { open_presets } from "./rewards";
import { ROW_CARS, event_place, first_pick, fits, gate_row, marks_of } from "./gate";

const at = (id: string): CareerEvent => event_of(id)!;
const shelves = car_shelves(DEFAULT_BUILD, [], open_presets([]), { cap: CarClass.C, car_sized_only: false });

test("marks read finish, then the event's times, or points where higher wins", () => {
  expect(marks_of(at("r4"))).toEqual([
    { stars: 1, text: "Finish" },
    { stars: 2, text: "2:49" },
    { stars: 3, text: "2:15" },
  ]);
  expect(marks_of(at("c2")).map((m) => m.text)).toEqual(["Finish", "230 pts", "287 pts"]);
});

test("the eyebrow counts the event within its tier", () => {
  expect(event_place(at("r4"))).toBe("Rookie 4 of 7");
});

test("the row starts with the car on now and the one to take, cars over the cap last", () => {
  const row = gate_row(shelves, null);
  expect(row.length).toBeLessThanOrEqual(ROW_CARS);
  expect(row[0].fitted).toBe(true);
  const open = row.findIndex((c) => c.blocked !== null);
  if (open >= 0) expect(row.slice(open).every((c) => c.blocked !== null)).toBe(true);
  const pick = first_pick(row);
  expect(row.find((c) => c.code === pick)?.recommended).toBe(true);
  expect(pick !== null && fits(shelves, pick)).toBe(true);
});

test("a car picked in the full picker always gets a place in the row", () => {
  const all = shelves.flatMap((s) => s.choices);
  const row = gate_row(shelves, null);
  const outside = all.find((c) => !row.includes(c));
  if (!outside) return;
  const with_pick = gate_row(shelves, outside.code);
  expect(with_pick.length).toBe(row.length);
  expect(with_pick.at(-1)?.code).toBe(outside.code);
});

test("a car over the cap does not fit", () => {
  const over = shelves.flatMap((s) => s.choices).find((c) => c.blocked !== null);
  expect(over && fits(shelves, over.code)).toBe(false);
});
