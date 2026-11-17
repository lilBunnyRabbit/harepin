import type { Car } from "../car/car";
import { OFF_ROAD, pass_clamp, pass_room, type Driver } from "./driver";
import type { RaceLine } from "./line";
import { AI_TUNING } from "./tuning";
import { atan2, cos, hypot, sin } from "../sim-math";

/** Metres ahead a car is looked at, plus this many per m/s of the looker's speed. */
const LOOK = 15;
const LOOK_PER = 1.2;
/** Road points apart under which a gap is measured from the car positions. */
const NEAR_POINTS = 20;
/** Lateral metres between centres under which a car ahead is in the way, and under which a car in trouble is. */
const IN_LANE = 2.6;
const HAZARD_LANE = 6;
/** Slip angle (rad) past which a car is in trouble (as is one off the road), and the share of its speed under which it is moving across the road. */
const TROUBLE_SLIDE = 0.5;
const TROUBLE_ALONG = 0.5;
const TROUBLE_SPEED = 3;
/** Lateral metres between centres a pass keeps off a car in trouble: room for it to slide a body width toward the passer. */
const TROUBLE_FLANK = 4;
/** m/s over a car in trouble's speed along the road a passer goes by it at: what a late slide into it would hit with. */
const TROUBLE_CLOSE = 8;
/** Lateral metres between centres a pass lane must keep off the passed car: two half widths and room for a slide. */
const PASS_FLANK = 2.8;
/** Metres off the centre a passing car drives in, in the half of the road the passed car is not in. */
const PASS_LANE = 2.8;
/** Metres of IN_LANE an aggressive driver (1) shaves off before it calls a pass squeezed. */
const PASS_TIGHT = 0.3;
/** Metres along the road under which a car counts as alongside, and the side gap it keeps from it. */
const ALONGSIDE = 5;
const SIDE_GAP = 3.6;
/** Metres to the side a car alongside is looked at (the road's width), and road points ahead its lane is read against the line. */
const BESIDE = 9;
const BESIDE_LOOK = 60;
/** Most metres the guard moves the aim off a car alongside, and the metres past IN_LANE it aims to open the gap to. */
const NUDGE_MAX = 1.5;
const NUDGE_MARGIN = 0.4;
/** m/s under the other car a squeezed driver drops to. */
const YIELD = 1.5;
/** m/s under a faster passer alongside a timid driver (0) lifts to, none at full aggression: the bold ones make it a fight. */
const CONCEDE = 1.5;
/** Metres a follower keeps behind a car in its lane, and the braking (m/s²) it plans to close down to it. */
const FOLLOW = 10;
const FOLLOW_BRAKE = 4;
/** Metres of FOLLOW a fully aggressive driver closes up: on the bumper, it has the run to pull out. */
const FOLLOW_BOLD = 5;
/** Shares of the plan where it is that a car ahead makes: under PACE_OFF it is slow for its own reasons, from PACE_ON up it is on the pace. */
const PACE_OFF = 0.7;
const PACE_ON = 0.85;
/** Metres past its follow gap inside which a driver pulls out to pass: from farther back it only loses time off the line. */
const PASS_REACH = 12;
/** Seconds a pass may wait behind for its side to open before it is given up and the lane picked again. */
const PASS_WAIT = 3;
/** Road points ahead a pass lane must stay clear over to start, and to go on while the nose is still behind, read every LANE_STRIDE. */
const PASS_START = 30;
const PASS_KEEP = 20;
const LANE_STRIDE = 2;
/** Metres a car off the grid keeps behind the one ahead in its lane: every car pulls away at full throttle together. */
const LAUNCH_KEEP = 4;
/** Metres a passer keeps behind the car it is passing while its line still overlaps: close enough to pull alongside. */
const PASS_FOLLOW = 3;
/** m/s under the car ahead per metre a follower is inside FOLLOW. */
const BACK_OFF = 1;
/** Pace share or m/s of speed a driver must have over the car ahead before it pulls out to pass. */
const PASS_PACE = 0.005;
const PASS_SPEED = 1.5;
/**
 * Seconds a driver takes to pull out of a lane: with a way by on a calm road it may close on the car ahead as fast as
 * leaves it PASS_FOLLOW behind after that long, and it pulls out when RUN_LEAD times that is all it has left. Held to
 * a follower's gap, a car in the tow shed the speed the tow gave it and pulled out with none.
 */
