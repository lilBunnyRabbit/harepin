import { Quaternion, Vector3 } from "three";
import { axle_index, axles_of, type Axle } from "./axles";
import { COUPE, type CarSpec } from "./cars";
import { curve_at } from "./curve";
import { NITRO_TORQUE, Nitro, type NitroSense } from "./nitro";
import { GRAVITY, RigidBody } from "./rigid-body";
import { SteerMode, Steering } from "./steering";
import { spin_free, suspend, tyre } from "./tyre";

export { SteerMode, grip_lock, unassisted_lock } from "./steering";
export { surface_grip } from "./tyre";

export interface Ground {
  /** `y`, when given, is the height the query comes from; a ground with stacked surfaces answers the one below it. */
  height(x: number, z: number, y?: number): number;
  normal(x: number, z: number, out: Vector3, y?: number): Vector3;
  grip(x: number, z: number): number;
  roll(x: number, z: number): number;
  /** How loose the surface is, 0 sealed road .. 1 sand: it widens the tyre curve and softens its fall past the peak. A ground without loose surfaces leaves it out. */
  loose?(x: number, z: number): number;
  /** On dirt or gravel, where a tyre's `grip_dirt` applies rather than `grip_grass`; a ground without it leaves it out. */
  dirt?(x: number, z: number): boolean;
}

export interface Controls {
  steer: number;
  throttle: number;
  brake: number;
  handbrake: number;
  analog: boolean;
  nitro?: boolean;
}

const SPIN_SLIP = 0.15;
const TCS_SLIP = 0.14;
/** Share over the downshift line the next gear must land at, past the coast the grade explains: loose ground drags more. */
const SHIFT_MARGIN = 0.02;
/** Wheel slip (locking) past which ABS eases the brake, on asphalt; loose ground scales it by `Wheel.peak`. */
const ABS_SLIP = 0.1;
/** Below this speed (m/s) traction control works per wheel and per axle; faster, braking one side yaws the car. */
const TCS_LOW_SPEED = 15;
/** Default `CarSpec.tcs_lateral`. Weight of a driven rear's sideways slip in traction control's slip: at 1.4 it cuts in at 0.9 of the peak slip angle. */
const TCS_LATERAL = 1.4;
/**
 * Wheelspin (in `peak_slip`) by which a driven wheel in a held drift outspins its pair before traction control brakes it,
 * as a limited-slip diff would. Open, the unloaded inner rear flared to the limiter and the loaded one, at a fifth of its
 * spin, barely pushed: a 50 km/h drift on full gas bled to 37 km/h in 5 s.
 */
const HOLD_SPLIT = 0.3;
/** Speed (m/s), about 30 km/h, under which `HOLD_SPLIT` stays off: a slide from rest pivots on the free-spinning inner rear. */
const SPLIT_SPEED = 8.5;
/** Traction control's slip in a launched power slide: about four times peak, enough wheelspin to break the rear loose. */
const DRIFT_TCS_SLIP = 0.5;
/**
 * Traction control's slip in a rear-drive launched slide, which holds its fronts on the course: at 0.5 it cut the gas to
 * a fifth through the slide and the car stalled to walking pace. All-wheel drive keeps 0.5: looser, its fronts spun too.
 */
const HELD_TCS_SLIP = 1.5;
/** Body slip (rad) over which the yaw damper comes back in a launched power slide, so it stays a drift and not a spin. */
const DRIFT_HOLD = [0.8, 1.2] as const;
/**
 * Default `CarSpec.drift_damp`. Rate (1/s) at which a held drift's slip angle stops swinging, FH's "yaw inertia" help, on full gas; lifting lets it go.
 * Without it the angle rang from straight to 50 degrees every 2.5 s on full gas, and a keyboard countersteer caught the
 * tail only to snap it straight.
 */
const DRIFT_DAMP = 4;
/**
 * Body slip (rad) over which `DRIFT_DAMP` comes in on a swing out to the drift's side, so the kick from rest still swings
 * the tail out at its old pace. Any other swing is damped at every angle: gated too, the catch snapped past straight.
 */
