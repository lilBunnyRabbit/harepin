/**
 * What a field race counts beyond the running order: each car's laps from its road progress, and in a knockout who is
 * out. A knockout drops the last car still in each time the leader passes another 1/count of the race, so the last
 * one left stands alone at (count - 1)/count of the distance.
 */
export class FieldTally {
  /** Car indices in the order they were knocked out, first out first. */
  readonly out: number[] = [];
  private readonly gone: Uint8Array;
  private readonly laps_done: Int32Array;
  private readonly lap_from: Float64Array;
  readonly best_lap: Float64Array;
  private readonly end: number;

  constructor(
    readonly count: number,
    private readonly points_per_lap: number,
    laps: number,
    private readonly knockout: boolean,
  ) {
    this.end = points_per_lap * laps;
    this.gone = new Uint8Array(count);
    this.laps_done = new Int32Array(count);
    this.lap_from = new Float64Array(count);
    this.best_lap = new Float64Array(count).fill(Infinity);
  }

  /** `order`: car indices, leader first. Returns the car knocked out on this call, or -1. */
  update(t: number, progress: ArrayLike<number>, order: readonly number[]): number {
    for (let i = 0; i < this.count; i++) {
      const p = progress[i];
      if (!(p >= 0)) continue;
      const laps = Math.floor(Math.min(p, this.end) / this.points_per_lap);
      if (laps <= this.laps_done[i]) continue;
      this.best_lap[i] = Math.min(this.best_lap[i], (t - this.lap_from[i]) / (laps - this.laps_done[i]));
      this.laps_done[i] = laps;
      this.lap_from[i] = t;
    }
    if (!this.knockout || this.left() <= 1) return -1;
    let leader = -1;
    let last = -1;
    for (const i of order) {
      if (this.gone[i]) continue;
      if (leader < 0) leader = i;
      last = i;
    }
    if (leader < 0 || !(progress[leader] >= (this.end * (this.out.length + 1)) / this.count)) return -1;
    this.gone[last] = 1;
    this.out.push(last);
    return last;
  }

  is_out(i: number): boolean {
    return this.gone[i] === 1;
  }

  left(): number {
    return this.count - this.out.length;
  }

  /** Cars still in by `order`, then the knocked out, the last one out first. */
  final_order(order: readonly number[]): number[] {
    return [...order.filter((i) => !this.gone[i]), ...[...this.out].reverse()];
  }

  /** Car `i` has a lap no other car beat. */
  fastest(i: number): boolean {
    return this.beats(i, this.best_lap[i]);
  }

  /** No car but `i` set a lap under `lap` s. */
  beats(i: number, lap: number): boolean {
    if (lap === Infinity) return false;
    for (let k = 0; k < this.count; k++) if (k !== i && this.best_lap[k] < lap) return false;
    return true;
  }
}
