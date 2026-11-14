import { Quaternion, Vector3 } from "three";
import type { Car, Controls } from "../car/car";
import { MAX_ANGLE, MIN_ANGLE, MIN_SPEED, SPIN_ANGLE } from "../modes/drift";
import type { LabGate, LabLane } from "../worldgen/lab";
import type { Goal } from "./pack";
import { TraitFold, type TraitMetrics } from "./traits";

const G = 9.81;
const KMH = 3.6;
/** Lateral g only counts on the ring above this, as in `scripts/telemetry.ts`' skidpad. */
const RING_MIN_SPEED = 20 / KMH;
/** A slide caught: from past `CATCH_FROM` back under `CATCH_TO` with the yaw settled, as in `scripts/drift.ts`' catch. */
const CATCH_FROM = (15 * Math.PI) / 180;
const CATCH_TO = (5 * Math.PI) / 180;
const CATCH_YAW = 0.05;
/** A driven wheel turning this much faster than the ground goes counts as spinning (`scripts/surfaces.ts`' launch rows). */
const SPIN_RATIO = 1.15;
const FULL = 0.95;
const STEER_REVERSE = 0.5;
const OFF_TIME = 0.5;
/** Airborne this long counts as a jump; airborne again this soon after landing counts a bounce. */
const AIR_MIN = 0.2;
const BOUNCE_WINDOW = 0.5;
const STOP_FROM = 30 / KMH;
const STOPPED = 0.5 / KMH;
export const MAX_LAPS = 32;
const DEG = 180 / Math.PI;

const local = new Vector3();
const inverse = new Quaternion();
const up = new Vector3();

/** Everything a trial measured; NaN where the trial never measured it. Distances m, times s, speeds km/h, angles degrees. */
export interface Metrics extends TraitMetrics {
  time: number;
  laps: number[];
  segment: number;
  lat_peak: number;
  lat_mean: number;
  ring_kmh: number;
  slip_peak: number;
  slip_mean: number;
  held: number;
  chain: number;
  spins: number;
  yaw_lag: number;
  recovery: number;
  to_100: number;
  stop_m: number;
  stop_from: number;
  top_kmh: number;
  wheelspin: number;
  spin_peak: number;
  air: number;
  landing: number;
  bounces: number;
  offs: number;
  resets: number;
  lock: number;
  throttle: number;
  handbrake: number;
  reversals: number;
}

/**
 * Folds a trial's numbers from the car, one physics step at a time. `step` runs at 360 Hz inside the sim loop: it only
 * writes preallocated fields, so it allocates nothing.
 */
export class Recorder {
  private t = 0;
  private moving = false;
  private readonly lap_times = new Float64Array(MAX_LAPS);
  private lap_count = 0;
  private wind = 0;
  private last_angle = 0;
  private lap_start = 0;
  private prev_x = 0;
  private prev_z = 0;
  private seg_start = NaN;
  private seg_time = NaN;
  private ring_t = 0;
  private lat_sum = 0;
  private lat_peak = 0;
  private ring_speed = 0;
  private slip_peak = 0;
  private slip_sum = 0;
  private slip_t = 0;
  private held = 0;
  private chain = 0;
  private chain_best = 0;
  private spins = 0;
  private spun = false;
  private steer_side = 0;
  private reversed_at = NaN;
  private lag_sum = 0;
  private lag_count = 0;
  private slide_at = NaN;
  private catch_sum = 0;
  private catch_count = 0;
  private launch_at = NaN;
  private to_100 = NaN;
  private stop_at = NaN;
  private stop_speed = 0;
  private stop_x = 0;
  private stop_z = 0;
  private stop_m = NaN;
  private stop_from = NaN;
  private top = 0;
  private wheelspin_t = 0;
  private drive_t = 0;
  private spin_peak = 0;
  private flying = 0;
  private air = 0;
  private landed_at = -Infinity;
  private landing = NaN;
  private bounces = 0;
  private off_t = 0;
  private offs = 0;
  private resets = 0;
  private lock_t = 0;
  private throttle_t = 0;
  private handbrake_t = 0;
  private reversals = 0;
  private finished = false;
  private lat_now = 0;
  private slip_now = 0;
  private readonly traits: TraitFold;

  constructor(
    private readonly lane: LabLane,
    private readonly goal: Goal,
  ) {
    this.traits = new TraitFold(lane);
  }

  /** The car was put back (reset, rewind, lava): counted, and the gates and winding start over from where it stands. */
  placed(car: Car) {
    if (this.moving) this.resets++;
    this.prev_x = car.pos.x;
    this.prev_z = car.pos.z;
    this.last_angle = this.angle(car.pos.x, car.pos.z);
  }

  get started(): boolean {
    return this.moving;
  }

  get done(): boolean {
    return this.finished;
  }

  /** Seconds driven since the first throttle. */
  get time(): number {
    return this.t;
  }

  get laps(): number {
    return this.lap_count;
  }

