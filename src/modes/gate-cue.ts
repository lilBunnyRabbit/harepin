export const Cue = { WRONG: "wrong", MISSED: "missed" } as const;
export type Cue = (typeof Cue)[keyof typeof Cue];

export const CUE_TEXT: Record<Cue, string> = {
  [Cue.WRONG]: "Wrong way",
  [Cue.MISSED]: "Missed gate · go back",
};

/**
 * The card a race shows over the road. A missed gate outranks wrong way: going back for it points the car back down
 * the route, which is what the card asks for. It clears on the step the gate is taken.
 */
export class GateCue {
  cue: Cue | null = null;
  /** True on the one step a miss begins: its sound. */
  struck = false;

  update(missed: boolean, wrong: boolean): Cue | null {
    this.struck = missed && this.cue !== Cue.MISSED;
    this.cue = missed ? Cue.MISSED : wrong ? Cue.WRONG : null;
    return this.cue;
  }
}
