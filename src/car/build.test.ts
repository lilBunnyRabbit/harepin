/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DEFAULT_BUILD, DEFAULT_PARTS, SLOTS, SLOT_NAMES, STATS, apply_build, build_code, build_spec, parse_build, stat_range, stats, type Build } from "./build";
import { CARS, COUPE, RALLY, car_sized, type CarId, type CarSpec } from "./cars";

const with_parts = (parts: Partial<Build["parts"]>, rest: Partial<Omit<Build, "parts">> = {}): Build => ({ ...DEFAULT_BUILD, ...rest, parts: { ...DEFAULT_PARTS, ...parts } });

test("codes round-trip", () => {
  const build = with_parts({ aero: 2, suspension: 0, engine: 1 }, { car: "rally", paint: 12, decal: 3 });
  expect(build_code(build)).toBe("rally.12.3.2.0.1");
  expect(parse_build(build_code(build))).toEqual(build);
  expect(parse_build(build_code(DEFAULT_BUILD))).toEqual(DEFAULT_BUILD);
  const decal = { ...build, decal: 8, ink: 5, number: 42 };
  expect(build_code(decal)).toBe("rally.12.8.2.0.1.5.42");
  expect(parse_build(build_code(decal))).toEqual(decal);
  expect(parse_build(build_code({ ...build, number: 0 }))).toEqual({ ...build, number: 0 });
  const drift = with_parts({ aero: 2, suspension: 3, engine: 1 }, { car: "kaze", paint: 12, decal: 3 });
  expect(build_code(drift)).toBe("kaze.12.3.2.3.1");
  expect(parse_build(build_code(drift))).toEqual(drift);
  expect(parse_build(build_code({ ...drift, ink: 2, number: 9 }))).toEqual({ ...drift, ink: 2, number: 9 });
});

test("new slots ride a tail that is left off at their defaults", () => {
  const tyres = with_parts({ tyres: 3 });
  expect(build_code(tyres)).toBe("coupe.0.0.0.1.0.0.7.3");
  expect(parse_build(build_code(tyres))).toEqual(tyres);
  const weight = with_parts({ weight: 2, engine: 2 }, { ink: 3, number: 11 });
  expect(build_code(weight)).toBe("coupe.0.0.0.1.2.3.11.0.0.2");
  expect(parse_build(build_code(weight))).toEqual(weight);
  const all = with_parts({ tyres: 1, brakes: 2, weight: 1, bias: 2, nitro: 2, aero: 2, suspension: 3, engine: 2 }, { car: "muscle", paint: 15, decal: 8, ink: 8, number: 99 });
  expect(build_code(all).length).toBeLessThanOrEqual(40);
  expect(parse_build(build_code(all))).toEqual(all);
  expect(build_code(with_parts({}, { ink: 1 }))).toBe("coupe.0.0.0.1.0.1.7");
  const nitro = with_parts({ nitro: 2 }, { car: "kaze" });
  expect(build_code(nitro)).toBe("kaze.0.0.0.1.0.0.7.0.0.0.1.2");
  expect(parse_build(build_code(nitro))).toEqual(nitro);
  expect(build_code(with_parts({ bias: 2 }))).toBe("coupe.0.0.0.1.0.0.7.0.0.0.2");
});

test("codes from before decal ink, number and the new slots still parse", () => {
  expect(build_code(DEFAULT_BUILD)).toBe("coupe.0.0.0.1.0");
  expect(parse_build("kaze.3.1.0.2.0")).toEqual(with_parts({ suspension: 2 }, { car: "kaze", paint: 3, decal: 1 }));
  expect(parse_build("coupe.3.1.2.1.0")).toEqual(with_parts({ aero: 2 }, { paint: 3, decal: 1 }));
  expect(parse_build("coupe.3.1.2.1.0.4.12")).toEqual(with_parts({ aero: 2 }, { paint: 3, decal: 1, ink: 4, number: 12 }));
  for (const suspension of [0, 1, 2] as const) expect(parse_build(`hatch.0.0.0.${suspension}.0`)?.parts.suspension).toBe(suspension);
  for (const aero of [0, 1, 2]) {
    const build = with_parts({ aero }, { car: "sturm", paint: 4 });
    expect(build_code(build)).toBe(`sturm.4.0.${aero}.1.0`);
    expect(parse_build(`sturm.4.0.${aero}.1.0`)).toEqual(build);
  }
});

