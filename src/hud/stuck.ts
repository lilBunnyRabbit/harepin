const PUSH_S = 2;
const LET_GO_S = 1.5;
const STILL = 1;
const MOVING = 3;
const PRESSED = 0.3;

/** The pedal that drives the car: in the auto box's reverse that is the brake, as in `Car.step`. */
export function pushing(throttle: number, brake: number, gear: number, auto: boolean): boolean {
  return (gear === -1 && auto ? brake : throttle) > PRESSED;
}

/** How long the car has sat still under the drive pedal; a short let-go keeps the count, a longer one or any real speed clears it. */
export class StuckTimer {
  private pushed = 0;
  private idle = 0;

  get stuck() {
    return this.pushed >= PUSH_S;
  }

  clear() {
    this.pushed = 0;
    this.idle = 0;
  }

  update(dt: number, speed: number, push: boolean) {
    if (speed > MOVING) this.pushed = 0;
    else if (push) {
      this.idle = 0;
      if (speed < STILL) this.pushed += dt;
    } else if ((this.idle += dt) > LET_GO_S) this.pushed = 0;
  }
}
