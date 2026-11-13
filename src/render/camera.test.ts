import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import type { Look } from "../hud/input";
import { ChaseCamera, type CarPose } from "./camera";

type Ground = Parameters<ChaseCamera["update"]>[2];

const FLAT: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0) };
const STILL: Look = { dx: 0, dy: 0, zoom: 0, pinch: 0, dragging: false, stick_x: 0, stick_y: 0 };

function rig(world: Ground = FLAT) {
  const chase = new ChaseCamera(new THREE.PerspectiveCamera(64, 16 / 9, 0.1, 1000));
  const car: CarPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), vel: new THREE.Vector3(0, 0, 30) };
  chase.snap(car);
  let time = 0;
  const frame = (dt: number) => {
    car.pos.addScaledVector(car.vel, dt);
    time += dt;
    chase.update(dt, car, world, false, time, STILL);
  };
  return { chase, car, frame };
}

/** Physics at 360 Hz drawn at `hz`: the velocity only moves on frames a step lands in, so at 480 Hz frames alternate between 0 and 1 steps. */
function drive(seconds: number, hz: number, accel: THREE.Vector3, { car, frame }: ReturnType<typeof rig>, each?: () => void) {
  let sim = 0;
  let stepped = 0;
  for (let i = 1; i <= seconds * hz; i++) {
    sim = Math.floor((i / hz) * 360);
    for (; stepped < sim; stepped++) car.vel.addScaledVector(accel, 1 / 360);
    frame(1 / hz);
    each?.();
  }
}

const DEG = Math.PI / 180;

describe("chase camera tilt feed", () => {
  test("braking on the level dips the view", () => {
    const r = rig();
    drive(2, 60, new THREE.Vector3(0, 0, -9), r);
    expect(r.chase.tilt.pitch).toBeLessThan(-0.5 * DEG);
  });

  test("a nose-down car in free fall feels nothing", () => {
    const r = rig();
    r.car.quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 30 * DEG);
    r.chase.snap(r.car);
    drive(1.5, 60, new THREE.Vector3(0, -9.81, 0), r);
    expect(Math.abs(r.chase.tilt.pitch)).toBeLessThan(1e-6);
  });

  test("snap takes the placed car's velocity, so a reset does not kick the view", () => {
    const r = rig();
    drive(1, 60, new THREE.Vector3(), r);
    r.car.vel.set(0, 0, 0);
    r.chase.snap(r.car);
    drive(0.5, 60, new THREE.Vector3(), r);
    expect(Math.abs(r.chase.tilt.pitch)).toBeLessThan(1e-9);
  });

  test("cockpit, the top view and rewind keep the view level", () => {
    for (const set of [(c: ChaseCamera) => (c.mode = 1), (c: ChaseCamera) => (c.top = true), (c: ChaseCamera) => (c.rewinding = true), (c: ChaseCamera) => (c.tilt_on = false)]) {
      const r = rig();
      set(r.chase);
      drive(1, 60, new THREE.Vector3(-8, 0, -9), r);
      expect(r.chase.tilt.pitch).toBe(0);
    }
  });

  test("at 480 Hz, frames with and without a physics step do not make the view shimmer", () => {
    const r = rig();
    const brake = new THREE.Vector3(0, 0, -9);
    drive(2, 480, brake, r);
    let last = r.chase.tilt.pitch;
    let worst = 0;
    drive(0.5, 480, brake, r, () => {
      worst = Math.max(worst, Math.abs(r.chase.tilt.pitch - last));
      last = r.chase.tilt.pitch;
    });
    expect(r.chase.tilt.pitch).toBeLessThan(-0.5 * DEG);
    expect(worst).toBeLessThan(0.002 * DEG);
  });
});