const PULL_OUT = 2;
/** Road points ahead a straight is read over. */
const STRAIGHT_LOOK = 300;
const RUN_LEAD = 1.5;
/** Metres a passed car must be behind before the pass is done. */
const PASS_DONE = 5;
/** A pass starts only where the next PASS_CALM road points hold their pace (CALM_SHARE of now) and bend gently (1/m): two abreast into a bend is where they touch. */
const PASS_CALM = 60;
const CALM_SHARE = 0.85;
/** Sharpest bend (1/m) a pass starts into for a timid driver, plus this much at full aggression: two abreast fit a wide corner. */
const CALM_BEND = 0.004;
/** Aggression over which a driver starts a pass into a bend, and metres past the car ahead its pass lane must be clear. */
const DIVE = 0.85;
/** Aggression over which a driver goes around the outside of a car ahead covering the inside, rather than sitting out its braking zone. */
const OUTSIDE = 0.6;
const PASS_WINDOW = 15;
/** Pace share a fully aggressive driver adds while passing: off the line it needs more than its own pace to get by. */
const PUSH = 0.1;
/** Metres ahead past which a pass is given up: the other car got away. */
const PASS_ABORT = 25;
/** Metres a defender looks behind for an attacker (past DEFEND_CLEAR: closer it would cut across its nose), and road points ahead it looks for a braking zone. */
const DEFEND_CLEAR = 8;
const DEFEND_BEHIND = 20;
const DEFEND_LOOK = 40;
/** m/s the plan drops over DEFEND_LOOK that makes it a braking zone worth covering. */
const DEFEND_DROP = 5;
/** Metres off the centre a defender takes on the inside. */
const DEFEND_LATERAL = 2.5;
/** Metres ahead of a kicker's run (pass room 0) a field goes single file: a challenge frame's gap fits one car. */
const KICKER_LOOK = 60;
/** Road points ahead the inside of the next bend is read from: where the line runs slowest. */
const BEND_LOOK = 100;
/** Road points ahead a braking zone is looked for to dive into, and the m/s the plan must drop over them. */
const DIVE_LOOK = 60;
const DIVE_DROP = 5;
/** Metres past its follow gap from which a driver dives down the inside: from the braking zone it has the late brake to close it. */
const DIVE_REACH = 15;
/** Pace share a driver may be under the car ahead and still dive: equal cars only get by on the brakes. */
const DIVE_SLOWER = 0.02;
/** Metres the diver's centre may be behind the defender's for the two to count as overlapped: the defender gives it the apex. */
const OVERLAP = 5;
/** Seconds before the apex by which a dive must have that overlap: later the car ahead is turning in across its nose, and it backs out. */
const DIVE_COMMIT = 2;

/**
 * Runs at 20 Hz over the whole field: from each car's place on the road it picks a lane for every driver (follow the
 * line, pull out past a slower car on the side with room toward the next bend's inside, hold a gap to a car alongside,
 * cover the inside into a braking zone once per straight) and caps its speed behind a car it cannot pass.
 */
export class Awareness {
  private readonly progress: Float64Array;
  private readonly lateral: Float64Array;
  /** Metres off the line, where `lateral` is off the centre: a pass rides the other car's line shifted, as the line swings. */
  private readonly rel: Float64Array;
  private readonly speed: Float64Array;
  /** m/s along the road, and whether the car is spinning, crossing the road or reversing: a hazard to plan around, not a car to follow. */
  private readonly along: Float64Array;
  private readonly trouble: Uint8Array;
  private readonly defend_until: Int32Array;
  /** defend_roll[i * n + j]: whether driver i defends against attacker j, rolled once on aggression; -1 not rolled yet. */
  private readonly defend_roll: Int8Array;
  /** The car each driver is passing (-1 for none) and the side it goes by on, held until it is clear past. */
  private readonly passing: Int32Array;
  private readonly pass_side: Int8Array;
  /** Seconds each driver's pass has waited behind for its side to open. */
  private readonly waited: Float64Array;
  /** The apex (road point) each driver's dive down the inside runs to, -1 for none; and the last braking zone it rolled for. */
  private readonly dive_until: Int32Array;
  private readonly dive_zone: Int32Array;
  private readonly dive_roll: Uint8Array;
  /** Scratch of `decide`: the cars ahead in the driver's lane, and how far. */
  private readonly queued: Uint8Array;
  private readonly gaps: Float64Array;
  /** Set by `straight`: the inside (-1 or 1, along the right normal) of the bend the calm road ahead ends in. */
  private corner_side = 1;
  private dt = 0;

  constructor(
    private readonly cars: readonly Car[],
    private readonly drivers: readonly Driver[],
    private readonly rng: () => number,
    /** How many of `cars`, from the first, the field drives: the rest (the player's) have no pace to read. */
    private readonly driven = cars.length,
    /** gone[i] set: car i is off the track (`Field.retire`), seen by no one and driven by no lane. */
    private readonly gone: Uint8Array = new Uint8Array(cars.length),
  ) {
    this.progress = new Float64Array(cars.length);
    this.lateral = new Float64Array(cars.length);
    this.rel = new Float64Array(cars.length);
    this.speed = new Float64Array(cars.length);
    this.along = new Float64Array(cars.length);
    this.trouble = new Uint8Array(cars.length);
    this.defend_until = new Int32Array(cars.length).fill(-1);
    this.defend_roll = new Int8Array(cars.length * cars.length).fill(-1);
    this.passing = new Int32Array(cars.length).fill(-1);
    this.pass_side = new Int8Array(cars.length);
    this.waited = new Float64Array(cars.length);
    this.dive_until = new Int32Array(cars.length).fill(-1);
    this.dive_zone = new Int32Array(cars.length).fill(-1);
    this.dive_roll = new Uint8Array(cars.length);
    this.queued = new Uint8Array(cars.length);
    this.gaps = new Float64Array(cars.length);
  }

