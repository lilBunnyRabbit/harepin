import { Quaternion, Vector3 } from "three";
import { axle_index, axles_of, type Axle } from "./axles";
import { COUPE, type CarSpec } from "./cars";
import { NITRO_TORQUE, Nitro, type NitroSense } from "./nitro";
import { RigidBody } from "./rigid-body";

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

/**
 * How keyboard steering behaves: `snap` ramps to full lock and springs back to centre, `hold` leaves the wheel where it
 * is and lets it self-centre as the car rolls, `smooth` asks for a share of the grip-limited turn rate that a tap nudges
 * and a held key builds.
 */
export const SteerMode = { SNAP: "snap", HOLD: "hold", SMOOTH: "smooth" } as const;
export type SteerMode = (typeof SteerMode)[keyof typeof SteerMode];

export const CAR_BODY = { mass: COUPE.mass, yaw_inertia: COUPE.inertia[1] };
const GRAVITY = 9.81;
const SPIN_SLIP = 0.15;
const TCS_SLIP = 0.14;
/** Wheel slip (locking) past which ABS eases the brake, on asphalt; loose ground scales it by `Wheel.peak`. */
const ABS_SLIP = 0.1;
/** Below this speed (m/s) traction control works per wheel and per axle; faster, braking one side yaws the car. */
const TCS_LOW_SPEED = 15;
/** Weight of a driven rear's sideways slip in traction control's slip: at 1.4 it cuts in at 0.9 of the peak slip angle. */
const TCS_LATERAL = 1.4;
/** Power-slide intent (walking pace × gas × held key) past which a launch may spin up the rear and swing the tail out. */
const DRIFT_INTENT = 0.9;
/**
 * Speed (m/s), about 30 km/h, under which a handbrake tap at full lock kicks a power slide while rolling. Faster, the tap
 * and full gas hold the slide the handbrake threw rather than launch one, so the gas still can't kick a slow corner.
 */
const DRIFT_START = 8.5;
/** Seconds after a rolling handbrake tap in which full gas and full lock still launch, so the gas may follow the tap. */
const TAP_WINDOW = 0.6;
/** Body slip (rad) against the key over which a launched slide's hold fades out once the launch has ended. */
const HOLD_FADE = [0.03, 0.15] as const;
/** Seconds after leaving rest on the gas that full key still counts as a launch, so the gas may go down first. */
const LAUNCH_WINDOW = 0.75;
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
 * Rate (1/s) at which a held drift's slip angle stops swinging, FH's "yaw inertia" help, on full gas; lifting lets it go.
 * Without it the angle rang from straight to 50 degrees every 2.5 s on full gas, and a keyboard countersteer caught the
 * tail only to snap it straight.
 */
const DRIFT_DAMP = 4;
/**
 * Body slip (rad) over which `DRIFT_DAMP` comes in on a swing out to the drift's side, so the kick from rest still swings
 * the tail out at its old pace. Any other swing is damped at every angle: gated too, the catch snapped past straight.
 */
const DRIFT_DAMP_SLIP = [0.15, 0.35] as const;
/** Yaw rate (rad/s) under which a caught drift lets go once the tail is in: dropped at straight, it swung on into a spin. */
const DRIFT_CALM = 0.3;
/**
 * Seconds the stick sits under `LET_GO_STEER` before a held drift ends, the FH way: let go and the car straightens. Short
 * enough that a real let-go reads at once, long enough that keyboard taps through centre mid-drift keep it.
 */
const LET_GO_TIME = 0.3;
const LET_GO_STEER = 0.3;
/** Front slip angle the steer assist allows, in `peak_angle`: past peak a tyre only scrubs speed. */
const USEFUL_SLIP = 1.1;
/**
 * Front slip angle past the front axle's course in a launched power slide, in `peak_angle`. At full lock the fronts
 * pulled the car round a 3 m circle whose scrub held it near 10 km/h; at `USEFUL_SLIP` they still did below 20 km/h.
 */
const DRIFT_REACH = 0.6;
/**
 * Front slip a held full key reaches past `grip_lock` at speed, in `peak_angle`: with the fronts held just under peak a
 * full key felt stiff at 100-150 km/h. A little past peak turns tighter into a catchable push rather than a wall.
 */
