import { GHOST_EVERY_MS, STRIDE, lap_cap_ms } from "../car/ghost-cap";

interface Posed {
  readonly pos: { readonly x: number; readonly y: number; readonly z: number };
  readonly quat: { readonly x: number; readonly y: number; readonly z: number; readonly w: number };
}

// A ghost lap's layout, so `lap_pose` reads it, but at the car's own height: the replay draws the car that drove, not a ghost's coupe.
export class RunTape {
  readonly frames: number[] = [];
  private ms = 0;
  private readonly cap_ms = lap_cap_ms(0);

  start() {
    this.frames.length = 0;
    this.ms = 0;
  }

  /** `sim_dt`: seconds stepped since the last call; a held sim adds none, so a countdown takes no tape. */
  record(sim_dt: number, car: Posed) {
    this.ms += sim_dt * 1000;
    const { frames } = this;
    if (this.ms > this.cap_ms) return;
    if (frames.length && this.ms - frames[frames.length - STRIDE] < GHOST_EVERY_MS) return;
    this.push(car);
  }

  end(car: Posed) {
    if (this.ms <= this.cap_ms && this.ms > this.end_ms) this.push(car);
  }

  get end_ms(): number {
    const { frames } = this;
    return frames.length ? frames[frames.length - STRIDE] : 0;
  }

  get watchable(): boolean {
    return this.frames.length >= STRIDE * 2;
  }

  private push({ pos, quat }: Posed) {
    this.frames.push(this.ms, pos.x, pos.y, pos.z, quat.x, quat.y, quat.z, quat.w);
  }
}