const DRIFT_DAMP_SLIP = [0.15, 0.35] as const;
/**
 * Default `CarSpec.drift_side_sx`. Wheelspin (in `peak_slip`) past which a held drift's rear tyres stop losing side grip to
 * it. On the full ellipse a rear spinning at 0.5 kept 60% of its side grip: with the key held into the turn the tail swung
 * from 25 to 37 degrees while the arc opened, and the car slid wide. Drive is left on the full ellipse, so the gas still
 * sets the spin and the angle. At 2 more gas could not swing the tail wider, and a held key into the turn barely tightened
 * the drift (lab round 1, "can't turn in more"); 4 lets the gas steer the tail again.
 */
const DRIFT_SIDE_SX = 4;
/**
 * Body slip (rad), about 15 to 30 degrees, over which `DRIFT_SIDE_SX` comes in. Under it the drift keeps the full ellipse:
 * applied at every angle, the rear gripped up out of a 20 degree drift. A launch keeps it too, so the kick still swings
 * round, and so does the steering assist, whose own countersteer holds the slide.
 */
const DRIFT_SIDE_SLIP = [0.26, 0.52] as const;
const DROP_CLEAR = 0.05;

// Each front points at the rear-axle turn centre, so at full lock inner and outer stop fighting each other.
/** Road wheel angle, radians, of the wheel mounted at `x` (positive on the left) for the car's `steer`. */
export function ackermann(steer: number, wheelbase: number, x: number): number {
  if (Math.abs(steer) < 1e-4) return steer;
  const centre = wheelbase / Math.tan(Math.abs(steer));
  const half = Math.abs(x);
  const inner = steer > 0 !== x > 0;
  return Math.sign(steer) * Math.atan(wheelbase / (centre + (inner ? -half : half)));
}

/** Suspension reach with the car parked on flat ground, for views that have no sim behind them. */
export function rest_reach(spec: CarSpec): number {
  return spec.wheel.rest + spec.wheel.radius - static_sag(spec);
}

function static_sag(spec: CarSpec): number {
  return (spec.mass * GRAVITY) / (spec.wheel.mounts.length * spec.spring);
}

/** Height of the car origin above flat ground with the car parked at rest. */
export function ride_height(spec: CarSpec): number {
  return rest_reach(spec) - spec.wheel.mounts[0][1];
}

/**
 * Height of the car origin above the ground to drop it from: `height`, sized for a car, or just over its own ride height
 * for a body that rides higher than that, so it never starts sunk into the road.
 */
export function drop_height(spec: CarSpec, height: number): number {
  return Math.max(height, ride_height(spec) + DROP_CLEAR);
}

export class Wheel {
  // Numbers start NaN and the constructor then sets them: V8 keeps the double slot a NaN gives, where a field begun as a
  // small integer reshapes every wheel on its first fraction (the first ABS stop, a lone wheel's TCS brake) and deopts the step.
  omega = NaN;
  spin = NaN;
  compression = NaN;
  prev = NaN;
  lateral = NaN;
  reach = NaN;
  contact = false;
  slip = NaN;
  angle = NaN;
  load = NaN;
  abs = false;
  abs_factor = NaN;
  /**
   * Slip at the peak of the tyre curve under this wheel, over asphalt's (1). ABS and traction control follow it: at
   * asphalt's slip the brake let go well short of the wider loose peak and stops on dirt ran long.
   */
  peak = NaN;
  /** Traction control's brake on this wheel, 0..1 of its drive torque. */
  tcs_brake = NaN;
  /** Where a braked, stopped wheel's contact patch is pinned; static friction holds it there until it breaks away. */
  readonly anchor = new Vector3();
  anchored = false;
  readonly point = new Vector3();
  readonly normal = new Vector3();
  readonly driven: boolean;

  constructor(
    readonly mount: Vector3,
    readonly axle: Axle,
    /** Index of the other wheel on this axle. */
    readonly pair: number,
    readonly left: boolean,
    spec: CarSpec,
  ) {
    this.driven = axle.drive_share > 0;
    this.reach = spec.wheel.rest + spec.wheel.radius;
    this.omega = 0;
    this.spin = 0;
    this.compression = 0;
    this.prev = 0;
    this.lateral = 0;
    this.slip = 0;
    this.angle = 0;
    this.load = 0;
    this.abs_factor = 1;
    this.peak = 1;
    this.tcs_brake = 0;
  }
}