test("the aero kits take digits 3 and 4 in the aero spot", () => {
  for (const aero of [3, 4]) {
    const build = with_parts({ aero, tyres: 2 }, { car: "raijin" });
    expect(build_code(build)).toBe(`raijin.0.0.${aero}.1.0.0.7.2`);
    expect(parse_build(build_code(build))).toEqual(build);
  }
});

test("off-grammar codes are rejected", () => {
  for (const code of [
    "",
    "van.0.0.0.1.0",
    "coupe.0.0.0.1",
    "coupe.0.0.0.1.0.0",
    "coupe.16.0.0.1.0",
    "coupe.0.9.0.1.0",
    "coupe.0.1.0.1.0.9.7",
    "coupe.0.1.0.1.0.0.100",
    "coupe.0.1.0.1.0.0",
    "coupe.0.1.0.1.0.0.7.4",
    "coupe.0.1.0.1.0.0.7.0.0.3",
    "coupe.0.1.0.1.0.0.7.0.0.0.0.0.0",
    "coupe.0.1.0.1.0.0.7.0.0.0.1.3",
    "coupe.0.1.0.1.0.0.7.0.0.0.3",
    "coupe.0.1.0.1.0.0.7.",
    "coupe.0.1.0.1.0..7",
    "coupe.0.0.5.1.0",
    "coupe.0.0.0.4.0",
    "coupe.0.0.0.1.3",
    "coupe.-1.0.0.1.0",
    "coupe.1e1.0.0.1.0",
    " coupe.0.0.0.1.0",
    "coupe.0.0.0.1.0\n",
    "constructor.0.0.0.1.0",
    "x".repeat(40),
    42,
    null,
    { car: "coupe" },
  ])
    expect(parse_build(code)).toBeNull();
});

// The hand-wired apply_build from before the parts table, kept as the reference the table must reproduce.
const SPOILER_DOWNFORCE = [1, 1.8, 2.6];
const SPOILER_DRAG = [0, 0.04, 0.09];
const SPOILER_REAR_GRIP = [0, 0.02, 0.04];
const SUSPENSION_SPRING = [0.8, 1, 1.3, 1.25];
const SUSPENSION_ARB_FRONT = [0.7, 1, 1.4, 0.6];
const SUSPENSION_ARB_REAR = [0.7, 1, 1.4, 3];
const SUSPENSION_REST = [0.04, 0, -0.03, -0.02];
const SUSPENSION_REAR_GRIP = [0, 0, 0, -0.02];
const SUSPENSION_LOCK = [1, 1, 1, 1.15];
const SUSPENSION_ASSIST_YAW = [1, 1, 1, 0.6];
const ENGINE_TORQUE = [1, 1.15, 1.3];
const ENGINE_REVS = [0, 300, 600];
const ENGINE_MASS = [0, 15, 30];

function legacy_apply(base: CarSpec, spoiler: number, suspension: number, engine: number): CarSpec {
  const spring = SUSPENSION_SPRING[suspension];
  const revs = ENGINE_REVS[engine];
  const torque = ENGINE_TORQUE[engine];
  return {
    ...base,
    mass: base.mass + ENGINE_MASS[engine],
    lock: base.lock * SUSPENSION_LOCK[suspension],
    assist_yaw: base.assist_yaw * SUSPENSION_ASSIST_YAW[suspension],
    wheel: { ...base.wheel, rest: base.wheel.rest + SUSPENSION_REST[suspension] },
    spring: base.spring * spring,
    damper: base.damper * spring,
    arb_front: base.arb_front * SUSPENSION_ARB_FRONT[suspension],
    arb_rear: base.arb_rear * SUSPENSION_ARB_REAR[suspension],
    rear_grip: base.rear_grip + SPOILER_REAR_GRIP[spoiler] + SUSPENSION_REAR_GRIP[suspension],
    redline: base.redline + revs,
    upshift: base.upshift + revs,
    torque: base.torque.map(([rpm, nm]) => [rpm, nm * torque]),
    drag: base.drag + SPOILER_DRAG[spoiler],
    downforce: base.downforce * SPOILER_DOWNFORCE[spoiler],
  };
}

