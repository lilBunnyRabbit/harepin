import { Quaternion, Vector3 } from "three";
import { COUPE, type CarSpec } from "./cars";
import { NITRO_TORQUE, Nitro } from "./nitro";

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
  nitro?: boolean;
}

/** How keyboard steering behaves on release: `snap` springs back to centre, `hold` leaves the wheel where it is and lets it self-centre as the car rolls. */
export const SteerMode = { SNAP: "snap", HOLD: "hold" } as const;
export type SteerMode = (typeof SteerMode)[keyof typeof SteerMode];

export const CAR_BODY = { mass: COUPE.mass, yaw_inertia: COUPE.inertia[1] };
const GRAVITY = 9.81;
const SPIN_SLIP = 0.15;
const TCS_SLIP = 0.14;
/** Below this speed (m/s) traction control works per wheel and per axle; faster, braking one side yaws the car. */
const TCS_LOW_SPEED = 15;
/** Weight of a driven rear's sideways slip in traction control's slip: at 1.4 it cuts in at 0.9 of the peak slip angle. */
const TCS_LATERAL = 1.4;
/** Front slip angle the steer assist allows, in `peak_angle`: past peak a tyre only scrubs speed. */
const USEFUL_SLIP = 1.1;
/** Speeds (m/s) where the useful-slip cap fades in and back out: below, parking keeps full lock; above, `grip_lock` rules. */
const USEFUL_SPEEDS = [3, 6, 12, 16] as const;
const STEER_RATE = 9;
const KEY_RAMP = 0.2;
const KEY_RAMP_MIN = 0.03;
const KEY_RAMP_SPEED = 30;
const KEY_RETURN = 2.5;
const HOLD_TIME = 0.4;
// Released, a held wheel centres over this many metres rolled: 0.5 s at 100 km/h, about 25 s of creeping at 2 km/h.
const HOLD_CENTRE_DISTANCE = 14;
// The slip model is viscous below its 2 m/s floor, so a locked wheel still creeps under any steady force (a slope);
// a pinned contact patch with a load-scaled spring and damper gives it real static friction.
const STICK_SPEED = 0.2;
const STICK_SPRING = 25;
const STICK_DAMPER = 2.2;
// Bearing drag on a wheel in the air, per second. It was 0.1% a step, 30% a second at 360 Hz, so after a long jump every
// wheel landed turning half the car's speed: past peak slip, with little lateral grip left.
const AIR_SPIN_DRAG = 0.02;
/** Load (N) at which the old load-sensitivity parabola fell to zero grip. */
const LOAD_FADE = 32000;

// Normalised magic formula: peak at s = 1, sliding grip sin(C·π/2) ≈ 65% of peak.
const MF_C = 1.55;
const MF_B = Math.tan(Math.PI / (2 * MF_C));

/** Suspension reach with the car parked on flat ground, for views that have no sim behind them. */
export function rest_reach(spec: CarSpec): number {
  return spec.wheel.rest + spec.wheel.radius - (spec.mass * GRAVITY) / (4 * spec.spring);
}

