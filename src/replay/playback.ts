export const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
const NORMAL = SPEEDS.indexOf(1);

export class Playback {
  ms = 0;
  end_ms = 0;
  paused = false;
  /** A seek or a restart moved the car: the camera snaps there instead of flying after it. */
  jumped = false;
  private rate = NORMAL;

  open(end_ms: number) {
    this.end_ms = end_ms;
    this.ms = 0;
    this.paused = false;
    this.jumped = true;
    this.rate = NORMAL;
  }

  get speed(): number {
    return SPEEDS[this.rate];
  }

  advance(dt: number) {
    if (this.paused) return;
    this.ms = Math.min(this.end_ms, this.ms + dt * 1000 * this.speed);
    if (this.ms >= this.end_ms) this.paused = true;
  }

  toggle() {
    if (this.paused && this.ms >= this.end_ms) this.seek(0);
    this.paused = !this.paused;
  }

  seek(ms: number) {
    this.ms = Math.max(0, Math.min(this.end_ms, ms));
    this.jumped = true;
  }

  next_speed() {
    this.rate = (this.rate + 1) % SPEEDS.length;
  }
}
