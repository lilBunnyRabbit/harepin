import { Car, type Controls } from "../car/car";
import type { CarSpec } from "../car/cars";
import { collide_cars } from "../car/contact";
import { mulberry32, sub } from "../rng";
import type { World } from "../world/world";
import type { Route } from "../worldgen/types";
import { Awareness } from "./awareness";
import { Driver, OFF_ROAD, STEADY, type Personality } from "./driver";
import { race_line, type RaceLine } from "./line";

/** Physics steps between awareness and recovery passes: 20 Hz at 360; at 10 Hz a follower closing in a hairpin reacts too late. */
const AWARE_STEPS = 18;
/** Road points between grid slots, the first slot's distance behind the line, and each slot's metres off the centre. */
const GRID_GAP = 4;
const GRID_BACK = 3;
const GRID_SIDE = 2.4;
/** A car under this speed (m/s) for STUCK_TIME seconds reverses out; off the road or upside down for RESET_TIME it is put back. */
const STUCK_SPEED = 1.5;
const STUCK_TIME = 2;
const RESET_TIME = 4;
/** Seconds without gaining a road point, reversing included, before a wedged car is put back. */
const STALL_TIME = 8;
const RESET_AHEAD = 15;
const RESET_BEHIND = 80;
/**
 * Metres before a kicker's run a reset puts a car back: put back on the run, it reaches the lip slow, falls short into
 * the frame and is put back there again.
 */
const RESET_RUNUP = 150;
/** Up component under which a car is on its side or roof. */
const UPRIGHT = 0.3;
/** Seconds apart before the same car's next touch counts as a new contact: a rub is one contact, however long. */
const CONTACT_GAP = 0.5;
/** Slip angle (rad) past which a car is spinning, and under which it has caught it. */
const SPIN = 1.6;
const SPIN_CAUGHT = 0.3;
/** Metres one car must be clear of another along the road before passing it counts. */
const PASS_CLEAR = 3;
/**
 * Metres from the rival past which an AI car off screen leaves the physics for the line follower (H7), and inside which,
 * or once on screen, it comes back to it.
 */
const FAR = 120;
const NEAR = 100;
/** Personality ranges a field draws from. */
const PACE = [0.92, 1] as const;
const BRAKE_MARGIN = [0, 0.8] as const;
/** Aggression and mistakes ranges per owner level 1-5 (H5, H6); level 3 is the default field. */
const AGGRESSION: readonly (readonly [number, number])[] = [[0, 0.6], [0.1, 0.8], [0.2, 1], [0.4, 1], [0.6, 1]];
const MISTAKES: readonly (readonly [number, number])[] = [[0, 0.1], [0.02, 0.2], [0.05, 0.3], [0.1, 0.4], [0.2, 0.5]];
const LEVEL = 3;

export interface RacerStats {
  /** Seconds at each lap's end, from the start. */
  laps: number[];
  finish: number;
  contacts: number;
  hardest: number;
  spins: number;
  overtakes: number;
  reverses: number;
  resets: number;
  offroad: number;
}

export interface Racer {
  readonly car: Car;
  readonly driver: Driver;
  readonly stats: RacerStats;
}

const between = (rng: () => number, [lo, hi]: readonly [number, number]) => lo + (hi - lo) * rng();

/** Where grid slot `slot` stands on a closed route, 0 on pole: staggered left and right, behind the start line. */
export function grid_spot(route: Route, slot: number): { index: number; x: number; z: number; heading: number } {
  const n = route.points.length;
  const index = (((-GRID_BACK - slot * GRID_GAP) % n) + n) % n;
  const p = route.points[index];
  const side = (slot % 2 ? -1 : 1) * GRID_SIDE;
  return { index, x: p.x + p.tz * side, z: p.z - p.tx * side, heading: Math.atan2(p.tx, p.tz) };
}

const level = (table: readonly (readonly [number, number])[], at: number) => table[Math.max(1, Math.min(table.length, Math.round(at))) - 1];

/** The owner's 1-5 levels one AI car draws its personality in (H5, H6). */
export interface FieldCar {
  aggression: number;
  mistakes: number;
}

export const LEVEL_3: FieldCar = { aggression: LEVEL, mistakes: LEVEL };

