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

  // Steering assist off, a rear-drive launch is the driver's drift: let go on full gas it holds its angle rather than
  // snapping straight, and the opposite key brings it in without spinning. All-wheel drive holds no drift of its own.
  const drifted = (over: PowerOver, counter: Counter) => {
    expect(over.t30).toBeLessThan(2.5);
    expect(over.peak).toBeGreaterThan(25);
    expect(over.body).toBeLessThan(85);
    expect(over.spun).toBe(false);
    if (counter === Counter.RELEASE) expect(over.catch).toBeGreaterThan(2);
    expect(over.flip).toBeLessThan(counter === Counter.HOLD ? 35 : 5);
  };

  for (const aids of COMBOS.slice(1))
    test(`${name(aids)}: full lock and full gas from parked still launches a power slide that a countersteer ${aids.assist ? "catches" : "holds or brings in"}`, () => {
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
// swerve, slalom and lift-off with the full-key reach past grip lock that opens from 90 km/h.
const BEFORE_SPLIT = {
  coupe: { swerve: -0.9195335124733298, slalom: 3.3716032303715324, lift: 3.9767758122283436, t30: 1.4944444444444398, peak: 65.41261525337042, catch: 0.48888888888888765, held: 0.37777777777777694 },
  muscle: { swerve: -0.8156821237686279, slalom: 4.113755540073077, lift: 3.5190155841831006, t30: 1.4888888888888843, peak: 69.63440274969838, catch: 0.605555555555554, held: 0.4944444444444432 },
  rally: { swerve: 0.07668757325832962, slalom: 4.499654456125449, lift: 13.019912053627973, t30: 1.3499999999999959, peak: 68.52582111088348, catch: 0.2944444444444439, held: 0.29722222222222167 },
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
