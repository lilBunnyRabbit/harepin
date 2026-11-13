/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DEFAULT_BUILD, build_code, parse_build } from "./build";
import { car_shelves, same_machine, within, type CarShelf } from "./car-pick";
import { CLASS_FLOORS, CLASS_LABELS, CarClass, rating } from "./pi";
import { PRESETS } from "./presets";

const preset = (name: string) => {
  const build = parse_build(PRESETS.find((p) => p.name === name)?.code);
  if (!build) throw new Error(`no preset ${name}`);
  return build;
};

test("a class fits its own cap and every one above it, never one below", () => {
  expect(within(CarClass.C, CarClass.C)).toBe(true);
  expect(within(CarClass.D, CarClass.S1)).toBe(true);
  expect(within(CarClass.B, CarClass.C)).toBe(false);
  expect(within(CarClass.X, CarClass.S2)).toBe(false);
});

const choices = (shelves: CarShelf[]) => shelves.flatMap((s) => s.choices);

test("one shelf per class that has cars, strongest first, each holding only its class", () => {
  const saved = { name: "Rally", code: PRESETS[2].code };
  const shelves = car_shelves(DEFAULT_BUILD, [saved], { cap: null, car_sized_only: false });
  const order = CLASS_FLOORS.map(([name]) => name).reverse();
  expect(shelves.map((s) => order.indexOf(s.class))).toEqual(shelves.map((s) => order.indexOf(s.class)).sort((a, b) => a - b));
  expect(shelves.map((s) => s.head)).toEqual(shelves.map((s) => `Class ${CLASS_LABELS[s.class]}`));
  for (const shelf of shelves) {
    expect(shelf.choices.length).toBeGreaterThan(0);
    expect(shelf.choices.every((c) => c.rating.class === shelf.class)).toBe(true);
  }
  const all = choices(shelves);
  expect(all.filter((c) => c.own).map((c) => c.code)).toEqual([build_code(DEFAULT_BUILD)]);
  expect(all.find((c) => c.own)?.fitted).toBe(true);
  expect(all.map((c) => c.title)).toContain("Rally");
  expect(all.every((c) => c.blocked === null)).toBe(true);
});

test("Fitted marks the car on now, which mid-event is not the player's own", () => {
  const rally = build_code(preset("Dirt rally"));
  const all = choices(car_shelves(DEFAULT_BUILD, [], { cap: null, car_sized_only: false }, rally));
  expect(all.filter((c) => c.fitted).map((c) => c.code)).toEqual([rally]);
  expect(all.find((c) => c.own)?.fitted).toBe(false);
});

test("a saved build or preset the player already drives shows once, as their own car", () => {
  const rally = preset("Dirt rally");
  const all = choices(car_shelves(rally, [{ name: "Rally", code: build_code(rally) }], { cap: null, car_sized_only: false }));
  const same = all.filter((c) => c.code === build_code(rally));
  expect(same.length).toBe(1);
  expect(same[0].own).toBe(true);
  expect(all.length).toBe(PRESETS.length);
});

test("a cap puts the classes it lets in first and greys every car over it, still listed", () => {
  const f1 = preset("Maxed F1");
  expect(within(rating(f1).class, CarClass.C)).toBe(false);
  const shelves = car_shelves(DEFAULT_BUILD, [], { cap: CarClass.C, car_sized_only: false });
  const first_shut = shelves.findIndex((s) => !s.open);
  expect(first_shut).toBeGreaterThan(0);
  expect(shelves.slice(first_shut).every((s) => !s.open)).toBe(true);
  expect(shelves.filter((s) => s.open).every((s) => within(s.class, CarClass.C))).toBe(true);
  expect(choices(shelves).find((c) => c.title === "Maxed F1")?.blocked).toBe("Over C");
  for (const choice of choices(shelves)) expect(choice.blocked === null).toBe(within(choice.rating.class, CarClass.C));
});

test("a mode laid out for cars greys the bus even under the cap, last in its class", () => {
  const shelves = car_shelves(DEFAULT_BUILD, [], { cap: null, car_sized_only: true });
  const shelf = shelves.find((s) => s.choices.some((c) => c.title === "Party bus"))!;
  expect(shelf.choices.find((c) => c.title === "Party bus")?.blocked).toBe("Too big for this mode");
  const blocked = shelf.choices.map((c) => c.blocked !== null);
  expect(blocked).toEqual([...blocked].sort((a, b) => Number(a) - Number(b)));
});

test("a new look is the same machine; a part or a body swap is not", () => {
  const cruiser = preset("Easy cruiser");
  expect(same_machine(cruiser, { ...cruiser, paint: 3, decal: 2, ink: 1, number: 42 })).toBe(true);
  expect(same_machine(cruiser, { ...cruiser, parts: { ...cruiser.parts, engine: cruiser.parts.engine + 1 } })).toBe(false);
  expect(same_machine(cruiser, { ...cruiser, car: "coupe" })).toBe(false);
});

test("under a cap the strongest allowed car is recommended, ties included; no cap recommends nothing", () => {
  const capped = choices(car_shelves(DEFAULT_BUILD, [], { cap: CarClass.C, car_sized_only: false }));
  const open = capped.filter((c) => c.blocked === null);
  const top = Math.max(...open.map((c) => c.rating.pi));
  expect(capped.filter((c) => c.recommended).map((c) => c.rating.pi)).toEqual(open.filter((c) => c.rating.pi === top).map(() => top));
  expect(capped.some((c) => c.recommended && c.blocked !== null)).toBe(false);
  const free = choices(car_shelves(DEFAULT_BUILD, [], { cap: null, car_sized_only: false }));
  expect(free.some((c) => c.recommended)).toBe(false);
});
