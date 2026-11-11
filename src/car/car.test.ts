/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";
import { DEFAULT_BUILD, DEFAULT_PARTS, apply_build } from "./build";
import { Car, SteerMode, drop_height, grip_lock, ride_height, unassisted_lock, type Controls, type Ground } from "./car";
import { CARS, car_sized, is_car, type CarId, type CarSpec } from "./cars";
import { donut } from "../../scripts/donut";
import { hairpin_pull } from "../../scripts/hairpin";
import { Counter, arc, flick, hairpin, lane_change, lift_off, power_over, slalom, swerve, tap, type PowerOver } from "../../scripts/keys";
import { GROUNDS } from "../../scripts/grounds";

const flat: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };
const DT = 1 / 360;
const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: false };

function fresh(mode: SteerMode): Car {
  const car = new Car();
  car.steer_mode = mode;
  car.place(0, 0.6, 0, 0);
  run(car, 1.5, () => idle);
  return car;
}

function run(car: Car, seconds: number, controls: () => Controls) {
  for (let t = 0; t < seconds; t += DT) car.step(DT, controls(), flat);
}

const kmh = (car: Car) => car.forward_speed * 3.6;
const cruise = (car: Car, target: number, steer = 0): Controls => ({ ...idle, steer, throttle: Math.max(0, Math.min(1, (target - kmh(car)) * 0.15 + 0.3)) });

describe("keyboard steer mode", () => {
  test("snap: released at a standstill, the wheel springs back to centre", () => {
    const car = fresh(SteerMode.SNAP);
    run(car, 1, () => ({ ...idle, steer: 1 }));
    expect(car.steer).toBeCloseTo(car.spec.lock, 3);
    run(car, 0.5, () => idle);
    expect(Math.abs(car.steer)).toBeLessThan(1e-3);
  });

  test("hold: released at a standstill, the wheel stays put", () => {
    const car = fresh(SteerMode.HOLD);
    run(car, 1, () => ({ ...idle, steer: -1 }));
    expect(car.steer).toBeCloseTo(-car.spec.lock, 3);
    run(car, 3, () => idle);
    expect(car.steer).toBeCloseTo(-car.spec.lock, 3);
  });

  test("hold: a key moves the wheel at a rate, a short tap only part way", () => {
    const car = fresh(SteerMode.HOLD);
    run(car, 0.1, () => ({ ...idle, steer: 1 }));
    run(car, 1, () => idle);
    expect(car.key_steer).toBeGreaterThan(0.2);
    expect(car.key_steer).toBeLessThan(0.3);
  });

  test("hold: rolling at parking speed barely centres it", () => {
    const car = fresh(SteerMode.HOLD);
    run(car, 1, () => ({ ...idle, steer: 1 }));
    run(car, 1, () => ({ ...idle, throttle: Math.max(0, Math.min(1, 0.08 + (2 - kmh(car)) * 0.3)) }));
    expect(car.key_steer).toBeGreaterThan(0.95);
  });

  test("hold: released at 100 km/h, the wheel centres within 0.6 s", () => {
    const car = fresh(SteerMode.HOLD);
    run(car, 30, () => cruise(car, 100));
    run(car, 0.5, () => cruise(car, 100, 1));
    const held = car.steer;
    expect(held).toBeGreaterThan(0.05);
    run(car, 0.6, () => cruise(car, 100));
    expect(car.key_steer).toBe(0);
    expect(Math.abs(car.steer)).toBeLessThan(held * 0.1);
  });

  test("analog input steers the same in every mode", () => {
    const pad = (car: Car): Controls => ({ ...cruise(car, 60, Math.sin(car.pos.z * 0.05)), analog: true });
    const [snap, ...rest] = [SteerMode.SNAP, SteerMode.HOLD, SteerMode.SMOOTH].map(fresh);
    run(snap, 8, () => pad(snap));
    for (const car of rest) {
      run(car, 8, () => pad(car));
      expect(car.steer).toBe(snap.steer);
      expect(car.pos.toArray()).toEqual(snap.pos.toArray());
    }
  });

  test("smooth: a one-frame tap at 100 km/h is a small nudge, where classic barely registers", () => {
    const smooth = tap(SteerMode.SMOOTH, 1 / 60);
    expect(smooth.heading).toBeGreaterThan(0.05);
    expect(smooth.heading).toBeLessThan(0.2);
    expect(tap(SteerMode.SNAP, 1 / 60).heading).toBeLessThan(0.05);
  });

  test("smooth: at 100 km/h a held key starts at the tap share, builds linearly to full, and lets go fast from full and gently near centre", () => {
    const car = fresh(SteerMode.SMOOTH);
    run(car, 30, () => cruise(car, 100));
    run(car, 1 / 360, () => cruise(car, 100, 1));
    expect(car.key_steer).toBeGreaterThan(0.05);
    expect(car.key_steer).toBeLessThan(0.06);
    run(car, 0.1, () => cruise(car, 100, 1));
    const early = car.key_steer;
    run(car, 0.1, () => cruise(car, 100, 1));
    expect(car.key_steer - early).toBeCloseTo(early - 0.05, 1);
    run(car, 0.3, () => cruise(car, 100, 1));
    expect(car.key_steer).toBe(1);
    run(car, 0.05, () => cruise(car, 100));
    const fast = 1 - car.key_steer;
    expect(fast).toBeGreaterThan(0.3);
    while (car.key_steer > 0.2) run(car, 1 / 360, () => cruise(car, 100));
    const near = car.key_steer;
    run(car, 0.05, () => cruise(car, 100));
    expect(near - car.key_steer).toBeLessThan(fast * 0.5);
    run(car, 0.4, () => cruise(car, 100));
    expect(car.key_steer).toBe(0);
  });

  test("smooth: the opposite key carries the wheel through centre with no step and catches up to a fresh press", () => {
    const [reversed, fresh_press] = [fresh(SteerMode.SMOOTH), fresh(SteerMode.SMOOTH)];
    for (const car of [reversed, fresh_press]) run(car, 30, () => cruise(car, 100));
    run(reversed, 0.5, () => cruise(reversed, 100, 1));
    let jump = 0;
    for (let t = 0; t < 0.3; t += DT) {
      const before = reversed.key_steer;
      run(reversed, DT, () => cruise(reversed, 100, -1));
      run(fresh_press, DT, () => cruise(fresh_press, 100, -1));
      if (Math.abs(before) < 0.1) jump = Math.max(jump, Math.abs(reversed.key_steer - before));
    }
    expect(jump).toBeGreaterThan(0);
    expect(jump).toBeLessThan(0.02);
    expect(reversed.key_steer).toBeCloseTo(fresh_press.key_steer, 2);
  });

  test("smooth: half a key (the precision key) eases down to half, not a jump", () => {
    const car = fresh(SteerMode.SMOOTH);
    run(car, 1, () => ({ ...idle, steer: -1 }));
    run(car, 1 / 360, () => ({ ...idle, steer: -0.5 }));
    expect(car.key_steer).toBeLessThan(-0.9);
    run(car, 1, () => ({ ...idle, steer: -0.5 }));
    expect(car.key_steer).toBe(-0.5);
  });

  test("smooth: a held key takes a 50 km/h hairpin as tight as classic, inside the grip", () => {
    const [classic, smooth] = [hairpin(SteerMode.SNAP), hairpin(SteerMode.SMOOTH)];
    expect(smooth.t180).toBeLessThan(classic.t180 * 1.05);
    expect(smooth.radius).toBeLessThan(classic.radius * 1.05);
    expect(smooth.slip).toBeLessThan(5);
  });

  test("smooth: a keyboard lane change at 120 km/h settles without a weave", () => {
    const change = lane_change(SteerMode.SMOOTH);
    expect(change.overshoot).toBeLessThan(1);
    expect(change.settle).toBeLessThan(3);
  });
});

