import { Quaternion, Vector3 } from "three";
import { ride_height, type Car, type Controls, type Ground } from "../car/car";
import { ROAD_HALF } from "../worldgen/types";
import { bank_floor, bank_top, CURVE_SPAN, grip_at, inverse_radius, type RaceLine } from "./line";
import { AI_TUNING } from "./tuning";

/** Under this pace (m/s) a bend is a hairpin and the aim stays short, or it cuts across the inside. */
const HAIRPIN_PACE = 15;
const AIM_HAIRPIN = 5;
const TRACK_BACK = 5;
const TRACK_AHEAD = 40;
/** m/s over the plan before the brake comes on, and m/s of overspeed per unit of pedal (capped at BRAKE_MAX). */
const BRAKE_SLACK = 1;
const BRAKE_PER = 10;
const BRAKE_MAX = 0.5;
/** Most pedal a late braker diving down the inside uses: it brakes harder than the line, short of locking up. */
const LATE_PEDAL = 0.8;
/** Behind a car, m/s over its cap per unit of pedal, up to full: the cap is a gap to keep, not a plan to ease into. */
const CAP_BRAKE_PER = 10;
/** Slip angle (rad) at which the driver is fully off the brake. */
const SLIDE_LET_GO = 0.15;
/** Metres the car's body keeps off the road edge when it leaves the line to pass or defend. */
const PASS_EDGE = 1;
const RAMP_SIDE = 0.5;
/**
 * Share over the plan a late brake carries, at most MISTAKE_SPEED m/s, the share of its pace a hesitation gives up, and
 * over how many road points. A flat 3 m/s took a 10 m/s hairpin at 30% over the plan, off the road.
 */
const MISTAKE_OVER = 0.1;
const MISTAKE_SPEED = 3;
const MISTAKE_LIFT = 0.12;
const MISTAKE_SPAN = 60;
/** Road points a mistake is rolled over (500 m), and the share of mistakes that are late brakes rather than hesitations. */
const SECTOR = 250;
const LATE_SHARE = 0.3;
/** Seconds a driver stays wary after touching a car, less this share of it at full aggression. */
const WARY = 5;
const WARY_BOLD = 0.6;
/** Seconds a stuck car reverses for, wheel the other way, before it drives on. */
const REVERSE_TIME = 1.5;
/** Road points ahead a driver off the line reads bends over, every HOLD_STRIDE. */
const HOLD_LOOK = 60;
const HOLD_STRIDE = 3;
/** m/s sideways a driver moves its aim off or back onto the line: a jump in aim at speed throws the car wide. */
const LATERAL_RATE = 1.5;

export interface Personality {
  /** Share of the line's planned speed it drives at: 0.96-1.02 drawn, times the difficulty and the car's grip. */
  pace: number;
  /** m/s it carries over the plan everywhere: a late braker. */
  brake_margin: number;
  /** 0..1: how tight it passes, how readily it defends. */
  aggression: number;
  /** Chance every SECTOR road points of a mistake: a late brake that runs wide, or a hesitation that costs time. */
  mistakes: number;
}

/** Metres off the centre past which a car is off the road: a hazard to the field, and on the clock toward a reset. */
export const OFF_ROAD = 7;

export const STEADY: Personality = { pace: 1, brake_margin: 0, aggression: 0, mistakes: 0 };

/** How far off the centre (m) a car may go to pass or defend at road point `index`; over a kicker's run, only RAMP_SIDE: posts flank its lip. */
export const pass_room = (car: Car, line: RaceLine, index: number) => (line.room[index] === 0 ? RAMP_SIDE : ROAD_HALF - car.spec.radius - PASS_EDGE);

const wrap_angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const never = () => 1;
const Y = new Vector3(0, 1, 0);
const level = new Quaternion();

