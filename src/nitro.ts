export const NITRO_TORQUE = 1.4;
const TRICKLE = 0.04;
const DRIFT_ANGLE = 0.3;
const DRIFT_SPEED = 10;
const DRIFT_RATE = 0.5;
const AIR_SPEED = 8;
const AIR_RATE = 0.6;
const NEAR_SPEED = 15;
const NEAR_BONUS = 0.6;
// An emptied tank waits for this much before it lights again; without it the trickle relit it every other step.
const RELIGHT = 0.3;

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
    this.close = this.scraped = false;
  }

  step(dt: number, want: boolean, sense: NitroSense): boolean {
    if (!this.fitted) return (this.boosting = false);
    let earn = TRICKLE;
    if (Math.abs(sense.slide) > DRIFT_ANGLE && sense.speed > DRIFT_SPEED) earn += DRIFT_RATE;
    if (sense.airborne && sense.speed > AIR_SPEED) earn += AIR_RATE;
    this.boosting = want && this.fill > (this.boosting ? 0 : RELIGHT);
    this.fill = Math.max(0, Math.min(this.capacity, this.fill + (earn - (this.boosting ? 1 : 0)) * dt));
    return this.boosting;
  }

  // Paid when the pass ends, so brushing along a wall pays once, and a pass that touched pays nothing.
  pass(close: boolean, hit: boolean, speed: number) {
    if (!this.fitted) return;
    const fast = speed > NEAR_SPEED;
    if (close && fast) {
      if (!this.close) this.scraped = false;
      this.close = true;
      this.scraped ||= hit;
      return;
    }
    if (this.close && !this.scraped && !close) this.fill = Math.min(this.capacity, this.fill + NEAR_BONUS);
    this.close = false;
  }
}