// Lane change at 120 km/h settle (s) with Smooth keys before the speed-table retune (scripts/keys.ts at 390308c); the bus never settled.
const OLD_SMOOTH_LANE_SETTLE: Record<CarId, number> = {
  hatch: 2.39,
  coupe: 2.37,
  muscle: 2.49,
  rally: 2.46,
  kaze: 2.4,
  sturm: 2.37,
  raijin: 3.92,
  formula: 2.53,
  bus: Infinity,
};

describe("smooth keys on every car at 100 km/h", () => {
  test("a keyboard driver weaves through bends from 60 to 130 km/h well under classic, averaged over the cars", () => {
    const bends: [number, number][] = [[80, 60], [150, 90], [200, 110], [300, 130]];
    for (const [radius, speed] of bends) {
      let share = 0;
      for (const spec of Object.values(CARS)) share += arc(SteerMode.SMOOTH, radius, speed, spec).yaw_swing / arc(SteerMode.SNAP, radius, speed, spec).yaw_swing;
      expect(share / Object.keys(CARS).length).toBeLessThan(0.7);
    }
  });

  for (const spec of Object.values(CARS)) {
    test(`${spec.id}: a symmetric swerve ends straight, taps scale with press length, a long bend weaves less than classic, a 120 km/h lane change settles as fast, and the assists own the rest`, () => {
      expect(Math.abs(swerve(SteerMode.SMOOTH, spec).heading)).toBeLessThan(2);
      const [short, long] = [tap(SteerMode.SMOOTH, 1 / 60, 100, spec), tap(SteerMode.SMOOTH, 0.15, 100, spec)];
      expect(long.heading / short.heading).toBeGreaterThan(12);
      expect(long.slip).toBeLessThan(2);
      const [classic_arc, smooth_arc] = [arc(SteerMode.SNAP, 150, 90, spec), arc(SteerMode.SMOOTH, 150, 90, spec)];
      expect(smooth_arc.rms).toBeLessThan(0.5);
      expect(smooth_arc.yaw_swing).toBeLessThan(classic_arc.yaw_swing * 0.75);
      expect(slalom(SteerMode.SMOOTH, spec).slip).toBeLessThanOrEqual(slalom(SteerMode.SNAP, spec).slip);
      expect(lift_off(SteerMode.SMOOTH, spec)).toBeLessThan(lift_off(SteerMode.SNAP, spec) * 1.1);
      const lane = lane_change(SteerMode.SMOOTH, spec).settle;
      expect(lane).toBeLessThanOrEqual(Math.max(lane_change(SteerMode.SNAP, spec).settle * 1.1, is_car(spec.id) ? OLD_SMOOTH_LANE_SETTLE[spec.id] : 0));
      const [classic, smooth] = [flick(SteerMode.SNAP, spec), flick(SteerMode.SMOOTH, spec)];
      expect(smooth.turned).toBeGreaterThan(classic.turned * 0.75);
      expect(smooth.settle).toBeLessThan(classic.settle * 1.1 + 0.05);
    });
  }
});