/**
 * A personality per grid slot, drawn from the race seed, so the grid order says nothing about pace. Each car draws
 * inside its own levels' ranges, so a mixed field takes the same draws a field of one level would.
 */
export function field_personalities(seed: number, cars: readonly FieldCar[]): Personality[] {
  const rng = mulberry32(sub(seed, "ai-field"));
  return cars.map((car) => ({ pace: between(rng, PACE), brake_margin: between(rng, BRAKE_MARGIN), aggression: between(rng, level(AGGRESSION, car.aggression)), mistakes: between(rng, level(MISTAKES, car.mistakes)) }));
}

/** `count` cars all on the owner's levels `aggression` and `mistakes`. */
export const personalities = (seed: number, count: number, aggression = LEVEL, mistakes = LEVEL): Personality[] => field_personalities(seed, Array.from({ length: count }, () => ({ aggression, mistakes })));

/**
 * A field of AI cars on one closed route, headless: every step drives and steps each car, hits the world, then resolves
 * car-to-car contact; at 20 Hz the awareness picks lanes and the recovery unsticks or resets cars.
 */
export class Field {
  readonly racers: Racer[];
  readonly line: RaceLine;
  t = 0;
  private readonly cars: Car[];
  /** The field's cars, then the rival when one races them: the contact pass's list. */
  private touching: Car[];
  /** Road points from the start, laps included, of each car and then the rival (NaN without one): the running order. */
  readonly progress: Float64Array;
  /** Bit i set: AI car i is on the player's screen, so it never coasts. Every bit set until the view says otherwise. */
  seen = -1;
  private rival_car: Car | null = null;
  /** Tracks the rival along the road, and drives it when `drives_rival` (a dev autopilot for the player's car). */
  private rival_driver: Driver;
  drives_rival = false;
  private readonly coasting: Uint8Array;
  /** Closing speed (m/s) of each car's hardest touch on the last step, -1 for none; the rival's after the field's. */
  readonly impacts: Float64Array;
  private awareness: Awareness;
  private readonly slow: Float64Array;
  private readonly lost: Float64Array;
  private readonly best: Float64Array;
  private readonly stall: Float64Array;
  private readonly last_contact: Float64Array;
  private readonly spinning: Uint8Array;
  /** ahead[i * n + j]: car i is clear ahead of car j. */
  private readonly ahead: Uint8Array;
  private steps = 0;

  constructor(
    private readonly world: World,
    readonly route: Route,
    specs: readonly CarSpec[],
    traits: readonly Personality[],
    private readonly seed: number,
  ) {
    const radius = Math.max(...specs.map((s) => s.radius));
    this.line = race_line(route.points, world.ramps, radius);
    this.racers = specs.map((spec, k) => {
      const car = new Car(spec);
      const driver = new Driver(this.line, traits[k], mulberry32(sub(seed, `ai-driver-${k}`)));
      const spot = grid_spot(route, k);
      car.park(spot.x, spot.z, spot.heading, world);
      driver.place(spot.index, -1);
      return { car, driver, stats: { laps: [], finish: Infinity, contacts: 0, hardest: 0, spins: 0, overtakes: 0, reverses: 0, resets: 0, offroad: 0 } };
    });
    this.cars = this.racers.map((r) => r.car);
    this.touching = this.cars;
    const count = this.racers.length;
    this.impacts = new Float64Array(count + 1).fill(-1);
    this.awareness = new Awareness(this.cars, this.racers.map((r) => r.driver), mulberry32(sub(seed, "ai-awareness")));
    this.slow = new Float64Array(count);
    this.lost = new Float64Array(count);
    this.best = new Float64Array(count).fill(-Infinity);
    this.stall = new Float64Array(count);
    this.last_contact = new Float64Array(count).fill(-Infinity);
    this.spinning = new Uint8Array(count);
    this.ahead = new Uint8Array(count * count);
    this.coasting = new Uint8Array(count);
    this.progress = new Float64Array(count + 1).fill(NaN);
    this.rival_driver = new Driver(this.line, STEADY);
  }