const down = new Vector3();
const forward = new Vector3();
const mount = new Vector3();
const lever = new Vector3();
const point_vel = new Vector3();
const force = new Vector3();
const tmp = new Vector3();
const tmp2 = new Vector3();
const steer_q = new Quaternion();
const Y = new Vector3(0, 1, 0);

// A driven rear counts its sideways slip too, not wheelspin alone: in a tight turn it saturates sideways at a spin
// traction control never saw, and full drive swung the tail in. A front's sideways slip is the steering's; cutting
// power for it only stalls the car.
function tcs_spin(w: Wheel, low: boolean, peak_slip: number, lateral: number): number {
  const slip = tcs_slip(w, peak_slip);
  return low && w.contact && !w.axle.steer ? Math.hypot(Math.max(0, slip), w.lateral * peak_slip * lateral) : slip;
}

// Wheelspin past the peak of the curve under the wheel, in asphalt's terms: traction control allows the same slip past
// it on any ground. Scaled with the peak instead, as ABS is, a wide loose curve spun the rally car up and launched slower.
function tcs_slip(w: Wheel, peak_slip: number): number {
  return w.slip - peak_slip * (w.peak - 1);
}

function omega_sum(wheels: readonly Wheel[]): number {
  let sum = 0;
  for (let i = 0; i < wheels.length; i++) sum += wheels[i].omega;
  return sum;
}

function any_slipping(wheels: readonly Wheel[], slip: number): boolean {
  for (let i = 0; i < wheels.length; i++) if (wheels[i].slip > slip) return true;
  return false;
}

function any_contact(wheels: readonly Wheel[]): boolean {
  for (let i = 0; i < wheels.length; i++) if (wheels[i].contact) return true;
  return false;
}

/** Height of the ray from `mount` along `down`, `t` metres out, above the ground under it. */
function ray_gap(ground: Ground, t: number): number {
  const y = mount.y + down.y * t;
  return y - ground.height(mount.x + down.x * t, mount.z + down.z * t, y);
}

/** What one step's phases hand on to the later ones; each field is written before any later phase reads it. */
export interface StepFrame {
  /** The car's up axis in the world. */
  readonly up: Vector3;
  /** World to car frame. */
  readonly inv: Quaternion;
  speed: number;
  /** Velocity along the car's nose, m/s. */
  vf: number;
  /** Gas pedal, 0..1: the brake key while reversing on the auto box. */
  pedal: number;
  brake: number;
  hold: boolean;
  /** Body slip angle (rad), 0 under 5 m/s. */
  slide: number;
  beta: number;
  walking: number;
  power_slide: number;
  drift_steer: number;
  wheel_omega: number;
  /** Overall drive ratio of the gear the step started in. */
  ratio: number;
  wheel_rpm: number;
  gas: number;
  /** Torque at the driven wheels, N·m, shared out by axle. */
  drive: number;
  stock: number;
  side_cap: number;
  drift_bite: number;
}

/** The last solid the car touched, written in place by `World.collide` on every contact; read by the sparks. */
export class Scrape {
  /** Contacts so far: a reader holding a lower count knows one landed since it last looked. */
  hits = 0;
  /** Point on the solid's face, world metres, at the height of the car's centre. */
  x = NaN;
  y = NaN;
  z = NaN;
  /** Flat unit normal out of the solid. */
  nx = NaN;
  nz = NaN;
  /** Speed of the car's contact point along the face, m/s. */
  slide = NaN;
  /** Speed into the face before the push, m/s; 0 when already leaving it. */
  into = NaN;
}

export class Car {
  readonly body: RigidBody;
  readonly axles: Axle[];
  readonly wheels: Wheel[];
  private readonly driven: Wheel[];
  private readonly corners: Vector3[];
  private readonly sense: NitroSense = { slide: NaN, speed: NaN, airborne: false };
  // NaN, not 0: a field first set to a small integer changes the object's shape the first time it takes a fraction, and
  // every phase that reads it deopts. Left at 0, one late fraction deopted every phase 139 s into a test drive.
  private readonly frame: StepFrame = {
    up: new Vector3(),
    inv: new Quaternion(),
    speed: NaN,
    vf: NaN,
    pedal: NaN,
    brake: NaN,
    hold: false,
    slide: NaN,
    beta: NaN,
    walking: NaN,
    power_slide: NaN,
    drift_steer: NaN,
    wheel_omega: NaN,
    ratio: NaN,
    wheel_rpm: NaN,
    gas: NaN,
    drive: NaN,
    stock: NaN,
    side_cap: NaN,
    drift_bite: NaN,
  };

