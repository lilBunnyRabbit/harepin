import { Quaternion, Vector3 } from "three";
import { COUPE, type CarSpec } from "./cars";

export interface Ground {
  height(x: number, z: number): number;
  normal(x: number, z: number, out: Vector3): Vector3;
  grip(x: number, z: number): number;
  roll(x: number, z: number): number;
}

export interface Controls {
  steer: number;
  throttle: number;
  brake: number;
  handbrake: number;
  analog: boolean;
}

export const CAR_BODY = { mass: COUPE.mass, yaw_inertia: COUPE.inertia[1] };
const GRAVITY = 9.81;

// Normalised magic formula: peak at s = 1, sliding grip sin(C·π/2) ≈ 65% of peak.
const MF_C = 1.55;
const MF_B = Math.tan(Math.PI / (2 * MF_C));

export class Wheel {
  omega = 0;
  spin = 0;
  compression = 0;
  prev = 0;
  lateral = 0;
  reach: number;
  contact = false;
  slip = 0;
  angle = 0;
  load = 0;
  abs = false;
  abs_factor = 1;
  readonly point = new Vector3();
  readonly normal = new Vector3();
  readonly driven: boolean;

  constructor(
    readonly mount: Vector3,
    readonly front: boolean,
    readonly left: boolean,
    spec: CarSpec,
  ) {
    this.driven = spec.drive === "awd" || (spec.drive === "fwd") === front;
    this.reach = spec.wheel.rest + spec.wheel.radius;
  }
}

function torque_at(curve: [number, number][], rpm: number): number {
  for (let i = 1; i < curve.length; i++) {
    const [r1, t1] = curve[i];
    if (rpm <= r1) {
      const [r0, t0] = curve[i - 1];
      return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
    }
  }
  return curve[curve.length - 1][1];
}

function magic(s: number): number {
  return Math.sin(MF_C * Math.atan(MF_B * s));
}

function combined_x(sx: number, sy: number): number {
  const s = Math.hypot(sx, sy);
  return s < 1e-6 ? MF_C * MF_B * sx : (magic(s) * sx) / s;
}

function combined_y(sx: number, sy: number): number {
  const s = Math.hypot(sx, sy);
  return s < 1e-6 ? MF_C * MF_B * sy : (magic(s) * sy) / s;
}

const up = new Vector3();
const down = new Vector3();
const forward = new Vector3();
const mount = new Vector3();
const wheel_fwd = new Vector3();
const lat = new Vector3();
const lever = new Vector3();
const point_vel = new Vector3();
const force = new Vector3();
const total_force = new Vector3();
const total_torque = new Vector3();
const tmp = new Vector3();
const tmp2 = new Vector3();
const inv = new Quaternion();
const steer_q = new Quaternion();
const Y = new Vector3(0, 1, 0);

export class Car {
  readonly pos = new Vector3();
  readonly quat = new Quaternion();
  readonly vel = new Vector3();
  readonly ang = new Vector3();
  readonly wheels: Wheel[];
  private readonly corners: Vector3[];

  gear = 1;
  auto = true;
  rpm: number;
  steer = 0;
  shifting = 0;
  tcs = true;
  abs = true;
  assist = true;
  tcs_factor = 1;
  braking = 0;
  throttle = 0;

  static readonly RADIUS = COUPE.wheel.radius;

  constructor(readonly spec: CarSpec = COUPE) {
    this.wheels = spec.wheel.mounts.map(([x, y, z]) => new Wheel(new Vector3(x, y, z), z > 0, x > 0, spec));
    this.corners = spec.corners.map(([x, y, z]) => new Vector3(x, y, z));
    this.rpm = spec.idle;
  }

  place(x: number, y: number, z: number, heading: number) {
    this.pos.set(x, y, z);
    this.quat.setFromAxisAngle(Y, heading);
    this.vel.set(0, 0, 0);
    this.ang.set(0, 0, 0);
    this.gear = 1;
    this.rpm = this.spec.idle;
    this.steer = 0;
    this.shifting = 0;
    for (const w of this.wheels) {
      w.omega = 0;
      w.compression = 0;
    }
  }

  get forward_speed(): number {
    return this.vel.dot(forward.set(0, 0, 1).applyQuaternion(this.quat));
  }