describe("garage swap", () => {
  const hill: Ground = { ...flat, height: (x, z) => 3 + 0.1 * x - 0.05 * z };

  test("20 swaps leave each car on the ground at its ride height, not stacked", () => {
    const specs = Object.values(CARS);
    let car = new Car(specs[0]);
    car.place(4, 10, -6, 0.7);
    const first = new Map<number, number>();
    for (let i = 0; i < 20; i++) {
      const prev = car;
      const index = (i + 1) % specs.length;
      car = new Car(specs[index]);
      car.park(prev.pos.x, prev.pos.z, prev.heading, hill);
      expect(car.pos.y).toBeCloseTo(hill.height(car.pos.x, car.pos.z) + ride_height(car.spec), 6);
      expect(car.heading).toBeCloseTo(0.7, 6);
      expect(car.vel.length()).toBe(0);
      const y = first.get(index) ?? car.pos.y;
      first.set(index, y);
      expect(Math.abs(car.pos.y - y)).toBeLessThan(0.02);
    }
  });

  test("a parked car neither drops nor lifts once the sim runs", () => {
    for (const spec of Object.values(CARS)) {
      const car = new Car(spec);
      car.park(0, 0, 0, flat);
      const parked = car.pos.y;
      run(car, 2, () => idle);
      expect(Math.abs(car.pos.y - parked)).toBeLessThan(0.02);
    }
  });
});

describe("grass drag", () => {
  const grass = GROUNDS.grass;

  test("flat out in a straight line, no car yaws away or loses speed", () => {
    for (const spec of Object.values(CARS)) {
      const car = new Car(spec);
      car.place(0, 0.6, 0, 0);
      run(car, 1.5, () => idle);
      let peak = 0;
      for (let t = 0; t < 40; t += DT) {
        if (Math.abs(t - 20) < DT / 2) car.ang.y += 0.03;
        car.step(DT, { ...idle, throttle: 1, analog: true }, grass);
        peak = Math.max(peak, kmh(car));
      }
      expect(Math.abs(car.heading)).toBeLessThan(0.05);
      expect(kmh(car)).toBeGreaterThan(peak - 2);
    }
  });
});

describe("parking", () => {
  const slope = (grade: number): Ground => ({ ...flat, height: (_x, z) => z * grade, normal: (_x, _z, out) => out.set(0, 1, -grade).normalize() });

  for (const [label, controls, grade] of [
    ["idle hold on 20%", idle, 0.2],
    ["handbrake on 20%", { ...idle, handbrake: 1 }, 0.2],
    ["handbrake on 30%", { ...idle, handbrake: 1 }, 0.3],
  ] as const) {
    test(`${label}: every car stays put within 2 mm over 10 s`, () => {
      const ground = slope(grade);
      for (const spec of Object.values(CARS)) {
        const car = new Car(spec);
        car.park(0, 0, 0, ground);
        for (let t = 0; t < 3; t += DT) car.step(DT, controls, ground);
        const start = car.pos.clone();
        for (let t = 0; t < 10; t += DT) car.step(DT, controls, ground);
        expect(car.pos.distanceTo(start)).toBeLessThan(0.002);
      }
    });
  }

  test("braking from walking pace stops dead and stays stopped", () => {
    for (const spec of Object.values(CARS)) {
      const car = new Car(spec);
      car.auto = false;
      car.park(0, 0, 0, flat);
      run(car, 6, () => ({ ...idle, throttle: Math.max(0, Math.min(1, 0.08 + (5 - kmh(car)) * 0.3)) }));
      let t = 0;
      for (; t < 3 && car.vel.length() > 0.01; t += DT) car.step(DT, { ...idle, brake: 1 }, flat);
      expect(t).toBeLessThan(1);
      run(car, 2, () => ({ ...idle, brake: 1 }));
      const stopped = car.pos.clone();
      run(car, 3, () => ({ ...idle, brake: 1 }));
      expect(car.pos.distanceTo(stopped)).toBeLessThan(0.001);
    }
  });

  test("manual neutral on the flat holds still, coasts on momentum and rolls down a slope", () => {
    for (const spec of Object.values(CARS)) {
      const parked = new Car(spec);
      parked.auto = false;
      parked.park(0, 0, 0.3, flat);
      parked.gear = 0;
      const start = parked.pos.clone();
      run(parked, 20, () => idle);
      expect(parked.pos.distanceTo(start)).toBeLessThan(0.01);

      const coasting = new Car(spec);
      coasting.auto = false;
      coasting.park(0, 0, 0, flat);
      coasting.gear = 0;
      coasting.vel.set(0, 0, 10);
      run(coasting, 2, () => idle);
      expect(coasting.forward_speed).toBeGreaterThan(8);

      const hill = slope(0.1);
      const rolling = new Car(spec);
      rolling.auto = false;
      rolling.park(0, 0, 0, hill);
      rolling.gear = 0;
      for (let t = 0; t < 5; t += DT) rolling.step(DT, idle, hill);
      expect(rolling.forward_speed).toBeLessThan(-2);
    }
  });
});

