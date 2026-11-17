/** The first run's three steps on the road, in order. */
export const FIRST_STEPS = ["Drive", "Steer", "Reach the flag"] as const;
/** The same three with the first flag on another map: no drive reaches it, the Next up ticket's Travel does. */
const AWAY_STEPS = [FIRST_STEPS[0], FIRST_STEPS[1], "Travel to the flag"] as const;

export const first_steps = (away: boolean): readonly string[] => (away ? AWAY_STEPS : FIRST_STEPS);

/** m/s: the car is moving under its own power, not rolling off the spawn. */
const DRIVE_SPEED = 8;
/** m/s: slower than this a turned wheel is not yet a corner taken. */
const STEER_SPEED = 3;
/** Radians of heading turned, both ways added up: about one junction. */
const STEER_TURN = 0.6;
/** Metres: under the flag, where its gate card opens. */
const FLAG_NEAR = 20;

/** Which first-run step the player is on, from the car alone: no input device is asked, so keys, pad and touch all count. */
export class FirstRun {
  /** Index into `FIRST_STEPS`; its length once the flag is reached. */
  step = 0;
  private turned = 0;
  private heading = NaN;

  get over(): boolean {
    return this.step >= FIRST_STEPS.length;
  }

  /** `flag`: metres to the next flag on this map, null with none to drive to. True as the step moves on. */
  update(speed: number, heading: number, flag: number | null): boolean {
    const before = this.step;
    if (this.step === 0 && speed >= DRIVE_SPEED) this.step = 1;
    if (this.step === 1) {
      if (speed >= STEER_SPEED && !Number.isNaN(this.heading)) this.turned += Math.abs(Math.atan2(Math.sin(heading - this.heading), Math.cos(heading - this.heading)));
      if (this.turned >= STEER_TURN) this.step = 2;
    }
    this.heading = heading;
    if (flag !== null && flag <= FLAG_NEAR) this.step = FIRST_STEPS.length;
    return this.step !== before;
  }
}