  /**
   * A car the field races but does not drive (the player's): its owner steps it before `step`, the contact pass here
   * takes it in, the awareness sees it as one more car, and it is tracked along the road from where it stands. A new
   * car in place of the rival (a garage swap where it stood) keeps its place in the race and the awareness's rolls.
   */
  set rival(car: Car | null) {
    const swap = this.rival_car !== null && car !== null;
    this.rival_car = car;
    this.impacts[this.cars.length] = -1;
    if (swap) {
      this.touching[this.cars.length] = car;
      return;
    }
    this.touching = car ? [...this.cars, car] : this.cars;
    const drivers = this.racers.map((r) => r.driver);
    if (car) {
      const at = nearest(this.route, car.pos.x, car.pos.z);
      this.rival_driver = new Driver(this.line, STEADY);
      this.rival_driver.place(at, at > this.route.points.length / 2 ? -1 : 0);
    }
    const rng = mulberry32(sub(this.seed, "ai-awareness"));
    this.awareness = car ? new Awareness(this.touching, [...drivers, this.rival_driver], rng) : new Awareness(this.cars, drivers, rng);
  }

  /** The rival's controls for this step, from the field's own driver: call before stepping the rival, with `drives_rival` on. */
  rival_controls(dt: number): Controls {
    if (!this.rival_car) throw new Error("no rival to drive");
    return this.rival_driver.drive(this.rival_car, dt);
  }

  /** Whether AI car i runs on the line follower now, off the physics. */
  is_coasting(i: number): boolean {
    return this.coasting[i] === 1;
  }

  step(dt: number, laps: number) {
    const { racers, world } = this;
    for (let i = 0; i < racers.length; i++) {
      const { car, driver } = racers[i];
      if (this.coasting[i]) {
        driver.coast(car, dt);
        continue;
      }
      car.step(dt, driver.drive(car, dt), world);
      world.collide(car);
    }
    const rival = this.rival_car;
    if (rival && !this.drives_rival) {
      this.rival_driver.track(rival);
      this.rival_driver.target = Math.hypot(rival.vel.x, rival.vel.z);
    }
    collide_cars(this.touching, this.impacts);
    this.t += dt;
    for (let i = 0; i < racers.length; i++) {
      const { car, driver, stats } = racers[i];
      const hit = this.impacts[i];
      if (hit >= 0) {
        if (this.t - this.last_contact[i] > CONTACT_GAP) stats.contacts++;
        this.last_contact[i] = this.t;
        driver.touched();
        stats.hardest = Math.max(stats.hardest, hit);
      }
      while (driver.laps > stats.laps.length && stats.laps.length < laps) {
        stats.laps.push(this.t);
        if (stats.laps.length === laps) stats.finish = this.t;
      }
      if (!this.coasting[i] && world.distance_to_road(car.pos.x, car.pos.z) > OFF_ROAD) stats.offroad += dt;
      this.progress[i] = driver.progress;
    }
    this.progress[racers.length] = rival ? this.rival_driver.progress : NaN;
    if (++this.steps % AWARE_STEPS === 0) {
      this.awareness.update();
      this.recover(dt * AWARE_STEPS);
      this.count_passes();
      this.far();
    }
  }

  /** Far from the rival and off its screen, a car coasts on the line; near or seen, it is back on the physics. */
  private far() {
    const rival = this.rival_car;
    if (!rival) return;
    for (let i = 0; i < this.racers.length; i++) {
      const { car, driver } = this.racers[i];
      const d = Math.hypot(car.pos.x - rival.pos.x, car.pos.z - rival.pos.z);
      const seen = (this.seen >> i) & 1;
      if (!this.coasting[i] && d > FAR && !seen) {
        this.coasting[i] = 1;
        driver.along = 0;
      } else if (this.coasting[i] && (d < NEAR || seen)) {
        this.coasting[i] = 0;
        driver.resume(car, this.world);
      }
    }
  }

  /** Steps until every car has run `laps` laps or `limit` seconds pass; true when all finished. */
  run(dt: number, laps: number, limit: number): boolean {
    while (this.t < limit && this.racers.some((r) => r.stats.laps.length < laps)) this.step(dt, laps);
    return this.racers.every((r) => r.stats.laps.length >= laps);
  }

