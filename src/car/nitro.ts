export const NITRO_TORQUE = 1.4;
const TRICKLE = 0.04;
const DRIFT_ANGLE = 0.3;
const DRIFT_SPEED = 10;
const DRIFT_RATE = 0.5;
const AIR_SPEED = 8;
const AIR_RATE = 0.6;
const NEAR_SPEED = 15;
const NEAR_BONUS = 0.6;
// A row of lamp posts or trees is many close passes in a row; these keep it from filling the tank.
const NEAR_COOLDOWN = 1.5;
const NEAR_REPEAT = 4;
const PEER_TOUCH = 2;
// An emptied tank waits for this much before it lights again; without it the trickle relit it every other step.
const RELIGHT = 0.3;

/** What a close pass is close to: a solid, or a peer's id; null when nothing is near. */
export type Near = object | string | null;

/** Everything a rewind puts back, so the tank and the near-miss cooldowns rewind with the car. */
export interface NitroSnapshot {
  fill: number;
  close: boolean;
  scraped: boolean;
  target: Near;
  clock: number;
  paid_at: number;
  paid: [object | string, number][];
}

/** A peer is a ghost with no collision: driving through one is not a near miss, so inside a car width it counts as touched. */
export function peer_pass(distance: number, near: number): { close: boolean; touched: boolean } {
  return { close: distance < near, touched: distance < PEER_TOUCH };
}

export interface NitroSense {
  slide: number;
  speed: number;
  airborne: boolean;
}

export class Nitro {
  /** Boost seconds left, 0..capacity. */
  fill: number;
  boosting = false;
  private close = false;
  private scraped = false;
  private target: Near = null;
  private clock = 0;
  private paid_at = -Infinity;
  private readonly paid = new Map<object | string, number>();

  /** `capacity` is the tank's boost seconds; 0 means no tank fitted. */
  constructor(readonly capacity: number) {
    this.fill = capacity;
  }

  get fitted(): boolean {
    return this.capacity > 0;
  }

  get level(): number {
    return this.fitted ? this.fill / this.capacity : 0;
  }

  refill() {
    this.fill = this.capacity;
    this.boosting = false;
    this.close = this.scraped = false;
    this.target = null;
    this.paid_at = -Infinity;
    this.paid.clear();
  }

  /** The sim is not stepping (rewind, garage, countdown): nothing burns. */
  cut() {
    this.boosting = false;
  }

  /** For a car rebuilt from the garage: in a timed run it takes over the old tank's level and cooldowns, clamped to this
   * one's size, so a garage trip can't refill it; in free drive it starts full. */
  carry(from: Nitro, timed: boolean) {
    if (timed) this.restore({ ...from.snapshot(), fill: Math.min(this.capacity, from.fill) });
    else this.refill();
  }

  snapshot(): NitroSnapshot {
    const { fill, close, scraped, target, clock, paid_at } = this;
    return { fill, close, scraped, target, clock, paid_at, paid: [...this.paid] };
  }

  restore(s: NitroSnapshot) {
    this.fill = Math.min(this.capacity, s.fill);
    this.boosting = false;
    this.close = s.close;
    this.scraped = s.scraped;
    this.target = s.target;
    this.clock = s.clock;
    this.paid_at = s.paid_at;
    this.paid.clear();
    for (const [key, at] of s.paid) this.paid.set(key, at);
  }

  step(dt: number, want: boolean, sense: NitroSense): boolean {
    if (!this.fitted) return (this.boosting = false);
    this.clock += dt;
    let earn = TRICKLE;
    if (Math.abs(sense.slide) > DRIFT_ANGLE && sense.speed > DRIFT_SPEED) earn += DRIFT_RATE;
    if (sense.airborne && sense.speed > AIR_SPEED) earn += AIR_RATE;
    this.boosting = want && this.fill > (this.boosting ? 0 : RELIGHT);
    this.fill = Math.max(0, Math.min(this.capacity, this.fill + (earn - (this.boosting ? 1 : 0)) * dt));
    return this.boosting;
  }

  // Paid when the pass ends, so brushing along a wall pays once, and a pass that touched pays nothing.
  pass(near: Near, hit: boolean, speed: number) {
    if (!this.fitted) return;
    if (near !== null && speed > NEAR_SPEED) {
      if (!this.close) {
        this.scraped = false;
        this.target = near;
      }
      this.close = true;
      this.scraped ||= hit;
      return;
    }
    const { target, clock } = this;
    if (this.close && !this.scraped && near === null && target !== null && clock - this.paid_at >= NEAR_COOLDOWN && clock - (this.paid.get(target) ?? -Infinity) >= NEAR_REPEAT) {
      this.fill = Math.min(this.capacity, this.fill + NEAR_BONUS);
      this.paid_at = clock;
      this.paid.set(target, clock);
      for (const [key, at] of this.paid) if (clock - at >= NEAR_REPEAT) this.paid.delete(key);
    }
    this.close = false;
  }
}
