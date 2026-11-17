import { Quaternion, Vector3 } from "three";
import { ride_height, type Car, type Controls, type Ground } from "../car/car";
import { GRAVITY } from "../car/rigid-body";
import { grip_lock, LOCK_GRIP } from "../car/steering";
import { ROAD_HALF } from "../worldgen/types";
import { CURVE_SPAN, grip_at, inverse_radius, type RaceLine } from "./line";
import { AI_TUNING } from "./tuning";
import { atan2, axis_angle, cos, hypot, sin } from "../sim-math";

const TRACK_BACK = 5;
const TRACK_AHEAD = 40;
/** Behind a car, m/s over its cap per unit of pedal, up to full: the cap is a gap to keep, not a plan to ease into. */
const CAP_BRAKE_PER = 10;
/** Metres the car's body keeps off the road edge when it leaves the line to pass or defend. */
const PASS_EDGE = 1;
const RAMP_SIDE = 0.5;
/**
 * Share over the plan a late brake carries, at most MISTAKE_SPEED m/s, the share of its pace a hesitation gives up, and
 * over how many road points. A flat 3 m/s took a 10 m/s hairpin at 30% over the plan, off the road; a tenth over a
 * plan at 85% of the car's grip is more than it has, and the mistake was a spin, not a wide line.
 */
const MISTAKE_OVER = 0.05;
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
/** m/s under which the easing ahead is read as at this speed: a car near a stop is not a path that eases over minutes. */
const EASE_SPEED = 5;
/** Road points ahead the plan's drop is read over for the brake's feed-forward, and the m/s² a car slows at off both pedals. */
const SLOPE_SPAN = 3;
const COAST_DECEL = 1;
/**
 * m/s a car keeps over a kicker's toe and run under a car ahead: under it, it falls short into the frame. A car ahead
 * making under KICK_YIELD along the road is stopped or wedged there, and the floor gives way to it rather than run into it.
 */
const KICK_MIN = 20;
const KICK_YIELD = 8;
/** Metres off the path it drives (the line, `aside` off it, or its grid lane) past which it slows for the arc back to its aim. */
const AIM_OFF = 2;

