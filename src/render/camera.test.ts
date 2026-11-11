import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import type { Look } from "../hud/input";
import { ChaseCamera, type CarPose } from "./camera";

const FLAT = { height: () => 0 };
const STILL: Look = { dx: 0, dy: 0, zoom: 0, pinch: 0, dragging: false, stick_x: 0, stick_y: 0 };

function rig() {
  const chase = new ChaseCamera(new THREE.PerspectiveCamera(64, 16 / 9, 0.1, 1000));
  const car: CarPose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), vel: new THREE.Vector3(0, 0, 30) };
  chase.snap(car);
  let time = 0;
  const frame = (dt: number) => {
    car.pos.addScaledVector(car.vel, dt);
    time += dt;
    chase.update(dt, car, FLAT, false, time, STILL);
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

  test("a right turn rolls the view outward, camera up toward the car's left", () => {
    const r = rig();
    drive(1, 60, new THREE.Vector3(-8, 0, 0), r);
    expect(r.chase.tilt.roll).toBeGreaterThan(0.5 * DEG);
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
      expect([r.chase.tilt.pitch, r.chase.tilt.roll]).toEqual([0, 0]);
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