const FULL_KEY_REACH = 0.15;
/** Speeds (m/s) over which `FULL_KEY_REACH` opens, 90 to 150 km/h: below, power slides and donuts keep their lock. */
const FULL_KEY_SPEEDS = [25, 41.7] as const;
/** Speeds (m/s) where the useful-slip cap fades in and back out: below, parking keeps full lock; above, `grip_lock` rules. */
const USEFUL_SPEEDS = [3, 6, 12, 16] as const;
/** Body slip (rad) with the tail out against the held steer at which a power slide counts in full. */
const SLIDE_OUT = 0.1;
/** Speeds (m/s) over which a power slide stops counting: the slide assists keep catching the car above them. */
const SLIDE_SPEEDS = [12, 16] as const;
/** Body slip (rad) against the held steer over which an unassisted countersteer blends to full lock. */
const COUNTER_SLIP = [0.1, 0.2] as const;
const STEER_RATE = 9;
const KEY_RAMP = 0.2;
const KEY_RAMP_MIN = 0.03;
const KEY_RAMP_SPEED = 30;
const KEY_RETURN = 2.5;
const HOLD_TIME = 0.4;
/** A keyboard steer filter: the key is a virtual stick that moves at these rates. */
interface KeyProfile {
  /** Seconds from the tap share to full key, linear, by speed (km/h) with linear steps between rows. */
  attack: readonly (readonly [kmh: number, s: number])[];
  /** Seconds from full key back to none once it is let go, by speed (km/h). */
  release: readonly (readonly [kmh: number, s: number])[];
  /**
   * Shape of the release: the key unwinds at a rate in proportion to `key + release_ease`. Small lets a full key go
   * fast and a small one gently, so short gaps between presses keep a correction rather than dropping it.
   */
  release_ease: number;
  /** Rate multiplier, on the attack, for the opposite key: through centre and on until it meets a fresh press's ramp. */
  reverse: number;
  /** Share of full key a fresh press applies on its first step. */
  tap: number;
}

const SMOOTH_KEYS: KeyProfile = {
  attack: [[0, 0.08], [30, 0.15], [60, 0.3], [100, 0.39], [150, 0.7], [200, 0.86], [250, 0.95]],
  release: [[0, 0.09], [30, 0.15], [60, 0.22], [100, 0.31], [150, 0.38], [200, 0.5], [250, 0.56]],
  release_ease: 0.18,
  reverse: 2.5,
  tap: 0.05,
};
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
const DROP_CLEAR = 0.05;

// Normalised magic formula: peak at s = 1, sliding grip sin(C·π/2) ≈ 65% of peak.
const MF_C = 1.55;
const MF_B = Math.tan(Math.PI / (2 * MF_C));
// Its tail kept falling to that 65%, so a car thrown fully sideways glided; real tyres slide at 70-80% of peak, so past
// SLIDE_S the patch slides outright at SLIDE_GRIP.
const SLIDE_GRIP = 0.76;
const SLIDE_S = Math.tan((Math.PI - Math.asin(SLIDE_GRIP)) / MF_C) / MF_B;
// Loose ground: the share of its peak a road tyre (`offroad` 0) keeps sliding on fully loose ground. Gravel and grass
// roll under the tread rather than tearing it, so a slide keeps most of the grip and stays catchable.
const LOOSE_SLIDE = 0.86;
/** Sliding share `offroad` 1 adds on loose ground: knobbly tread digs in; slicks (below 0) lose it. */
const LOOSE_BITE = 0.09;

// Module scratch rather than a returned object: the step runs at 360 Hz per wheel and must not allocate.
let curve_c = MF_C;
let curve_b = MF_B;
let curve_s = SLIDE_S;
let curve_spread = 1;
let curve_cap = 1;
/** Where the bounded curve peaks, in `s`: under 1 once the stock tyre's asphalt curve cuts the loose one off before its own peak. */
let curve_peak = 1;

// `share` (from `surface_grip`) and `road` (the stock tyres' `mu` over this tyre's) bound the loose curve by
// the stock tyre's asphalt curve at the same slip. Unbound, wider and slower to fall past the peak, it kept more of a
// high-share tyre's grip in a slide than asphalt does, and locked stops and launches off the road beat the road.
function shape(loose: number, offroad: number, share: number, road: number) {
  if (loose <= 0) {
    curve_c = MF_C;
    curve_b = MF_B;
    curve_s = SLIDE_S;
    curve_spread = 1;
    curve_peak = 1;
    return;
  }
  curve_cap = road / share;
  const slide = LOOSE_SLIDE + LOOSE_BITE * Math.max(-1, Math.min(1, offroad));
  // With this C the magic formula falls from its peak towards `slide` and never under it.
  const c = (2 * (Math.PI - Math.asin(slide))) / Math.PI;
  // The peak moves out to keep asphalt's cornering stiffness: softer, a 120 km/h keyboard lane change on dirt took a
  // second longer to settle; stiffer, the peak sat at asphalt's slip and nothing felt broader.
  const spread = (c * Math.tan(Math.PI / (2 * c))) / (MF_C * MF_B);
  curve_c = MF_C + (c - MF_C) * loose;
  curve_b = Math.tan(Math.PI / (2 * curve_c));
  const floor = SLIDE_GRIP + (slide - SLIDE_GRIP) * loose;
  curve_s = floor > Math.sin((curve_c * Math.PI) / 2) + 1e-6 ? Math.tan((Math.PI - Math.asin(floor)) / curve_c) / curve_b : Infinity;
  curve_spread = 1 + (spread - 1) * loose;
  curve_peak = bound_peak();
}