  /** Signed metres off the centre along the road's right normal (tz, -tx). */
  static lateral_of(car: Car, driver: Driver): number {
    const p = driver.line.road[driver.index];
    return (car.pos.x - p.x) * p.tz - (car.pos.z - p.z) * p.tx;
  }

  /** `dt`: seconds since the last update. */
  update(dt: number) {
    this.dt = dt;
    const { cars, drivers } = this;
    for (let i = 0; i < cars.length; i++) {
      this.progress[i] = drivers[i].progress;
      this.lateral[i] = Awareness.lateral_of(cars[i], drivers[i]);
      this.rel[i] = this.lateral[i] - drivers[i].line.offset[drivers[i].index];
      const { vel, heading } = cars[i];
      const v = hypot(vel.x, vel.z);
      const p = drivers[i].line.road[drivers[i].index];
      this.speed[i] = v;
      this.along[i] = vel.x * p.tx + vel.z * p.tz;
      const slide = Math.abs(atan2(sin(atan2(vel.x, vel.z) - heading), cos(atan2(vel.x, vel.z) - heading)));
      const off = Math.abs(this.lateral[i]) > OFF_ROAD;
      this.trouble[i] = drivers[i].reversing > 0 || off || (v > TROUBLE_SPEED && (slide > TROUBLE_SLIDE || this.along[i] < TROUBLE_ALONG * v)) ? 1 : 0;
    }
    for (let i = 0; i < cars.length; i++) {
      if (this.gone[i]) continue;
      this.decide(i);
      this.guard(i);
    }
  }

  /** Metres car j is ahead of car i along the road; Infinity for a car off the track, which is never near. */
  private gap(i: number, j: number): number {
    if (this.gone[j]) return Infinity;
    const line = this.drivers[i].line;
    const n = line.road.length;
    const d = ((((this.progress[j] - this.progress[i]) % n) + n + n / 2) % n) - n / 2;
    if (Math.abs(d) > NEAR_POINTS) return d * (line.step[this.drivers[i].index] || 2);
    // Close by, the road points are too coarse for a gap that decides a rear-end: measure it along i's tangent.
    const p = line.road[this.drivers[i].index];
    const a = this.cars[i].pos;
    const b = this.cars[j].pos;
    return (b.x - a.x) * p.tx + (b.z - a.z) * p.tz;
  }

  private inside(driver: Driver): number {
    const { line } = driver;
    const n = line.road.length;
    let slowest = driver.index;
    for (let k = 1; k < BEND_LOOK; k++) {
      const i = (driver.index + k) % n;
      if (line.speed[i] < line.speed[slowest]) slowest = i;
    }
    return Math.sign(line.offset[slowest]) || 1;
  }

