import { Car } from "../car/car";
import type { CarSpec } from "../car/cars";
import { collide_cars } from "../car/contact";
import { mulberry32, sub } from "../rng";
import type { World } from "../world/world";
import type { Route } from "../worldgen/types";
import { Awareness } from "./awareness";
import { Driver, type Personality } from "./driver";
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
/** Metres off the centre past which a car is off the road, and the up component under which it is on its side or roof. */
const OFF_ROAD = 7;
const UPRIGHT = 0.3;
/** Seconds apart before the same car's next touch counts as a new contact: a rub is one contact, however long. */
const CONTACT_GAP = 0.5;
/** Slip angle (rad) past which a car is spinning, and under which it has caught it. */
const SPIN = 1.6;
const SPIN_CAUGHT = 0.3;
/** Metres one car must be clear of another along the road before passing it counts. */
const PASS_CLEAR = 3;
/** Personality ranges a field draws from. */
const PACE = [0.92, 1] as const;
const BRAKE_MARGIN = [0, 0.8] as const;
const AGGRESSION = [0.2, 1] as const;
const MISTAKES = [0.05, 0.3] as const;

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

/** A personality per grid slot, drawn from the race seed, so the grid order says nothing about pace. */
export function personalities(seed: number, count: number): Personality[] {
  const rng = mulberry32(sub(seed, "ai-field"));
  return Array.from({ length: count }, () => ({ pace: between(rng, PACE), brake_margin: between(rng, BRAKE_MARGIN), aggression: between(rng, AGGRESSION), mistakes: between(rng, MISTAKES) }));
}

/**
 * A field of AI cars on one closed route, headless: every step drives and steps each car, hits the world, then resolves
 * car-to-car contact; at 20 Hz the awareness picks lanes and the recovery unsticks or resets cars.
 */
export class Field {
  readonly racers: Racer[];
  readonly line: RaceLine;
  t = 0;
  private readonly cars: Car[];
  /** Closing speed (m/s) of each car's hardest touch on the last step, -1 for none. */
  readonly impacts: Float64Array;
  private readonly awareness: Awareness;
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
    seed: number,
  ) {
    const radius = Math.max(...specs.map((s) => s.radius));
    this.line = race_line(route.points, world.ramps, radius);
    const n = route.points.length;
    this.racers = specs.map((spec, k) => {
      const car = new Car(spec);
      const driver = new Driver(this.line, traits[k], mulberry32(sub(seed, `ai-driver-${k}`)));
      const index = (((-GRID_BACK - k * GRID_GAP) % n) + n) % n;
      const p = route.points[index];
      const side = (k % 2 ? -1 : 1) * GRID_SIDE;
      car.park(p.x + p.tz * side, p.z - p.tx * side, Math.atan2(p.tx, p.tz), world);
      driver.place(index, -1);
      return { car, driver, stats: { laps: [], finish: Infinity, contacts: 0, hardest: 0, spins: 0, overtakes: 0, reverses: 0, resets: 0, offroad: 0 } };
    });
    this.cars = this.racers.map((r) => r.car);
    const count = this.racers.length;
    this.impacts = new Float64Array(count);
    this.awareness = new Awareness(this.cars, this.racers.map((r) => r.driver), mulberry32(sub(seed, "ai-awareness")));
    this.slow = new Float64Array(count);
    this.lost = new Float64Array(count);
    this.best = new Float64Array(count).fill(-Infinity);
    this.stall = new Float64Array(count);
    this.last_contact = new Float64Array(count).fill(-Infinity);
    this.spinning = new Uint8Array(count);
    this.ahead = new Uint8Array(count * count);
  }

  step(dt: number, laps: number) {
    const { racers, world } = this;
    for (let i = 0; i < racers.length; i++) {
      const { car, driver } = racers[i];
      car.step(dt, driver.drive(car, dt), world);
      world.collide(car);
    }
    collide_cars(this.cars, this.impacts);
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
      if (world.distance_to_road(car.pos.x, car.pos.z) > OFF_ROAD) stats.offroad += dt;
    }
    if (++this.steps % AWARE_STEPS === 0) {
      this.awareness.update();
      this.recover(dt * AWARE_STEPS);
      this.count_passes();
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
      if ((this.lost[i] > RESET_TIME || this.stall[i] > STALL_TIME) && this.clear(i)) {
        const p = this.route.points[driver.index];
        car.park(p.x, p.z, Math.atan2(p.tx, p.tz), this.world);
        driver.reversing = 0;
        stats.resets++;
        this.lost[i] = 0;
        this.stall[i] = 0;
      }
    }
  }

  /**
   * No other car on the road within RESET_AHEAD metres ahead or RESET_BEHIND behind: a reset never drops a car into
   * another's path. A car itself lost or stalled is no one's path: two cars wedged together would hold each other there.
   */
  private clear(i: number): boolean {
    const spacing = this.route.length / this.route.points.length;
    const n = this.route.points.length;
    const me = this.racers[i].driver.progress;
    for (let j = 0; j < this.racers.length; j++) {
      if (j === i || this.lost[j] > 0 || this.stall[j] > STUCK_TIME) continue;
      const gap = (((((this.racers[j].driver.progress - me) % n) + n + n / 2) % n) - n / 2) * spacing;
      if (gap > -RESET_BEHIND && gap < RESET_AHEAD) return false;
    }
    return true;
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