  get heading(): number {
    const f = tmp.set(0, 0, 1).applyQuaternion(this.quat);
    return Math.atan2(f.x, f.z);
  }

  shift(by: number) {
    if (this.shifting > 0) return;
    const next = Math.max(-1, Math.min(this.spec.gears.length, this.gear + by));
    if (next === this.gear) return;
    this.gear = next;
    this.shifting = this.spec.shift_time;
  }

  private ratio(gear = this.gear): number {
    if (gear === -1) return -this.spec.reverse * this.spec.final;
    if (gear === 0) return 0;
    return this.spec.gears[gear - 1] * this.spec.final;
  }

  step(dt: number, input: Controls, ground: Ground) {
    const { pos, quat, vel, ang, spec } = this;
    const { radius, rest } = spec.wheel;
    up.set(0, 1, 0).applyQuaternion(quat);
    down.copy(up).negate();
    forward.set(0, 0, 1).applyQuaternion(quat);
    const vf = vel.dot(forward);
    const speed = vel.length();

    if (this.auto) {
      if (this.gear >= 1 && Math.abs(vf) < 1 && input.brake > 0.5 && input.throttle < 0.1) this.gear = -1;
      else if (this.gear === -1 && input.throttle > 0.5 && vf > -1) this.gear = 1;
    }
    const reversing = this.gear === -1 && this.auto;
    const pedal = reversing ? input.brake : input.throttle;
    const brake = reversing ? input.throttle : input.brake;
    const hold = pedal < 0.05 && brake < 0.05 && speed < 1 && this.gear !== 0;
    this.braking = brake;

    inv.copy(quat).invert();
    const local = tmp.copy(vel).applyQuaternion(inv);
    const slide = speed > 5 ? Math.atan2(-local.x, Math.abs(local.z)) : 0;
    // Assisted lock is the steer a grip-limited corner needs: kinematic L/R plus front-minus-rear slip, which is small
    // because body slip already loads the fronts. Past it the fronts go over peak, lose yaw damping and the car wallows.
    const grip_lock = (spec.wheelbase * GRAVITY * 1.05) / Math.max(1, speed * speed) + spec.peak_angle * 0.45;
    const lock = this.assist ? Math.min(spec.lock, grip_lock) : spec.lock / (1 + speed / 45);
    let target = input.steer * lock;
    if (this.assist && speed > 4 && local.z > 1) {
      const beta = Math.atan2(-local.x, local.z);
      target += Math.sign(beta) * Math.max(0, Math.abs(beta) - 0.1) * 0.8;
    }
    target = Math.max(-spec.lock, Math.min(spec.lock, target));
    const rate = input.analog ? 9 : Math.max(1.6, lock * 6) * (input.steer === 0 ? 1.6 : 1);
    this.steer += Math.max(-rate * dt, Math.min(rate * dt, target - this.steer));

    const driven = this.wheels.filter((w) => w.driven);
    const wheel_omega = driven.reduce((sum, w) => sum + w.omega, 0) / driven.length;
    const ratio = this.ratio();
    const wheel_rpm = Math.abs((wheel_omega * ratio * 60) / (2 * Math.PI));

    if (this.shifting > 0) this.shifting -= dt;
    if (this.auto && this.gear >= 1 && this.shifting <= 0) {
      if (wheel_rpm > spec.upshift && this.gear < spec.gears.length) this.shift(1);
      else {
        const road_rpm = Math.abs((vf / radius) * ratio * 60) / (2 * Math.PI);
        if (road_rpm < spec.downshift && this.gear > 1 && road_rpm * (spec.gears[this.gear - 2] / spec.gears[this.gear - 1]) < spec.upshift - 600) this.shift(-1);
      }
    }

    let max_slip = 0;
    for (const w of driven) max_slip = Math.max(max_slip, w.slip);
    if (this.tcs && pedal > 0.1 && max_slip > 0.14 && speed > 1) this.tcs_factor = Math.max(0.15, this.tcs_factor - 9 * dt);
    else this.tcs_factor = Math.min(1, this.tcs_factor + 2.5 * dt);
    const gas = pedal * (this.tcs ? this.tcs_factor : 1);
    this.throttle = gas;

    const launch = this.gear !== 0 ? spec.idle + gas * 2600 : spec.idle + gas * (spec.redline - spec.idle);
    const rpm = Math.max(wheel_rpm, launch);
    this.rpm += (rpm - this.rpm) * Math.min(1, dt * 30);
    let engine = 0;
    if (this.shifting <= 0 && this.gear !== 0) {
      const braking_torque = wheel_rpm > spec.idle ? (1 - gas) * (20 + rpm * 0.009) : 0;
      engine = rpm >= spec.redline ? -braking_torque : gas * torque_at(spec.torque, rpm) - braking_torque;
    }
    const drive = (engine * ratio * spec.driveline) / driven.length;
    const driven_inertia = 1.4 + (spec.engine_inertia * ratio * ratio) / driven.length;

    total_force.set(0, -GRAVITY * spec.mass, 0);
    total_torque.set(0, 0, 0);

    const reach = rest + radius;
    for (const w of this.wheels) {
      mount.copy(w.mount).applyQuaternion(quat).add(pos);
      const f = (t: number) => mount.y + down.y * t - ground.height(mount.x + down.x * t, mount.z + down.z * t);
      let t = reach;
      w.contact = false;
      if (f(reach) <= 0) {
        w.contact = true;
        if (f(0) <= 0) t = 0;
        else {
          let lo = 0;
          let hi = reach;
          for (let i = 0; i < 12; i++) {
            const mid = (lo + hi) / 2;
            if (f(mid) > 0) lo = mid;
            else hi = mid;
          }
          t = (lo + hi) / 2;
        }
      }
      const compression = reach - t;
      w.angle = w.front ? this.steer : 0;
      w.reach = t;
      w.load = 0;
      w.point.copy(mount).addScaledVector(down, t);
      w.prev = w.compression;
      w.compression = compression;
    }

    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      const prev = w.prev;
      const other = this.wheels[i ^ 1];
      const inertia = w.driven ? driven_inertia : 1.4;
      const torque = w.driven ? drive : 0;
      const brake_torque = brake * (w.front ? spec.brake_front : spec.brake_rear) * w.abs_factor + (w.front ? 0 : input.handbrake * spec.handbrake) + (hold ? spec.hold : 0);

      if (!w.contact) {
        let omega = w.omega + (dt * torque) / inertia;
        const cut = (dt * brake_torque) / inertia;
        omega -= Math.sign(omega) * Math.min(Math.abs(omega), cut);
        w.omega = omega * 0.999;
        w.spin += w.omega * dt;
        w.slip = 0;
        w.abs = false;
        w.abs_factor = 1;
        continue;
      }

      let suspension = spec.spring * w.compression + (spec.damper * (w.compression - prev)) / dt;
      suspension += (w.front ? spec.arb_front : spec.arb_rear) * (w.compression - other.compression);
      if (w.compression > rest) suspension += spec.bump * (w.compression - rest);
      suspension = Math.max(0, Math.min(40000, suspension));
      lever.copy(w.point).sub(pos);
      force.copy(up).multiplyScalar(suspension);
      total_force.add(force);
      total_torque.add(tmp2.crossVectors(lever, force));

      ground.normal(w.point.x, w.point.z, w.normal);
      const load = suspension * Math.max(0, up.dot(w.normal));
      w.load = load;

      steer_q.setFromAxisAngle(Y, -w.angle);
      wheel_fwd.set(0, 0, 1).applyQuaternion(steer_q).applyQuaternion(quat);
      wheel_fwd.addScaledVector(w.normal, -wheel_fwd.dot(w.normal)).normalize();
      lat.crossVectors(w.normal, wheel_fwd).normalize();

      point_vel.crossVectors(ang, lever).add(vel);
      const v_long = point_vel.dot(wheel_fwd);
      const v_lat = point_vel.dot(lat);
      const denom = Math.max(Math.abs(v_long), 2);
      const grip = ground.grip(w.point.x, w.point.z);
      const peak = spec.mu * (w.front ? 1 : spec.rear_grip) * grip * load * (1 - load / 32000);
      const sy = -Math.atan2(v_lat, denom) / spec.peak_angle;

      // Semi-implicit wheel spin: linearise the tyre's longitudinal force around the current slip so a stiff tyre
      // can't overshoot within one step; past the peak the slope clamps to 0 and wheelspin runs free.
      const sx0 = (w.omega * radius - v_long) / denom / spec.peak_slip;
      const fx0 = combined_x(sx0, sy) * peak;
      const k = Math.max(0, ((combined_x(sx0 + 1e-3, sy) * peak - fx0) / 1e-3) * (radius / (denom * spec.peak_slip)));
      const stiff = 1 + (dt * radius * k) / inertia;
      let omega = (w.omega + (dt / inertia) * (torque - radius * fx0 + radius * k * w.omega)) / stiff;
      const cut = (dt * brake_torque) / inertia / stiff;
      omega -= Math.sign(omega) * Math.min(Math.abs(omega), cut);
      w.omega = omega;
      w.spin += omega * dt;

      const sx = (omega * radius - v_long) / denom / spec.peak_slip;
      const fx = combined_x(sx, sy) * peak - v_long * spec.roll_resist * ground.roll(w.point.x, w.point.z);
      const fy = combined_y(sx, sy) * peak;
      w.slip = sx * spec.peak_slip;
      const locking = this.abs && brake > 0.1 && w.slip < -0.1 && Math.abs(v_long) > 2;
      w.abs_factor = locking ? Math.max(0.2, w.abs_factor - 25 * dt) : Math.min(1, w.abs_factor + 12 * dt);
      w.abs = w.abs_factor < 0.95;
      w.lateral = Math.abs(sy);

      force.copy(wheel_fwd).multiplyScalar(fx).addScaledVector(lat, fy);
      total_force.add(force);
      total_torque.add(tmp2.crossVectors(lever, force));
    }

