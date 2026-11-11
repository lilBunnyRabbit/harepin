/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Car, SteerMode } from "./car";
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
    test(`${name(aids)}: steering assist alone owns the lock and countersteer, stability alone owns the spin`, () => {
      for (const id of LOCKED) {
        const spec = CARS[id];
        const sl = slalom(SMOOTH, spec, 100, 0.5, aids).slip;
        const guided = slalom(SMOOTH, spec, 100, 0.5, { ...aids, assist: true }).slip;
        if (aids.assist) {
          expect(Math.abs(swerve(SMOOTH, spec, 100, 0.4, aids).heading)).toBeLessThan(2);
          expect(sl).toBeLessThan(5);
        } else expect(sl).toBeGreaterThan(guided * 2);
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

  const caught = (over: PowerOver) => {
    expect(over.t30).toBeLessThan(2.5);
    expect(over.peak).toBeGreaterThan(25);
    expect(over.body).toBeLessThan(85);
    expect(over.catch).toBeLessThan(1.2);
    expect(over.flip).toBeLessThan(15);
    expect(over.spun).toBe(false);
  };

  for (const aids of COMBOS.slice(1))
    test(`${name(aids)}: full lock and full gas from parked still launches a power slide that a countersteer catches`, () => {
      for (const id of RWD_AWD) for (const counter of [Counter.RELEASE, Counter.TAP, Counter.HOLD]) caught(power_over(SMOOTH, CARS[id], { ...aids, counter }));
    });
});

// Captured at 412bd08, before the split: the default pair must drive exactly as the one steer assist did.
const BEFORE_SPLIT = {
  coupe: { swerve: -0.6700782823942704, slalom: 3.203028883365339, lift: 3.976719773473729, t30: 1.6666666666666614, peak: 70.55051651646333, catch: 0.3972222222222213, held: 0.3916666666666658 },
  muscle: { swerve: -0.554125484121893, slalom: 3.908775701011693, lift: 3.5190292135852954, t30: 1.6972222222222169, peak: 81.27962711368201, catch: 0.5027777777777765, held: 0.44722222222222113 },
  rally: { swerve: 0.28588541310505927, slalom: 4.270474022385427, lift: 13.019912053627973, t30: 1.3499999999999959, peak: 68.52582111088348, catch: 0.2944444444444439, held: 0.29722222222222167 },
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