test("the car-sized list is exactly the eight cars, so a body change can't silently drop one from the car tests", () => {
  expect(Object.values(CARS).filter(car_sized).map((spec) => spec.id).sort()).toEqual(["coupe", "formula", "hatch", "kaze", "muscle", "raijin", "rally", "sturm"]);
});

test("dropped at drop_height for a mode start or a reset, every car settles without bouncing", () => {
  for (const spec of Object.values(CARS)) {
    const car = new Car(spec);
    const start = drop_height(spec, 0.75);
    car.place(0, start, 0, 0);
    let rise = 0;
    let highest = start;
    for (let t = 0; t < 3; t += DT) {
      car.step(DT, idle, flat);
      rise = Math.max(rise, car.vel.y);
      highest = Math.max(highest, car.pos.y);
    }
    expect(rise, spec.id).toBeLessThan(1);
    expect(highest - start, spec.id).toBeLessThan(0.02);
  }
});

describe("park and idle hold", () => {
  const slope = (grade: number): Ground => ({ ...flat, height: (_x, z) => z * grade, normal: (_x, _z, out) => out.set(0, 1, -grade).normalize() });

  for (const heading of [0, Math.PI / 2, Math.PI]) {
    test(`park() on a 30% slope lands without sliding (heading ${heading.toFixed(2)})`, () => {
      const ground = slope(0.3);
      for (const spec of Object.values(CARS).filter(car_sized)) {
        const car = new Car(spec);
        car.park(0, 0, heading, ground);
        const start = car.pos.clone();
        let fastest = 0;
        for (let t = 0; t < 1; t += DT) {
          car.step(DT, idle, ground);
          fastest = Math.max(fastest, car.vel.length());
        }
        const settled = car.pos.clone();
        for (let t = 0; t < 4; t += DT) car.step(DT, idle, ground);
        expect(fastest).toBeLessThan(0.2);
        expect(settled.distanceTo(start)).toBeLessThan(0.03);
        expect(car.pos.distanceTo(settled)).toBeLessThan(0.001);
      }
      // A tall, soft body leans into the slope on its springs and swings its centre of mass a few centimetres while it
      // settles, so it is held to what parked means: the contact patches stay put and the body comes to rest.
      for (const spec of Object.values(CARS).filter((s) => !car_sized(s))) {
        const car = new Car(spec);
        car.park(0, 0, heading, ground);
        car.step(DT, idle, ground);
        const patches = car.wheels.map((w) => w.point.clone());
        for (let t = 0; t < 1; t += DT) car.step(DT, idle, ground);
        car.wheels.forEach((w, i) => expect(w.point.distanceTo(patches[i]), spec.id).toBeLessThan(0.02));
        for (let t = 0; t < 2; t += DT) car.step(DT, idle, ground);
        const settled = car.pos.clone();
        for (let t = 0; t < 2; t += DT) car.step(DT, idle, ground);
        expect(car.pos.distanceTo(settled), spec.id).toBeLessThan(0.001);
      }
    });
  }

  test("once engaged, the idle hold stays on until the driver touches a control", () => {
    for (const spec of Object.values(CARS)) {
      const car = new Car(spec);
      car.park(0, 0, 0, flat);
      run(car, 1, () => idle);
      car.vel.set(0, 0, 3);
      const start = car.pos.clone();
      run(car, 3, () => idle);
      expect(car.vel.length()).toBeLessThan(0.05);
      expect(car.pos.distanceTo(start)).toBeLessThan(1.5);
      run(car, 3, () => ({ ...idle, throttle: 0.3 }));
      expect(kmh(car)).toBeGreaterThan(5);
    }
  });
});