  private decide(i: number) {
    const driver = this.drivers[i];
    const me = this.lateral[i];
    const v = this.speed[i];
    const aggression = driver.personality.aggression;
    let blocker = -1;
    let blocker_gap = Infinity;
    let beside = -1;
    let attacker = -1;
    let cover = -1;
    let cover_gap = Infinity;
    driver.cap = Infinity;
    driver.ahead_speed = Infinity;
    const keep = this.keep(driver);
    for (let j = 0; j < this.cars.length; j++) {
      this.queued[j] = 0;
      if (j === i) continue;
      const gap = this.gap(i, j);
      const dl = this.lateral[j] - me;
      if (Math.abs(gap) < ALONGSIDE && Math.abs(dl) < BESIDE) beside = j;
      // A car in trouble blocks the whole road, except to the car already going by it with TROUBLE_FLANK to spare.
      const width = this.trouble[j] ? (this.passing[i] === j ? TROUBLE_FLANK : HAZARD_LANE) : IN_LANE;
      // Beside its lane now, a car ahead may still sit where the driver's path runs by the time it gets there: the line swings
      // across the road, and a car two metres to the side was closed on at 15 m/s as the line came over to it (seed 6).
      const across = gap > 0 ? Math.min(Math.abs(dl), Math.abs(this.lateral[j] - driver.lateral_at(this.cars[i], this.drivers[j].index))) : Math.abs(dl);
      if (gap > 0 && gap < LOOK + LOOK_PER * v && across < width) {
        // Every car ahead in its lane caps it, not the nearest alone: behind two cars a row apart, it ran into the slower one past the first.
        this.queued[j] = 1;
        this.gaps[j] = gap;
        // Pulling out, it closes as fast as the move leaves room for; a dive closes under braking, where the lane ahead is the other car's too.
        this.hold(driver, j, j !== this.passing[i] ? this.follow(i, j, gap, keep) : this.dive_until[i] >= 0 ? this.follow(i, j, gap, PASS_FOLLOW) : this.run_cap(i, j, gap));
        if (gap < blocker_gap) {
          blocker = j;
          blocker_gap = gap;
        }
      }
      if (gap > 0 && gap < LOOK + LOOK_PER * v && this.defend_until[j] >= 0 && gap < cover_gap) {
        cover = j;
        cover_gap = gap;
      }
      if (gap < -DEFEND_CLEAR && -gap < DEFEND_BEHIND && this.speed[j] > v) attacker = j;
    }
    driver.push = 1;
    driver.late = false;
    const kicker = this.kicker_ahead(driver);
    const line = driver.line;
    const n = line.road.length;
    const room = pass_room(this.cars[i], driver.line, driver.index);
    const base = line.offset[driver.index];
    const lane = Math.min(room, PASS_LANE);
    const target = this.passing[i];
    if (target >= 0 && (driver.wary > 0 || kicker) && this.gap(i, target) > 0) this.end_pass(i);
    else if (target >= 0) {
      const gap = this.gap(i, target);
      // Not by before the braking zone: on the bend's inside the pass goes on as a dive, on its outside with the nose
      // still behind it is off, since round the outside the road is longer and the bend closes on it.
      const apex = this.dive_until[i] < 0 && gap > -PASS_DONE ? this.braking_zone(driver) : -1;
      if (apex >= 0 && this.pass_side[i] === (Math.sign(line.offset[apex]) || 1)) this.dive_until[i] = apex;
      else if (this.dive_until[i] < 0 && (apex >= 0 || this.bends(driver, PASS_KEEP)) && gap > 0 && !this.trouble[target]) {
        this.end_pass(i);
        driver.hold = NaN;
        return;
      }
      // A dive holds the inside past the apex until it is by: let back onto the line there, it met the car it had
      // out-braked turning in. Past the apex with the nose still behind, it did not make it.
      const diving = this.dive_until[i] >= 0;
      const braking = diving && this.ahead_of(driver.index, this.dive_until[i], n);
      const committed = braking && (((this.dive_until[i] - driver.index + n) % n) * line.step[driver.index]) < v * DIVE_COMMIT;
      if (diving && gap > (committed ? OVERLAP : braking ? Infinity : 0)) {
        // Backed out, it does not dive into this zone again.
        this.dive_roll[i] = 0;
        this.end_pass(i);
        driver.hold = NaN;
        return;
      }
      // No room ahead on this side: still behind, it waits off the other's bumper for the line to swing back, its lane
      // held, since chasing the other side across the road at every swing never gets it alongside; alongside, it is off.
      const wait = !diving && gap > 0 && !this.lane_clear(i, target, this.pass_side[i], PASS_KEEP);
      // A pass rides the passed car's line shifted by a side gap, so the two swing together; the road's edge clamps it.
      // A dive holds the inside lane down to the apex, wherever the other car's line swings.
      const hold = diving ? this.pass_side[i] * lane - base : this.flank_hold(i, target, this.pass_side[i], this.flank(target));
      const at = pass_clamp(this.cars[i], line, driver.index, base + hold);
      // Squeezed alongside with the nose still behind: the car being passed has come over, so the pass is off.
      const squeezed = gap > 0 && gap < ALONGSIDE && (wait || Math.abs(this.lateral[target] - at) < (this.trouble[target] ? TROUBLE_FLANK : IN_LANE - aggression * PASS_TIGHT));
      if (gap > -PASS_DONE && gap < PASS_ABORT && !squeezed) {
        // Waiting, it follows on its own line: held out on the passed car's flank, the road's edge bends its path tighter than the line.
        driver.hold = wait ? NaN : hold;
        driver.push = 1 + PUSH * aggression;
        driver.late = braking;
        if (wait) this.hold(driver, target, this.follow(i, target, gap, PASS_FOLLOW));
        this.waited[i] = wait ? this.waited[i] + this.dt : 0;
        if (this.waited[i] > PASS_WAIT) this.end_pass(i);
        if (this.trouble[target] && gap > -ALONGSIDE) this.hold(driver, target, Math.max(0, this.along[target]) + TROUBLE_CLOSE);
        return;
      }
      this.end_pass(i);
    }
    // Overlapped down the inside into a braking zone, the defender gives the apex up and runs round the outside.
    const diver = this.diver_on(i);
    if (diver >= 0) {
      driver.hold = this.flank_hold(i, diver, -Math.sign(this.lateral[diver] - me) || -1, SIDE_GAP);
      return;
    }
    if (this.defend_until[i] >= 0 && beside < 0 && this.ahead_of(driver.index, this.defend_until[i], n)) {
      driver.hold = this.inside(driver) * DEFEND_LATERAL - base;
      return;
    }
    this.defend_until[i] = -1;
    if (blocker >= 0) {
      const other = this.lateral[blocker];
      // The half of the road the car ahead is not in, the next bend's inside when it sits in the middle.
      // The inside of the bend the straight ends in first: a pass not done by then goes on from there as a dive.
      const straight = this.straight(driver);
      const away = this.corner_side;
      const reach = blocker_gap + PASS_WINDOW;
      const pick = this.side_open(i, blocker, away, lane, room, reach) ? away : this.side_open(i, blocker, -away, lane, room, reach) ? -away : 0;
      const bend = straight < v * PULL_OUT;
      // A bold driver dives into a braking zone; the rest pass only where the road stays calm.
      // A car in trouble is passed only on a side that leaves TROUBLE_FLANK, however calm the road.
      const clear_of = !this.trouble[blocker] || Math.abs(Math.max(-room, Math.min(room, other + pick * TROUBLE_FLANK)) - other) >= TROUBLE_FLANK;
      if (this.dive(i, blocker, blocker_gap, kicker, lane, room)) return;
      const way = pick !== 0 && driver.wary <= 0 && !kicker && clear_of && (!bend || this.trouble[blocker] === 1);
      const their = Math.max(0, this.along[blocker]);
      const closing = v - their;
      // With a way by, the car ahead is no wall: the tow's speed is kept for the pull-out.
      if (way && !this.trouble[blocker]) {
        driver.cap = Infinity;
        driver.ahead_speed = Infinity;
        for (let j = 0; j < this.cars.length; j++) if (this.queued[j]) this.hold(driver, j, j === blocker ? this.run_cap(i, j, blocker_gap) : this.follow(i, j, this.gaps[j], keep));
      }
      // It pulls out with the speed to get by: closing with only the pull-out's room left, or on a car well under the pace.
      const by = closing > PASS_SPEED && ((blocker_gap + PASS_DONE) / closing) * v < straight;
      const run = closing > PASS_SPEED && blocker_gap - PASS_FOLLOW < closing * PULL_OUT * RUN_LEAD && (by || pick === away);
      const slow = their < PACE_ON * line.speed[this.drivers[blocker].index] * driver.personality.pace && blocker_gap < keep + PASS_REACH;
      if (way && (run || slow || this.trouble[blocker] === 1)) {
        this.passing[i] = blocker;
        this.dive_until[i] = -1;
        this.pass_side[i] = pick;
        driver.hold = this.flank_hold(i, blocker, pick, this.flank(blocker));
        driver.push = 1 + PUSH * aggression;
        return;
      }
    }
    // A car covering the inside has left the outside open: a bold driver takes it into the braking zone.
    if (blocker < 0 && cover >= 0 && cover_gap < keep + PASS_REACH && aggression > OUTSIDE && driver.wary <= 0 && !kicker && !this.trouble[cover] && this.faster(i, cover)) {
      const outside = -Math.sign(this.lateral[cover]) || 1;
      if (this.side_open(i, cover, outside, lane, room, cover_gap + PASS_WINDOW)) {
        this.passing[i] = cover;
        this.dive_until[i] = -1;
        this.pass_side[i] = outside;
        driver.hold = this.flank_hold(i, cover, outside, SIDE_GAP);
        driver.push = 1 + PUSH * aggression;
        return;
      }
    }
    // Ahead of a car alongside, a driver keeps its line: the one behind has to find the room or lift.
    if (beside >= 0 && !this.trouble[beside] && this.gap(i, beside) < 0 && beside >= this.driven) beside = -1;
    // Across the road from it, a car alongside is in the way only where the line swings over to its lane: the room is
    // left from BESIDE_LOOK back, since the line crosses a road faster than a car can be eased off it.
    if (beside >= 0 && Math.abs(this.lateral[beside] - me) >= SIDE_GAP + 0.5) {
      const side = -Math.sign(this.lateral[beside] - me);
      if (side * this.flank_hold(i, beside, side, SIDE_GAP, BESIDE_LOOK) <= 0) beside = -1;
    }
    if (beside >= 0) {
      const dl = this.lateral[beside] - me;
      const at = this.flank_hold(i, beside, -Math.sign(dl) || -1, SIDE_GAP, Math.abs(dl) < SIDE_GAP + 0.5 ? PASS_KEEP : BESIDE_LOOK);
      driver.hold = at;
      // Squeezed against the edge: the car with its nose behind gives the corner up rather than leaning on the other.
      if (Math.abs(base + at) > room && this.gap(i, beside) > 0) this.hold(driver, beside, Math.max(0, this.speed[beside] - YIELD));
      return;
    }
    if (!Number.isNaN(driver.launch)) {
      driver.hold = driver.launch - base;
      return;
    }
    driver.hold = NaN;
    // One roll per attacker for the race: rolled every tick, a timid driver defends within a second.
    const roll = i * this.cars.length + attacker;
    if (attacker >= 0 && this.defend_roll[roll] < 0) this.defend_roll[roll] = this.rng() < aggression ? 1 : 0;
    if (attacker >= 0 && blocker < 0 && !kicker && this.defend_roll[roll] === 1) {
      let drop = 0;
      for (let k = 1; k < DEFEND_LOOK; k++) drop = Math.max(drop, line.speed[driver.index] - line.speed[(driver.index + k) % n]);
      if (drop > DEFEND_DROP) {
        let slowest = driver.index;
        for (let k = 1; k < BEND_LOOK; k++) if (line.speed[(driver.index + k) % n] < line.speed[slowest]) slowest = (driver.index + k) % n;
        this.defend_until[i] = slowest;
        driver.hold = this.inside(driver) * DEFEND_LATERAL - base;
      }
    }
  }

