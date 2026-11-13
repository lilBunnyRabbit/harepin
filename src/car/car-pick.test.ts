/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DEFAULT_BUILD, build_code, parse_build } from "./build";
import { car_shelves, same_machine, within } from "./car-pick";
import { CarClass, rating } from "./pi";
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

test("your car comes first, then saved builds, then every preset, each with its rating", () => {
  const saved = { name: "Rally", code: PRESETS[2].code };
  const shelves = car_shelves(DEFAULT_BUILD, [saved], { cap: null, car_sized_only: false });
  expect(shelves.map((s) => s.head)).toEqual(["Your car", "My builds", "Presets"]);
  expect(shelves[0].choices[0].fitted).toBe(true);
  expect(shelves[0].choices[0].code).toBe(build_code(DEFAULT_BUILD));
  expect(shelves[1].choices[0].title).toBe("Rally");
  expect(shelves[2].choices.map((c) => c.title)).toEqual(PRESETS.map((p) => p.name));
  expect(shelves.flatMap((s) => s.choices).every((c) => c.blocked === null)).toBe(true);
});

test("a cap greys every car over it and keeps it listed; no saved builds drops that shelf", () => {
  const f1 = preset("Maxed F1");
  expect(within(rating(f1).class, CarClass.C)).toBe(false);
  const shelves = car_shelves(DEFAULT_BUILD, [], { cap: CarClass.C, car_sized_only: false });
  expect(shelves.map((s) => s.head)).toEqual(["Your car", "Presets"]);
  const listed = shelves[1].choices.find((c) => c.title === "Maxed F1");
  expect(listed?.blocked).toBe("Over C");
  for (const choice of shelves.flatMap((s) => s.choices)) expect(choice.blocked === null).toBe(within(choice.rating.class, CarClass.C));
});

test("a mode laid out for cars greys the bus even under the cap", () => {
  const shelves = car_shelves(DEFAULT_BUILD, [], { cap: null, car_sized_only: true });
  expect(shelves[1].choices.find((c) => c.title === "Party bus")?.blocked).toBe("Too big for this mode");
});

test("a new look is the same machine; a part or a body swap is not", () => {
  const cruiser = preset("Easy cruiser");
  expect(same_machine(cruiser, { ...cruiser, paint: 3, decal: 2, ink: 1, number: 42 })).toBe(true);
  expect(same_machine(cruiser, { ...cruiser, parts: { ...cruiser.parts, engine: cruiser.parts.engine + 1 } })).toBe(false);
  expect(same_machine(cruiser, { ...cruiser, car: "coupe" })).toBe(false);
});

test("under a cap the strongest allowed car is recommended, ties included; no cap recommends nothing", () => {
  const capped = car_shelves(DEFAULT_BUILD, [], { cap: CarClass.C, car_sized_only: false }).flatMap((s) => s.choices);
  const open = capped.filter((c) => c.blocked === null);
  const top = Math.max(...open.map((c) => c.rating.pi));
  expect(capped.filter((c) => c.recommended).map((c) => c.rating.pi)).toEqual(open.filter((c) => c.rating.pi === top).map(() => top));
  expect(capped.some((c) => c.recommended && c.blocked !== null)).toBe(false);
  const free = car_shelves(DEFAULT_BUILD, [], { cap: null, car_sized_only: false }).flatMap((s) => s.choices);
  expect(free.some((c) => c.recommended)).toBe(false);
});
