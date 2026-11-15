import type { Car } from "../car/car";
import { OFF_ROAD, pass_room, type Driver } from "./driver";

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
/** Most metres the guard moves the aim off a car alongside, and the metres past IN_LANE it aims to open the gap to. */
const NUDGE_MAX = 1.5;
const NUDGE_MARGIN = 0.4;
/** m/s under the other car a squeezed driver drops to. */
const YIELD = 1.5;
/** Metres of IN_LANE a fully aggressive driver lets a car alongside into before it steers off: doors rub, nobody wrecks. */
const RUB = 0.8;
/** m/s under a faster passer alongside a timid driver (0) lifts to, none at full aggression: the bold ones make it a fight. */
const CONCEDE = 1.5;
/** Metres a follower keeps behind a car in its lane, and the braking (m/s²) it plans to close down to it. */
const FOLLOW = 10;
const FOLLOW_BRAKE = 4;
/** Metres of FOLLOW a fully aggressive driver closes up: on the bumper, it has the run to pull out. */
const FOLLOW_BOLD = 5;
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
/** Metres a passed car must be behind before the pass is done. */
const PASS_DONE = 5;
/** A pass starts only where the next PASS_CALM road points hold their pace (CALM_SHARE of now) and bend gently (1/m): two abreast into a bend is where they touch. */
const PASS_CALM = 60;
const CALM_SHARE = 0.85;
/** Sharpest bend (1/m) a pass starts into for a timid driver, plus this much at full aggression: two abreast fit a wide corner. */
const CALM_BEND = 0.02;
const BOLD_BEND = 0.02;
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
  private dt = 0;

  constructor(
    private readonly cars: readonly Car[],
    private readonly drivers: readonly Driver[],
    private readonly rng: () => number,
    /** How many of `cars`, from the first, the field drives: the rest (the player's) have no pace to read. */
    private readonly driven = cars.length,
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
      const v = Math.hypot(vel.x, vel.z);
      const p = drivers[i].line.road[drivers[i].index];
      this.speed[i] = v;
      this.along[i] = vel.x * p.tx + vel.z * p.tz;
      const slide = Math.abs(Math.atan2(Math.sin(Math.atan2(vel.x, vel.z) - heading), Math.cos(Math.atan2(vel.x, vel.z) - heading)));
      const off = Math.abs(this.lateral[i]) > OFF_ROAD;
      this.trouble[i] = drivers[i].reversing > 0 || off || (v > TROUBLE_SPEED && (slide > TROUBLE_SLIDE || this.along[i] < TROUBLE_ALONG * v)) ? 1 : 0;
    }
    for (let i = 0; i < cars.length; i++) {
      this.decide(i);
      this.guard(i);
    }
  }

  private gap(i: number, j: number): number {
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
    for (let j = 0; j < this.cars.length; j++) {
      if (j === i) continue;
      const gap = this.gap(i, j);
      const dl = this.lateral[j] - me;
      if (Math.abs(gap) < ALONGSIDE && Math.abs(dl) < SIDE_GAP + 0.5) beside = j;
      // A car in trouble blocks the whole road, except to the car already going by it with TROUBLE_FLANK to spare.
      const width = this.trouble[j] ? (this.passing[i] === j ? TROUBLE_FLANK : HAZARD_LANE) : IN_LANE;
      if (gap > 0 && gap < LOOK + LOOK_PER * v && Math.abs(dl) < width && gap < blocker_gap) {
        blocker = j;
        blocker_gap = gap;
      }
      if (gap > 0 && gap < LOOK + LOOK_PER * v && this.defend_until[j] >= 0 && gap < cover_gap) {
        cover = j;
        cover_gap = gap;
      }
      if (gap < -DEFEND_CLEAR && -gap < DEFEND_BEHIND && this.speed[j] > v) attacker = j;
    }
    driver.cap = Infinity;
    driver.push = 1;
    driver.late = false;
    const kicker = this.kicker_ahead(driver);
    if (blocker >= 0) {
      // The speed the car ahead is about to hold, not the one it has: it brakes for the bend before the follower sees it slow.
      driver.cap = this.follow(blocker, blocker_gap, blocker === this.passing[i] ? PASS_FOLLOW : this.keep(driver));
    }
    const line = driver.line;
    const n = line.road.length;
    const room = pass_room(this.cars[i], driver.line, driver.index);
    const base = line.offset[driver.index];
    const lane = Math.min(room, PASS_LANE);
    const target = this.passing[i];
    if (target >= 0 && (driver.wary > 0 || kicker) && this.gap(i, target) > 0) this.passing[i] = -1;
    else if (target >= 0) {
      const gap = this.gap(i, target);
      const diving = this.dive_until[i] >= 0 && this.ahead_of(driver.index, this.dive_until[i], n);
      if (!diving) this.dive_until[i] = -1;
      // No room ahead on this side: still behind, it waits off the other's bumper for the line to swing back, its lane
      // held, since chasing the other side across the road at every swing never gets it alongside; alongside, it is off.
      const wait = !diving && gap > 0 && !this.lane_clear(i, target, this.pass_side[i], PASS_KEEP);
      // A pass rides the passed car's line shifted by a side gap, so the two swing together; the road's edge clamps it.
      // A dive holds the inside lane down to the apex, wherever the other car's line swings.
      const hold = diving ? this.pass_side[i] * lane - base : this.rel[target] + this.pass_side[i] * this.flank(target);
      const at = Math.max(-room, Math.min(room, base + hold));
      // Squeezed alongside with the nose still behind: the car being passed has come over, so the pass is off.
      const squeezed = gap > 0 && gap < ALONGSIDE && (wait || Math.abs(this.lateral[target] - at) < (this.trouble[target] ? TROUBLE_FLANK : IN_LANE - aggression * PASS_TIGHT));
      if (gap > -PASS_DONE && gap < PASS_ABORT && !squeezed) {
        // Waiting, it follows on its own line: held out on the passed car's flank, the road's edge bends its path tighter than the line.
        driver.hold = wait ? NaN : hold;
        driver.push = 1 + PUSH * aggression;
        driver.late = diving;
        if (wait) driver.cap = Math.min(driver.cap, this.follow(target, gap, PASS_FOLLOW));
        this.waited[i] = wait ? this.waited[i] + this.dt : 0;
        if (this.waited[i] > PASS_WAIT) this.passing[i] = -1;
        if (this.trouble[target] && gap > -ALONGSIDE) driver.cap = Math.min(driver.cap, Math.max(0, this.along[target]) + TROUBLE_CLOSE);
        return;
      }
      this.passing[i] = -1;
      this.dive_until[i] = -1;
    }
    // Overlapped down the inside into a braking zone, the defender gives the apex up and runs round the outside.
    const diver = this.diver_on(i);
    if (diver >= 0) {
      driver.hold = this.rel[diver] - (Math.sign(this.lateral[diver] - me) || 1) * SIDE_GAP;
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
      const away = Math.abs(other) > IN_LANE / 2 ? -Math.sign(other) : this.inside(driver);
      const reach = blocker_gap + PASS_WINDOW;
      const pick = this.side_open(i, blocker, away, lane, room, reach) ? away : this.side_open(i, blocker, -away, lane, room, reach) ? -away : 0;
      const faster = this.faster(i, blocker);
      const wide = CALM_BEND + BOLD_BEND * aggression;
      let bend = false;
      for (let k = 0; k < PASS_CALM && !bend; k += 4) bend = line.speed[(driver.index + k) % n] < CALM_SHARE * line.speed[driver.index] || Math.abs(line.bend[(driver.index + k) % n]) > wide;
      // A bold driver dives into a braking zone; the rest pass only where the road stays calm.
      // A car in trouble is passed only on a side that leaves TROUBLE_FLANK, however calm the road.
      const clear_of = !this.trouble[blocker] || Math.abs(Math.max(-room, Math.min(room, other + pick * TROUBLE_FLANK)) - other) >= TROUBLE_FLANK;
      const calm = this.trouble[blocker] || !bend || aggression > DIVE;
      if (this.dive(i, blocker, blocker_gap, kicker, lane, room)) return;
      const close = blocker_gap < this.keep(driver) + PASS_REACH || this.trouble[blocker] === 1;
      if (faster && close && pick !== 0 && driver.wary <= 0 && !kicker && clear_of && calm) {
        this.passing[i] = blocker;
        this.pass_side[i] = pick;
        driver.hold = this.rel[blocker] + pick * this.flank(blocker);
        driver.push = 1 + PUSH * aggression;
        return;
      }
    }
    // A car covering the inside has left the outside open: a bold driver takes it into the braking zone.
    if (blocker < 0 && cover >= 0 && aggression > OUTSIDE && driver.wary <= 0 && !kicker && !this.trouble[cover] && this.faster(i, cover)) {
      const outside = -Math.sign(this.lateral[cover]) || 1;
      if (this.side_open(i, cover, outside, lane, room, cover_gap + PASS_WINDOW)) {
        this.passing[i] = cover;
        this.pass_side[i] = outside;
        driver.hold = this.rel[cover] + outside * SIDE_GAP;
        driver.push = 1 + PUSH * aggression;
        return;
      }
    }
    // Ahead of a car alongside, a driver keeps its line: the one behind has to find the room or lift.
    if (beside >= 0 && !this.trouble[beside] && this.gap(i, beside) < 0 && beside >= this.driven) beside = -1;
    if (beside >= 0) {
      const dl = this.lateral[beside] - me;
      const at = this.rel[beside] - (Math.sign(dl) || 1) * SIDE_GAP;
      driver.hold = at;
      // Squeezed against the edge: the car with its nose behind gives the corner up rather than leaning on the other.
      if (Math.abs(base + at) > room && this.gap(i, beside) > 0) driver.cap = Math.min(driver.cap, Math.max(0, this.speed[beside] - YIELD));
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

  /** The slowest road point of a braking zone within DIVE_LOOK ahead of driver i, or -1 when the plan holds. */
  private braking_zone(driver: Driver): number {
    const { line } = driver;
    const n = line.road.length;
    let slowest = driver.index;
    for (let k = 1; k < DIVE_LOOK; k++) if (line.speed[(driver.index + k) % n] < line.speed[slowest]) slowest = (driver.index + k) % n;
    return line.speed[driver.index] - line.speed[slowest] > DIVE_DROP ? slowest : -1;
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
      const inside = (this.trouble[j] ? TROUBLE_FLANK : IN_LANE - RUB * driver.personality.aggression) - Math.abs(dl);
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
    const yield_to = this.kicker_ahead(driver) ? this.follow(near, gap, FOLLOW) : this.speed[near] - YIELD;
    driver.cap = Math.min(driver.cap, Math.max(0, yield_to));
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
      driver.cap = Math.min(driver.cap, Math.max(0, this.speed[j] - give));
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

  /** Speed (m/s) that closes down to `keep` metres behind car j, `gap` metres ahead, and brakes off any metre inside it. */
  private follow(j: number, gap: number, keep: number): number {
    // The speed the car ahead is about to hold, not the one it has: it brakes for the bend before the follower sees it slow. A
    // car in trouble holds only what it makes along the road.
    const vj = this.trouble[j] ? Math.max(0, this.along[j]) : Math.min(this.speed[j], this.drivers[j].target);
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
      const room = pass_room(this.cars[i], line, at);
      const them = line.offset[at] + this.rel[target];
      if (Math.abs(Math.max(-room, Math.min(room, them + side * SIDE_GAP)) - them) < PASS_FLANK) return false;
    }
    return true;
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