describe("chase camera follow", () => {
  /** Drives `kmh` with the car turning at `rate(t)` rad/s; `each` sees the time, the view's heading and the car's. */
  const follow = (kmh: number, seconds: number, rate: (t: number) => number, each: (t: number, view: number, heading: number, chase: ChaseCamera) => void) => {
    const r = rig();
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const v = kmh / 3.6;
    let heading = 0;
    for (let t = 1 / 60; t <= seconds; t += 1 / 60) {
      heading += rate(t) / 60;
      r.car.vel.set(Math.sin(heading) * v, 0, Math.cos(heading) * v);
      r.car.quat.setFromAxisAngle(up, heading);
      r.frame(1 / 60);
      each(t, Math.atan2(r.chase.camera.getWorldDirection(dir).x, dir.z), heading, r.chase);
    }
  };
  const off = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  /** Turn rate of a lateral pull of `g` at `kmh`. */
  const turn = (kmh: number, g: number) => (g * 9.81) / (kmh / 3.6);

  test("a road weave turns the view at a third of the car's rate or less", () => {
    for (const [kmh, g, hz] of [[80, 0.8, 0.75], [100, 0.8, 1], [130, 0.6, 1.5]]) {
      const amp = turn(kmh, g);
      let last = 0;
      let peak = 0;
      follow(kmh, 8, (t) => amp * Math.cos(2 * Math.PI * hz * t), (t, view) => {
        if (t > 3) peak = Math.max(peak, Math.abs(off(view, last)) * 60);
        last = view;
      });
      expect(peak / amp).toBeLessThan(0.34);
    }
  });

  test("a held sweeper trails the car by no more than the old fixed-rate camera (about 4 degrees) at any speed and grip", () => {
    for (const [kmh, g] of [[300, 3.2], [100, 1]]) {
      let lag = 0;
      follow(kmh, 9, (t) => (t > 1 ? turn(kmh, g) : 0), (_, view, heading) => (lag = Math.abs(off(heading, view))));
      expect(lag).toBeLessThan(4.2 * DEG);
    }
  });

  test("the view does not swing past the car coming out of a turn", () => {
    for (const [kmh, g, hold] of [[300, 3.2, 2], [100, 1, 1.5], [60, 1, 0.4]]) {
      let past = 0;
      follow(kmh, 7 + hold, (t) => (t > 1 && t <= 1 + hold ? turn(kmh, g) : 0), (t, view, heading) => {
        if (t > 1 + hold) past = Math.max(past, off(view, heading));
      });
      expect(past).toBeLessThan(1 * DEG);
    }
  });

  test("switching from the cockpit mid-turn starts the chase view behind the car", () => {
    let worst = 0;
    follow(200, 6, (t) => (t > 1 && t < 4 ? turn(200, 2) : 0), (t, view, heading, chase) => {
      chase.mode = t < 4 ? 1 : 0;
      if (t > 4.05) worst = Math.max(worst, Math.abs(off(heading, view)));
    });
    expect(worst).toBeLessThan(3 * DEG);
  });
});

describe("chase camera on a wall", () => {
  let bank = 0;
  /** A deck rising toward -x at `bank`, the car driving +z along it. */
  const WALL: Ground = { height: () => -10, normal: (_x, _z, out) => out.set(Math.sin(bank), Math.cos(bank), 0) };
  const up_off = (r: ReturnType<typeof rig>) => r.chase.camera.up.angleTo(new THREE.Vector3(Math.sin(bank), Math.cos(bank), 0));

  test("a world without a wall bank, or on the flat, drives the view exactly as before", () => {
    const plain = rig();
    const walled = rig();
    walled.chase.wall_bank = 35 * DEG;
    drive(3, 60, new THREE.Vector3(-4, 0, 3), plain);
    drive(3, 60, new THREE.Vector3(-4, 0, 3), walled);
    expect(walled.chase.camera.position.toArray()).toEqual(plain.chase.camera.position.toArray());
    expect(walled.chase.camera.quaternion.toArray()).toEqual(plain.chase.camera.quaternion.toArray());
  });

  test("an ordinary bank keeps the view level", () => {
    bank = 30 * DEG;
    const r = rig(WALL);
    r.chase.wall_bank = 35 * DEG;
    drive(3, 60, new THREE.Vector3(), r);
    expect(r.chase.camera.up.toArray()).toEqual([0, 1, 0]);
  });

  test("a steep wall stands the view on the deck, without a snap", () => {
    bank = 0;
    const r = rig(WALL);
    r.chase.wall_bank = 35 * DEG;
    drive(0.5, 60, new THREE.Vector3(), r);
    bank = 65 * DEG;
    const up = new THREE.Vector3(0, 1, 0);
    let worst = 0;
    drive(4, 60, new THREE.Vector3(), r, () => {
      worst = Math.max(worst, up.angleTo(r.chase.camera.up));
      up.copy(r.chase.camera.up);
    });
    expect(up_off(r)).toBeLessThan(1 * DEG);
    expect(worst).toBeLessThan(3 * DEG);
  });
});