  /**
   * Metres of calm road ahead of the driver, up to STRAIGHT_LOOK road points; sets `corner_side` to the inside of the
   * bend it ends in (the side the line runs on where it is slowest over the BEND_LOOK points from there).
   */
  private straight(driver: Driver): number {
    const { line } = driver;
    const n = line.road.length;
    let k = 0;
    let run = 0;
    for (; k < STRAIGHT_LOOK; k += LANE_STRIDE) {
      const at = (driver.index + k) % n;
      if (line.speed[at] < CALM_SHARE * line.speed[driver.index] || Math.abs(line.bend[at]) > CALM_BEND) break;
      run += line.step[at] * LANE_STRIDE;
    }
    let slowest = (driver.index + k) % n;
    for (let b = 1; b < BEND_LOOK; b++) if (line.speed[(driver.index + k + b) % n] < line.speed[slowest]) slowest = (driver.index + k + b) % n;
    this.corner_side = Math.sign(line.offset[slowest]) || 1;
    return run;
  }

  /** Whether the next `span` road points bend past CALM_BEND or drop under CALM_SHARE of the pace here: no road to go two abreast on. */
  private bends(driver: Driver, span: number): boolean {
    const { line } = driver;
    const n = line.road.length;
    for (let k = 0; k < span; k += 4) {
      const at = (driver.index + k) % n;
      if (line.speed[at] < CALM_SHARE * line.speed[driver.index] || Math.abs(line.bend[at]) > CALM_BEND) return true;
    }
    return false;
  }

