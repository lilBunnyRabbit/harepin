/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";
import { DEFAULT_BUILD, DEFAULT_PARTS, apply_build } from "./build";
import { Car, SteerMode, ride_height, type Controls, type Ground } from "./car";
import { CARS, car_sized, type CarId, type CarSpec } from "./cars";
import { donut } from "../../scripts/donut";
import { hairpin_pull } from "../../scripts/hairpin";
import { arc, hairpin, lane_change, tap } from "../../scripts/keys";

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
    expect(smooth.heading).toBeGreaterThan(0.2);
    expect(smooth.heading).toBeLessThan(0.8);
    expect(tap(SteerMode.SNAP, 1 / 60).heading).toBeLessThan(0.1);
  });

  test("smooth: at 100 km/h a held key builds from the tap share to full within 0.5 s, and lets go without a snap", () => {
    const car = fresh(SteerMode.SMOOTH);
    run(car, 30, () => cruise(car, 100));
    run(car, 1 / 360, () => cruise(car, 100, 1));
    expect(car.key_steer).toBeCloseTo(0.15, 2);
    run(car, 0.2, () => cruise(car, 100, 1));
    expect(car.key_steer).toBeGreaterThan(0.3);
    expect(car.key_steer).toBeLessThan(0.7);
    run(car, 0.3, () => cruise(car, 100, 1));
    expect(car.key_steer).toBe(1);
    run(car, 0.05, () => cruise(car, 100));
    expect(car.key_steer).toBeGreaterThan(0.5);
    run(car, 0.6, () => cruise(car, 100));
    expect(car.key_steer).toBe(0);
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

  test("smooth: a keyboard driver holds a long 90 km/h bend with less weave than classic", () => {
    const [classic, smooth] = [arc(SteerMode.SNAP), arc(SteerMode.SMOOTH)];
    expect(smooth.rms).toBeLessThan(0.5);
    expect(smooth.yaw_swing).toBeLessThan(classic.yaw_swing * 0.6);
  });
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
  const grass: Ground = { ...flat, grip: () => 0.72, roll: () => 12 };

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

  // TCS off and held in third at 70 km/h, so the only thing between the two runs is the setup.
  function rolling(id: CarId, suspension: number, assist = false): Car {
    const car = new Car(apply_build(CARS[id], { ...DEFAULT_BUILD, car: id, parts: { ...DEFAULT_PARTS, suspension } }));
    Object.assign(car, { tcs: false, assist, auto: false });
    car.place(0, 0.6, 0, 0);
    run(car, 1.5, () => idle);
    car.gear = 3;
    run(car, 30, () => ({ ...cruise(car, 70), analog: true }));
    return car;
  }

  function step_steer(id: CarId, suspension: number) {
    const car = rolling(id, suspension);
    run(car, 0.8, () => power_on);
    const early = slip(car);
    run(car, 0.4, () => power_on);
    return { early, late: slip(car) };
  }

  // A plain countersteer-and-feather driver aiming for 26 degrees: time spent between 15 and 50 is a slide held.
  function held_slide(id: CarId, suspension: number) {
    const car = rolling(id, suspension);
    run(car, 1, () => power_on);
    let held = 0;
    let most = 0;
    for (let t = 0; t < 4; t += DT) {
      const b = beta(car);
      const err = Math.abs(b) - 0.45;
      const lock = car.spec.lock / (1 + car.vel.length() / 45);
      car.step(DT, { ...idle, analog: true, steer: Math.max(-1, Math.min(1, (b * 1.2 + Math.sign(b) * err) / lock)), throttle: Math.max(0, Math.min(1, 0.5 - err)) }, flat);
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

    test(`${id}: drift holds a caught slide that race straightens out of`, () => {
      const race = held_slide(id, 2);
      const drift = held_slide(id, 3);
      expect(drift.held).toBeGreaterThan(1.4);
      expect(drift.held).toBeGreaterThan(race.held + 0.8);
      expect(drift.most).toBeLessThan(45);
    });
  }
});

describe("rally off-road", () => {
  const grass: Ground = { ...flat, grip: () => 0.72, roll: () => 12 };
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
      car.assist = false;
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