  gear = 1;
  auto = true;
  // NaN until the constructor sets them, as the frame's numbers are: begun as 0 or undefined, each reshaped the car or boxed every write.
  rpm = NaN;
  steer = NaN;
  shifting = NaN;
  tcs = true;
  abs = true;
  /** ABS's slip on asphalt; tests sweep it for the best fixed-slip stop. */
  abs_slip = ABS_SLIP;
  /** Steering assist: the grip-limited lock, the auto countersteer and the fronts held near their course. */
  assist = true;
  /** Stability (STM): the yaw damper that stops a slide growing into a spin. */
  stability = true;
  tcs_factor = NaN;
  braking = NaN;
  throttle = NaN;
  /** Keyboard steer after the speed-scaled ramp, -1..1; follows the stick directly for analog input. */
  key_steer = NaN;
  readonly steering: Steering;
  steer_mode: SteerMode = SteerMode.SNAP;
  /**
   * With the steering assist off, a slide opens full lock into the turn as well as against it, and a held drift past
   * walking pace bites: the fronts never scrub past their useful slip into the turn and the rears keep `DRIFT_REAR_BITE`.
   * Off (`?feel` only) is the old feel: the key into the turn stops at the grip-limited lock, 6-9 degrees in a 60-90 km/h drift.
   */
  drift_full_lock = true;
  /** Idle hold latched on: it keeps braking at any speed until a pedal or the wheel is touched. */
  parked = false;
  readonly nitro: Nitro;
  readonly scrape = new Scrape();

  constructor(readonly spec: CarSpec = COUPE) {
    this.body = new RigidBody(spec.mass, spec.inertia);
    this.nitro = new Nitro(spec.nitro ?? 0);
    this.axles = axles_of(spec);
    this.wheels = spec.wheel.mounts.map(([x, y, z], i) => {
      const axle = this.axles[axle_index(this.axles, i)];
      return new Wheel(new Vector3(x, y, z), axle, axle.wheels[0] === i ? axle.wheels[1] : axle.wheels[0], x > 0, spec);
    });
    this.steering = new Steering(this.axles.find((a) => a.steer)?.z ?? 0);
    this.driven = this.wheels.filter((w) => w.driven);
    this.corners = spec.corners.map(([x, y, z]) => new Vector3(x, y, z));
    this.rpm = spec.idle;
    this.steer = 0;
    this.shifting = 0;
    this.tcs_factor = 1;
    this.braking = 0;
    this.throttle = 0;
    this.key_steer = 0;
  }

  get pos(): Vector3 {
    return this.body.pos;
  }

  get quat(): Quaternion {
    return this.body.quat;
  }

  get vel(): Vector3 {
    return this.body.vel;
  }

  get ang(): Vector3 {
    return this.body.ang;
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
    this.steering.release_keys();
    this.forget_slide();
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
    const sag = static_sag(this.spec);
    for (const w of this.wheels) w.compression = sag;
    this.parked = true;
  }

  get forward_speed(): number {
    return this.vel.dot(forward.set(0, 0, 1).applyQuaternion(this.quat));
  }

  /** A power slide launched from rest is under way: traction control lets the rear spin up. */
  get launched(): boolean {
    return this.steering.launched;
  }

  /** Share of the held-drift helpers in play: all with TCS on, `CarSpec.drift_tcs_off` with it off. */
  get drift_aid(): number {
    return this.tcs ? 1 : (this.spec.drift_tcs_off ?? 0);
  }