    for (const corner of this.corners) {
      const p = mount.copy(corner).applyQuaternion(quat).add(pos);
      const depth = ground.height(p.x, p.z) - p.y;
      if (depth <= 0) continue;
      ground.normal(p.x, p.z, tmp);
      lever.copy(p).sub(pos);
      point_vel.crossVectors(ang, lever).add(vel);
      const vn = point_vel.dot(tmp);
      const normal_force = Math.max(0, 140000 * depth - 7000 * vn);
      force.copy(tmp).multiplyScalar(normal_force);
      point_vel.addScaledVector(tmp, -vn);
      const vt = point_vel.length();
      if (vt > 1e-4) force.addScaledVector(point_vel, -Math.min(0.6 * normal_force, vt * 4000) / vt);
      total_force.add(force);
      total_torque.add(tmp2.crossVectors(lever, force));
    }

    // Stability assist: damp only yaw that grows the slide, so a drift can be held and caught but not spun; the
    // handbrake bypasses it so slides can still be started on purpose.
    const excess = Math.abs(slide) - 0.2;
    if (this.assist && excess > 0 && input.handbrake < 0.1 && Math.sign(ang.y) === Math.sign(slide)) {
      total_torque.y -= ang.y * spec.inertia[1] * Math.min(1, excess * 6) * 3.5;
    }
    total_force.addScaledVector(vel, -spec.drag * speed);
    total_force.addScaledVector(up, -spec.downforce * vf * vf);

    vel.addScaledVector(total_force, dt / spec.mass);
    const body_torque = total_torque.applyQuaternion(inv);
    body_torque.set(body_torque.x / spec.inertia[0], body_torque.y / spec.inertia[1], body_torque.z / spec.inertia[2]).applyQuaternion(quat);
    ang.addScaledVector(body_torque, dt);
    pos.addScaledVector(vel, dt);

    const half = dt / 2;
    const { x, y, z, w } = quat;
    quat.set(
      x + half * (ang.x * w + ang.y * z - ang.z * y),
      y + half * (ang.y * w + ang.z * x - ang.x * z),
      z + half * (ang.z * w + ang.x * y - ang.y * x),
      w - half * (ang.x * x + ang.y * y + ang.z * z),
    );
    quat.normalize();
  }

  get scrub(): number {
    let most = 0;
    for (const w of this.wheels) {
      if (!w.contact) continue;
      most = Math.max(most, w.lateral - 0.9, Math.abs(w.slip) / this.spec.peak_slip - 1.2);
    }
    return Math.max(0, Math.min(1, most));
  }
}
