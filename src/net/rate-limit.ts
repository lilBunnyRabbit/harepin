const GAP_MS = 800;
const BURST = 5;
const WINDOW_MS = 10_000;

export class RateLimit {
  private times: number[] = [];

  constructor(
    private gap = GAP_MS,
    private burst = BURST,
  ) {}

  allow(now: number): boolean {
    while (this.times.length && now - this.times[0] >= WINDOW_MS) this.times.shift();
    const last = this.times[this.times.length - 1];
    if (last !== undefined && now - last < this.gap) return false;
    if (this.times.length >= this.burst) return false;
    this.times.push(now);
    return true;
  }
}