  private recover(dt: number) {
    for (let i = 0; i < this.racers.length; i++) {
      const { car, driver, stats } = this.racers[i];
      if (this.coasting[i]) {
        this.slow[i] = 0;
        this.lost[i] = 0;
        this.stall[i] = 0;
        this.best[i] = driver.progress;
        continue;
      }
      const speed = Math.hypot(car.vel.x, car.vel.z);
      const slide = speed > 3 ? Math.abs(Math.atan2(Math.sin(Math.atan2(car.vel.x, car.vel.z) - car.heading), Math.cos(Math.atan2(car.vel.x, car.vel.z) - car.heading))) : 0;
      if (!this.spinning[i] && driver.reversing <= 0 && slide > SPIN) {
        this.spinning[i] = 1;
        stats.spins++;
      } else if (this.spinning[i] && slide < SPIN_CAUGHT) this.spinning[i] = 0;
      this.slow[i] = speed < STUCK_SPEED && driver.reversing <= 0 ? this.slow[i] + dt : 0;
      if (this.slow[i] > STUCK_TIME) {
        driver.reverse();
        stats.reverses++;
        this.slow[i] = 0;
      }
      const up = 1 - 2 * (car.quat.x * car.quat.x + car.quat.z * car.quat.z);
      const lost = up < UPRIGHT || this.world.distance_to_road(car.pos.x, car.pos.z) > OFF_ROAD || this.world.fallen(car.pos);
      this.lost[i] = lost ? this.lost[i] + dt : 0;
      if (driver.progress > this.best[i]) {
        this.best[i] = driver.progress;
        this.stall[i] = 0;
      } else this.stall[i] += dt;
      if (this.lost[i] > RESET_TIME || this.stall[i] > STALL_TIME) {
        const at = this.reset_point(driver.index);
        const laps = at > driver.index ? driver.laps - 1 : driver.laps;
        if (!this.clear(i, laps * this.route.points.length + at)) continue;
        const p = this.route.points[at];
        car.park(p.x, p.z, Math.atan2(p.tx, p.tz), this.world);
        driver.place(at, laps);
        driver.recovered();
        stats.resets++;
        this.lost[i] = 0;
        this.stall[i] = 0;
        this.best[i] = driver.progress;
      }
    }
  }

  /**
   * No other car on the road within RESET_AHEAD metres ahead of progress `me` or RESET_BEHIND behind: a reset never
   * drops a car into another's path. A car itself lost or stalled is no one's path: two cars wedged together would hold each other there.
   */
  private clear(i: number, me: number): boolean {
    const spacing = this.route.length / this.route.points.length;
    const n = this.route.points.length;
    const near = (progress: number) => {
      const gap = (((((progress - me) % n) + n + n / 2) % n) - n / 2) * spacing;
      return gap > -RESET_BEHIND && gap < RESET_AHEAD;
    };
    for (let j = 0; j < this.racers.length; j++) {
      if (j === i || this.lost[j] > 0 || this.stall[j] > STUCK_TIME) continue;
      if (near(this.racers[j].driver.progress)) return false;
    }
    return !this.rival_car || !near(this.rival_driver.progress);
  }

  /** The road point a car at `index` is put back at: `index` itself, or RESET_RUNUP metres before the kicker run it is on. */
  private reset_point(index: number): number {
    const { room, step } = this.line;
    const n = room.length;
    if (room[index] !== 0) return index;
    let at = index;
    for (let k = 0; k < n && room[at] === 0; k++) at = (at - 1 + n) % n;
    for (let d = 0, k = 0; d < RESET_RUNUP && k < n; k++) {
      at = (at - 1 + n) % n;
      d += step[at];
    }
    return at;
  }

  private count_passes() {
    const count = this.racers.length;
    const spacing = this.route.length / this.route.points.length;
    for (let i = 0; i < count; i++)
      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        const gap = (this.racers[i].driver.progress - this.racers[j].driver.progress) * spacing;
        const at = i * count + j;
        if (gap > PASS_CLEAR) {
          if (!this.ahead[at] && this.ahead[j * count + i]) this.racers[i].stats.overtakes++;
          this.ahead[at] = 1;
        } else if (gap < -PASS_CLEAR) this.ahead[at] = 0;
      }
  }
}

function nearest(route: Route, x: number, z: number): number {
  let best = 0;
  let best_d = Infinity;
  route.points.forEach((p, i) => {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < best_d) {
      best_d = d;
      best = i;
    }
  });
  return best;
}