  /** Drops the slide the driver was asking for, for a car put somewhere new or rewound. */
  forget_slide() {
    this.steering.forget_slide();
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

  private ackermann(w: Wheel): number {
    return ackermann(this.steer, this.spec.wheelbase, w.mount.x);
  }

  private ratio(gear = this.gear): number {
    if (gear === -1) return -this.spec.reverse * this.spec.final;
    if (gear === 0) return 0;
    return this.spec.gears[gear - 1] * this.spec.final;
  }

  // Split into phases because V8 deopts a whole function on its first time down a new branch: as one 430-line body the
  // step kept falling out of its top tier and boxed every float, 3 KB a step two minutes in. Phases run in the old order.
  step(dt: number, input: Controls, ground: Ground) {
    const { body, frame } = this;
    frame.up.set(0, 1, 0).applyQuaternion(body.quat);
    down.copy(frame.up).negate();
    forward.set(0, 0, 1).applyQuaternion(body.quat);
    frame.vf = body.vel.dot(forward);
    frame.speed = body.vel.length();

    this.pedals(input);
    this.steering.step(this, frame, dt, input);
    this.gearbox(dt);
    const max_drag = this.traction(dt);
    this.engine(dt, input, max_drag);
    body.force.y -= GRAVITY * this.spec.mass;
    this.cast_wheels(ground);
    this.wheel_forces(dt, input, ground);
    const on_wheels = any_contact(this.wheels);
    const airborne = this.hull(ground, !on_wheels);
    this.yaw_assist(input, on_wheels);
    this.aero(dt, airborne);
    body.integrate(dt);
  }

  private pedals(input: Controls) {
    const frame = this.frame;
    const { vf, speed } = frame;
    if (this.auto) {
      if (this.gear >= 1 && Math.abs(vf) < 1 && input.brake > 0.5 && input.throttle < 0.1) this.gear = -1;
      else if (this.gear === -1 && input.throttle > 0.5 && vf > -1) this.gear = 1;
    }
    const reversing = this.gear === -1 && this.auto;
    const pedal = reversing ? input.brake : input.throttle;
    const brake = reversing ? input.throttle : input.brake;
    const idle_now = pedal < 0.05 && brake < 0.05 && this.gear !== 0;
    this.parked = idle_now && Math.abs(input.steer) < 0.05 && (this.parked || speed < 1);
    frame.pedal = pedal;
    frame.brake = brake;
    frame.hold = this.parked || (idle_now && speed < 1);
    this.braking = brake;
  }

  private gearbox(dt: number) {
    const { spec, frame } = this;
    const { vf } = frame;
    const radius = spec.wheel.radius;
    const driven = this.driven;
    const wheel_omega = omega_sum(driven) / driven.length;
    const ratio = this.ratio();
    const wheel_rpm = Math.abs((wheel_omega * ratio * 60) / (2 * Math.PI));
    frame.wheel_omega = wheel_omega;
    frame.ratio = ratio;
    frame.wheel_rpm = wheel_rpm;

    if (this.shifting > 0) this.shifting -= dt;
    if (this.auto && this.gear >= 1 && this.shifting <= 0) {
      const road_rpm = Math.abs((vf / radius) * ratio * 60) / (2 * Math.PI);
      // Spinning wheels read as high rpm; upshifting on them, then downshifting on road speed, makes the box hunt.
      const spinning = any_slipping(driven, SPIN_SLIP) && road_rpm < spec.redline - 200;
      // The next gear judged where it lands: at road speed after the shift's coast up the grade. On wheel rpm, wheelspin
      // and the coast put the Sturm's 2nd, 9% over its downshift line, under it, and it hunted 1st-2nd up every dune.
      const landing = (Math.abs(vf - GRAVITY * forward.y * spec.shift_time) / radius) * Math.abs(this.ratio(this.gear + 1)) * (60 / (2 * Math.PI));
      // A slide spins the driven wheels far past road speed, and the engine turns with them: judged on road speed at a
      // big drift angle, the box dropped a gear and put the engine on the limiter.
      const turning = Math.max(road_rpm, wheel_rpm);
      if (wheel_rpm > spec.upshift && this.gear < spec.gears.length) {
        if (!spinning && landing >= spec.downshift * (1 + SHIFT_MARGIN)) this.shift(1);
      } else if (turning < spec.downshift && this.gear > 1 && turning * (spec.gears[this.gear - 2] / spec.gears[this.gear - 1]) < spec.upshift - 600) this.shift(-1);
    }
  }

  /** Traction control's cut on the gas and its brake on a lone spinning wheel; returns the most a wheel in the air drags. */
  private traction(dt: number): number {
    const { spec, frame } = this;
    const { pedal, speed, drift_steer } = frame;
    let max_slip = 0;
    let max_drag = 0;
    // From rest a rear-drive launch flared to 8-23x road speed before traction control woke at 1 m/s. All-wheel drive keeps
    // the old gate: caught from rest, the Raijin's gas-first launch never swung its tail and it climbed 32 degree sand.
    const acting = this.tcs && pedal > 0.1 && (speed > 1 || spec.drive === "rwd");
    const low = acting && speed < TCS_LOW_SPEED;
    // Launched from rest on full key and full gas, the driver asks for a power slide: the lateral term and the lone-wheel
    // brake exist to keep the tail in, and they cut the gas before it could step out.
    const sideways = low && !this.launched && drift_steer === 0;
    const split = !this.launched && !this.assist && drift_steer > 0 && speed > SPLIT_SPEED;
    const lateral = spec.tcs_lateral ?? TCS_LATERAL;
    const slip_limit = this.launched && drift_steer === 0 ? DRIFT_TCS_SLIP : TCS_SLIP + (HELD_TCS_SLIP - TCS_SLIP) * drift_steer;
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      if (!w.driven) continue;
      // An axle spins when both its wheels do; one spinning alone, like the unloaded inner wheel in a tight turn, is
      // braked instead, as a brake-based TCS does. Cutting the engine for it starved the loaded wheel and the car bogged.
      const other = this.wheels[w.pair];
      max_slip = Math.max(max_slip, low ? Math.min(tcs_spin(w, sideways, spec.peak_slip, lateral), tcs_spin(other, sideways, spec.peak_slip, lateral)) : tcs_spin(w, sideways, spec.peak_slip, lateral));
      const spin = tcs_slip(w, spec.peak_slip);
      const pair_spin = tcs_slip(other, spec.peak_slip);
      const lone = w.contact && ((sideways && spin > TCS_SLIP && pair_spin <= TCS_SLIP) || (split && spin > pair_spin + HOLD_SPLIT));
      w.tcs_brake = lone ? Math.min(1, w.tcs_brake + 9 * dt) : Math.max(0, w.tcs_brake - 2.5 * dt);
      if (!w.contact) max_drag = Math.max(max_drag, -w.slip);
    }
    // On the ground some torque always gets through so a stuck car can still crawl out; in the air there is no grip to save.
    const floor = any_contact(this.driven) ? 0.15 : 0;
    if (acting && max_slip > slip_limit) this.tcs_factor = Math.max(floor, this.tcs_factor - 9 * dt);
    else this.tcs_factor = Math.min(1, this.tcs_factor + 2.5 * dt);
    const gas = pedal * (this.tcs ? this.tcs_factor : 1);
    frame.gas = gas;
    this.throttle = gas;
    return max_drag;
  }