export interface Personality {
  /** Share of the line's planned speed it drives at: 0.96-1.02 drawn, times the difficulty. */
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

/** `lateral` (m off the centre) held inside the pass room at road point `index` and off the steps and solids there (`RaceLine.lo` / `hi`). */
export function pass_clamp(car: Car, line: RaceLine, index: number, lateral: number): number {
  const room = pass_room(car, line, index);
  return Math.max(Math.max(-room, line.lo[index]), Math.min(Math.min(room, line.hi[index]), lateral));
}

const wrap_angle = (a: number) => atan2(sin(a), cos(a));
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
  /** m/s along the road of the slowest car that sets `cap`; Infinity with none. */
  ahead_speed = Infinity;
  /** m/s it aims at this step, cap included: what a follower reads as the speed this car is about to hold. */
  target = 0;
  /** Metres along the road's right normal the aim moves at once, past `aside`'s easing: set by the awareness to pull off a car overlapping alongside. */
  nudge = 0;
  /** Metres off the line it drives now, eased toward `hold` at LATERAL_RATE. */
  aside = 0;
  /** Metres off the line `aside` is easing to: `hold` inside its room, 0 with none. */
  private easing_to = 0;
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
    const heading = atan2(dx, dz);
    car.pos.set(line.x[i] + dx * f, line.road[i].y + (line.road[j].y - line.road[i].y) * f + ride_height(car.spec), line.z[i] + dz * f);
    car.quat.copy(axis_angle(level, Y, heading));
    car.vel.set(sin(heading) * v, 0, cos(heading) * v);
    car.ang.set(0, 0, 0);
  }

  /** Puts a coasting car back on the physics where it stands, at its coasting speed and in the gear for it. */
  resume(car: Car, ground: Ground) {
    const v = this.coast_speed();
    const heading = car.heading;
    car.park(car.pos.x, car.pos.z, heading, ground);
    car.parked = false;
    car.vel.set(0, 0, v).applyQuaternion(car.quat);
    const { spec } = car;
    const omega = v / spec.wheel.radius;
    for (const w of car.wheels) w.omega = omega;
    let gear = 1;
    while (gear < spec.gears.length && ((omega * spec.gears[gear - 1] * spec.final * 60) / (2 * Math.PI)) > spec.downshift + (spec.upshift - spec.downshift) / 2) gear++;
    car.gear = gear;
    this.along = 0;
    this.recovered();
  }

  /**
   * Metres off the centre it drives at road point `j`, off the line or in its grid lane: the road's edge clamps it. Ahead,
   * `aside` is where its easing will have it by then: aimed a second ahead at the `aside` of now, a car sat a second of
   * easing (1.5 m) wide of its path, past the edge of its room when the line swung the same way.
   */
  lateral_at(car: Car, j: number): number {
    if (!Number.isNaN(this.launch)) return pass_clamp(car, this.line, j, this.launch);
    const n = this.line.road.length;
    const ahead = ((j - this.index + n + (n >> 1)) % n) - (n >> 1);
    const move = ahead > 0 ? (LATERAL_RATE * ahead * this.line.step[this.index]) / Math.max(EASE_SPEED, hypot(car.vel.x, car.vel.z)) : 0;
    return pass_clamp(car, this.line, j, this.line.offset[j] + this.aside + Math.max(-move, Math.min(move, this.easing_to - this.aside)));
  }

  // Off the line it plans on the bend of the path it drives, the line shifted and clamped to the road: where the line
  // swings across the road and the edge holds the car, that path bends with the road, far tighter than the line. Each
  // bend's speed is brought back to now along the line's braking curve, and never over the line's own.
  private aside_pace(car: Car): number {
    const { line } = this;
    const { road } = line;
    const n = road.length;
    const plan = this.late ? line.late : line.speed;
    const brake = (this.late ? AI_TUNING.late_brake : AI_TUNING.line_brake) * line.scale.brake;
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
      // Onto a kicker's pin the path steps to the centre: no bend to slow for, and a lane braked for it met the lip at 16 m/s (seed 49).
      const pinned = line.room[a] === 0 || line.room[i] === 0 || line.room[c] === 0;
      const v = pinned ? plan[i] : Math.min(plan[i], Math.sqrt((this.push > 1 ? Math.min(AI_TUNING.pass_max * line.scale.slow, grip_at(bend, line.scale) * AI_TUNING.pass_grip) : grip_at(bend, line.scale) * AI_TUNING.aside_grip) / Math.max(1e-9, Math.abs(bend))));
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
    const speed = hypot(vx, vz);
    const slip = this.mistake_at >= 0 && (((this.index - this.mistake_at) % n) + n) % n < MISTAKE_SPAN;
    const want = Number.isNaN(this.hold) ? 0 : pass_clamp(car, line, this.index, line.offset[this.index] + this.hold) - line.offset[this.index];
    this.easing_to = want;
    const move = LATERAL_RATE * dt;
    // A grid lane is a fixed spot on the road: held at the easing rate, the car would drift after the line as it swings.
    if (Number.isNaN(this.launch)) this.aside += Math.max(-move, Math.min(move, want - this.aside));
    else this.aside = want;
    const plan = this.aside !== 0 ? this.aside_pace(car) : this.late ? line.late[this.index] : line.speed[this.index];
    const free = slip && !this.mistake_late ? plan * personality.pace * (1 - MISTAKE_LIFT) : plan * personality.pace * this.push + personality.brake_margin + (slip ? Math.min(MISTAKE_SPEED, MISTAKE_OVER * plan) : 0);
    // A kicker is taken at the line's own pace, never over: pace, a pass's push or a late brake over it launched a car into the frame by the toe, and the field piled up behind it.
    // Pace, a pass's push and a brake margin carry speed down the straights and into the braking, never through a bend
    // faster than its grip: the corner speeds braked for at late_brake are the most a car holds. Over them, cars ran
    // 2-4 m wide out of hairpins into the posts at the road's edge. A mistake is the one way over.
    const held = slip ? free : Math.min(free, line.late[this.index]);
    const kicker = line.ramp[this.index] >= 0;
    // Pinned onto a kicker's run, a car keeps KICK_MIN under any car ahead: held to a follower's gap, a car met the lip at
    // 16 m/s, fell into the frame and the field piled up behind it (seed 28, 90 m off the grid).
    const floor = kicker && line.room[this.index] === 0 && this.ahead_speed >= KICK_YIELD ? Math.min(KICK_MIN, line.speed[this.index]) : 0;
    const want_speed = Math.max(floor, Math.min(this.cap, kicker ? Math.min(held, line.speed[this.index]) : held));
    const look = want_speed < AI_TUNING.hairpin_pace ? AI_TUNING.aim_hairpin : AI_TUNING.aim_base + Math.floor(speed / AI_TUNING.aim_per);
    const at = (this.index + look) % n;
    let ax = line.x[at];
    let az = line.z[at];
    const here = line.road[this.index];
    const me = (car.pos.x - here.x) * here.tz - (car.pos.z - here.z) * here.tx;
    const over = Math.abs(me) - pass_room(car, line, this.index);
    // Aimed at the edge of its room through a bend, pure pursuit cuts the chord: a car held to the inside after a pass
    // ran 2 m past it into the posts (seeds 12, 30). Held off the line past its room, it aims as far back inside as it
    // is over; on the line it runs past the room out of hairpins clear of the posts, and pulling it in only cost pace.
    const back = over > 0 && this.aside !== 0 && line.room[at] > 0 ? Math.sign(me) * over : 0;
    const shifted = this.aside !== 0 || this.nudge !== 0 || back !== 0;
    if (shifted) {
      const p = line.road[at];
      const lateral = pass_clamp(car, line, at, pass_clamp(car, line, at, this.lateral_at(car, at) + this.nudge) - back);
      ax = p.x + p.tz * lateral;
      az = p.z - p.tx * lateral;
    }
    const err = wrap_angle(atan2(ax - car.pos.x, az - car.pos.z) - car.heading);
    // On its path and along it, the aim still sits off the nose through a bend. Steered at that whole angle, a car ran
    // 2 m inside its line in every bend and turned into hairpins 3 m early, on the road's edge at each apex. The wheel
    // holds the bend itself and corrects what the car is off its path by. A full wheel is LOCK_GRIP g of turn at any
    // speed (`grip_lock`), so the bend takes its share of that; the slip part of the lock goes by the tyres' load, or a
    // car pressed to twice its weight (the fujin at 65 m/s) turned in on a full wheel for a bend it needed a fifth for.
    const before = (this.index - 1 + n) % n;
    const after = (this.index + 1) % n;
    let hx = line.x[this.index];
    let hz = line.z[this.index];
    let tx = line.x[after] - line.x[before];
    let tz = line.z[after] - line.z[before];
    let px = line.x[at];
    let pz = line.z[at];
    if (shifted) {
      const b = line.road[before];
      const a = line.road[after];
      const p = line.road[at];
      const lb = this.lateral_at(car, before);
      const lh = this.lateral_at(car, this.index);
      const la = this.lateral_at(car, after);
      const lp = this.lateral_at(car, at);
      hx = here.x + here.tz * lh;
      hz = here.z - here.tx * lh;
      tx = a.x + a.tz * la - (b.x + b.tz * lb);
      tz = a.z - a.tx * la - (b.z - b.tx * lb);
      px = p.x + p.tz * lp;
      pz = p.z - p.tx * lp;
    }
    const stray = wrap_angle(err - wrap_angle(atan2(px - hx, pz - hz) - atan2(tx, tz)));
    const square = Math.max(1, speed * speed);
    const slip_lock = 1 - (car.spec.wheelbase * GRAVITY * LOCK_GRIP) / square / grip_lock(car.spec, speed);
    const pressed = (car.spec.downforce * square) / (car.spec.mass * GRAVITY);
    const hold_bend = ((speed * speed * line.bend[this.index]) / (LOCK_GRIP * GRAVITY)) * (1 - (slip_lock * pressed) / (1 + pressed)) * AI_TUNING.steer_lead;
    // Wide of its path, the arc back to the aim is far tighter than the plan's bend: on full lock and full throttle
    // over it, cars ran off the far side of the road (seeds 9, 40). The aim's arc (pure pursuit) caps the speed there;
    // on its path the plan already holds the bend, and the cap only cost pace.
    const off = Math.abs(me - this.lateral_at(car, this.index)) > AIM_OFF;
    const arc = off ? (2 * Math.abs(sin(err))) / Math.max(1, hypot(ax - car.pos.x, az - car.pos.z)) : 0;
    const target = Math.max(floor, Math.min(want_speed, Math.sqrt((AI_TUNING.pass_max * line.scale.slow) / Math.max(1e-9, arc))));
    this.target = target;
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
    const slide = speed > 5 ? Math.abs(wrap_angle(atan2(vx, vz) - car.heading)) : 0;
    const ease = Math.max(0, 1 - slide / AI_TUNING.slide_let_go);
    // The aim steps a road point at a time: its jump read as a rate would kick the wheel to full lock for one step.
    const swing = Number.isNaN(this.last_err) ? 0 : at === this.last_at ? wrap_angle(err - this.last_err) / dt : this.last_swing;
    this.last_err = err;
    this.last_at = at;
    this.last_swing = swing;
    c.steer = airborne ? 0 : Math.max(-1, Math.min(1, hold_bend - stray * AI_TUNING.steer_gain - swing * AI_TUNING.steer_damp));
    c.throttle = speed < target ? 1 : 0;
    // Behind a car the brake is not eased for the turn: running into it costs more than a wide line.
    const capped = this.cap < free;
    const turn = capped ? 1 : Math.max(0.2, 1 - Math.abs(err) * AI_TUNING.brake_turn);
    // In a braking zone the pedal follows the profile's slope from its first metre: waiting for the slack over it, then
    // feeding back on the overspeed alone, was the long light trail that started braking 250 m early.
    const decel = this.plan_decel(personality.pace * this.push);
    const feed = Math.max(0, decel - COAST_DECEL) / (AI_TUNING.brake_gain * line.scale.brake);
    const pedal = capped ? Math.min(1, feed + (speed - target) / CAP_BRAKE_PER) : Math.min(this.late ? AI_TUNING.late_pedal : AI_TUNING.brake_max, feed + (speed - target) / AI_TUNING.brake_per);
    c.brake = speed > target + (decel > 0 ? 0 : AI_TUNING.brake_slack) ? pedal * turn * ease : 0;
    return c;
  }

  /** Deceleration (m/s²) the plan asks for here, its speeds times `scale`: their drop over the next SLOPE_SPAN road points. */
  private plan_decel(scale: number): number {
    const { line } = this;
    const plan = this.late ? line.late : line.speed;
    const n = plan.length;
    let run = 0;
    for (let k = 0; k < SLOPE_SPAN; k++) run += line.step[(this.index + k) % n];
    const a = plan[this.index] * scale;
    const b = plan[(this.index + SLOPE_SPAN) % n] * scale;
    return run > 0 ? Math.max(0, (a * a - b * b) / (2 * run)) : 0;
  }
}
