import type { Car, Controls } from "../car/car";
import { ROAD_HALF } from "../worldgen/types";
import { LINE_BRAKE, type RaceLine } from "./line";

/** Road points of aim past the car, plus one per this many m/s: pure pursuit, as the autopilot steers. */
const AIM_BASE = 7;
const AIM_PER = 3;
/** Under this pace (m/s) a bend is a hairpin and the aim stays short, or it cuts across the inside. */
const HAIRPIN_PACE = 15;
const AIM_HAIRPIN = 5;
const STEER_GAIN = 3;
/** Wheel per rad/s the aim error swings at: without it a fast car fishtails, each catch overshooting the last. */
const STEER_DAMP = 1;
const TRACK_BACK = 5;
const TRACK_AHEAD = 40;
/** m/s over the plan before the brake comes on, and m/s of overspeed per unit of pedal (capped at BRAKE_MAX). */
const BRAKE_SLACK = 1;
const BRAKE_PER = 10;
const BRAKE_MAX = 0.5;
/** Behind a car, m/s over its cap per unit of pedal, up to full: the cap is a gap to keep, not a plan to ease into. */
const CAP_BRAKE_PER = 10;
/** Slip angle (rad) at which the driver is fully off the brake. */
const SLIDE_LET_GO = 0.15;
/** Metres the car's body keeps off the road edge when it leaves the line to pass or defend. */
const PASS_EDGE = 1;
const RAMP_SIDE = 0.5;
/** m/s over the plan a mistake carries, and over how many road points. */
const MISTAKE_SPEED = 3;
const MISTAKE_SPAN = 60;
/** Seconds a driver stays wary after touching a car, less this share of it at full aggression. */
const WARY = 5;
const WARY_BOLD = 0.6;
/** Seconds a stuck car reverses for, wheel the other way, before it drives on. */
const REVERSE_TIME = 1.5;
/** Road points ahead a driver off the line reads bends over, every HOLD_STRIDE, and the least share of radius it plans on. */
const HOLD_LOOK = 60;
const HOLD_STRIDE = 3;
const HOLD_MIN = 0.3;
/** m/s sideways a driver moves its aim off or back onto the line: a jump in aim at speed throws the car wide. */
const LATERAL_RATE = 1.5;

export interface Personality {
  /** Share of the line's planned speed it drives at, 0.90-1.0. */
  pace: number;
  /** m/s it carries over the plan everywhere: a late braker. */
  brake_margin: number;
  /** 0..1: how tight it passes, how readily it defends. */
  aggression: number;
  /** Chance a lap of one late brake. */
  mistakes: number;
}

/** Metres off the centre past which a car is off the road: a hazard to the field, and on the clock toward a reset. */
export const OFF_ROAD = 7;

export const STEADY: Personality = { pace: 1, brake_margin: 0, aggression: 0, mistakes: 0 };

/** How far off the centre (m) a car may go to pass or defend at road point `index`; over a kicker's run, only RAMP_SIDE: posts flank its lip. */
export const pass_room = (car: Car, line: RaceLine, index: number) => (line.room[index] === 0 ? RAMP_SIDE : ROAD_HALF - car.spec.radius - PASS_EDGE);

const wrap_angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const never = () => 1;

/** Follows a `RaceLine` and writes pedals and wheel into its own `controls` every physics step, like a player's input. */
export class Driver {
  readonly controls: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
  index = 0;
  laps = 0;
  /** Metres off the line (along the road's right normal) the awareness asks it to hold; NaN follows the line. */
  hold = NaN;
  /** Share over its own pace it drives at while the awareness has it passing. */
  push = 1;
  /** Speed (m/s) it may not pass, set by the awareness behind a car it cannot get by. */
  cap = Infinity;
  /** m/s it aims at this step, cap included: what a follower reads as the speed this car is about to hold. */
  target = 0;
  /** Metres along the road's right normal the aim moves at once, past `aside`'s easing: set by the awareness to pull off a car overlapping alongside. */
  nudge = 0;
  /** Metres off the line it drives now, eased toward `hold` at LATERAL_RATE. */
  aside = 0;
  /** Seconds left in which it starts no pass and gives up one still behind, set by the field when it touches a car. */
  wary = 0;
  /** Seconds of reversing left, set by the field's recovery. */
  reversing = 0;
  private mistake_at = -1;
  private last_err = NaN;

  constructor(
    readonly line: RaceLine,
    readonly personality: Personality = STEADY,
    private readonly rng: () => number = never,
  ) {}

  /** Road points from the start, laps included: the field's running order. */
  get progress(): number {
    return this.laps * this.line.road.length + this.index;
  }

  place(index: number, laps = 0) {
    this.index = index;
    this.laps = laps;
  }

  /** A touch with another car: rubbing on through a pass that already touched is how one contact becomes ten. */
  touched() {
    this.wary = WARY * (1 - WARY_BOLD * this.personality.aggression);
  }