  private engine(dt: number, input: Controls, max_drag: number) {
    const { spec, frame } = this;
    const { gas, pedal, wheel_rpm, wheel_omega, ratio } = frame;
    const launch = this.gear !== 0 ? spec.idle + gas * spec.launch_rpm : spec.idle + gas * (spec.redline - spec.idle);
    const rpm = Math.max(wheel_rpm, launch);
    const grounded = any_contact(this.wheels);
    // First gear is grip-bound: boost there only spins the wheels, and spinning wheels hold the auto box off its upshift.
    // Mid-shift and on the limiter no torque reaches the wheels, so nothing burns either.
    const drives = this.gear >= 2 && this.shifting <= 0 && rpm < spec.redline;
    this.sense.slide = frame.slide;
    this.sense.speed = frame.speed;
    this.sense.airborne = !grounded;
    const boost = this.nitro.step(dt, !!input.nitro && drives && pedal > 0.1 && grounded, this.sense);
    this.rpm += (rpm - this.rpm) * Math.min(1, dt * 30);
    let engine = 0;
    if (this.shifting <= 0 && this.gear !== 0) {
      // Engine braking resists the way the wheels turn; rolling back in a forward gear it must not push the car downhill.
      const coast = wheel_omega * ratio < 0 ? -1 : 1;
      // Drag control, traction control's mirror: in the air nothing holds the driven wheels to road speed, and engine
      // braking would drag them down towards idle so the car lands on them half locked.
      const dragging = max_drag > 0;
      const braking_torque = wheel_rpm > spec.idle && !dragging ? (1 - gas) * (20 + rpm * 0.009) * coast : 0;
      engine = rpm >= spec.redline ? -braking_torque : gas * curve_at(spec.torque, rpm) * (boost ? NITRO_TORQUE : 1) - braking_torque;
    }
    frame.drive = engine * ratio * spec.driveline;
  }