  private end_pass(i: number) {
    this.passing[i] = -1;
    this.dive_until[i] = -1;
  }

  /**
   * The apex (the plan's low point) of a braking zone starting within DIVE_LOOK ahead of driver i, or -1 when the plan
   * holds. Followed past the window to where the plan rises again: the window's own slowest point moves on every tick
   * inside a zone, and a roll keyed to it would be rolled again each time.
   */
  private braking_zone(driver: Driver): number {
    const { line } = driver;
    const n = line.road.length;
    let slowest = driver.index;
    for (let k = 1; k < DIVE_LOOK; k++) if (line.speed[(driver.index + k) % n] < line.speed[slowest]) slowest = (driver.index + k) % n;
    if (line.speed[driver.index] - line.speed[slowest] <= DIVE_DROP) return -1;
    for (let k = 0; k < n && line.speed[(slowest + 1) % n] <= line.speed[slowest]; k++) slowest = (slowest + 1) % n;
    return slowest;
  }

  /**
   * A dive down the inside of the car ahead into the next braking zone, rolled once a zone on aggression: the diver
   * brakes later than the line (`Driver.late`) and holds the inside lane to the apex. True when one starts.
   */
  private dive(i: number, blocker: number, gap: number, kicker: boolean, lane: number, room: number): boolean {
    const driver = this.drivers[i];
    if (this.trouble[blocker] || driver.wary > 0 || kicker || gap > this.keep(driver) + DIVE_REACH) return false;
    if (blocker < this.driven && driver.personality.pace < this.drivers[blocker].personality.pace - DIVE_SLOWER) return false;
    const apex = this.braking_zone(driver);
    if (apex < 0) return false;
    if (this.dive_zone[i] !== apex) {
      this.dive_zone[i] = apex;
      this.dive_roll[i] = this.rng() < driver.personality.aggression ? 1 : 0;
    }
    const side = Math.sign(driver.line.offset[apex]) || 1;
    if (!this.dive_roll[i] || !this.open(i, side * lane, room, gap + PASS_WINDOW)) return false;
    this.passing[i] = blocker;
    this.pass_side[i] = side;
    this.dive_until[i] = apex;
    this.waited[i] = 0;
    driver.hold = side * lane - driver.line.offset[driver.index];
    driver.push = 1 + PUSH * driver.personality.aggression;
    driver.late = true;
    return true;
  }