  reverse() {
    this.reversing = REVERSE_TIME;
  }

  /** Put back on the road by the field: whatever it was steering against is gone. */
  recovered() {
    this.reversing = 0;
    this.last_err = NaN;
  }

  track(car: Car) {
    const { road } = this.line;
    const n = road.length;
    let best = this.index;
    let best_d = Infinity;
    for (let k = -TRACK_BACK; k <= TRACK_AHEAD; k++) {
      const i = (((this.index + k) % n) + n) % n;
      const d = (road[i].x - car.pos.x) ** 2 + (road[i].z - car.pos.z) ** 2;
      if (d < best_d) {
        best_d = d;
        best = i;
      }
    }
    if (best < this.index - n / 2) {
      this.laps++;
      this.mistake_at = this.rng() < this.personality.mistakes ? Math.floor(this.rng() * n) : -1;
    } else if (best > this.index + n / 2) this.laps--;
    this.index = best;
  }

  // Off the line the radius of every bend ahead moves by the gap to it (1 + bend * gap), and so does the speed it
  // carries; each is brought back to now along the line's braking curve.
  private aside_pace(): number {
    const { line } = this;
    const n = line.road.length;
    let pace = Infinity;
    let run = 0;
    for (let k = 0; k < HOLD_LOOK; k += HOLD_STRIDE) {
      const i = (this.index + k) % n;
      const share = Math.max(HOLD_MIN, Math.min(1, 1 + line.bend[i] * this.aside));
      const v = line.speed[i] * Math.sqrt(share);
      pace = Math.min(pace, Math.sqrt(v * v + 2 * LINE_BRAKE * run));
      for (let s = 0; s < HOLD_STRIDE; s++) run += line.step[(i + s) % n];
    }
    return pace;
  }

  drive(car: Car, dt: number): Controls {
    this.track(car);
    this.wary = Math.max(0, this.wary - dt);
    const { line, personality } = this;
    const n = line.road.length;
    const vx = car.vel.x;
    const vz = car.vel.z;
    const speed = Math.hypot(vx, vz);
    const late = this.mistake_at >= 0 && (((this.index - this.mistake_at) % n) + n) % n < MISTAKE_SPAN;
    const here = pass_room(car, line, this.index);
    const want = Number.isNaN(this.hold) ? 0 : Math.max(-here, Math.min(here, line.offset[this.index] + this.hold)) - line.offset[this.index];
    const move = LATERAL_RATE * dt;
    this.aside += Math.max(-move, Math.min(move, want - this.aside));
    const plan = this.aside === 0 ? line.speed[this.index] : this.aside_pace();
    const free = plan * personality.pace * this.push + personality.brake_margin + (late ? MISTAKE_SPEED : 0);
    const target = Math.min(this.cap, free);
    this.target = target;
    const look = target < HAIRPIN_PACE ? AIM_HAIRPIN : AIM_BASE + Math.floor(speed / AIM_PER);
    const at = (this.index + look) % n;
    let ax = line.x[at];
    let az = line.z[at];
    if (this.aside !== 0 || this.nudge !== 0) {
      const p = line.road[at];
      const room = pass_room(car, line, at);
      const lateral = Math.max(-room, Math.min(room, line.offset[at] + this.aside + this.nudge));
      ax = p.x + p.tz * lateral;
      az = p.z - p.tx * lateral;
    }
    const err = wrap_angle(Math.atan2(ax - car.pos.x, az - car.pos.z) - car.heading);
    const c = this.controls;
    if (this.reversing > 0) {
      this.reversing -= dt;
      this.last_err = NaN;
      c.steer = Math.max(-1, Math.min(1, err * STEER_GAIN));
      c.throttle = 0;
      c.brake = 1;
      return c;
    }
    let airborne = true;
    for (let w = 0; w < car.wheels.length; w++) if (car.wheels[w].contact) airborne = false;
    const slide = speed > 5 ? Math.abs(wrap_angle(Math.atan2(vx, vz) - car.heading)) : 0;
    const ease = Math.max(0, 1 - slide / SLIDE_LET_GO);
    const swing = Number.isNaN(this.last_err) ? 0 : wrap_angle(err - this.last_err) / dt;
    this.last_err = err;
    c.steer = airborne ? 0 : Math.max(-1, Math.min(1, -err * STEER_GAIN - swing * STEER_DAMP));
    c.throttle = speed < target ? 1 : 0;
    // Behind a car the brake is not eased for the turn: running into it costs more than a wide line.
    const capped = this.cap < free;
    const turn = capped ? 1 : Math.max(0.2, 1 - Math.abs(err) * 4);
    const pedal = capped ? Math.min(1, (speed - target) / CAP_BRAKE_PER) : Math.min(BRAKE_MAX, (speed - target) / BRAKE_PER);
    c.brake = speed > target + BRAKE_SLACK ? pedal * turn * ease : 0;
    return c;
  }
}