describe("drift suspension", () => {
  const local = new Vector3();
  const beta = (car: Car) => {
    local.copy(car.vel).applyQuaternion(car.quat.clone().invert());
    return Math.atan2(-local.x, local.z);
  };
  const slip = (car: Car) => Math.abs(beta(car)) * (180 / Math.PI);
  const power_on: Controls = { ...idle, steer: 0.3, throttle: 1, analog: true };
  // Steering assist off still caps the lock at the grip limit, about 0.3 of the old speed-cut lock at 70 km/h.
  const power_in: Controls = { ...power_on, steer: 1 };

  // TCS off and held in third at 70 km/h, so the only thing between the two runs is the setup.
  function rolling(id: CarId, suspension: number, assist = false): Car {
    const car = new Car(apply_build(CARS[id], { ...DEFAULT_BUILD, car: id, parts: { ...DEFAULT_PARTS, suspension } }));
    Object.assign(car, { tcs: false, assist, stability: assist, auto: false });
    car.place(0, 0.6, 0, 0);
    run(car, 1.5, () => idle);
    car.gear = 3;
    run(car, 30, () => ({ ...cruise(car, 70), analog: true }));
    return car;
  }

  function step_steer(id: CarId, suspension: number) {
    const car = rolling(id, suspension);
    run(car, 0.8, () => power_in);
    const early = slip(car);
    run(car, 0.4, () => power_in);
    return { early, late: slip(car) };
  }

  // A plain countersteer-and-feather driver aiming for 26 degrees: time spent between 15 and 50 is a slide held.
  function held_slide(id: CarId, suspension: number) {
    const car = rolling(id, suspension);
    run(car, 1, () => power_in);
    let held = 0;
    let most = 0;
    for (let t = 0; t < 4; t += DT) {
      const b = beta(car);
      const err = Math.abs(b) - 0.45;
      const want = b * 1.2 + Math.sign(b) * err;
      const lock = unassisted_lock(car.spec, Math.min(car.spec.lock, grip_lock(car.spec, car.vel.length())), Math.sign(want), b);
      car.step(DT, { ...idle, analog: true, steer: Math.max(-1, Math.min(1, want / lock)), throttle: Math.max(0, Math.min(1, 0.5 - err)) }, flat);
      const s = slip(car);
      most = Math.max(most, s);
      if (s >= 15 && s <= 50) held += DT;
    }
    return { held, most };
  }

  function peak_slip(car: Car, seconds: number, controls: Controls): number {
    let most = 0;
    for (let t = 0; t < seconds; t += DT) {
      car.step(DT, controls, flat);
      most = Math.max(most, slip(car));
    }
    return most;
  }

  for (const id of ["coupe", "kaze"] as const) {
    test(`${id}: with steer assist on, drift still rotates under power where race stays planted`, () => {
      const race = peak_slip(rolling(id, 2, true), 3, power_on);
      const drift = peak_slip(rolling(id, 3, true), 3, power_on);
      expect(race).toBeLessThan(5);
      expect(drift).toBeGreaterThan(25);
      expect(drift).toBeLessThan(50);
    });

    test(`${id}: with steer assist on, floored full lock rotates drift further but the assist still catches it`, () => {
      const floored: Controls = { ...idle, steer: 1, throttle: 1 };
      const race_car = rolling(id, 2, true);
      const drift_car = rolling(id, 3, true);
      const race = peak_slip(race_car, 4, floored);
      const drift = peak_slip(drift_car, 4, floored);
      expect(drift).toBeGreaterThan(race + 10);
      expect(drift).toBeLessThan(75);
      expect(kmh(drift_car)).toBeGreaterThan(20);
    });

    test(`${id}: under power, drift steps the rear out well past race without spinning on the spot`, () => {
      const race = step_steer(id, 2);
      const drift = step_steer(id, 3);
      expect(drift.early).toBeGreaterThan(race.early * 1.5);
      expect(drift.late).toBeGreaterThan(race.late * 1.4);
      expect(drift.late).toBeLessThan(45);
    });

    test(`${id}: drift swings wider and slides longer than race under a driver who keeps kicking it back out`, () => {
      const race = held_slide(id, 2);
      const drift = held_slide(id, 3);
      expect(drift.held).toBeGreaterThan(1.4);
      // Race still straightens each slide inside 0.6 s. At the grip-capped lock the driver's kick back into the turn now
      // bites where the over-peak fronts used to scrub, so race's time is two short swings; race ARB 1.0-2.0 and +0.04
      // rear grip moved it by under 0.05 s, so the gap is in the angle and the swings, not in race straightening.
      expect(drift.held).toBeGreaterThan(race.held + 0.6);
      expect(drift.most).toBeGreaterThan(race.most + 6);
      expect(drift.most).toBeLessThan(45);
    });
  }
});

describe("rally off-road", () => {
  const grass = GROUNDS.grass;
  const flat_out = (spec: CarSpec, ground: Ground) => {
    const car = new Car(spec);
    car.place(0, 0.6, 0, 0);
    for (let t = 0; t < 25; t += DT) car.step(DT, { ...idle, throttle: 1, analog: true }, ground);
    return kmh(car);
  };
  const corner_g = (spec: CarSpec, ground: Ground) => {
    let most = 0;
    for (const steer of [0.35, 0.5, 0.7, 1]) {
      const car = new Car(spec);
      Object.assign(car, { assist: false, stability: false });
      car.place(0, 0.6, 0, 0);
      for (let t = 0; t < 20 && kmh(car) < 60; t += DT) car.step(DT, { ...idle, throttle: 1, analog: true }, ground);
      for (let t = 0; t < 6; t += DT) car.step(DT, { ...idle, steer, analog: true, throttle: Math.max(0, Math.min(1, (60 - kmh(car)) * 0.2 + 0.25)) }, ground);
      most = Math.max(most, Math.abs(car.ang.y * car.vel.length()) / 9.81);
    }
    return most;
  };

  test("on grass it keeps nearly its tarmac pace and outruns every other car by a wide margin", () => {
    const rally = flat_out(CARS.rally, grass);
    expect(rally).toBeGreaterThan(flat_out(CARS.rally, flat) * 0.9);
    for (const spec of Object.values(CARS)) if (spec !== CARS.rally) expect(rally).toBeGreaterThan(flat_out(spec, grass) * 1.15);
  });

  test("on grass it keeps nearly its tarmac cornering grip, well above the coupe's", () => {
    const rally = corner_g(CARS.rally, grass);
    expect(rally).toBeGreaterThan(corner_g(CARS.rally, flat) * 0.9);
    expect(rally).toBeGreaterThan(corner_g(CARS.coupe, grass) + 0.12);
  });

  test("launched off a crest spinning, it lands on its wheels", () => {
    const car = new Car(CARS.rally);
    car.place(0, 2, 0, 0);
    car.vel.set(0, 5, 20);
    car.ang.set(0, 0, 1.2);
    const up = new Vector3();
    let lowest = 1;
    for (let t = 0; t < 4; t += DT) {
      car.step(DT, idle, grass);
      lowest = Math.min(lowest, up.set(0, 1, 0).applyQuaternion(car.quat).y);
    }
    expect(lowest).toBeGreaterThan(Math.cos((25 * Math.PI) / 180));
    expect(car.wheels.every((w) => w.contact)).toBe(true);
  });
});