// The loose curve rises to its peak at s = 1 while the bound, past its own peak at 1 / spread, falls: the bounded
// curve peaks where they cross, or on the bound's peak when the loose curve is already over it there.
function bound_peak(): number {
  if (bound_at(1) >= 1) return 1;
  let lo = 1 / curve_spread;
  if (loose_at(lo) >= bound_at(lo)) return lo;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (loose_at(mid) < bound_at(mid)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function bound_at(s: number): number {
  return curve_cap * Math.sin(MF_C * Math.atan(MF_B * s * curve_spread));
}

function loose_at(s: number): number {
  return Math.sin(curve_c * Math.atan(curve_b * s));
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
  /**
   * Slip at the peak of the tyre curve under this wheel, over asphalt's (1). ABS and traction control follow it: at
   * asphalt's slip the brake let go well short of the wider loose peak and stops on dirt ran long.
   */
  peak = 1;
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
    readonly axle: Axle,
    /** Index of the other wheel on this axle. */
    readonly pair: number,
    readonly left: boolean,
    spec: CarSpec,
  ) {
    this.driven = axle.drive_share > 0;
    this.reach = spec.wheel.rest + spec.wheel.radius;
  }
}

function curve_at(curve: readonly (readonly [number, number])[], x: number): number {
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i];
    if (x <= x1) {
      const [x0, y0] = curve[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return curve[curve.length - 1][1];
}

/**
 * Share of `spec.mu` a tyre grips with on ground of row grip `surface`, `dirt` on a trail. The loss `offroad` shrugs off
 * is capped at asphalt's, and the tyre's own loose-ground bite (`grip_dirt`, `grip_grass`) goes on top: capped
 * together, an off-road tyre's tarmac penalty followed it onto the dirt and the rally car's stock tyres outgripped its
 * rally tyres there. The parts keep bite × their `mu` scale at or under 1, so loose ground never outgrips road tyres on the road.
 */
export function surface_grip(spec: CarSpec, surface: number, dirt: boolean): number {
  const bite = surface < 1 ? ((dirt ? spec.grip_dirt : spec.grip_grass) ?? 1) : 1;
  return Math.max(0, Math.min(1, surface + (1 - surface) * spec.offroad)) * bite;
}

/**
 * Lock (rad) at `speed` m/s that a grip-limited corner needs: kinematic L/R plus front-minus-rear slip, which is small
 * because body slip already loads the fronts. Past it the fronts go over peak, lose yaw damping and the car wallows.
 */
export function grip_lock(spec: CarSpec, speed: number): number {
  return (spec.wheelbase * GRAVITY * 1.05) / Math.max(1, speed * speed) + spec.peak_angle * 0.45;
}

/**
 * Lock (rad) a full key adds past `grip_lock` at `speed` m/s. Keys take it in along `key_reach`, a stick linearly.
 */
function full_key_reach(spec: CarSpec, speed: number): number {
  const [slow, fast] = FULL_KEY_SPEEDS;
  return spec.peak_angle * FULL_KEY_REACH * Math.max(0, Math.min(1, (speed - slow) / (fast - slow)));
}

/**
 * Share of `full_key_reach` a key held at `key` (-1..1) asks for: a smoothstep, flat at both ends, so the wheel meets and
 * leaves full lock no faster than the plain lock alone moves it. The key cubed it replaced was steepest at full key, and
 * the wheel swung into the extra lock and off it quicker than before.
 */
function key_reach(key: number): number {
  const size = Math.min(1, Math.abs(key));
  return Math.sign(key) * size * size * (3 - 2 * size);
}

/**
 * Lock (rad) with the steer assist off, `limit` the grip-limited lock, `steer` the held stick and `slide` the body slip
 * (rad). Into a turn it is the grip-limited lock, as with the assist: the wider speed-cut lock it had put the fronts at
 * four to six times their peak slip, and a held key pushed wide and scrubbed speed. A countersteer opens it to full
 * lock: capped, the fronts could not reach their course past 30 degrees of body slip and a power slide spun.
 */
export function unassisted_lock(spec: CarSpec, limit: number, steer: number, slide: number): number {
  const [from, to] = COUNTER_SLIP;
  const counter = Math.max(0, Math.min(1, (Math.sign(steer) * slide - from) / (to - from)));
  return limit + (spec.lock - limit) * counter;
}

function magic(s: number): number {
  const y = Math.sin(curve_c * Math.atan(curve_b * Math.max(-curve_s, Math.min(curve_s, s))));
  if (curve_spread === 1) return y;
  const road = s * curve_spread;
  return Math.min(y, curve_cap * Math.sin(MF_C * Math.atan(MF_B * Math.max(-SLIDE_S, Math.min(SLIDE_S, road)))));
}

function combined_x(sx: number, sy: number): number {
  const s = Math.hypot(sx, sy);
  return s < 1e-6 ? curve_c * curve_b * sx : (magic(s) * sx) / s;
}

function combined_y(sx: number, sy: number): number {
  const s = Math.hypot(sx, sy);
  return s < 1e-6 ? curve_c * curve_b * sy : (magic(s) * sy) / s;
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
const tmp = new Vector3();
const tmp2 = new Vector3();
const inv = new Quaternion();
const steer_q = new Quaternion();
const Y = new Vector3(0, 1, 0);

// A driven rear counts its sideways slip too, not wheelspin alone: in a tight turn it saturates sideways at a spin
// traction control never saw, and full drive swung the tail in. A front's sideways slip is the steering's; cutting
// power for it only stalls the car.
function tcs_spin(w: Wheel, low: boolean, peak_slip: number): number {
  const slip = tcs_slip(w, peak_slip);
  return low && w.contact && !w.axle.steer ? Math.hypot(Math.max(0, slip), w.lateral * peak_slip * TCS_LATERAL) : slip;
}

// Wheelspin past the peak of the curve under the wheel, in asphalt's terms: traction control allows the same slip past
// it on any ground. Scaled with the peak instead, as ABS is, a wide loose curve spun the rally car up and launched slower.
function tcs_slip(w: Wheel, peak_slip: number): number {
  return w.slip - peak_slip * (w.peak - 1);
}

/** Height of the ray from `mount` along `down`, `t` metres out, above the ground under it. */
function ray_gap(ground: Ground, t: number): number {
  const y = mount.y + down.y * t;
  return y - ground.height(mount.x + down.x * t, mount.z + down.z * t, y);
}

export class Car {
  readonly body: RigidBody;
  readonly axles: Axle[];
  readonly wheels: Wheel[];
  private readonly driven: Wheel[];
  private readonly corners: Vector3[];
  private readonly steer_z: number;
  private readonly sense: NitroSense = { slide: 0, speed: 0, airborne: false };

  gear = 1;
  auto = true;
  rpm: number;
  steer = 0;
  shifting = 0;
  tcs = true;
  abs = true;
  /** ABS's slip on asphalt; tests sweep it for the best fixed-slip stop. */
  abs_slip = ABS_SLIP;
  /** Steering assist: the grip-limited lock, the auto countersteer and the fronts held near their course. */
  assist = true;
  /** Stability (STM): the yaw damper that stops a slide growing into a spin. */
  stability = true;
  tcs_factor = 1;
  braking = 0;
  throttle = 0;
  /** Keyboard steer after the speed-scaled ramp, -1..1; follows the stick directly for analog input. */
  key_steer = 0;
  /** Smooth keys: the steer input on the last step, so a fresh press is told from a held or reversed one. */
  private key_input = 0;
  /** Smooth keys: seconds the steer key has been held in its current direction. */
  private key_press = 0;
  /** Side (sign of the key) of the power slide asked for since the steer was last let go; 0 with none. */
  private slide_side = 0;
  /** Side (sign of the held key) of a power slide launched from rest and still asked for; 0 with none. */
  private launch_side = 0;
  /** Seconds since the car left rest with the gas down, held since; Infinity when it was not, or the gas came up. */
  private launch_age = Infinity;
  /** Side of the launched slide whose hold is still fading out after gas or stick eased the launch off; 0 with none. */
  private hold_side = 0;
  /** Seconds since a rolling handbrake tap at full lock; Infinity with none. */
  private tap_age = Infinity;
  /** Seconds the stick has sat near centre; a held drift ends past `LET_GO_TIME`. */
  private centred = 0;
  steer_mode: SteerMode = SteerMode.SNAP;
  /** Idle hold latched on: it keeps braking at any speed until a pedal or the wheel is touched. */
  parked = false;
  readonly nitro: Nitro;

  constructor(readonly spec: CarSpec = COUPE) {
    this.body = new RigidBody(spec.mass, spec.inertia);
    this.nitro = new Nitro(spec.nitro ?? 0);
    this.axles = axles_of(spec);
    this.wheels = spec.wheel.mounts.map(([x, y, z], i) => {
      const axle = this.axles[axle_index(this.axles, i)];
      return new Wheel(new Vector3(x, y, z), axle, axle.wheels[0] === i ? axle.wheels[1] : axle.wheels[0], x > 0, spec);
    });
    this.steer_z = this.axles.find((a) => a.steer)?.z ?? 0;
    this.driven = this.wheels.filter((w) => w.driven);
    this.corners = spec.corners.map(([x, y, z]) => new Vector3(x, y, z));
    this.rpm = spec.idle;
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
    this.key_input = 0;
    this.key_press = 0;
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
    return this.launch_side !== 0;
  }

  /** Drops the slide the driver was asking for, for a car put somewhere new or rewound. */
  forget_slide() {
    this.slide_side = 0;
    this.launch_side = 0;
    this.launch_age = Infinity;
    this.hold_side = 0;
    this.tap_age = Infinity;
    this.centred = 0;
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
    const { body, spec } = this;
    const { pos, quat, vel, ang } = body;
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
    } else if (this.steer_mode === SteerMode.SMOOTH) {
      const keys = SMOOTH_KEYS;
      const kmh = speed * 3.6;
      const held = this.key_steer;
      const want = input.steer;
      const size = Math.abs(want);
      this.key_press = want * this.key_input > 0 ? this.key_press + dt : want === 0 ? 0 : dt;
      const attack = curve_at(keys.attack, kmh) / (1 - keys.tap);
      // Where a press held this long would sit had it started at centre: the opposite key catches the wheel up to it.
      const ramp = size * Math.min(1, keys.tap + this.key_press / attack);
      if (want * held < 0 || (want !== 0 && Math.abs(held) < ramp)) {
        const from = this.key_input === 0 && want * held >= 0 ? Math.sign(want) * Math.max(Math.abs(held), keys.tap * size) : held;
        const step = (keys.reverse / attack) * dt;
        this.key_steer = from + Math.max(-step, Math.min(step, Math.sign(want) * ramp - from));
      } else if (size > Math.abs(held)) {
        this.key_steer = Math.sign(want) * Math.min(size, Math.abs(held) + dt / attack);
      } else {
        const decay = curve_at(keys.release, kmh) / Math.log((1 + keys.release_ease) / keys.release_ease);
        const step = ((Math.abs(held) + keys.release_ease) * dt) / decay;
        this.key_steer += Math.max(-step, Math.min(step, want - held));
      }
      this.key_input = want;
    } else {
      const full = KEY_RAMP * Math.min(1, speed / KEY_RAMP_SPEED) + KEY_RAMP_MIN;
      const back = input.steer === 0 || input.steer * this.key_steer < 0;
      const step = ((back ? KEY_RETURN : 1) / full) * dt;
      this.key_steer += Math.max(-step, Math.min(step, input.steer - this.key_steer));
    }
    const beta = Math.atan2(-local.x, Math.abs(local.z));
    const [slow, fast] = SLIDE_SPEEDS;
    const walking = Math.max(0, Math.min(1, (fast - speed) / (fast - slow)));
    // Steer held into the turn on the gas with the tail out, at walking pace: a deliberate power slide or a donut. The assists
    // that catch a slide at speed (grip lock, countersteer, yaw damping) would straighten the wheels and stop it.
    const tail_out = Math.max(0, Math.min(1, (-Math.sign(this.key_steer) * beta) / SLIDE_OUT));
    // The countersteer that catches a slide is full key the other way at full gas too: until the steer is let go it
    // catches rather than asking for the mirror slide, which swung the tail past straight into a spin.
    if (Math.abs(input.steer) < 0.05) this.slide_side = 0;
    const rear_drive = spec.drive !== "fwd" && this.gear >= 1 ? walking * Math.min(1, pedal) : 0;
    const side = Math.sign(this.key_steer);
    const intent = (this.slide_side === -side ? 0 : rear_drive) * Math.abs(this.key_steer);
    if (intent > DRIFT_INTENT) this.slide_side = side;
    const power_slide = intent * tail_out;
    // The launch reads the held key, not the filtered wheel: a keyboard wheel still ramping, or the gas down first, had the
    // car past walking speed before the wheel got there.
    // Rolling, a handbrake tap at full lock kicks it, the Forza way: keys and touch buttons are always full, so no gas
    // pattern tells a drift from a slow corner. TCS on and the assist off, as from rest; all-wheel drive stalled in it.
    const tapped = this.tcs && !this.assist && spec.drive === "rwd" && this.gear >= 1 && input.handbrake > 0.5 && Math.abs(input.steer) > DRIFT_INTENT;
    this.tap_age = tapped ? 0 : this.tap_age + dt;
    const kicks = speed < DRIFT_START;
    this.launch_age = pedal > 0.1 && speed < 1 ? 0 : pedal <= 0.1 ? Infinity : this.launch_age + dt;
    const held = Math.sign(input.steer);
    const asked = (this.slide_side === -held ? 0 : rear_drive) * Math.abs(input.steer);
    if (asked <= DRIFT_INTENT || held !== this.launch_side) this.launch_side = 0;
    if (asked > DRIFT_INTENT && (this.launch_age < LAUNCH_WINDOW || (kicks && this.tap_age < TAP_WINDOW))) this.launch_side = held;
    if (this.launch_side !== 0) this.slide_side = this.launch_side;
    // All-wheel drive pulls its own nose along the course; held there too it came out of the slide at 45 km/h, where
    // the opposite key is a full-lock turn the other way rather than a catch.
    // Once gas or stick eases the launch off, the hold stays while the tail is still out on the launched side and fades as
    // it comes in: cut there, the wheels swung from countersteer to lock and the car pivoted down to walking pace.
    const [fade_from, fade_to] = HOLD_FADE;
    if (this.launched) this.hold_side = this.launch_side;
    // Faster, the tap's slide is the drift: its side is the way the tail went, as the key may already be countersteering.
    else if (!kicks && this.tap_age < TAP_WINDOW && pedal > DRIFT_INTENT && Math.abs(beta) > fade_from) this.hold_side = -Math.sign(beta);
    const tail_left = Math.max(0, Math.min(1, (-(this.hold_side || side) * beta - fade_from) / (fade_to - fade_from)));
    // With the steering assist off, the countersteer key is the catch, not the end: dropping the hold for it put traction
    // control back at 0.14, the gas went to its floor and the car slowed and gripped up mid-slide. Letting go ends it.
    this.centred = Math.abs(input.steer) < LET_GO_STEER ? this.centred + dt : 0;
    const let_go = this.assist ? this.hold_side !== held || this.hold_side !== side : this.centred >= LET_GO_TIME;
    // Braking or reversing out of it is no drift: held on, the loose TCS let the car reverse at full lock to 41 km/h.
    const swung = tail_left === 0 && (Math.abs(ang.y) < DRIFT_CALM || this.assist);
    if (!this.launched && (let_go || swung || this.gear < 1 || brake > 0.1 || local.z < 0)) this.hold_side = 0;
    const drift_steer = !this.tcs || spec.drive !== "rwd" ? 0 : this.launched ? 1 : this.hold_side !== 0 ? tail_left : 0;
    const cornering = grip_lock(spec, speed);
    const limit = Math.min(spec.lock, cornering + (spec.lock - cornering) * power_slide);
    const lock = this.assist ? limit : unassisted_lock(spec, limit, this.key_steer, slide);
    let target = this.key_steer * lock + (input.analog ? this.key_steer : key_reach(this.key_steer)) * full_key_reach(spec, speed);
    if (this.assist && speed > 4 && local.z > 1) target += Math.sign(beta) * Math.max(0, Math.abs(beta) - 0.1) * 0.8 * (1 - power_slide);
    if (local.z > 1) {
      // Full lock at hairpin speed put the fronts at 20-27 degrees of slip, three times peak, and their scrub held the car
      // at walking pace under full throttle. Keep them within reach of peak around the way the front axle is moving.
      const course = Math.atan2(-(local.x + ang.dot(up) * this.steer_z), local.z);
      const [on_from, on_to, off_from, off_to] = USEFUL_SPEEDS;
      const fade = Math.max((on_to - speed) / (on_to - on_from), (speed - off_from) / (off_to - off_from));
      const free = spec.lock * Math.max(0, Math.min(1, fade));
      const reach = USEFUL_SLIP * spec.peak_angle + free;
      // In a power slide the front axle's course swings with the tail, and pulling the fronts after it straightened them
      // under a player holding full lock.
      const near = Math.max(course - reach, Math.min(course + reach, target));
      // Without the assist the clamp only takes lock off: turning the wheels towards the course on its own is the countersteer.
      const kept = this.assist ? near : Math.sign(target) * Math.max(0, Math.min(Math.abs(target), Math.sign(target) * near));
      // A launched slide under traction control keeps the fronts on the course at any speed, with the assist off too: it is
      // the launch's own countersteer, as its yaw hold is, and what lets the slide carry speed rather than pivot.
      const on_course = Math.max(course - DRIFT_REACH * spec.peak_angle, Math.min(course + DRIFT_REACH * spec.peak_angle, target));
      const loose = target + (kept - target) * (1 - power_slide);
      target = loose + (on_course - loose) * drift_steer;
      // Fading, the wheels still never point further into the turn than the held course: blended with the full lock the
      // stick asks for, an eased kaze steered 17 degrees into the turn and the tail swung out again.
      if (this.hold_side !== 0 && drift_steer > 0) target = this.hold_side * Math.min(this.hold_side * target, this.hold_side * on_course);
    }
    target = Math.max(-spec.lock, Math.min(spec.lock, target));
    // At speed the ramped key input moves slower than either limit; at parking speed this keeps the old keyboard feel.
    const rate = input.analog ? STEER_RATE : Math.max(1.6, lock * 6) * (input.steer === 0 ? 1.6 : 1);
    this.steer += Math.max(-rate * dt, Math.min(rate * dt, target - this.steer));

    const driven = this.driven;
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
    // Launched from rest on full key and full gas, the driver asks for a power slide: the lateral term and the lone-wheel
    // brake exist to keep the tail in, and they cut the gas before it could step out.
    const sideways = low && !this.launched && drift_steer === 0;
    const slip_limit = this.launched && drift_steer === 0 ? DRIFT_TCS_SLIP : TCS_SLIP + (HELD_TCS_SLIP - TCS_SLIP) * drift_steer;
    for (const w of this.wheels) {
      if (!w.driven) continue;
      // An axle spins when both its wheels do; one spinning alone, like the unloaded inner wheel in a tight turn, is
      // braked instead, as a brake-based TCS does. Cutting the engine for it starved the loaded wheel and the car bogged.
      const other = this.wheels[w.pair];
      max_slip = Math.max(max_slip, low ? Math.min(tcs_spin(w, sideways, spec.peak_slip), tcs_spin(other, sideways, spec.peak_slip)) : tcs_spin(w, sideways, spec.peak_slip));
      const lone = sideways && w.contact && tcs_slip(w, spec.peak_slip) > TCS_SLIP && tcs_slip(other, spec.peak_slip) <= TCS_SLIP;
      w.tcs_brake = lone ? Math.min(1, w.tcs_brake + 9 * dt) : Math.max(0, w.tcs_brake - 2.5 * dt);
      if (!w.contact) max_drag = Math.max(max_drag, -w.slip);
    }
    // On the ground some torque always gets through so a stuck car can still crawl out; in the air there is no grip to save.
    const floor = driven.every((w) => !w.contact) ? 0 : 0.15;
    if (acting && max_slip > slip_limit) this.tcs_factor = Math.max(floor, this.tcs_factor - 9 * dt);
    else this.tcs_factor = Math.min(1, this.tcs_factor + 2.5 * dt);
    const gas = pedal * (this.tcs ? this.tcs_factor : 1);
    this.throttle = gas;

    const launch = this.gear !== 0 ? spec.idle + gas * spec.launch_rpm : spec.idle + gas * (spec.redline - spec.idle);
    const rpm = Math.max(wheel_rpm, launch);
    const grounded = this.wheels.some((w) => w.contact);
    // First gear is grip-bound: boost there only spins the wheels, and spinning wheels hold the auto box off its upshift.
    // Mid-shift and on the limiter no torque reaches the wheels, so nothing burns either.
    const drives = this.gear >= 2 && this.shifting <= 0 && rpm < spec.redline;
    this.sense.slide = slide;
    this.sense.speed = speed;
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
    const drive = engine * ratio * spec.driveline;
    const driven_inertia = 1.4 + (spec.engine_inertia * ratio * ratio) / driven.length;

    body.force.y -= GRAVITY * spec.mass;

    // A tyre part's grip over stock tyres counts on asphalt only: off it the curve stays under the stock tyre's on the road.
    const stock = (spec.stock_mu ?? spec.mu) / spec.mu;
    const reach = rest + radius;
    for (const w of this.wheels) {
      mount.copy(w.mount).applyQuaternion(quat).add(pos);
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

    for (const w of this.wheels) {
      const { axle, prev } = w;
      const other = this.wheels[w.pair];
      const inertia = w.driven ? driven_inertia : 1.4;
      const torque = w.driven ? (drive * axle.drive_share) / axle.wheels.length : 0;
      const brake_torque = brake * axle.brake * w.abs_factor + (axle.handbrake ? input.handbrake * spec.handbrake : 0) + (hold ? spec.hold : 0) + w.tcs_brake * Math.abs(torque);

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
      suspension += axle.arb * (w.compression - other.compression);
      if (w.compression > rest) suspension += spec.bump * (w.compression - rest);
      suspension = Math.max(0, Math.min(spec.strut_max, suspension));
      lever.copy(w.point).sub(pos);
      ground.normal(w.point.x, w.point.z, w.normal, w.point.y);
      const load = suspension * Math.max(0, up.dot(w.normal));
      w.load = load;
      // Along body up, a pitched body pushed itself sideways and a car in neutral rolled off on the flat.
      body.apply(force.copy(w.normal).multiplyScalar(load), w.point);

      steer_q.setFromAxisAngle(Y, -w.angle);
      wheel_fwd.set(0, 0, 1).applyQuaternion(steer_q).applyQuaternion(quat);
      wheel_fwd.addScaledVector(w.normal, -wheel_fwd.dot(w.normal)).normalize();
      lat.crossVectors(w.normal, wheel_fwd).normalize();

      point_vel.crossVectors(ang, lever).add(vel);
      const v_long = point_vel.dot(wheel_fwd);
      const v_lat = point_vel.dot(lat);
      const denom = Math.max(Math.abs(v_long), 2);
      const surface = ground.grip(w.point.x, w.point.z);
      const grip = surface_grip(spec, surface, surface < 1 && !!ground.dirt?.(w.point.x, w.point.z));
      shape(ground.loose?.(w.point.x, w.point.z) ?? 0, spec.offroad, grip, stock);
      // Tyre force grows ever slower with load and tops out at half `load_fade`; past that it stays flat. Left as a
      // parabola it fell to nothing at `load_fade` and reversed above it, which a hard landing reaches.
      const bite = Math.min(load, spec.load_fade / 2);
      const peak = spec.mu * axle.grip * grip * bite * (1 - bite / spec.load_fade);
      // Over the same denominator as the longitudinal slip, so the combined force points against the patch's slip
      // velocity. As an angle it stopped at 90 degrees while wheelspin over a 2 m/s floor did not: a rear spinning fully
      // sideways put nearly all its grip into drive and the car glided on the fronts.
      const sy = -v_lat / denom / Math.tan(spec.peak_angle) / curve_spread;
      const peak_slip = spec.peak_slip * curve_spread;
      w.peak = curve_spread * curve_peak;

      // Semi-implicit wheel spin: linearise the tyre's longitudinal force around the current slip so a stiff tyre
      // can't overshoot within one step; past the peak the slope clamps to 0 and wheelspin runs free.
      const sx0 = (w.omega * radius - v_long) / denom / peak_slip;
      const peak_x = brake > 0.05 && sx0 * v_long < 0 ? peak * spec.brake_grip : peak;
      const fx0 = combined_x(sx0, sy) * peak_x;
      const k = Math.max(0, ((combined_x(sx0 + 1e-3, sy) * peak_x - fx0) / 1e-3) * (radius / (denom * peak_slip)));
      const stiff = 1 + (dt * radius * k) / inertia;
      let omega = (w.omega + (dt / inertia) * (torque - radius * fx0 + radius * k * w.omega)) / stiff;
      const cut = (dt * brake_torque) / inertia / stiff;
      omega -= Math.sign(omega) * Math.min(Math.abs(omega), cut);
      w.omega = omega;
      w.spin += omega * dt;

      const sx = (omega * radius - v_long) / denom / peak_slip;
      const roll = ground.roll(w.point.x, w.point.z);
      const rolling = v_long * spec.roll_resist;
      const fx = combined_x(sx, sy) * peak_x - rolling;
      const fy = combined_y(sx, sy) * peak;
      w.slip = sx * peak_slip;
      const locking = this.abs && brake > 0.1 && w.slip < -this.abs_slip * w.peak && Math.abs(v_long) > 2;
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
      body.apply(force, w.point);
      // Grass drag acts at the centre of mass: at the contact patch it pitched load off the rear, and at full throttle on grass
      // the unloaded rear lost straight-line yaw stability, so the car circled while TCS cut the power.
      body.force.addScaledVector(wheel_fwd, -rolling * (roll - 1) * (1 - spec.offroad));
    }

    let airborne = this.wheels.every((w) => !w.contact);
    for (const corner of this.corners) {
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

    // Stability assist: damp only yaw that grows the slide, so a drift can be held and caught but not spun; the
    // handbrake bypasses it so slides can still be started on purpose.
    // A launched slide past a drift's angle is a spin in the making: the momentum carried it round with the gas already cut.
    // That hold belongs to the launch, not to stability: without it a launch with stability off pirouetted the AWD cars.
    const [hold_from, hold_to] = DRIFT_HOLD;
    // With the steering assist off the held drift is the driver's, and stability gives way to it as to a launch: at speed it
    // damped the handbrake's slide away before the gas could hold it. The assist's own countersteer catches the rest.
    const held_drift = this.assist ? 0 : drift_steer;
    const drifting = this.launched || held_drift > 0;
    const spinning = drifting ? Math.max(0, Math.min(1, (Math.abs(beta) - hold_from) / (hold_to - hold_from))) : 0;
    const excess = Math.abs(slide) - 0.2;
    const damp = this.stability ? 1 - Math.max(power_slide, held_drift) * (1 - spinning) : spinning;
    if ((this.stability || spinning > 0) && excess > 0 && input.handbrake < 0.1 && Math.sign(ang.y) === Math.sign(slide)) {
      body.torque.y -= ang.y * spec.inertia[1] * Math.min(1, excess * 6) * 3.5 * spec.assist_yaw * damp;
    }
    // In the air there is no slip angle to hold; damped there it cancelled the yaw a slide carries over a jump.
    if (!this.assist && this.hold_side !== 0 && this.tcs && spec.drive === "rwd" && speed > 1 && this.wheels.some((w) => w.contact)) {
      // Yaw against the velocity's own turn rate is the slip angle changing; damping that, not yaw, leaves the arc alone.
      const swing = ang.y - tmp.crossVectors(vel, body.force).y / (spec.mass * speed * speed);
      const [damp_from, damp_to] = DRIFT_DAMP_SLIP;
      const settle = Math.sign(swing) !== -this.hold_side ? 1 : held_drift * Math.max(0, Math.min(1, (Math.abs(beta) - damp_from) / (damp_to - damp_from)));
      body.torque.y -= swing * spec.inertia[1] * DRIFT_DAMP * Math.min(1, pedal) * settle;
    }
    if (airborne && spec.air_settle > 0) {
      // Crests launch the car off whichever wheel leaves last, so it takes off spinning; bleed pitch and roll and level it
      // in the air so it lands on its wheels. Yaw is left alone so a slide carries through the jump.
      const level = tmp2.crossVectors(up, Y).multiplyScalar(spec.air_settle * spec.air_settle * 0.25);
      const yaw = up.dot(ang);
      tmp.copy(ang).addScaledVector(up, -yaw);
      ang.addScaledVector(tmp, -Math.min(1, spec.air_settle * dt)).addScaledVector(level, dt);
    }
    body.force.addScaledVector(vel, -spec.drag * speed);
    const lift = this.wheels.some((w) => w.contact) ? 1 : 1 - spec.ground_effect;
    const press = spec.downforce * lift * vf * vf;
    body.force.addScaledVector(up, -press);
    // Downforce ahead of the centre of mass pitches the nose onto its springs, so the front tyres carry more of it.
    if (spec.aero_front) body.torque.add(tmp2.crossVectors(lever.copy(forward).multiplyScalar(spec.aero_front * spec.wheelbase), tmp.copy(up).multiplyScalar(-press)));

    body.integrate(dt);
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