  /**
   * The car overlapping driver i down the inside into a braking zone, -1 for none: an AI car diving on it, or the
   * player's car there on its own.
   */
  private diver_on(i: number): number {
    const driver = this.drivers[i];
    for (let j = 0; j < this.cars.length; j++) {
      if (j === i) continue;
      const gap = this.gap(i, j);
      if (gap > 0 || gap < -OVERLAP) continue;
      const dl = this.lateral[j] - this.lateral[i];
      if (Math.abs(dl) > SIDE_GAP + 0.5 || this.trouble[j]) continue;
      if (j < this.driven ? this.passing[j] === i && this.dive_until[j] >= 0 : this.player_dives(driver, dl)) return j;
    }
    return -1;
  }

  /** Whether the player's car, `dl` metres to driver's side, is on the inside of a braking zone ahead. */
  private player_dives(driver: Driver, dl: number): boolean {
    const apex = this.braking_zone(driver);
    return apex >= 0 && Math.sign(dl) === Math.sign(driver.line.offset[apex]);
  }

  /**
   * Last word over whatever lane was picked: a car overlapping alongside inside IN_LANE pulls the aim off it at once,
   * and the one with its nose behind drops back.
   */
  private guard(i: number) {
    const driver = this.drivers[i];
    driver.nudge = 0;
    let near = -1;
    let near_dl = 0;
    let near_in = 0;
    for (let j = 0; j < this.cars.length; j++) {
      if (j === i) continue;
      const dl = this.lateral[j] - this.lateral[i];
      // A car in trouble alongside can come across at any moment: it is kept TROUBLE_FLANK off, not IN_LANE.
      const inside = (this.trouble[j] ? TROUBLE_FLANK : IN_LANE - AI_TUNING.rub * driver.personality.aggression) - Math.abs(dl);
      if (inside > near_in && Math.abs(this.gap(i, j)) < ALONGSIDE) {
        near = j;
        near_dl = dl;
        near_in = inside;
      }
    }
    this.concede(i);
    if (near < 0) return;
    const away = -Math.sign(near_dl) || 1;
    const gap = this.gap(i, near);
    // With its nose ahead, only a timid driver steers off for the other; a bold one holds the line and leans on it.
    const give = gap > 0 || this.trouble[near] || near < this.driven ? 1 : 1 - driver.personality.aggression;
    driver.nudge = away * give * Math.min(NUDGE_MAX, near_in + NUDGE_MARGIN);
    if (gap <= 0) return;
    const yield_to = this.kicker_ahead(driver) ? this.follow(i, near, gap, FOLLOW) : this.speed[near] - YIELD;
    this.hold(driver, near, Math.max(0, yield_to));
  }

  /** Caps the driver at `cap` for car j, and keeps the slowest such car's speed along the road: a kicker's floor gives way to it. */
  private hold(driver: Driver, j: number, cap: number) {
    driver.cap = Math.min(driver.cap, cap);
    driver.ahead_speed = Math.min(driver.ahead_speed, Math.max(0, this.along[j]));
  }

  /** A car passing driver i with its nose alongside and the pace to get by: the less aggressive i is, the more it lifts. */
  private concede(i: number) {
    const driver = this.drivers[i];
    const give = CONCEDE * (1 - driver.personality.aggression);
    if (give <= 0) return;
    for (let j = 0; j < this.cars.length; j++) {
      if (this.passing[j] !== i || this.trouble[j]) continue;
      const gap = this.gap(i, j);
      if (gap > 0 || gap < -ALONGSIDE || !this.faster(j, i)) continue;
      // A passer still in i's lane is held behind i (`decide`'s blocker): lifting for it, each capped to the other
      // slowed the pair to a stop side by side (seed 18).
      if (Math.abs(this.lateral[j] - this.lateral[i]) < (this.trouble[i] ? TROUBLE_FLANK : IN_LANE)) continue;
      this.hold(driver, j, Math.max(0, this.speed[j] - give));
    }
  }

  /** Metres driver behind keeps off the car ahead in its lane. */
  private keep(driver: Driver): number {
    if (!Number.isNaN(driver.launch)) return LAUNCH_KEEP;
    return FOLLOW - FOLLOW_BOLD * driver.personality.aggression;
  }

  /**
   * Whether driver i has the pace, or the speed, to get by car j: its pace over j's, its speed now over j's, or its own
   * line's speed here over j's speed. The last is how a car with no pace to read (the player's) gets passed when slow.
   */
  private faster(i: number, j: number): boolean {
    const driver = this.drivers[i];
    const own = driver.line.speed[driver.index] * driver.personality.pace;
    return driver.personality.pace > this.drivers[j].personality.pace + PASS_PACE || this.speed[i] > this.speed[j] + PASS_SPEED || own > this.speed[j] + PASS_SPEED;
  }