/** Follows a `RaceLine` and writes pedals and wheel into its own `controls` every physics step, like a player's input. */
export class Driver {
  readonly controls: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
  index = 0;
  laps = 0;
  /** Metres off the line (along the road's right normal) the awareness asks it to hold; NaN follows the line. */
  hold = NaN;
  /** Share over its own pace it drives at while the awareness has it passing. */
  push = 1;
  /** Diving down the inside: it plans on the line's late braking curve (`RaceLine.late`), set by the awareness. */
  late = false;
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
  /** Metres off the centre of its grid slot's lane, held off the start until the field lets it go (NaN). */
  launch = NaN;
  /** Seconds of reversing left, set by the field's recovery. */
  reversing = 0;
  /** Metres past road point `index` a coasting car has gone, off the physics (`coast`). */
  along = 0;
  private mistake_at = -1;
  private mistake_late = false;
  private sector = -1;
  private last_err = NaN;
  private last_at = -1;
  private last_swing = 0;

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
    this.last_swing = 0;
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
    if (best < this.index - n / 2) this.laps++;
    else if (best > this.index + n / 2) this.laps--;
    this.index = best;
    const sector = Math.floor(best / SECTOR);
    if (sector !== this.sector) this.roll(sector);
  }

  private roll(sector: number) {
    this.sector = sector;
    if (this.rng() >= this.personality.mistakes) return;
    this.mistake_at = (sector * SECTOR + Math.floor(this.rng() * SECTOR)) % this.line.road.length;
    this.mistake_late = this.rng() < LATE_SHARE;
  }

  /** The speed (m/s) a coasting car moves at here: its pace on the line, under the awareness's cap. */
  private coast_speed(): number {
    return Math.min(this.cap, this.line.speed[this.index] * this.personality.pace);
  }

  /**
   * Moves the car along the line at its pace with no physics, level and on the road's height: the far, unseen car's
   * stand-in (H7), about a microsecond a step. The car's own state stays as it was left; `resume` hands it back.
   */
  coast(car: Car, dt: number) {
    const { line } = this;
    const n = line.road.length;
    const v = this.coast_speed();
    this.target = v;
    this.along += v * dt;
    while (this.along >= line.step[this.index]) {
      this.along -= line.step[this.index];
      this.index = (this.index + 1) % n;
      if (this.index === 0) this.laps++;
    }
    const i = this.index;
    const j = (i + 1) % n;
    const f = line.step[i] > 0 ? this.along / line.step[i] : 0;
    const dx = line.x[j] - line.x[i];
    const dz = line.z[j] - line.z[i];
    const heading = Math.atan2(dx, dz);
    car.pos.set(line.x[i] + dx * f, line.road[i].y + (line.road[j].y - line.road[i].y) * f + ride_height(car.spec), line.z[i] + dz * f);
    car.quat.copy(level.setFromAxisAngle(Y, heading));
    car.vel.set(Math.sin(heading) * v, 0, Math.cos(heading) * v);
    car.ang.set(0, 0, 0);
  }

  /** Puts a coasting car back on the physics where it stands, at its coasting speed and in the gear for it. */
  resume(car: Car, ground: Ground) {
    const v = this.coast_speed();
    const heading = car.heading;
    car.park(car.pos.x, car.pos.z, heading, ground);
    car.parked = false;
    car.vel.set(Math.sin(heading) * v, 0, Math.cos(heading) * v);
    const { spec } = car;
    const omega = v / spec.wheel.radius;
    for (const w of car.wheels) w.omega = omega;
    let gear = 1;
    while (gear < spec.gears.length && ((omega * spec.gears[gear - 1] * spec.final * 60) / (2 * Math.PI)) > spec.downshift + (spec.upshift - spec.downshift) / 2) gear++;
    car.gear = gear;
    this.along = 0;
    this.recovered();
  }

  /** Metres off the centre it drives at road point `j`, `aside` off the line or in its grid lane: the road's edge clamps it. */
  private lateral_at(car: Car, j: number): number {
    const room = pass_room(car, this.line, j);
    return Math.max(-room, Math.min(room, Number.isNaN(this.launch) ? this.line.offset[j] + this.aside : this.launch));
  }

  // Off the line it plans on the bend of the path it drives, the line shifted and clamped to the road: where the line
  // swings across the road and the edge holds the car, that path bends with the road, far tighter than the line. Each
  // bend's speed is brought back to now along the line's braking curve, and never over the line's own.
  private aside_pace(car: Car): number {
    const { line } = this;
    const { road } = line;
    const n = road.length;
    const plan = this.late ? line.late : line.speed;
    const brake = this.late ? AI_TUNING.late_brake : AI_TUNING.line_brake;
    let pace = Infinity;
    let run = 0;
    for (let k = 0; k < HOLD_LOOK; k += HOLD_STRIDE) {
      const i = (this.index + k) % n;
      const a = (i - CURVE_SPAN + n) % n;
      const c = (i + CURVE_SPAN) % n;
      const la = this.lateral_at(car, a);
      const li = this.lateral_at(car, i);
      const lc = this.lateral_at(car, c);
      const bend = inverse_radius(road[a].x + road[a].tz * la, road[a].z - road[a].tx * la, road[i].x + road[i].tz * li, road[i].z - road[i].tx * li, road[c].x + road[c].tz * lc, road[c].z - road[c].tx * lc);
      const grip = this.push > 1 ? Math.min(AI_TUNING.pass_max, grip_at(bend) * AI_TUNING.pass_grip) : grip_at(bend);
      const bank = line.bank[i];
      const v = bank === 0 ? Math.min(plan[i], Math.sqrt(grip / Math.max(1e-9, Math.abs(bend)))) : Math.min(plan[i], Math.max(bank_floor(bend, bank), bank_top(bend, bank, grip)));
      pace = Math.min(pace, Math.sqrt(v * v + 2 * brake * run));
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
    const slip = this.mistake_at >= 0 && (((this.index - this.mistake_at) % n) + n) % n < MISTAKE_SPAN;
    const here = pass_room(car, line, this.index);
    const want = Number.isNaN(this.hold) ? 0 : Math.max(-here, Math.min(here, line.offset[this.index] + this.hold)) - line.offset[this.index];
    const move = LATERAL_RATE * dt;
    // A grid lane is a fixed spot on the road: held at the easing rate, the car would drift after the line as it swings.
    if (Number.isNaN(this.launch)) this.aside += Math.max(-move, Math.min(move, want - this.aside));
    else this.aside = want;
    const plan = this.aside !== 0 ? this.aside_pace(car) : this.late ? line.late[this.index] : line.speed[this.index];
    const free = slip && !this.mistake_late ? plan * personality.pace * (1 - MISTAKE_LIFT) : plan * personality.pace * this.push + personality.brake_margin + (slip ? Math.min(MISTAKE_SPEED, MISTAKE_OVER * plan) : 0);
    const target = Math.min(this.cap, free);
    this.target = target;
    const look = target < HAIRPIN_PACE ? AIM_HAIRPIN : AI_TUNING.aim_base + Math.floor(speed / AI_TUNING.aim_per);
    const at = (this.index + look) % n;
    let ax = line.x[at];
    let az = line.z[at];
    if (this.aside !== 0 || this.nudge !== 0) {
      const p = line.road[at];
      const room = pass_room(car, line, at);
      const lateral = Math.max(-room, Math.min(room, (Number.isNaN(this.launch) ? line.offset[at] + this.aside : this.launch) + this.nudge));
      ax = p.x + p.tz * lateral;
      az = p.z - p.tx * lateral;
    }
    const err = wrap_angle(Math.atan2(ax - car.pos.x, az - car.pos.z) - car.heading);
    const c = this.controls;
    if (this.reversing > 0) {
      this.reversing -= dt;
      this.last_err = NaN;
      c.steer = Math.max(-1, Math.min(1, err * AI_TUNING.steer_gain));
      c.throttle = 0;
      c.brake = 1;
      return c;
    }
    let airborne = true;
    for (let w = 0; w < car.wheels.length; w++) if (car.wheels[w].contact) airborne = false;
    const slide = speed > 5 ? Math.abs(wrap_angle(Math.atan2(vx, vz) - car.heading)) : 0;
    const ease = Math.max(0, 1 - slide / SLIDE_LET_GO);
    // The aim steps a road point at a time: its jump read as a rate would kick the wheel to full lock for one step.
    const swing = Number.isNaN(this.last_err) ? 0 : at === this.last_at ? wrap_angle(err - this.last_err) / dt : this.last_swing;
    this.last_err = err;
    this.last_at = at;
    this.last_swing = swing;
    c.steer = airborne ? 0 : Math.max(-1, Math.min(1, -err * AI_TUNING.steer_gain - swing * AI_TUNING.steer_damp));
    c.throttle = speed < target ? 1 : 0;
    // Behind a car the brake is not eased for the turn: running into it costs more than a wide line.
    const capped = this.cap < free;
    const turn = capped ? 1 : Math.max(0.2, 1 - Math.abs(err) * 4);
    const pedal = capped ? Math.min(1, (speed - target) / CAP_BRAKE_PER) : Math.min(this.late ? LATE_PEDAL : BRAKE_MAX, (speed - target) / BRAKE_PER);
    c.brake = speed > target + BRAKE_SLACK ? pedal * turn * ease : 0;
    return c;
  }
}