  /** Casts each wheel's ray to the ground: contact, reach, contact point and compression. */
  private cast_wheels(ground: Ground) {
    const { spec, body } = this;
    const reach = spec.wheel.rest + spec.wheel.radius;
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      mount.copy(w.mount).applyQuaternion(body.quat).add(body.pos);
      let t = reach;
      w.contact = false;
      if (ray_gap(ground, reach) <= 0) {
        w.contact = true;
        if (ray_gap(ground, 0) <= 0) t = 0;
        else {
          let lo = 0;
          let hi = reach;
          for (let i = 0; i < 12; i++) {
            const mid = (lo + hi) / 2;
            if (ray_gap(ground, mid) > 0) lo = mid;
            else hi = mid;
          }
          t = (lo + hi) / 2;
        }
      }
      const compression = reach - t;
      w.angle = w.axle.steer ? this.ackermann(w) : 0;
      w.reach = t;
      w.load = 0;
      w.point.copy(mount).addScaledVector(down, t);
      w.prev = w.compression;
      w.compression = compression;
    }
  }

  private wheel_forces(dt: number, input: Controls, ground: Ground) {
    const { spec, frame } = this;
    const { ratio, drive, brake, hold, beta, drift_steer, walking } = frame;
    const driven_inertia = 1.4 + (spec.engine_inertia * ratio * ratio) / this.driven.length;
    // A tyre part's grip over stock tyres counts on asphalt only: off it the curve stays under the stock tyre's on the road.
    frame.stock = (spec.stock_mu ?? spec.mu) / spec.mu;
    const side_from = DRIFT_SIDE_SLIP[0];
    const side_to = DRIFT_SIDE_SLIP[1];
    const side_hold = this.launched || this.assist ? 0 : drift_steer * Math.max(0, Math.min(1, (Math.abs(beta) - side_from) / (side_to - side_from)));
    frame.side_cap = side_hold > 0 ? (spec.drift_side_sx ?? DRIFT_SIDE_SX) / side_hold : Infinity;
    // At walking pace the slide is a pivot on the rears' spin: gripped up there, a launch from rest held 1.6 s, not 5.
    frame.drift_bite = this.assist || !this.drift_full_lock ? 0 : drift_steer * (1 - walking);
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const axle = w.axle;
      const inertia = w.driven ? driven_inertia : 1.4;
      const torque = w.driven ? (drive * axle.drive_share) / axle.wheels.length : 0;
      const brake_torque = brake * axle.brake * w.abs_factor + (axle.handbrake ? input.handbrake * spec.handbrake : 0) + (hold ? spec.hold : 0) + w.tcs_brake * Math.abs(torque);
      if (!w.contact) spin_free(this, frame, w, dt, torque, brake_torque, inertia);
      else tyre(this, frame, w, dt, ground, torque, brake_torque, inertia, suspend(this, frame, w, dt, ground));
    }
  }

  /** Pushes the body out of the ground at each corner the hull sinks in at; returns whether the car is still in the air. */
  private hull(ground: Ground, airborne: boolean): boolean {
    const { spec, body } = this;
    const { pos, quat, vel, ang } = body;
    for (let i = 0; i < this.corners.length; i++) {
      const corner = this.corners[i];
      const p = mount.copy(corner).applyQuaternion(quat).add(pos);
      const depth = ground.height(p.x, p.z, p.y) - p.y;
      if (depth <= 0) continue;
      airborne = false;
      ground.normal(p.x, p.z, tmp, p.y);
      point_vel.crossVectors(ang, lever.copy(p).sub(pos)).add(vel);
      const vn = point_vel.dot(tmp);
      const normal_force = Math.max(0, spec.hull[0] * depth - spec.hull[1] * vn);
      force.copy(tmp).multiplyScalar(normal_force);
      point_vel.addScaledVector(tmp, -vn);
      const vt = point_vel.length();
      if (vt > 1e-4) force.addScaledVector(point_vel, -Math.min(0.6 * normal_force, vt * 4000) / vt);
      body.apply(force, p);
    }
    return airborne;
  }

  private yaw_assist(input: Controls, on_wheels: boolean) {
    const { spec, body, frame } = this;
    const { vel, ang } = body;
    const { speed, pedal, slide, beta, power_slide, drift_steer } = frame;
    // Stability assist: damp only yaw that grows the slide, so a drift can be held and caught but not spun; the
    // handbrake bypasses it so slides can still be started on purpose.
    // A launched slide past a drift's angle is a spin in the making: the momentum carried it round with the gas already cut.
    // That hold belongs to the launch, not to stability: without it a launch with stability off pirouetted the AWD cars.
    const hold_from = DRIFT_HOLD[0];
    const hold_to = DRIFT_HOLD[1];
    // With the steering assist off the held drift is the driver's, and stability gives way to it as to a launch: at speed it
    // damped the handbrake's slide away before the gas could hold it. The assist's own countersteer catches the rest.
    const held_drift = this.assist ? 0 : drift_steer;
    const drifting = this.launched || held_drift > 0;
    const catches = this.launched ? 1 : (spec.drift_catch ?? 1);
    const spinning = drifting ? catches * Math.max(0, Math.min(1, (Math.abs(beta) - hold_from) / (hold_to - hold_from))) : 0;
    const excess = Math.abs(slide) - 0.2;
    const damp = this.stability ? 1 - Math.max(power_slide, held_drift) * (1 - spinning) : spinning;
    if ((this.stability || spinning > 0) && excess > 0 && input.handbrake < 0.1 && Math.sign(ang.y) === Math.sign(slide)) {
      body.torque.y -= ang.y * spec.inertia[1] * Math.min(1, excess * 6) * 3.5 * spec.assist_yaw * damp;
    }
    // In the air, or on the body with no wheel down, there is no tyre slip angle to hold; damped in the air it cancelled the
    // yaw a slide carries over a jump.
    if (!this.assist && this.steering.hold_side !== 0 && this.drift_aid > 0 && spec.drive === "rwd" && speed > 1 && on_wheels) {
      // Yaw against the velocity's own turn rate is the slip angle changing; damping that, not yaw, leaves the arc alone.
      const swing = ang.y - tmp.crossVectors(vel, body.force).y / (spec.mass * speed * speed);
      const damp_from = DRIFT_DAMP_SLIP[0];
      const damp_to = DRIFT_DAMP_SLIP[1];
      const settle = Math.sign(swing) !== -this.steering.hold_side ? 1 : held_drift * Math.max(0, Math.min(1, (Math.abs(beta) - damp_from) / (damp_to - damp_from)));
      body.torque.y -= swing * spec.inertia[1] * (spec.drift_damp ?? DRIFT_DAMP) * Math.min(1, pedal) * settle * this.drift_aid;
    }
  }

  /** Levels the car in the air, then drag and downforce. */
  private aero(dt: number, airborne: boolean) {
    const { spec, body, frame } = this;
    const { vel, ang } = body;
    const { speed, vf, up } = frame;
    if (airborne && spec.air_settle > 0) {
      // Crests launch the car off whichever wheel leaves last, so it takes off spinning; bleed pitch and roll and level it
      // in the air so it lands on its wheels. Yaw is left alone so a slide carries through the jump.
      const level = tmp2.crossVectors(up, Y).multiplyScalar(spec.air_settle * spec.air_settle * 0.25);
      const yaw = up.dot(ang);
      tmp.copy(ang).addScaledVector(up, -yaw);
      ang.addScaledVector(tmp, -Math.min(1, spec.air_settle * dt)).addScaledVector(level, dt);
    }
    body.force.addScaledVector(vel, -spec.drag * speed);
    const lift = any_contact(this.wheels) ? 1 : 1 - spec.ground_effect;
    const press = spec.downforce * lift * vf * vf;
    body.force.addScaledVector(up, -press);
    // Downforce ahead of the centre of mass pitches the nose onto its springs, so the front tyres carry more of it.
    if (spec.aero_front) body.torque.add(tmp2.crossVectors(lever.copy(forward).multiplyScalar(spec.aero_front * spec.wheelbase), tmp.copy(up).multiplyScalar(-press)));
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