  /** Gates crossed so far: the start, then the finish. */
  get gates(): number {
    return Number.isNaN(this.seg_time) ? (Number.isNaN(this.seg_start) ? 0 : 1) : 2;
  }

  /** Lateral g this step, anywhere on the lane. */
  get lateral(): number {
    return this.lat_now;
  }

  /** Body slip this step, degrees. */
  get slip(): number {
    return this.slip_now;
  }

  step(dt: number, car: Car, input: Controls) {
    const { pos, vel, ang } = car;
    const speed = Math.hypot(vel.x, vel.z);
    if (!this.moving) {
      if (input.throttle <= 0 && speed < 0.5) {
        this.prev_x = pos.x;
        this.prev_z = pos.z;
        this.last_angle = this.angle(pos.x, pos.z);
        return;
      }
      this.moving = true;
      this.launch_at = speed < 1 ? 0 : NaN;
    }
    this.t += dt;
    const t = this.t;
    const forward = car.forward_speed;
    this.top = Math.max(this.top, forward);
    if (!Number.isNaN(this.launch_at) && Number.isNaN(this.to_100) && forward * KMH >= 100) this.to_100 = t - this.launch_at;

    this.lat_now = Math.abs(ang.y * speed) / G;
    this.ring(t, pos.x, pos.z, speed, ang.y);
    this.cross(t, pos.x, pos.z);
    this.prev_x = pos.x;
    this.prev_z = pos.z;

    inverse.copy(car.quat).invert();
    local.copy(vel).applyQuaternion(inverse);
    const slip = speed > 2 ? Math.abs(Math.atan2(-local.x, local.z)) : 0;
    this.slip_now = slip * DEG;
    this.slip_peak = Math.max(this.slip_peak, slip);
    const drifting = speed > MIN_SPEED && slip >= MIN_ANGLE && slip <= MAX_ANGLE;
    if (slip >= MIN_ANGLE) {
      this.slip_sum += slip * dt;
      this.slip_t += dt;
    }
    if (drifting) {
      this.held += dt;
      this.chain += dt;
      this.chain_best = Math.max(this.chain_best, this.chain);
    } else this.chain = 0;
    this.traits.step(t, dt, car, input, speed, slip);
    if (slip > SPIN_ANGLE && !this.spun) this.spins++;
    this.spun = slip > SPIN_ANGLE;
    if (slip > CATCH_FROM && Number.isNaN(this.slide_at)) this.slide_at = t;
    if (!Number.isNaN(this.slide_at) && slip < CATCH_TO && Math.abs(ang.y) < CATCH_YAW) {
      this.catch_sum += t - this.slide_at;
      this.catch_count++;
      this.slide_at = NaN;
    }

    const side = input.steer > STEER_REVERSE ? 1 : input.steer < -STEER_REVERSE ? -1 : 0;
    if (side !== 0 && side === -this.steer_side) {
      this.reversals++;
      this.reversed_at = t;
    }
    if (side !== 0) this.steer_side = side;
    // Yaw lag: from a steer reversal to the yaw rate turning the way the wheel now points (+steer turns +yaw).
    if (!Number.isNaN(this.reversed_at) && Math.sign(ang.y) === this.steer_side) {
      this.lag_sum += t - this.reversed_at;
      this.lag_count++;
      this.reversed_at = NaN;
    }

    if (input.brake > 0.5 && Number.isNaN(this.stop_at) && speed > STOP_FROM) {
      this.stop_at = t;
      this.stop_speed = speed;
      this.stop_x = pos.x;
      this.stop_z = pos.z;
    }
    if (!Number.isNaN(this.stop_at)) {
      if (input.brake <= 0.5 && speed > STOPPED) this.stop_at = NaN;
      else if (speed < STOPPED) {
        this.stop_m = Math.hypot(pos.x - this.stop_x, pos.z - this.stop_z);
        this.stop_from = this.stop_speed * KMH;
        this.stop_at = NaN;
      }
    }

    let touching = false;
    let spinning = 0;
    const radius = car.spec.wheel.radius;
    for (const w of car.wheels) {
      touching ||= w.contact;
      if (w.driven && w.contact) spinning = Math.max(spinning, Math.abs(w.omega) * radius / Math.max(speed, 1));
    }
    if (input.throttle > 0.1) {
      this.drive_t += dt;
      if (spinning > SPIN_RATIO) this.wheelspin_t += dt;
      this.spin_peak = Math.max(this.spin_peak, spinning);
    }
    if (!touching) this.flying += dt;
    else {
      if (this.flying >= AIR_MIN) {
        this.air += this.flying;
        if (t - this.flying - this.landed_at < BOUNCE_WINDOW) this.bounces++;
        this.landing = Number.isNaN(this.landing) ? this.upright(car) : Math.min(this.landing, this.upright(car));
        this.landed_at = t;
      }
      this.flying = 0;
    }

    this.off_t = this.on_lane(pos.x, pos.z) ? 0 : this.off_t + dt;
    if (this.off_t >= OFF_TIME && this.off_t - dt < OFF_TIME) this.offs++;
    if (Math.abs(input.steer) > FULL) this.lock_t += dt;
    if (input.throttle > FULL) this.throttle_t += dt;
    if (input.handbrake > 0.5) this.handbrake_t += dt;
    this.finished ||= this.goal_met();
  }

