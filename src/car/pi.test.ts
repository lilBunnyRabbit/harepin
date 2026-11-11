/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DEFAULT_BUILD, DEFAULT_PARTS, SLOTS, SLOT_NAMES, build_spec, parse_build, stats, type Build, type Slot } from "./build";
import { CARS, car_sized, type CarId } from "./cars";
import { CLASS_FLOORS, CarClass, PI_MAX, PI_MIN, class_of, pi, rating } from "./pi";
import { PRESETS } from "./presets";
import { mulberry32 } from "../rng";

const CAR_IDS = Object.keys(CARS) as CarId[];
const stock = (car: CarId): Build => ({ ...DEFAULT_BUILD, car, parts: { ...DEFAULT_PARTS } });
const fit = (build: Build, slot: Slot, part: number): Build => ({ ...build, parts: { ...build.parts, [slot]: part } });

// Past the wing the kits trade drag and weight for downforce: on a slow hatch the sim laps the race kit no faster.
const AERO_LADDER = [0, 1, 2];
const LADDERS: [Slot, number[]][] = [
  ["engine", [0, 1, 2]],
  ["brakes", [0, 1, 2]],
  ["weight", [0, 1, 2]],
  ["tyres", [0, 1, 2]],
  ["nitro", [0, 1, 2]],
];

test("an upgrade up a part's ladder never lowers PI", () => {
  for (const car of CAR_IDS)
    for (const base of [stock(car), { ...stock(car), parts: { engine: 2, tyres: 2, aero: 4, suspension: 2, brakes: 2, weight: 2, bias: 1, nitro: 2 } }])
      for (const [slot, ladder] of LADDERS)
        for (let i = 1; i < ladder.length; i++) expect(pi(fit(base, slot, ladder[i]))).toBeGreaterThanOrEqual(pi(fit(base, slot, ladder[i - 1])));
});

test("one step up any ladder from a random mix of parts never lowers PI", () => {
  const random = mulberry32(11);
  const pick = (n: number) => Math.floor(random() * n);
  for (let i = 0; i < 300; i++) {
    const parts = { ...DEFAULT_PARTS };
    for (const slot of SLOT_NAMES) parts[slot] = pick(SLOTS[slot].parts.length);
    const base: Build = { ...DEFAULT_BUILD, car: CAR_IDS[pick(CAR_IDS.length)], parts };
    const ladders: [Slot, number[]][] = car_sized(CARS[base.car]) ? [...LADDERS, ["aero", AERO_LADDER]] : LADDERS;
    for (const [slot, ladder] of ladders) {
      const at = ladder.indexOf(parts[slot]);
      if (at < 0 || at === ladder.length - 1) continue;
      expect(pi(fit(base, slot, ladder[at + 1]))).toBeGreaterThanOrEqual(pi(base));
    }
  }
});

// The bus is the exception: it never goes fast enough for downforce to pay for the drag.
test("up the aero ladder never lowers PI on a car-sized car, and any kit beats none on every car", () => {
  for (const car of CAR_IDS) {
    const none = pi(stock(car));
    for (let i = 1; i < SLOTS.aero.parts.length; i++) expect(pi(fit(stock(car), "aero", i))).toBeGreaterThan(none);
    if (!car_sized(CARS[car])) continue;
    for (let i = 1; i < AERO_LADDER.length; i++)
      expect(pi(fit(stock(car), "aero", AERO_LADDER[i]))).toBeGreaterThanOrEqual(pi(fit(stock(car), "aero", AERO_LADDER[i - 1])));
  }
});

test("a part no worse on any input than another never rates lower", () => {
  const inputs = (build: Build) => {
    const spec = build_spec(build);
    const s = stats(spec);
    return [s.power, s.grip, s.braking, s.top_speed, spec.downforce / spec.mass, spec.nitro ?? 0];
  };
  for (const car of CAR_IDS)
    for (const slot of SLOT_NAMES) {
      const builds = SLOTS[slot].parts.map((_, i) => fit(stock(car), slot, i));
      for (const a of builds)
        for (const b of builds) {
          const [ia, ib] = [inputs(a), inputs(b)];
          if (ia.every((x, k) => x >= ib[k])) expect(pi(a)).toBeGreaterThanOrEqual(pi(b));
        }
    }
});

test("the same build always rates the same", () => {
  for (const preset of PRESETS) {
    const build = parse_build(preset.code);
    expect(build).not.toBeNull();
    if (build) expect(pi(build)).toBe(pi(structuredClone(build)));
  }
});

test("every build rates inside PI_MIN..PI_MAX as a whole number", () => {
  for (const car of CAR_IDS) {
    const value = pi(stock(car));
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(PI_MIN);
    expect(value).toBeLessThanOrEqual(PI_MAX);
  }
});

test("class bands start at PI_MIN, climb, and each floor opens its class", () => {
  expect(CLASS_FLOORS[0][1]).toBe(PI_MIN);
  for (let i = 1; i < CLASS_FLOORS.length; i++) {
    const [name, floor] = CLASS_FLOORS[i];
    expect(floor).toBeGreaterThan(CLASS_FLOORS[i - 1][1]);
    expect(class_of(floor)).toBe(name);
    expect(class_of(floor - 1)).toBe(CLASS_FLOORS[i - 1][0]);
  }
  expect(class_of(PI_MAX)).toBe(CarClass.X);
});

test("the cars spread over the classes: bus slowest, formula fastest, road cars between", () => {
  const of = (car: CarId) => rating(stock(car));
  expect(of("bus").class).toBe(CarClass.D);
  expect(of("hatch").class).toBe(CarClass.C);
  for (const car of ["coupe", "muscle", "rally", "kaze", "sturm", "raijin"] as const) expect(of(car).class).toBe(CarClass.B);
  expect(of("formula").class).toBe(CarClass.S1);
  const maxed = parse_build(PRESETS.find((p) => p.name === "Maxed F1")?.code);
  expect(maxed && rating(maxed).class).toBe(CarClass.X);
});
