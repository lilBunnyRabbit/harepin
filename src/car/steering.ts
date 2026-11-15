import { Vector3 } from "three";
import type { Car, Controls, StepFrame } from "./car";
import type { CarSpec } from "./cars";
import { curve_at } from "./curve";
import { GRAVITY } from "./rigid-body";

/**
 * How keyboard steering behaves: `snap` ramps to full lock and springs back to centre, `hold` leaves the wheel where it
 * is and lets it self-centre as the car rolls, `smooth` asks for a share of the grip-limited turn rate that a tap nudges
 * and a held key builds.
 */
export const SteerMode = { SNAP: "snap", HOLD: "hold", SMOOTH: "smooth" } as const;
export type SteerMode = (typeof SteerMode)[keyof typeof SteerMode];

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
/** Yaw rate (rad/s) under which a caught drift lets go once the tail is in: dropped at straight, it swung on into a spin. */
const DRIFT_CALM = 0.3;
/**
 * Seconds the stick sits under `LET_GO_STEER` before a held drift ends, the FH way: let go and the car straightens. Short
 * enough that a real let-go reads at once, long enough that keyboard taps through centre mid-drift keep it.
 */
const LET_GO_TIME = 0.3;
const LET_GO_STEER = 0.3;
/**
 * Front slip angle the steer assist allows, in `peak_angle`: past peak a tyre only scrubs speed. A held drift reads
 * `CarSpec.drift_reach` instead; at 1.8 the held key into a drift turned in no tighter, as the fronts are past peak already.
 */
export const USEFUL_SLIP = 1.1;
/**
 * Body slip (rad), about 2.3 degrees, past which a countersteered rear-drive slide on full gas with the assist off and TCS
 * on becomes a held drift, as a handbrake tap does. Held only from a launch or a tap, a power or lift-off slide met
 * traction control's road limit: it cut the gas, the rear stopped pushing, and the car slowed and gripped up mid-slide.
 * The countersteer tells a drift from a grip corner at full gas, whose slip reaches this angle too.
 */
const SLIDE_HOLD = 0.04;
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
/** Body slip (rad) against the held steer over which an unassisted countersteer blends to full lock (either way with `both`). */
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
  const slow = FULL_KEY_SPEEDS[0];
  const fast = FULL_KEY_SPEEDS[1];
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
 * lock: capped, the fronts could not reach their course past 30 degrees of body slip and a power slide spun. With `both`
 * the key into the turn opens it too (`Car.drift_full_lock`).
 */
export function unassisted_lock(spec: CarSpec, limit: number, steer: number, slide: number, both = false): number {
  const from = COUNTER_SLIP[0];
  const to = COUNTER_SLIP[1];
  const counter = Math.max(0, Math.min(1, ((both ? Math.abs(slide) : Math.sign(steer) * slide) - from) / (to - from)));
  return limit + (spec.lock - limit) * counter;
}

const local_vel = new Vector3();

/** The driver's side of the wheel: the keyboard ramp, the slide asked for and the lock the wheel turns to. */
export class Steering {
  /** Smooth keys: the steer input on the last step, so a fresh press is told from a held or reversed one. */
  private key_input = NaN;
  /** Smooth keys: seconds the steer key has been held in its current direction. */
  private key_press = NaN;
  /** Side (sign of the key) of the power slide asked for since the steer was last let go; 0 with none. */
  private slide_side = 0;
  /** Side (sign of the held key) of a power slide launched from rest and still asked for; 0 with none. */
  private launch_side = 0;
  /** Seconds since the car left rest with the gas down, held since; Infinity when it was not, or the gas came up. */
  private launch_age = Infinity;
  /** Side of the launched slide whose hold is still fading out after gas or stick eased the launch off; 0 with none. */
  hold_side = 0;
  /** Seconds since a rolling handbrake tap at full lock; Infinity with none. */
  private tap_age = Infinity;
  /** Seconds the stick has sat near centre; a held drift ends past `LET_GO_TIME`. */
  private centred = NaN;