  private upright(car: Car): number {
    return up.set(0, 1, 0).applyQuaternion(car.quat).y;
  }

  private angle(x: number, z: number): number {
    const ring = this.lane.ring;
    return ring ? Math.atan2(z - ring.z, x - ring.x) : 0;
  }

  private ring(t: number, x: number, z: number, speed: number, yaw: number) {
    const ring = this.lane.ring;
    if (!ring) return;
    const angle = this.angle(x, z);
    let d = angle - this.last_angle;
    if (d > Math.PI) d -= 2 * Math.PI;
    else if (d < -Math.PI) d += 2 * Math.PI;
    this.last_angle = angle;
    this.wind += d;
    if (Math.abs(this.wind) >= 2 * Math.PI) {
      this.wind -= Math.sign(this.wind) * 2 * Math.PI;
      if (this.lap_count < MAX_LAPS) this.lap_times[this.lap_count] = t - this.lap_start;
      this.lap_count++;
      this.lap_start = t;
    }
    const off = Math.abs(Math.hypot(x - ring.x, z - ring.z) - ring.radius);
    if (off > ring.band || speed < RING_MIN_SPEED) return;
    const lateral = Math.abs(yaw * speed) / G;
    this.lat_peak = Math.max(this.lat_peak, lateral);
    this.lat_sum += lateral;
    this.ring_speed += speed;
    this.ring_t++;
  }

  private cross(t: number, x: number, z: number) {
    const { start, finish } = this.lane;
    if (start && Number.isNaN(this.seg_time) && this.crossed(start, x, z)) this.seg_start = t;
    if (finish && !Number.isNaN(this.seg_start) && Number.isNaN(this.seg_time) && this.crossed(finish, x, z)) this.seg_time = t - this.seg_start;
  }

  private crossed(gate: LabGate, x: number, z: number): boolean {
    const before = (this.prev_x - gate.x) * gate.fx + (this.prev_z - gate.z) * gate.fz;
    const after = (x - gate.x) * gate.fx + (z - gate.z) * gate.fz;
    const across = Math.abs((x - gate.x) * gate.fz - (z - gate.z) * gate.fx);
    return before < 0 && after >= 0 && across <= gate.hw;
  }

  private on_lane(x: number, z: number): boolean {
    const { ring, path } = this.lane;
    if (path) {
      const { points, half } = path;
      for (let s = 0; s < points.length - 1; s++) {
        const [ax, az] = points[s];
        const [bx, bz] = points[s + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        if (Math.hypot(x - ax - dx * k, z - az - dz * k) <= half) return true;
      }
      return false;
    }
    if (ring) return Math.abs(Math.hypot(x - ring.x, z - ring.z) - ring.radius) <= ring.band;
    return true;
  }

  private goal_met(): boolean {
    const goal = this.goal;
    if (goal.kind === "laps") return this.lap_count >= goal.laps;
    if (goal.kind === "time") return this.t >= goal.seconds;
    if (goal.kind === "stop") return this.stop_from >= goal.from_kmh * 0.9;
    if (goal.kind === "run") return !Number.isNaN(this.seg_time);
    return false;
  }

  metrics(): Metrics {
    const share = (part: number) => (this.t > 0 ? part / this.t : NaN);
    const mean = (sum: number, n: number) => (n > 0 ? sum / n : NaN);
    return {
      time: this.t,
      laps: Array.from(this.lap_times.subarray(0, Math.min(this.lap_count, MAX_LAPS))),
      segment: this.seg_time,
      lat_peak: this.ring_t ? this.lat_peak : NaN,
      lat_mean: mean(this.lat_sum, this.ring_t),
      ring_kmh: mean(this.ring_speed * KMH, this.ring_t),
      slip_peak: this.slip_peak * DEG,
      slip_mean: mean(this.slip_sum * DEG, this.slip_t),
      held: this.held,
      chain: this.chain_best,
      spins: this.spins,
      yaw_lag: mean(this.lag_sum, this.lag_count),
      recovery: mean(this.catch_sum, this.catch_count),
      to_100: this.to_100,
      stop_m: this.stop_m,
      stop_from: this.stop_from,
      top_kmh: this.top * KMH,
      wheelspin: this.drive_t > 0 ? this.wheelspin_t / this.drive_t : NaN,
      spin_peak: this.spin_peak,
      air: this.air,
      landing: this.landing,
      bounces: this.bounces,
      offs: this.offs,
      resets: this.resets,
      lock: share(this.lock_t),
      throttle: share(this.throttle_t),
      handbrake: share(this.handbrake_t),
      reversals: share(this.reversals),
      ...this.traits.metrics(),
    };
  }
}