/** Height of the car origin above flat ground with the car parked at rest. */
export function ride_height(spec: CarSpec): number {
  return rest_reach(spec) - spec.wheel.mounts[0][1];
}

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
  /** Traction control's brake on this wheel, 0..1 of its drive torque. */
  tcs_brake = 0;
  /** Where a braked, stopped wheel's contact patch is pinned; static friction holds it there until it breaks away. */
  readonly anchor = new Vector3();
  anchored = false;
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
  /** Keyboard steer after the speed-scaled ramp, -1..1; follows the stick directly for analog input. */
  key_steer = 0;
  steer_mode: SteerMode = SteerMode.SNAP;
  /** Idle hold latched on: it keeps braking at any speed until a pedal or the wheel is touched. */
  parked = false;
  readonly nitro: Nitro;

  constructor(readonly spec: CarSpec = COUPE) {
    this.nitro = new Nitro(spec.nitro ?? 0);
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
    this.key_steer = 0;
    this.shifting = 0;
    for (const w of this.wheels) {
      w.omega = 0;
      w.compression = 0;
      w.anchored = false;
    }
    this.parked = false;
  }

  /** Sets the car at rest on the ground under (x, z) at its own ride height, so a swap or respawn neither drops nor stacks. */
  park(x: number, z: number, heading: number, ground: Ground) {
    const normal = ground.normal(x, z, tmp);
    this.place(x, ground.height(x, z), z, heading);
    this.quat.premultiply(steer_q.setFromUnitVectors(Y, normal));
    this.pos.addScaledVector(normal, ride_height(this.spec));
    // Start at static sag so the first step's damper sees no compression rate and the car does not bounce off the slope.
    const sag = (this.spec.mass * GRAVITY) / (4 * this.spec.spring);
    for (const w of this.wheels) w.compression = sag;
    this.parked = true;
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

  // Each front points at the rear-axle turn centre, so at full lock inner and outer stop fighting each other.
  private ackermann(w: Wheel): number {
    const steer = this.steer;
    if (Math.abs(steer) < 1e-4) return steer;
    const { wheelbase } = this.spec;
    const centre = wheelbase / Math.tan(Math.abs(steer));
    const half = Math.abs(w.mount.x);
    const inner = steer > 0 !== w.left;
    return Math.sign(steer) * Math.atan(wheelbase / (centre + (inner ? -half : half)));
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
    const idle_now = pedal < 0.05 && brake < 0.05 && this.gear !== 0;
    this.parked = idle_now && Math.abs(input.steer) < 0.05 && (this.parked || speed < 1);
    const hold = this.parked || (idle_now && speed < 1);
    this.braking = brake;

    inv.copy(quat).invert();
    const local = tmp.copy(vel).applyQuaternion(inv);
    const slide = speed > 5 ? Math.atan2(-local.x, Math.abs(local.z)) : 0;
    // Assisted lock is the steer a grip-limited corner needs: kinematic L/R plus front-minus-rear slip, which is small
    // because body slip already loads the fronts. Past it the fronts go over peak, lose yaw damping and the car wallows.
    const grip_lock = (spec.wheelbase * GRAVITY * 1.05) / Math.max(1, speed * speed) + spec.peak_angle * 0.45;
    const lock = this.assist ? Math.min(spec.lock, grip_lock) : spec.lock / (1 + speed / 45);
    // A key is full stick at once, which at speed makes every tap a full-lock flick; ramp it like a thumb would.
    if (input.analog) this.key_steer = input.steer;
    else if (this.steer_mode === SteerMode.HOLD) {
      // Hands off, the caster turns the wheel back only as the car rolls: parked it stays put, at speed it centres fast.
      if (input.steer === 0) {
        const step = (speed * dt) / HOLD_CENTRE_DISTANCE;
        this.key_steer -= Math.sign(this.key_steer) * Math.min(Math.abs(this.key_steer), step);
      } else {
        const step = ((input.steer * this.key_steer < 0 ? KEY_RETURN : 1) / HOLD_TIME) * dt;
        this.key_steer += Math.max(-step, Math.min(step, input.steer - this.key_steer));
      }
    } else {
      const full = KEY_RAMP * Math.min(1, speed / KEY_RAMP_SPEED) + KEY_RAMP_MIN;
      const back = input.steer === 0 || input.steer * this.key_steer < 0;
      const step = ((back ? KEY_RETURN : 1) / full) * dt;
      this.key_steer += Math.max(-step, Math.min(step, input.steer - this.key_steer));
    }
    let target = this.key_steer * lock;
    if (this.assist && speed > 4 && local.z > 1) {
      const beta = Math.atan2(-local.x, local.z);
      target += Math.sign(beta) * Math.max(0, Math.abs(beta) - 0.1) * 0.8;
    }
    if (this.assist && local.z > 1) {
      // Full lock at hairpin speed put the fronts at 20-27 degrees of slip, three times peak, and their scrub held the car
      // at walking pace under full throttle. Keep them within reach of peak around the way the front axle is moving.
      const course = Math.atan2(-(local.x + ang.dot(up) * spec.wheel.mounts[0][2]), local.z);
      const [on_from, on_to, off_from, off_to] = USEFUL_SPEEDS;
      const fade = Math.max((on_to - speed) / (on_to - on_from), (speed - off_from) / (off_to - off_from));
      const free = spec.lock * Math.max(0, Math.min(1, fade));
      const reach = USEFUL_SLIP * spec.peak_angle + free;
      target = Math.max(course - reach, Math.min(course + reach, target));
    }
    target = Math.max(-spec.lock, Math.min(spec.lock, target));
    // At speed the ramped key input moves slower than either limit; at parking speed this keeps the old keyboard feel.
    const rate = input.analog ? STEER_RATE : Math.max(1.6, lock * 6) * (input.steer === 0 ? 1.6 : 1);
    this.steer += Math.max(-rate * dt, Math.min(rate * dt, target - this.steer));

    const driven = this.wheels.filter((w) => w.driven);
    const wheel_omega = driven.reduce((sum, w) => sum + w.omega, 0) / driven.length;
    const ratio = this.ratio();
    const wheel_rpm = Math.abs((wheel_omega * ratio * 60) / (2 * Math.PI));

    if (this.shifting > 0) this.shifting -= dt;
    if (this.auto && this.gear >= 1 && this.shifting <= 0) {
      const road_rpm = Math.abs((vf / radius) * ratio * 60) / (2 * Math.PI);
      // Spinning wheels read as high rpm; upshifting on them, then downshifting on road speed, makes the box hunt.
      const spinning = driven.some((w) => w.slip > SPIN_SLIP) && road_rpm < spec.redline - 200;
      if (wheel_rpm > spec.upshift && this.gear < spec.gears.length) {
        if (!spinning) this.shift(1);
      } else if (road_rpm < spec.downshift && this.gear > 1 && road_rpm * (spec.gears[this.gear - 2] / spec.gears[this.gear - 1]) < spec.upshift - 600) this.shift(-1);
    }

    let max_slip = 0;
    let max_drag = 0;
    const acting = this.tcs && pedal > 0.1 && speed > 1;
    const low = acting && speed < TCS_LOW_SPEED;
    // A driven rear counts its sideways slip too, not wheelspin alone: in a tight turn it saturates sideways at a spin
    // traction control never saw, and full drive swung the tail in. A front's sideways slip is the steering's; cutting
    // power for it only stalls the car.
    const spin = (w: Wheel) => (low && w.contact && !w.front ? Math.hypot(Math.max(0, w.slip), w.lateral * spec.peak_slip * TCS_LATERAL) : w.slip);
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      if (!w.driven) continue;
      // An axle spins when both its wheels do; one spinning alone, like the unloaded inner wheel in a tight turn, is
      // braked instead, as a brake-based TCS does. Cutting the engine for it starved the loaded wheel and the car bogged.
      const other = this.wheels[i ^ 1];
      max_slip = Math.max(max_slip, low ? Math.min(spin(w), spin(other)) : spin(w));
      const lone = low && w.contact && w.slip > TCS_SLIP && other.slip <= TCS_SLIP;
      w.tcs_brake = lone ? Math.min(1, w.tcs_brake + 9 * dt) : Math.max(0, w.tcs_brake - 2.5 * dt);
      if (!w.contact) max_drag = Math.max(max_drag, -w.slip);
    }
    // On the ground some torque always gets through so a stuck car can still crawl out; in the air there is no grip to save.
    const floor = driven.every((w) => !w.contact) ? 0 : 0.15;
    if (acting && max_slip > TCS_SLIP) this.tcs_factor = Math.max(floor, this.tcs_factor - 9 * dt);
    else this.tcs_factor = Math.min(1, this.tcs_factor + 2.5 * dt);
    const gas = pedal * (this.tcs ? this.tcs_factor : 1);
    this.throttle = gas;

    const launch = this.gear !== 0 ? spec.idle + gas * 2600 : spec.idle + gas * (spec.redline - spec.idle);
    const rpm = Math.max(wheel_rpm, launch);
    const grounded = this.wheels.some((w) => w.contact);
    // First gear is grip-bound: boost there only spins the wheels, and spinning wheels hold the auto box off its upshift.
    // Mid-shift and on the limiter no torque reaches the wheels, so nothing burns either.
    const drives = this.gear >= 2 && this.shifting <= 0 && rpm < spec.redline;
    const boost = this.nitro.step(dt, !!input.nitro && drives && pedal > 0.1 && grounded, { slide, speed, airborne: !grounded });
    this.rpm += (rpm - this.rpm) * Math.min(1, dt * 30);
    let engine = 0;
    if (this.shifting <= 0 && this.gear !== 0) {
      // Engine braking resists the way the wheels turn; rolling back in a forward gear it must not push the car downhill.
      const coast = wheel_omega * ratio < 0 ? -1 : 1;
      // Drag control, traction control's mirror: in the air nothing holds the driven wheels to road speed, and engine
      // braking would drag them down towards idle so the car lands on them half locked.
      const dragging = max_drag > 0;
      const braking_torque = wheel_rpm > spec.idle && !dragging ? (1 - gas) * (20 + rpm * 0.009) * coast : 0;
      engine = rpm >= spec.redline ? -braking_torque : gas * torque_at(spec.torque, rpm) * (boost ? NITRO_TORQUE : 1) - braking_torque;
    }
    let drive_front = 0;
    let drive_rear = 0;
    if (spec.drive === "awd") {
      const total = engine * ratio * spec.driveline;
      const split = spec.awd_split ?? 0.5;
      drive_front = (total * split) / 2;
      drive_rear = (total * (1 - split)) / 2;
    } else if (spec.drive === "fwd") drive_front = (engine * ratio * spec.driveline) / driven.length;
    else drive_rear = (engine * ratio * spec.driveline) / driven.length;
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
      w.angle = w.front ? this.ackermann(w) : 0;
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
      const torque = w.driven ? (w.front ? drive_front : drive_rear) : 0;
      const brake_torque = brake * (w.front ? spec.brake_front : spec.brake_rear) * w.abs_factor + (w.front ? 0 : input.handbrake * spec.handbrake) + (hold ? spec.hold : 0) + w.tcs_brake * Math.abs(torque);

      if (!w.contact) {
        let omega = w.omega + (dt * torque) / inertia;
        const cut = (dt * brake_torque) / inertia;
        omega -= Math.sign(omega) * Math.min(Math.abs(omega), cut);
        w.omega = omega * (1 - AIR_SPIN_DRAG * dt);
        w.spin += w.omega * dt;
        // Wheel speed against the car's, as on the ground, so traction control still sees a wheel revving free in the
        // air; unchecked it lands spinning far past peak slip with no lateral grip left.
        w.slip = (w.omega * radius - vf) / Math.max(Math.abs(vf), 2);
        w.abs = false;
        w.abs_factor = 1;
        w.anchored = false;
        continue;
      }

      let suspension = spec.spring * w.compression + (spec.damper * (w.compression - prev)) / dt;
      suspension += (w.front ? spec.arb_front : spec.arb_rear) * (w.compression - other.compression);
      if (w.compression > rest) suspension += spec.bump * (w.compression - rest);
      suspension = Math.max(0, Math.min(40000, suspension));
      lever.copy(w.point).sub(pos);
      ground.normal(w.point.x, w.point.z, w.normal);
      const load = suspension * Math.max(0, up.dot(w.normal));
      w.load = load;
      // Along body up, a pitched body pushed itself sideways and a car in neutral rolled off on the flat.
      force.copy(w.normal).multiplyScalar(load);
      total_force.add(force);
      total_torque.add(tmp2.crossVectors(lever, force));

      steer_q.setFromAxisAngle(Y, -w.angle);
      wheel_fwd.set(0, 0, 1).applyQuaternion(steer_q).applyQuaternion(quat);
      wheel_fwd.addScaledVector(w.normal, -wheel_fwd.dot(w.normal)).normalize();
      lat.crossVectors(w.normal, wheel_fwd).normalize();

      point_vel.crossVectors(ang, lever).add(vel);
      const v_long = point_vel.dot(wheel_fwd);
      const v_lat = point_vel.dot(lat);
      const denom = Math.max(Math.abs(v_long), 2);
      const surface = ground.grip(w.point.x, w.point.z);
      const grip = surface + (1 - surface) * spec.offroad;
      // Tyre force grows ever slower with load and tops out at half LOAD_FADE; past that it stays flat. Left as a
      // parabola it fell to nothing at LOAD_FADE and reversed above it, which a hard landing reaches.
      const bite = Math.min(load, LOAD_FADE / 2);
      const peak = spec.mu * (w.front ? 1 : spec.rear_grip) * grip * bite * (1 - bite / LOAD_FADE);
      const sy = -Math.atan2(v_lat, denom) / spec.peak_angle;

      // Semi-implicit wheel spin: linearise the tyre's longitudinal force around the current slip so a stiff tyre
      // can't overshoot within one step; past the peak the slope clamps to 0 and wheelspin runs free.
      const sx0 = (w.omega * radius - v_long) / denom / spec.peak_slip;
      const peak_x = brake > 0.05 && sx0 * v_long < 0 ? peak * spec.brake_grip : peak;
      const fx0 = combined_x(sx0, sy) * peak_x;
      const k = Math.max(0, ((combined_x(sx0 + 1e-3, sy) * peak_x - fx0) / 1e-3) * (radius / (denom * spec.peak_slip)));
      const stiff = 1 + (dt * radius * k) / inertia;
      let omega = (w.omega + (dt / inertia) * (torque - radius * fx0 + radius * k * w.omega)) / stiff;
      const cut = (dt * brake_torque) / inertia / stiff;
      omega -= Math.sign(omega) * Math.min(Math.abs(omega), cut);
      w.omega = omega;
      w.spin += omega * dt;

      const sx = (omega * radius - v_long) / denom / spec.peak_slip;
      const roll = ground.roll(w.point.x, w.point.z);
      const rolling = v_long * spec.roll_resist;
      const fx = combined_x(sx, sy) * peak_x - rolling;
      const fy = combined_y(sx, sy) * peak;
      w.slip = sx * spec.peak_slip;
      const locking = this.abs && brake > 0.1 && w.slip < -0.1 && Math.abs(v_long) > 2;
      w.abs_factor = locking ? Math.max(0.2, w.abs_factor - 25 * dt) : Math.min(1, w.abs_factor + 12 * dt);
      w.abs = w.abs_factor < 0.95;
      w.lateral = Math.abs(sy);

      force.copy(wheel_fwd).multiplyScalar(fx).addScaledVector(lat, fy);
      const held = brake_torque > 0 && omega === 0;
      if (!held) w.anchored = false;
      else if (!w.anchored && Math.hypot(v_long, v_lat) < STICK_SPEED) {
        w.anchored = true;
        w.anchor.copy(w.point);
      }
      if (w.anchored) {
        tmp2.copy(w.point).sub(w.anchor);
        tmp2.addScaledVector(w.normal, -tmp2.dot(w.normal)).multiplyScalar(-STICK_SPRING * load);
        tmp2.addScaledVector(wheel_fwd, -v_long * STICK_DAMPER * load).addScaledVector(lat, -v_lat * STICK_DAMPER * load);
        if (tmp2.length() > peak) w.anchored = false;
        else force.copy(tmp2);
      }
      total_force.add(force);
      total_torque.add(tmp2.crossVectors(lever, force));
      // Grass drag acts at the centre of mass: at the contact patch it pitched load off the rear, and at full throttle on grass
      // the unloaded rear lost straight-line yaw stability, so the car circled while TCS cut the power.
      total_force.addScaledVector(wheel_fwd, -rolling * (roll - 1) * (1 - spec.offroad));
    }

    let airborne = this.wheels.every((w) => !w.contact);
    for (const corner of this.corners) {
      const p = mount.copy(corner).applyQuaternion(quat).add(pos);
      const depth = ground.height(p.x, p.z) - p.y;
      if (depth <= 0) continue;
      airborne = false;
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
      total_torque.y -= ang.y * spec.inertia[1] * Math.min(1, excess * 6) * 3.5 * spec.assist_yaw;
    }
    if (airborne && spec.air_settle > 0) {
      // Crests launch the car off whichever wheel leaves last, so it takes off spinning; bleed pitch and roll and level it
      // in the air so it lands on its wheels. Yaw is left alone so a slide carries through the jump.
      const level = tmp2.crossVectors(up, Y).multiplyScalar(spec.air_settle * spec.air_settle * 0.25);
      const yaw = up.dot(ang);
      tmp.copy(ang).addScaledVector(up, -yaw);
      ang.addScaledVector(tmp, -Math.min(1, spec.air_settle * dt)).addScaledVector(level, dt);
    }
    total_force.addScaledVector(vel, -spec.drag * speed);
    const lift = this.wheels.some((w) => w.contact) ? 1 : 1 - spec.ground_effect;
    total_force.addScaledVector(up, -spec.downforce * lift * vf * vf);

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