describe("crest landings", () => {
  const up = new Vector3();
  /** Most tilt (deg) from 4 s after leaving a crest at 72 km/h, 5 m/s up, with `spin` rad/s of pitch and roll, and whether it ends on its wheels. */
  const launch = (spec: CarSpec, spin: [number, number, number]) => {
    const car = new Car(spec);
    car.place(0, 2, 0, 0);
    car.vel.set(0, 5, 20);
    car.ang.set(...spin);
    let lowest = 1;
    for (let t = 0; t < 4; t += DT) {
      car.step(DT, idle, GROUNDS.grass);
      lowest = Math.min(lowest, up.set(0, 1, 0).applyQuaternion(car.quat).y);
    }
    return { tilt: (Math.acos(Math.min(1, lowest)) * 180) / Math.PI, wheels: car.wheels.every((w) => w.contact) };
  };

  test("every car launched pitching or rolling lands on its wheels, never past 40 degrees", () => {
    const failed: string[] = [];
    for (const spec of Object.values(CARS))
      for (const spin of [[1, 0, 0], [0, 0, 1.2], [-0.8, 0, -0.8]] as [number, number, number][]) {
        const { tilt, wheels } = launch(spec, spin);
        if (tilt > 40 || !wheels) failed.push(`${spec.id} ${spin}: ${tilt.toFixed(0)} deg${wheels ? "" : ", not on its wheels"}`);
      }
    expect(failed).toEqual([]);
  });

  test("a gentle crest still shows in the air: no car is levelled flat", () => {
    expect(Object.values(CARS).filter((spec) => launch(spec, [0.4, 0, 0]).tilt < 3).map((spec) => spec.id)).toEqual([]);
  });
});

describe("nitro", () => {
  const boosted = (): Car => {
    const car = new Car({ ...CARS.coupe, nitro: 10 });
    car.place(0, 0.6, 0, 0);
    run(car, 1.5, () => idle);
    run(car, 4, () => ({ ...idle, throttle: 1 }));
    return car;
  };
  const gas = { ...idle, throttle: 1, nitro: true };

  test("burns in 2nd and up, but not through a gear change or on the limiter", () => {
    const car = boosted();
    expect(car.gear).toBeGreaterThanOrEqual(2);
    car.auto = false;
    run(car, 0.2, () => gas);
    expect(car.nitro.boosting).toBe(true);
    car.shift(1);
    const before = car.nitro.fill;
    while (car.shifting > 0) {
      car.step(DT, gas, flat);
      if (car.shifting > 0) expect(car.nitro.boosting).toBe(false);
    }
    expect(car.nitro.fill).toBeGreaterThanOrEqual(before);
    car.shift(-1);
    run(car, 6, () => gas);
    const at_limiter = car.nitro.fill;
    let burning = 0;
    for (let t = 0; t < 1; t += DT) {
      car.step(DT, gas, flat);
      if (car.nitro.boosting) burning++;
    }
    expect(burning).toBeLessThan(120);
    expect(at_limiter - car.nitro.fill).toBeLessThan(0.3);
  });

  test("never in 1st, reverse or neutral", () => {
    const car = new Car({ ...CARS.coupe, nitro: 10 });
    car.place(0, 0.6, 0, 0);
    run(car, 1.5, () => idle);
    run(car, 0.5, () => gas);
    expect(car.gear).toBe(1);
    expect(car.nitro.boosting).toBe(false);
    expect(car.nitro.fill).toBeGreaterThanOrEqual(10 - 1e-9);
  });
});

describe("aero kit", () => {
  const front_share = (aero: number): number => {
    const car = new Car(apply_build(CARS.coupe, { ...DEFAULT_BUILD, parts: { ...DEFAULT_PARTS, aero } }));
    car.place(0, 0.6, 0, 0);
    run(car, 1.5, () => idle);
    run(car, 13.5, () => cruise(car, 160));
    // Averaged: the loads chatter by a step's worth from one instant to the next, a third of the margin.
    let share = 0;
    let samples = 0;
    for (let t = 0; t < 0.5; t += DT) {
      car.step(DT, cruise(car, 160), flat);
      const [fl, fr, rl, rr] = car.wheels.map((w) => w.load);
      share += (fl + fr) / (fl + fr + rl + rr);
      samples++;
    }
    return share / samples;
  };

  test("the kits load the front tyres more at speed than the wing alone", () => {
    const wing = front_share(2);
    const street = front_share(3);
    expect(street).toBeGreaterThan(wing + 0.015);
    expect(front_share(4)).toBeGreaterThan(wing);
  });
});

