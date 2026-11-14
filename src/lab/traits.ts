import { Quaternion, Vector3 } from "three";
import type { Car, Controls } from "../car/car";
import type { LabLane } from "../worldgen/lab";

const G = 9.81;
const KMH = 3.6;
const DEG = 180 / Math.PI;
const RING_MIN_SPEED = 20 / KMH;
const STEER_SIDE = 0.5;
/** The yaw after a steer step or reversal is read over this long, its value at the end taken as settled: 1 s read a step steer's still-falling yaw as settled and halved its overshoot. */
const YAW_WINDOW = 2;
const YAW_SETTLED = 0.05;
const YAW_MIN = 0.5;
const POWER_THROTTLE = 0.8;
const POWER_STEER = 0.3;
/**
 * Lift-off is a throttle drop from at least this to under `LIFT_TO` while cornering past `LIFT_G`. The plan says from
 * 0.5; a held cruise through a corner sits near 0.3, and a key lift is 1 to 0 either way.
 */
const LIFT_FROM = 0.25;
const LIFT_TO = 0.1;
const LIFT_G = 0.5;
const THROTTLE_WINDOW = 1.5;
const BRAKE_ON = 0.5;
const BRAKE_FROM = 30 / KMH;
const BRAKE_STRAIGHT = 0.1;
const STOPPED = 0.5 / KMH;
const TRAIL_BRAKE = 0.3;
const TRAIL_STEER = 0.2;
const ENTRY_FROM = (10 * Math.PI) / 180;
const ENTRY_TO = (25 * Math.PI) / 180;
const AIR_MIN = 0.2;
const LAND_WINDOW = 0.3;
const SEAM_WINDOW = 0.5;
/** The front axle's mean tyre peak (set from the ground row under it each step) moving this much is a surface seam. */
const SEAM_STEP = 1e-3;
const FAST = 200 / KMH;

const inverse = new Quaternion();
const spin = new Vector3();

export interface TraitMetrics {
  /** Mean yaw peak over its settled value after a steer step or reversal, minus 1. */
  yaw_over: number;
  /** Mean steer angle over the kinematic angle `wheelbase / R` on the ring band: above 1 pushes. */
  understeer: number;
  /** Peak slip, degrees, within 1.5 s of throttle past 0.8 with steer past 0.3. */
  power_slip: number;
  /** Peak slip, degrees, within 1.5 s of lifting mid corner. */
  lift_slip: number;
  /** Largest heading change, degrees, over a straight stop from 30 km/h. */
  brake_dev: number;
  /** Peak slip, degrees, braking past 0.3 with steer past 0.2. */
  trail_slip: number;
  /** Mean s from slip past 10° to past 25°. */
  entry: number;
  /** Peak pitch rate, rad/s, in the 0.3 s after a touchdown. */
  land_pitch: number;
  /** Peak slip, degrees, within 0.5 s of the ground row under the fronts changing. */
  seam_slip: number;
  /** Yaw-rate RMS, rad/s, and steer input RMS above 200 km/h. */
  yaw_sd: number;
  steer_sd: number;
}

/** The plan's per-trait folds (feel-lab-v2 4), stepped by `Recorder` after its own: scalars only, no allocation. */
export class TraitFold {
  private steer_side = 0;
  private yaw_at = NaN;
  private yaw_peak = 0;
  private yaw_low = 0;
  private prev_yaw = 0;
  private over_sum = 0;
  private over_n = 0;
  private us_sum = 0;
  private us_n = 0;
  private prev_throttle = 0;
  private power_at = NaN;
  private power_slip = NaN;
  private lift_at = NaN;
  private lift_slip = NaN;
  private brake_at = NaN;
  private brake_heading = 0;
  private brake_dev = NaN;
  private trail_slip = NaN;
  private entry_at = NaN;
  private entry_sum = 0;
  private entry_n = 0;
  private entered = false;
  private flying = 0;
  private land_at = NaN;
  private land_pitch = NaN;
  private seam_peak = NaN;
  private seam_at = NaN;
  private seam_slip = NaN;
  private fast_n = 0;
  private yaw_sq = 0;
  private steer_sq = 0;

  constructor(private readonly lane: LabLane) {}

  /** The car was put back: every open window closes unread, so a reset never counts as a stop, a landing or a seam. */
  placed() {
    this.steer_side = 0;
    this.yaw_at = NaN;
    this.prev_throttle = 0;
    this.power_at = NaN;
    this.lift_at = NaN;
    this.brake_at = NaN;
    this.entry_at = NaN;
    this.entered = false;
    this.flying = 0;
    this.land_at = NaN;
    this.seam_peak = NaN;
    this.seam_at = NaN;
  }

  private close_yaw(settled_yaw: number) {
    const settled = Math.abs(settled_yaw);
    if (settled > YAW_SETTLED) {
      this.over_sum += (settled_yaw > 0 ? this.yaw_peak : -this.yaw_low) / settled - 1;
      this.over_n++;
    }
    this.yaw_at = NaN;
  }

