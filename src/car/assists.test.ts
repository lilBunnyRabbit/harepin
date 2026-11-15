/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Car, SteerMode, type Ground } from "./car";
import { CARS } from "./cars";
import { ALL_AIDS, Counter, kick, lift_off, power_over, slalom, swerve, type Aids, type PowerOver } from "../../scripts/keys";

const SMOOTH = SteerMode.SMOOTH;
const COMBOS: Aids[] = [
  { assist: true, stability: true },
  { assist: true, stability: false },
  { assist: false, stability: true },
  { assist: false, stability: false },
];
const name = ({ assist, stability }: Aids) => `steering ${assist ? "on" : "off"}, stability ${stability ? "on" : "off"}`;
const RWD_AWD = ["coupe", "muscle", "kaze", "formula", "sturm", "rally", "raijin"] as const;
/** Cars whose grip lock shows in a slalom: the formula's downforce and the sturm's grip leave little to limit. */
const LOCKED = ["coupe", "muscle", "kaze", "rally", "raijin", "hatch"] as const;

describe("steering assist and stability", () => {
  test("a car starts with both on", () => {
    const car = new Car();
    expect({ assist: car.assist, stability: car.stability }).toEqual(ALL_AIDS);
  });

  for (const aids of COMBOS) {
    test(`${name(aids)}: the grip-limited lock holds either way, stability alone owns the spin`, () => {
      for (const id of LOCKED) {
        const spec = CARS[id];
        expect(Math.abs(swerve(SMOOTH, spec, 100, 0.4, aids).heading)).toBeLessThan(2);
        expect(slalom(SMOOTH, spec, 100, 0.5, aids).slip).toBeLessThan(5);
      }
      for (const spec of Object.values(CARS)) {
        const slip = kick(SMOOTH, spec, 100, 1.5, aids);
        if (aids.stability) expect(slip).toBeLessThan(30);
        else expect(slip).toBeGreaterThan(45);
      }
    });
  }

  test("with steering assist on, stability leaves a swerve and a slalom alone", () => {
    for (const spec of Object.values(CARS)) {
      const off = { assist: true, stability: false };
      expect(swerve(SMOOTH, spec, 100, 0.4, off)).toEqual(swerve(SMOOTH, spec));
      expect(slalom(SMOOTH, spec, 100, 0.5, off)).toEqual(slalom(SMOOTH, spec));
    }
  });

  const flat: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };
  /** Wheel angle (rad) 0.1 s into a 20 degree slide at `kmh` with the keys let go. */
  const hands_off = (aids: Aids, kmh: number) => {
    const car = new Car(CARS.coupe);
    Object.assign(car, aids);
    car.park(0, 0, 0, flat);
    car.parked = false;
    const v = kmh / 3.6;
    const beta = (20 * Math.PI) / 180;
    car.vel.set(v * Math.sin(beta), 0, v * Math.cos(beta));
    for (const w of car.wheels) w.omega = (v * Math.cos(beta)) / car.spec.wheel.radius;
    for (let t = 0; t < 0.1; t += 1 / 360) car.step(1 / 360, { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: false }, flat);
    return car.steer;
  };

  for (const aids of COMBOS)
    test(`${name(aids)}: hands off in a slide, ${aids.assist ? "the wheels countersteer into it" : "the wheels stay straight"}`, () => {
      // 60 km/h is past the course clamp's speeds, so only the countersteer turns the wheels; at 30 km/h the clamp does too.
      for (const kmh of [60, 30]) {
        const steer = hands_off(aids, kmh);
        if (aids.assist) expect(steer).toBeLessThan(-0.05);
        else expect(steer).toBe(0);
      }
    });

  const caught = (over: PowerOver) => {
    expect(over.t30).toBeLessThan(2.5);
    expect(over.peak).toBeGreaterThan(25);
    expect(over.body).toBeLessThan(85);
    expect(over.catch).toBeLessThan(1.2);
    expect(over.flip).toBeLessThan(15);
    expect(over.spun).toBe(false);
  };

  // Steering assist off, a rear-drive launch is the driver's drift: the opposite key brings it in without spinning, and
  // letting go ends it. All-wheel drive holds no drift of its own.
  const drifted = (over: PowerOver, counter: Counter) => {
    expect(over.t30).toBeLessThan(2.5);
    expect(over.peak).toBeGreaterThan(25);
    expect(over.body).toBeLessThan(85);
    expect(over.spun).toBe(false);
    if (counter === Counter.RELEASE) expect(over.catch).toBeLessThan(2);
    // The opposite key held is the driver steering into the mirror slide: with stability off the formula's tail swings 41 degrees
    // (38 before the exact suspension ray).
    expect(over.flip).toBeLessThan(counter === Counter.HOLD ? 42 : 5);
  };

  for (const aids of COMBOS.slice(1))
    test(`${name(aids)}: full lock and full gas from parked still launches a power slide that a countersteer ${aids.assist ? "catches" : "brings in"}`, () => {
      for (const id of RWD_AWD)
        for (const counter of [Counter.RELEASE, Counter.TAP, Counter.HOLD]) {
          const over = power_over(SMOOTH, CARS[id], { ...aids, counter });
          if (aids.assist || CARS[id].drive !== "rwd") caught(over);
          else drifted(over, counter);
        }
    });
});

// Captured at 412bd08, before the split: the default pair must drive exactly as the one steer assist did. The power over
// of the rear-drive cars is re-captured with the launch's looser traction control and its own countersteer, by design;
// swerve, slalom and lift-off with the full-key reach past grip lock that opens from 90 km/h; the rear-drive power over again
// with traction control acting from rest; all of it once more on the shared sim maths and the exact suspension ray.
const BEFORE_SPLIT = {
  coupe: { swerve: -0.9192917511313919, slalom: 3.3711228754736013, lift: 3.977104999842984, t30: 1.4583333333333288, peak: 65.56822375838192, catch: 0.4777777777777766, held: 0.3722222222222214 },
  muscle: { swerve: -0.8163578226112009, slalom: 4.113813394044343, lift: 3.519485083332628, t30: 1.3999999999999957, peak: 69.79437597707974, catch: 0.5833333333333318, held: 0.4694444444444433 },
  rally: { swerve: 0.07736498397216841, slalom: 4.500709533216948, lift: 13.028844965378003, t30: 1.3499999999999959, peak: 68.53237710413995, catch: 0.29166666666666613, held: 0.29722222222222167 },
} as const;

describe("both on is the old steer assist", () => {
  for (const [id, was] of Object.entries(BEFORE_SPLIT))
    test(`${id}: swerve, slalom, lift-off and power over are bit-exact`, () => {
      const spec = CARS[id as keyof typeof BEFORE_SPLIT];
      const over = power_over(SMOOTH, spec);
      expect({
        swerve: swerve(SMOOTH, spec).heading,
        slalom: slalom(SMOOTH, spec).slip,
        lift: lift_off(SMOOTH, spec),
        t30: over.t30,
        peak: over.peak,
        catch: over.catch,
        held: power_over(SMOOTH, spec, { counter: Counter.HOLD }).catch,
      }).toEqual(was);
    });
});