describe("hairpin pull", () => {
  test("full lock and full throttle up a 6% hairpin, TCS and assist on, every car reaches 30 km/h from 10 within 4 s", () => {
    for (const spec of Object.values(CARS)) expect(hairpin_pull(spec, 0.06, true, true).t30).toBeLessThan(4);
  });
});

describe("donut", () => {
  for (const id of ["coupe", "muscle", "kaze", "formula", "sturm", "rally"] as const) {
    for (const mode of [SteerMode.SNAP, SteerMode.SMOOTH])
      test(`${id} (${mode} keys): full steer and full gas from 5 m/s, TCS off, assist on, holds full lock and keeps rotating on the spot`, () => {
        const d = donut(CARS[id], false, true, false, mode);
        expect(d.steer_min).toBeGreaterThan(0.99);
        expect(d.yaw).toBeGreaterThan(0.6);
        expect(d.yaw_min).toBeGreaterThan(0);
        expect(d.kmh).toBeLessThan(30);
      });
  }
});

describe("power over from rest", () => {
  const RWD_AWD = ["coupe", "muscle", "kaze", "formula", "sturm", "rally", "raijin"] as const;
  const caught = (over: PowerOver) => {
    expect(over.t30).toBeLessThan(2.5);
    expect(over.peak).toBeGreaterThan(25);
    expect(over.body).toBeLessThan(85);
    expect(over.catch).toBeLessThan(1.2);
    expect(over.flip).toBeLessThan(15);
    expect(over.spun).toBe(false);
  };

  for (const id of RWD_AWD) {
    test(`${id}: full lock and full gas from parked, TCS and assist on, swings the tail out and a countersteer at full gas catches it`, () => {
      for (const counter of [Counter.RELEASE, Counter.TAP, Counter.HOLD]) caught(power_over(SteerMode.SMOOTH, CARS[id], { counter }));
    });

    test(`${id}: it launches whichever goes down first, the gas up to 0.4 s early or the key, in every key mode`, () => {
      for (const lead of [-0.2, 0.1, 0.2, 0.4]) caught(power_over(SteerMode.SMOOTH, CARS[id], { lead }));
      for (const mode of [SteerMode.SNAP, SteerMode.HOLD]) caught(power_over(mode, CARS[id], { lead: 0.2 }));
    });
  }

  test("hatch (FWD): full lock and full gas from parked stays a grip circle", () => {
    expect(power_over(SteerMode.SMOOTH, CARS.hatch).t30).toBe(Infinity);
  });

  test("reversing on full lock never launches one", () => {
    for (const id of RWD_AWD) {
      const car = new Car(CARS[id]);
      car.steer_mode = SteerMode.SMOOTH;
      car.park(0, 0, 0, flat);
      run(car, 0.5, () => ({ ...idle, brake: 1 }));
      expect(car.gear).toBe(-1);
      for (let t = 0; t < 2; t += DT) {
        car.step(DT, { ...idle, steer: 1, brake: 1 }, flat);
        expect(car.launched).toBe(false);
      }
    }
  });

  test("a car put back by a rewind forgets the slide it was launched into", () => {
    const car = new Car(CARS.coupe);
    car.park(0, 0, 0, flat);
    run(car, 0.5, () => ({ ...idle, steer: 1, throttle: 1 }));
    expect(car.launched).toBe(true);
    car.forget_slide();
    car.vel.set(0, 0, 5);
    car.step(DT, { ...idle, steer: 1, throttle: 1 }, flat);
    expect(car.launched).toBe(false);
  });
});