test("every build from before the parts table drives exactly as it did", () => {
  let checked = 0;
  for (const car of Object.keys(CARS) as CarId[])
    for (let spoiler = 0; spoiler < 3; spoiler++)
      for (let suspension = 0; suspension < 4; suspension++)
        for (let engine = 0; engine < 3; engine++) {
          const spec = apply_build(CARS[car], with_parts({ aero: spoiler, suspension, engine }, { car }));
          expect(spec).toEqual(legacy_apply(CARS[car], spoiler, suspension, engine));
          checked++;
        }
  expect(checked).toBe(Object.keys(CARS).length * 3 * 4 * 3);
});

test("the default build leaves the base spec unchanged", () => {
  expect(apply_build(COUPE, DEFAULT_BUILD)).toEqual(COUPE);
  expect(build_spec(DEFAULT_BUILD)).toEqual(COUPE);
});

test("the slot table and the default parts agree", () => {
  for (const slot of SLOT_NAMES) {
    expect(DEFAULT_PARTS[slot]).toBeLessThan(SLOTS[slot].parts.length);
    expect(SLOTS[slot].parts.length).toBeLessThanOrEqual(10);
  }
});

test("drift stiffens the rear bar past the front and sits low", () => {
  const spec = apply_build(COUPE, with_parts({ suspension: 3 }));
  expect(spec.arb_rear).toBeGreaterThan(spec.arb_front * 2);
  expect(spec.arb_front).toBeLessThan(COUPE.arb_front);
  expect(spec.spring).toBeGreaterThan(COUPE.spring);
  expect(spec.wheel.rest).toBeLessThan(COUPE.wheel.rest);
  expect(spec.rear_grip).toBeLessThan(COUPE.rear_grip);
  expect(spec.lock).toBeGreaterThan(COUPE.lock);
  expect(spec.assist_yaw).toBeLessThan(COUPE.assist_yaw);
});

const surface_grip = (spec: CarSpec, surface: number) => spec.mu * (surface + (1 - surface) * spec.offroad);

test("tyres order tarmac grip street < sport < semi-slick, rally wins off it and slicks lose there", () => {
  for (const base of [COUPE, RALLY]) {
    const car = base.id as CarId;
    const [street, sport, slick, rally] = [0, 1, 2, 3].map((tyres) => apply_build(base, with_parts({ tyres }, { car })));
    expect(surface_grip(sport, 1)).toBeGreaterThan(surface_grip(street, 1));
    expect(surface_grip(slick, 1)).toBeGreaterThan(surface_grip(sport, 1));
    expect(surface_grip(rally, 1)).toBeLessThan(surface_grip(street, 1));
    expect(surface_grip(rally, 1)).toBeGreaterThan(surface_grip(street, 1) * 0.94);
    for (const other of [street, sport, slick]) expect(surface_grip(rally, 0.5)).toBeGreaterThan(surface_grip(other, 0.5) * 1.05);
    expect(surface_grip(slick, 0.72)).toBeLessThan(surface_grip(street, 0.72) * (base.offroad > 0 ? 1 : 0.92));
    expect(rally.offroad).toBeLessThanOrEqual(1);
    expect(stats(slick).grip).toBeGreaterThan(stats(street).grip * 1.1);
  }
});

