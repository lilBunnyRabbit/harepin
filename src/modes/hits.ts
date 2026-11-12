import { HIT_MS } from "./gymkhana";

// Measured from the last contact, not the last counted hit: a long scrape along a rail costs once.
export const HIT_GAP_MS = 1000;

export class Hits {
  private count_ = 0;
  private clock = 0;
  private last = -Infinity;
  private seen: number;

  constructor(private readonly contacts: () => number) {
    this.seen = contacts();
  }

  // Contacts while the clock is stopped (countdown, the drive to the line) are dropped, not saved for later.
  update(dt_ms: number, running: boolean) {
    const now = this.contacts();
    const fresh = now !== this.seen;
    this.seen = now;
    if (!running) return;
    this.clock += dt_ms;
    if (!fresh) return;
    if (this.clock - this.last >= HIT_GAP_MS) this.count_++;
    this.last = this.clock;
  }

  get count(): number {
    return this.count_;
  }

  get penalty_ms(): number {
    return this.count_ * HIT_MS;
  }
}