  /** Side gap (m) a pass rides off car j's line. */
  private flank(j: number): number {
    return this.trouble[j] ? TROUBLE_FLANK : SIDE_GAP;
  }

  private kicker_ahead(driver: Driver): boolean {
    const { line } = driver;
    const n = line.road.length;
    for (let k = 0, d = 0; d < KICKER_LOOK; k++) {
      const at = (driver.index + k) % n;
      if (line.room[at] === 0) return true;
      d += line.step[at];
    }
    return false;
  }

  /** Speed (m/s) driver i may close on car j at, `gap` metres ahead, while it pulls out past it: never under a follower's. */
  private run_cap(i: number, j: number, gap: number): number {
    return Math.max(this.follow(i, j, gap, PASS_FOLLOW), Math.max(0, this.along[j]) + Math.max(0, gap - PASS_FOLLOW) / PULL_OUT);
  }

  /** Speed (m/s) that closes down to `keep` metres behind car j, `gap` metres ahead, and brakes off any metre inside it. */
  private follow(i: number, j: number, gap: number, keep: number): number {
    // The speed the car ahead is about to hold, not the one it has: it brakes for the bend before the follower sees it slow. A
    // car in trouble holds only what it makes along the road.
    const at = this.trouble[j] ? Math.max(0, this.along[j]) : Math.min(this.speed[j], this.drivers[j].target);
    // Farther into a braking zone the car ahead is slower for where it is, not for its pace: held to that speed from 50 m
    // back, a faster car braked on the slower one's curve in every zone and never reached its bumper. A car on the pace
    // is read at the speed that share of the plan is here; one well under it (stopped, hit, off the gas) as it is.
    const { speed } = this.drivers[i].line;
    const there = speed[this.drivers[j].index];
    const share = Math.max(0, Math.min(1, (at / there - PACE_OFF) / (PACE_ON - PACE_OFF)));
    const vj = at * (1 + share * Math.max(0, speed[this.drivers[i].index] / there - 1));
    const close = gap - keep;
    return close > 0 ? Math.sqrt(vj * vj + 2 * FOLLOW_BRAKE * close) : Math.max(0, vj + close * BACK_OFF);
  }

  /**
   * Whether a pass on `side` of car `target` stays PASS_FLANK off it and on the road over the next `span` road points,
   * the target holding its line as it does now: past the centre toward that side its line leaves no room.
   */
  private side_open(i: number, blocker: number, side: number, lane: number, room: number, reach: number): boolean {
    return this.open(i, side * lane, room, reach) && this.lane_clear(i, blocker, side, PASS_START);
  }

  private lane_clear(i: number, target: number, side: number, span: number): boolean {
    const { line } = this.drivers[i];
    const n = line.road.length;
    for (let k = 0; k < span; k += LANE_STRIDE) {
      const at = (this.drivers[i].index + k) % n;
      const them = this.lane_of(target, line, at);
      if (Math.abs(pass_clamp(this.cars[i], line, at, them + side * SIDE_GAP) - them) < PASS_FLANK) return false;
    }
    return true;
  }

  /** Metres off the centre car j's lane runs at road point `at`: as far off the line as it is now, inside the road's edge. */
  private lane_of(j: number, line: RaceLine, at: number): number {
    return pass_clamp(this.cars[j], line, at, line.offset[at] + this.rel[j]);
  }

  /**
   * Metres off the line that keep driver i `flank` m to `side` of car j over the next PASS_KEEP road points. Where the
   * line swings to the edge car j is on, the edge holds j and the line closes on it at 2 m/s: held a flank off where j
   * is now, the car alongside followed the line over and took j's road (seed 0).
   */
  private flank_hold(i: number, j: number, side: number, flank: number, span = PASS_KEEP): number {
    const driver = this.drivers[i];
    const { line } = driver;
    const n = line.road.length;
    let hold = this.rel[j] + side * flank;
    for (let k = LANE_STRIDE; k < span; k += LANE_STRIDE) {
      const at = (driver.index + k) % n;
      const need = this.lane_of(j, line, at) + side * flank - line.offset[at];
      hold = side > 0 ? Math.max(hold, need) : Math.min(hold, need);
    }
    return hold;
  }

  /** Whether lateral spot `at` (m off the centre) is on the road and clear of every car from alongside to `reach` metres ahead. */
  private open(i: number, at: number, room: number, reach: number): boolean {
    if (Math.abs(at) > room) return false;
    for (let j = 0; j < this.cars.length; j++) {
      if (j === i) continue;
      const gap = this.gap(i, j);
      if (gap > -ALONGSIDE && gap < reach && Math.abs(this.lateral[j] - at) < IN_LANE) return false;
    }
    return true;
  }

  /** Whether road point `index` is still short of `until` (within half a lap). */
  private ahead_of(index: number, until: number, n: number): boolean {
    const d = (((until - index) % n) + n) % n;
    return d > 0 && d < n / 2;
  }
}