  step(t: number, dt: number, car: Car, input: Controls, speed: number, slip: number) {
    const yaw = car.ang.y;
    const slip_deg = slip * DEG;

    const side = input.steer > STEER_SIDE ? 1 : input.steer < -STEER_SIDE ? -1 : 0;
    if (side !== this.steer_side) {
      // A slalom reverses before the window ends: the sample closes on the yaw the old side held, when long enough to settle.
      if (!Number.isNaN(this.yaw_at) && t - this.yaw_at >= YAW_MIN) this.close_yaw(this.prev_yaw);
      this.yaw_at = side === 0 ? NaN : t;
      this.yaw_peak = 0;
      this.yaw_low = 0;
    }
    this.steer_side = side;
    if (!Number.isNaN(this.yaw_at)) {
      if (t - this.yaw_at < YAW_WINDOW) {
        this.yaw_peak = Math.max(this.yaw_peak, yaw);
        this.yaw_low = Math.min(this.yaw_low, yaw);
      } else this.close_yaw(yaw);
    }
    this.prev_yaw = yaw;

    const ring = this.lane.ring;
    if (ring && speed >= RING_MIN_SPEED && Math.abs(car.steer) > 1e-3 && Math.abs(Math.hypot(car.pos.x - ring.x, car.pos.z - ring.z) - ring.radius) <= ring.band) {
      this.us_sum += Math.abs(car.steer) / (car.spec.wheelbase / ring.radius);
      this.us_n++;
    }

    const lateral = Math.abs(yaw * speed) / G;
    if (input.throttle > POWER_THROTTLE && this.prev_throttle <= POWER_THROTTLE && Math.abs(input.steer) > POWER_STEER) this.power_at = t;
    if (input.throttle < LIFT_TO && this.prev_throttle >= LIFT_FROM && lateral > LIFT_G) this.lift_at = t;
    this.prev_throttle = input.throttle;
    if (t - this.power_at <= THROTTLE_WINDOW) this.power_slip = Number.isNaN(this.power_slip) ? slip_deg : Math.max(this.power_slip, slip_deg);
    if (t - this.lift_at <= THROTTLE_WINDOW) this.lift_slip = Number.isNaN(this.lift_slip) ? slip_deg : Math.max(this.lift_slip, slip_deg);

    const straight = Math.abs(input.steer) < BRAKE_STRAIGHT;
    if (input.brake > BRAKE_ON && straight && Number.isNaN(this.brake_at) && speed > BRAKE_FROM) {
      this.brake_at = t;
      this.brake_heading = car.heading;
    }
    if (!Number.isNaN(this.brake_at)) {
      if (!straight || (input.brake <= BRAKE_ON && speed > STOPPED)) this.brake_at = NaN;
      else if (speed < STOPPED) {
        const turned = Math.abs(((((car.heading - this.brake_heading) * DEG + 540) % 360) - 180));
        this.brake_dev = Number.isNaN(this.brake_dev) ? turned : Math.max(this.brake_dev, turned);
        this.brake_at = NaN;
      }
    }
    if (input.brake > TRAIL_BRAKE && Math.abs(input.steer) > TRAIL_STEER) this.trail_slip = Number.isNaN(this.trail_slip) ? slip_deg : Math.max(this.trail_slip, slip_deg);

    if (slip < ENTRY_FROM) {
      this.entry_at = NaN;
      this.entered = false;
    } else if (!this.entered) {
      if (Number.isNaN(this.entry_at)) this.entry_at = t;
      if (slip >= ENTRY_TO) {
        this.entry_sum += t - this.entry_at;
        this.entry_n++;
        this.entered = true;
      }
    }

    let touching = false;
    for (const w of car.wheels) touching ||= w.contact;
    if (!touching) this.flying += dt;
    else {
      if (this.flying >= AIR_MIN) this.land_at = t;
      this.flying = 0;
    }
    if (t - this.land_at <= LAND_WINDOW) {
      inverse.copy(car.quat).invert();
      const pitch = Math.abs(spin.copy(car.ang).applyQuaternion(inverse).x);
      this.land_pitch = Number.isNaN(this.land_pitch) ? pitch : Math.max(this.land_pitch, pitch);
    }

    const [left, right] = car.axles[0].wheels;
    const fl = car.wheels[left];
    const fr = car.wheels[right];
    if (fl.contact && fr.contact) {
      const peak = (fl.peak + fr.peak) / 2;
      if (!Number.isNaN(this.seam_peak) && Math.abs(peak - this.seam_peak) > SEAM_STEP) this.seam_at = t;
      this.seam_peak = peak;
    }
    if (t - this.seam_at <= SEAM_WINDOW) this.seam_slip = Number.isNaN(this.seam_slip) ? slip_deg : Math.max(this.seam_slip, slip_deg);

    if (speed > FAST) {
      this.fast_n++;
      this.yaw_sq += yaw * yaw;
      this.steer_sq += input.steer * input.steer;
    }
  }

  metrics(): TraitMetrics {
    const mean = (sum: number, n: number) => (n > 0 ? sum / n : NaN);
    return {
      yaw_over: mean(this.over_sum, this.over_n),
      understeer: mean(this.us_sum, this.us_n),
      power_slip: this.power_slip,
      lift_slip: this.lift_slip,
      brake_dev: this.brake_dev,
      trail_slip: this.trail_slip,
      entry: mean(this.entry_sum, this.entry_n),
      land_pitch: this.land_pitch,
      seam_slip: this.seam_slip,
      yaw_sd: Math.sqrt(mean(this.yaw_sq, this.fast_n)),
      steer_sd: Math.sqrt(mean(this.steer_sq, this.fast_n)),
    };
  }
}
