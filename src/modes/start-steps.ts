/** Ms the lights stay green once the race is on. */
export const GREEN_MS = 1000;

export const Beep = { RED: "red", GO: "go" } as const;
export type Beep = (typeof Beep)[keyof typeof Beep];

/**
 * The start sequence at a moment: 1..`reds` red lamps lit, one more each second of the countdown;
 * `reds + 1` all green for `GREEN_MS` after the go; 0 off.
 * `countdown`: ms left before the go; `since_go`: ms since it, negative before.
 */
export function start_step(countdown: number, since_go: number, reds: number): number {
  if (countdown > 0) return Math.max(1, reds - Math.ceil(countdown / 1000) + 1);
  return since_go < GREEN_MS ? reds + 1 : 0;
}

/** A short beep as each red lamp comes on, a higher, longer one at the go, nothing as the lights go out. */
export function step_beep(from: number, to: number, reds: number): Beep | null {
  if (to === from || to === 0) return null;
  return to > reds ? Beep.GO : Beep.RED;
}

/** Follows one start sequence frame by frame, giving the beep of the frame its step changes on. */
export class StartSteps {
  private at = 0;

  constructor(readonly reds: number) {}

  get step(): number {
    return this.at;
  }

  next(countdown: number, since_go: number): Beep | null {
    const to = start_step(countdown, since_go, this.reds);
    const beep = step_beep(this.at, to, this.reds);
    this.at = to;
    return beep;
  }

  reset() {
    this.at = 0;
  }
}