test("brakes and weight move the spec the documented way", () => {
  const race = apply_build(COUPE, with_parts({ brakes: 2 }));
  expect(race.brake_front).toBeCloseTo(COUPE.brake_front * 1.3);
  expect(race.brake_grip).toBeCloseTo(COUPE.brake_grip + 0.3);
  const rear = apply_build(COUPE, with_parts({ bias: 2 }));
  expect(rear.brake_rear / rear.brake_front).toBeGreaterThan(COUPE.brake_rear / COUPE.brake_front);
  const stripped = apply_build(COUPE, with_parts({ weight: 2, engine: 2 }));
  expect(stripped.mass).toBeCloseTo(COUPE.mass * 0.9 + 30);
  expect(stripped.inertia[1]).toBeCloseTo(COUPE.inertia[1] * 0.9);
  expect(stripped.wheel.mounts[0][1]).toBeCloseTo(COUPE.wheel.mounts[0][1] + 0.025);
  expect(stripped.corners[0][1]).toBeCloseTo(COUPE.corners[0][1] + 0.025);
});

test("aero parts trade top speed for downforce in table order, and the kits move it forward", () => {
  for (const car of Object.keys(CARS) as CarId[]) {
    const specs = SLOTS.aero.parts.map((_, aero) => build_spec(with_parts({ aero }, { car })));
    for (let i = 1; i < specs.length; i++) {
      expect(specs[i].downforce).toBeGreaterThan(specs[i - 1].downforce);
      expect(specs[i].drag).toBeGreaterThan(specs[i - 1].drag);
      expect(stats(specs[i]).top_speed).toBeLessThanOrEqual(stats(specs[i - 1]).top_speed);
    }
    const [none, lip, wing, street, race] = specs;
    for (const spec of [none, lip, wing]) expect(spec.aero_front).toBe(CARS[car].aero_front);
    expect(street.aero_front).toBeGreaterThan(race.aero_front);
    expect(race.aero_front).toBeGreaterThan(wing.aero_front);
    expect(street.rear_grip).toBeLessThan(wing.rear_grip);
    expect(race.rear_grip).toBeGreaterThan(wing.rear_grip);
    expect(race.mass).toBeGreaterThan(street.mass);
    expect(street.mass).toBeGreaterThan(wing.mass);
  }
});

test("a bigger nitro tank holds more boost and weighs more", () => {
  const [none, small, big] = [0, 1, 2].map((nitro) => build_spec(with_parts({ nitro })));
  expect(none.nitro).toBeUndefined();
  expect(small.nitro).toBeGreaterThan(0);
  expect(big.nitro).toBeGreaterThan(small.nitro ?? 0);
  expect(small.mass).toBeGreaterThan(none.mass);
  expect(big.mass).toBeGreaterThan(small.mass);
});

test("stats rise with the parts that should raise them and stay inside the range", () => {
  const stock = stats(COUPE);
  const { low, high } = stat_range();
  expect(stats(build_spec(with_parts({ engine: 2 }))).power).toBeGreaterThan(stock.power);
  expect(stats(build_spec(with_parts({ weight: 2 }))).power).toBeGreaterThan(stock.power);
  expect(stats(build_spec(with_parts({ tyres: 1 }))).grip).toBeGreaterThan(stock.grip);
  expect(stats(build_spec(with_parts({ brakes: 2 }))).braking).toBeGreaterThan(stock.braking);
  for (const bias of [0, 2]) expect(stats(build_spec(with_parts({ bias }))).braking).toBeLessThan(stock.braking);
  expect(stats(build_spec(with_parts({ aero: 2 }))).top_speed).toBeLessThan(stock.top_speed);
  for (const car of Object.keys(CARS) as CarId[]) {
    const s = stats(CARS[car]);
    expect(s.top_speed * 3.6).toBeGreaterThan(car_sized(CARS[car]) ? 150 : 80);
    expect(s.top_speed * 3.6).toBeLessThan(330);
    for (const key of STATS) {
      expect(s[key]).toBeLessThanOrEqual(high[key]);
      expect(s[key]).toBeGreaterThanOrEqual(low[key]);
    }
  }
});