  /** `steer_z`: the steered axle's z in the car's frame, m. */
  constructor(private readonly steer_z: number) {
    this.key_input = 0;
    this.key_press = 0;
    this.centred = 0;
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

  /** Lets go of the keys, for a car put somewhere new. */
  release_keys() {
    this.key_input = 0;
    this.key_press = 0;
  }

  step(car: Car, frame: StepFrame, dt: number, input: Controls) {
    const speed = frame.speed;
    frame.inv.copy(car.body.quat).invert();
    const local = local_vel.copy(car.body.vel).applyQuaternion(frame.inv);
    frame.slide = speed > 5 ? Math.atan2(-local.x, Math.abs(local.z)) : 0;
    this.ramp_keys(car, dt, input, speed);
    this.drift_intent(car, frame, dt, input, local);
    this.aim(car, frame, dt, input, local);
  }

  // A key is full stick at once, which at speed makes every tap a full-lock flick; ramp it like a thumb would.
  private ramp_keys(car: Car, dt: number, input: Controls, speed: number) {
    if (input.analog) car.key_steer = input.steer;
    else if (car.steer_mode === SteerMode.HOLD) {
      // Hands off, the caster turns the wheel back only as the car rolls: parked it stays put, at speed it centres fast.
      if (input.steer === 0) {
        const step = (speed * dt) / HOLD_CENTRE_DISTANCE;
        car.key_steer -= Math.sign(car.key_steer) * Math.min(Math.abs(car.key_steer), step);
      } else {
        const step = ((input.steer * car.key_steer < 0 ? KEY_RETURN : 1) / HOLD_TIME) * dt;
        car.key_steer += Math.max(-step, Math.min(step, input.steer - car.key_steer));
      }
    } else if (car.steer_mode === SteerMode.SMOOTH) {
      const keys = SMOOTH_KEYS;
      const kmh = speed * 3.6;
      const held = car.key_steer;
      const want = input.steer;
      const size = Math.abs(want);
      this.key_press = want * this.key_input > 0 ? this.key_press + dt : want === 0 ? 0 : dt;
      const attack = curve_at(keys.attack, kmh) / (1 - keys.tap);
      // Where a press held this long would sit had it started at centre: the opposite key catches the wheel up to it.
      const ramp = size * Math.min(1, keys.tap + this.key_press / attack);
      if (want * held < 0 || (want !== 0 && Math.abs(held) < ramp)) {
        const from = this.key_input === 0 && want * held >= 0 ? Math.sign(want) * Math.max(Math.abs(held), keys.tap * size) : held;
        const step = (keys.reverse / attack) * dt;
        car.key_steer = from + Math.max(-step, Math.min(step, Math.sign(want) * ramp - from));
      } else if (size > Math.abs(held)) {
        car.key_steer = Math.sign(want) * Math.min(size, Math.abs(held) + dt / attack);
      } else {
        const decay = curve_at(keys.release, kmh) / Math.log((1 + keys.release_ease) / keys.release_ease);
        const step = ((Math.abs(held) + keys.release_ease) * dt) / decay;
        car.key_steer += Math.max(-step, Math.min(step, want - held));
      }
      this.key_input = want;
    } else {
      const full = KEY_RAMP * Math.min(1, speed / KEY_RAMP_SPEED) + KEY_RAMP_MIN;
      const back = input.steer === 0 || input.steer * car.key_steer < 0;
      const step = ((back ? KEY_RETURN : 1) / full) * dt;
      car.key_steer += Math.max(-step, Math.min(step, input.steer - car.key_steer));
    }
  }

  /** The slide the driver asks for, from `local`, the car's velocity in its own frame: `power_slide` and `drift_steer`. */
  private drift_intent(car: Car, frame: StepFrame, dt: number, input: Controls, local: Vector3) {
    const spec = car.spec;
    const { speed, pedal, brake } = frame;
    const beta = Math.atan2(-local.x, Math.abs(local.z));
    const slow = SLIDE_SPEEDS[0];
    const fast = SLIDE_SPEEDS[1];
    const walking = Math.max(0, Math.min(1, (fast - speed) / (fast - slow)));
    // Steer held into the turn on the gas with the tail out, at walking pace: a deliberate power slide or a donut. The assists
    // that catch a slide at speed (grip lock, countersteer, yaw damping) would straighten the wheels and stop it.
    const tail_out = Math.max(0, Math.min(1, (-Math.sign(car.key_steer) * beta) / SLIDE_OUT));
    // The countersteer that catches a slide is full key the other way at full gas too: until the steer is let go it
    // catches rather than asking for the mirror slide, which swung the tail past straight into a spin.
    if (Math.abs(input.steer) < 0.05) this.slide_side = 0;
    const rear_drive = spec.drive !== "fwd" && car.gear >= 1 ? walking * Math.min(1, pedal) : 0;
    const side = Math.sign(car.key_steer);
    const intent = (this.slide_side === -side ? 0 : rear_drive) * Math.abs(car.key_steer);
    if (intent > DRIFT_INTENT) this.slide_side = side;
    const power_slide = intent * tail_out;
    // The launch reads the held key, not the filtered wheel: a keyboard wheel still ramping, or the gas down first, had the
    // car past walking speed before the wheel got there.
    // Rolling, a handbrake tap at full lock kicks it, the Forza way: keys and touch buttons are always full, so no gas
    // pattern tells a drift from a slow corner. TCS on and the assist off, as from rest; all-wheel drive stalled in it.
    const aid = car.drift_aid;
    const tapped = aid > 0 && !car.assist && spec.drive === "rwd" && car.gear >= 1 && input.handbrake > 0.5 && Math.abs(input.steer) > DRIFT_INTENT;
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
    const fade_from = HOLD_FADE[0];
    const fade_to = HOLD_FADE[1];
    if (this.launched) this.hold_side = this.launch_side;
    // Faster, the tap's slide is the drift: its side is the way the tail went, as the key may already be countersteering.
    else if (!kicks && this.tap_age < TAP_WINDOW && pedal > DRIFT_INTENT && Math.abs(beta) > fade_from) this.hold_side = -Math.sign(beta);
    else if (this.hold_side === 0 && aid > 0 && !car.assist && spec.drive === "rwd" && car.gear >= 1 && !kicks && pedal > DRIFT_INTENT && brake <= 0.1 && local.z > 0 && held * beta > SLIDE_HOLD) this.hold_side = -Math.sign(beta);
    const tail_left = Math.max(0, Math.min(1, (-(this.hold_side || side) * beta - fade_from) / (fade_to - fade_from)));
    // With the steering assist off, the countersteer key is the catch, not the end: dropping the hold for it put traction
    // control back at 0.14, the gas went to its floor and the car slowed and gripped up mid-slide. Letting go ends it.
    this.centred = Math.abs(input.steer) < LET_GO_STEER ? this.centred + dt : 0;
    const let_go = car.assist ? this.hold_side !== held || this.hold_side !== side : this.centred >= LET_GO_TIME;
    // Braking or reversing out of it is no drift: held on, the loose TCS let the car reverse at full lock to 41 km/h.
    const swung = tail_left === 0 && (Math.abs(car.body.ang.y) < DRIFT_CALM || car.assist);
    if (!this.launched && (let_go || swung || car.gear < 1 || brake > 0.1 || local.z < 0)) this.hold_side = 0;
    frame.beta = beta;
    frame.walking = walking;
    frame.power_slide = power_slide;
    frame.drift_steer = aid === 0 || spec.drive !== "rwd" ? 0 : this.launched ? aid : this.hold_side !== 0 ? tail_left * aid : 0;
  }

  /** Turns the wheel towards the lock the key and the slide ask for, from `local`, the car's velocity in its own frame. */
  private aim(car: Car, frame: StepFrame, dt: number, input: Controls, local: Vector3) {
    const spec = car.spec;
    const { speed, slide, beta, power_slide, drift_steer } = frame;
    const cornering = grip_lock(spec, speed);
    const limit = Math.min(spec.lock, cornering + (spec.lock - cornering) * power_slide);
    const lock = car.assist ? limit : unassisted_lock(spec, limit, car.key_steer, slide, car.drift_full_lock);
    let target = car.key_steer * lock + (input.analog ? car.key_steer : key_reach(car.key_steer)) * full_key_reach(spec, speed);
    if (car.assist && speed > 4 && local.z > 1) target += Math.sign(beta) * Math.max(0, Math.abs(beta) - 0.1) * 0.8 * (1 - power_slide);
    if (local.z > 1) {
      // Full lock at hairpin speed put the fronts at 20-27 degrees of slip, three times peak, and their scrub held the car
      // at walking pace under full throttle. Keep them within reach of peak around the way the front axle is moving.
      const course = Math.atan2(-(local.x + car.body.ang.dot(frame.up) * this.steer_z), local.z);
      const on_from = USEFUL_SPEEDS[0];
      const on_to = USEFUL_SPEEDS[1];
      const off_from = USEFUL_SPEEDS[2];
      const off_to = USEFUL_SPEEDS[3];
      const fade = Math.max((on_to - speed) / (on_to - on_from), (speed - off_from) / (off_to - off_from));
      // Opened into the turn, a full lock of slack still held a drift's key at 34 degrees, its course 15 degrees out.
      const free = car.drift_full_lock && !car.assist && fade >= 1 ? Infinity : spec.lock * Math.max(0, Math.min(1, fade));
      const reach = (this.hold_side !== 0 && drift_steer > 0 ? (spec.drift_reach ?? USEFUL_SLIP) : USEFUL_SLIP) * spec.peak_angle + free;
      // In a power slide the front axle's course swings with the tail, and pulling the fronts after it straightened them
      // under a player holding full lock.
      const near = Math.max(course - reach, Math.min(course + reach, target));
      // Without the assist the clamp only takes lock off: turning the wheels towards the course on its own is the countersteer.
      const kept = car.assist ? near : Math.sign(target) * Math.max(0, Math.min(Math.abs(target), Math.sign(target) * near));
      // A launched or held slide under traction control keeps the fronts on the course at any speed: the assist's countersteer,
      // and what lets the slide carry speed rather than pivot. Without the assist the wheels follow the key alone: held into
      // a handbrake drift they turned 14 degrees the other way.
      const course_steer = car.assist ? drift_steer : 0;
      const on_course = Math.max(course - DRIFT_REACH * spec.peak_angle, Math.min(course + DRIFT_REACH * spec.peak_angle, target));
      const loose = target + (kept - target) * (1 - power_slide);
      target = loose + (on_course - loose) * course_steer;
      // Fading, the wheels still never point further into the turn than the held course: blended with the full lock the
      // stick asks for, an eased kaze steered 17 degrees into the turn and the tail swung out again.
      if (this.hold_side !== 0 && course_steer > 0) target = this.hold_side * Math.min(this.hold_side * target, this.hold_side * on_course);
    }
    target = Math.max(-spec.lock, Math.min(spec.lock, target));
    // At speed the ramped key input moves slower than either limit; at parking speed this keeps the old keyboard feel.
    const rate = input.analog ? STEER_RATE : Math.max(1.6, lock * 6) * (input.steer === 0 ? 1.6 : 1);
    car.steer += Math.max(-rate * dt, Math.min(rate * dt, target - car.steer));
  }
}
