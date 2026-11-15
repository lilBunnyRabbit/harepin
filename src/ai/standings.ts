/**
 * The running order of a race from each car's road progress (road points from the start line, laps included). It keeps
 * the time each car first reached every point, so a gap is how long ago the car ahead stood where this one is now.
 */
export class Standings {
  /** s from the start, Infinity until the car finishes. */
  readonly finish: Float64Array;
  private readonly at: Float64Array;
  private readonly reached: Int32Array;
  private readonly end: number;
  private readonly order_now: number[];

  /** `timed_by_gates`: the car whose finish its race sets with `finished` (the player's, whose laps must take every gate). */
  constructor(
    readonly count: number,
    points_per_lap: number,
    laps: number,
    private readonly timed_by_gates = -1,
  ) {
    this.end = points_per_lap * laps;
    this.finish = new Float64Array(count).fill(Infinity);
    this.at = new Float64Array(count * (this.end + 1)).fill(NaN);
    this.reached = new Int32Array(count).fill(-1);
    this.order_now = Array.from({ length: count }, (_, i) => i);
  }

  /** `progress[i]` for every car, at `t` s from the start. */
  update(t: number, progress: ArrayLike<number>) {
    for (let i = 0; i < this.count; i++) {
      const to = Math.min(this.end, Math.floor(progress[i]));
      for (let k = this.reached[i] + 1; k <= to; k++) this.at[i * (this.end + 1) + k] = t;
      if (to > this.reached[i]) this.reached[i] = to;
      if (i !== this.timed_by_gates && to >= this.end && this.finish[i] === Infinity) this.finish[i] = t;
    }
    this.order_now.sort((a, b) => this.finish[a] - this.finish[b] || this.reached[b] - this.reached[a] || a - b);
  }

  finished(i: number, t: number) {
    if (this.finish[i] === Infinity) this.finish[i] = t;
    this.order_now.sort((a, b) => this.finish[a] - this.finish[b] || this.reached[b] - this.reached[a] || a - b);
  }

  /** Car indices, leader first: finishers by time, then the rest by how far they have got. */
  get order(): readonly number[] {
    return this.order_now;
  }

  place(i: number): number {
    return this.order_now.indexOf(i) + 1;
  }

  /** s car `behind` trails car `ahead` at `t`: since `ahead` stood where `behind` is now; NaN before either is past the line. */
  gap(ahead: number, behind: number, t: number): number {
    const k = this.reached[behind];
    if (k < 0) return NaN;
    const then = this.at[ahead * (this.end + 1) + k];
    return Number.isNaN(then) ? NaN : (this.finish[behind] < Infinity ? this.finish[behind] : t) - then;
  }
}