describe("power over with TCS on and the steering assist off", () => {
  const RWD = ["coupe", "muscle", "kaze", "formula", "sturm"] as const;
  const AWD = ["rally", "raijin"] as const;
  const DRIFT_SETUP = apply_build(CARS.muscle, { ...DEFAULT_BUILD, car: "muscle", parts: { ...DEFAULT_PARTS, suspension: 3 } });
  const ahead = new Vector3();

  function rolling(spec: CarSpec, from: number, assist = false): Car {
    const car = new Car(spec);
    Object.assign(car, { steer_mode: SteerMode.SMOOTH, assist });
    car.park(0, 0, 0, flat);
    run(car, 0.5, () => idle);
    while (car.vel.length() * 3.6 < from) car.step(DT, { ...idle, throttle: 0.6 }, flat);
    if (from > 0) run(car, 1, () => cruise(car, from));
    return car;
  }

  // Rear-axle slip, as in keys.ts: body slip reads a tail out in a plain tight circle.
  function tail(car: Car): number {
    const local = ahead.copy(car.vel).applyQuaternion(car.quat.clone().invert());
    const side = local.x + car.ang.y * car.axles[car.axles.length - 1].z;
    return Math.hypot(side, local.z) < 0.5 ? 0 : (Math.atan2(side, local.z) * 180) / Math.PI;
  }

  function launches(car: Car, controls: Controls, seconds = 2): boolean {
    for (let t = 0; t < seconds; t += DT) {
      car.step(DT, controls, flat);
      if (car.launched) return true;
    }
    return false;
  }

  const kick: Controls = { ...idle, steer: 1, throttle: 1 };

  /** Full gas, the stick at `steer`, the handbrake tapped for 0.25 s after 0.2 s: the gesture a rolling kick needs. */
  function tap(car: Car, { steer = 1, throttle = 1 } = {}): boolean {
    for (let t = 0; t < 1.5; t += DT) {
      car.step(DT, { ...idle, steer, throttle, handbrake: t >= 0.2 && t < 0.45 ? 1 : 0 }, flat);
      if (car.launched) return true;
    }
    return false;
  }

  for (const id of RWD)
    test(`${id}: rolling from walking pace to 30 km/h, a handbrake tap at full lock on the gas kicks a power slide`, () => {
      for (const from of [5, 15, 20]) expect(tap(rolling(CARS[id], from))).toBe(true);
    });

  test("keys and touch buttons are always full: held or feathered full gas at full key through a slow corner never kicks one", () => {
    for (const spec of [DRIFT_SETUP, ...RWD.map((id) => CARS[id])])
      for (const from of [5, 15, 25]) {
        const held = rolling(spec, from);
        expect(launches(held, kick, 1.2)).toBe(false);
        expect(Math.abs(tail(held))).toBeLessThan(15);
        const feathered = rolling(spec, from);
        for (let t = 0; t < 2.5; t += DT) {
          feathered.step(DT, { ...kick, throttle: (t * 3) % 1 < 0.5 ? 1 : 0 }, flat);
          expect(feathered.launched).toBe(false);
        }
      }
  });

  test("a handbrake turn without gas, parking or stopping on it, an eased stick, 40 km/h, the steering assist on or all-wheel drive kicks nothing", () => {
    for (const id of RWD) {
      expect(tap(rolling(CARS[id], 15), { throttle: 0 })).toBe(false);
      expect(tap(rolling(CARS[id], 15), { steer: 0.6 })).toBe(false);
      expect(tap(rolling(CARS[id], 40))).toBe(false);
      expect(tap(rolling(CARS[id], 15, true))).toBe(false);
      const stop = rolling(CARS[id], 15);
      expect(launches(stop, { ...idle, handbrake: 1 }, 3)).toBe(false);
      expect(launches(stop, { ...idle, steer: 1, handbrake: 1 }, 1)).toBe(false);
    }
    for (const id of AWD) expect(tap(rolling(CARS[id], 15))).toBe(false);
  });

  test("a parking turn, full lock without full gas, a gentle throttle turn or reversing never kicks one", () => {
    for (const id of [...RWD, ...AWD]) {
      expect(launches(rolling(CARS[id], 0), { ...idle, steer: 1, throttle: 0.3 })).toBe(false);
      for (const from of [0, 10, 20, 30]) {
        expect(launches(rolling(CARS[id], from), { ...idle, steer: 1, throttle: 0.7 })).toBe(false);
        expect(launches(rolling(CARS[id], from), { ...idle, steer: 0.6, throttle: 1 })).toBe(false);
      }
      const reverse = rolling(CARS[id], 0);
      run(reverse, 0.5, () => ({ ...idle, brake: 1 }));
      expect(reverse.gear).toBe(-1);
      expect(launches(reverse, { ...idle, steer: 1, brake: 1 })).toBe(false);
    }
  });

  for (const spec of [DRIFT_SETUP, CARS.coupe, CARS.muscle])
    test(`${spec.id}${spec === DRIFT_SETUP ? " (drift setup)" : ""}: easing pad gas or stick mid-slide eases out of it, never steering into the turn or pivoting`, () => {
      for (const eased of [0.85, 0.7, 0.6])
        for (const which of ["steer", "throttle"] as const) {
          const car = rolling(spec, 0);
          run(car, 2.5, () => ({ ...kick, analog: true }));
          let into = -Infinity;
          for (let t = 0; t < 1.5; t += DT) {
            car.step(DT, { ...kick, analog: true, [which]: eased }, flat);
            if (Math.abs(tail(car)) > 10) into = Math.max(into, car.steer);
          }
          // A few degrees into the turn is the front axle's own course in the tight arc the slide leaves behind.
          expect(into).toBeLessThan(0.2);
          expect(car.vel.length() * 3.6).toBeGreaterThan(15);
        }
    });

  for (const spec of [DRIFT_SETUP, ...RWD.filter((id) => id !== "sturm").map((id) => CARS[id])])
    test(`${spec.id}${spec === DRIFT_SETUP ? " (drift setup)" : ""}: a held power slide from rest on full lock and full gas carries speed instead of pivoting`, () => {
      const car = rolling(spec, 0);
      run(car, 2, () => kick);
      let out = 0;
      let steps = 0;
      for (let t = 0; t < 4; t += DT, steps++) {
        car.step(DT, kick, flat);
        out += tail(car);
      }
      expect(car.vel.length() * 3.6).toBeGreaterThan(25);
      expect(out / steps).toBeGreaterThan(15);
    });
});
