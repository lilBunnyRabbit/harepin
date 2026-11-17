import { GHOST_EVERY_MS, STRIDE, lap_cap_ms } from "../car/ghost-cap";

/** m/s no car reaches: farther than this apart, two poses are a placement (a reset, a fall put back), not a drive. */
export const TELEPORT_MPS = 150;

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
    return this.end_ms > 0;
  }

  private push({ pos, quat }: Posed) {
    const { frames } = this;
    const last = frames.length - STRIDE;
    // A placement goes on the tape as a cut: a second frame at the last one's time, so `lap_pose` never blends across it.
    if (last >= 0 && Math.hypot(pos.x - frames[last + 1], pos.y - frames[last + 2], pos.z - frames[last + 3]) > (TELEPORT_MPS * (this.ms - frames[last])) / 1000) {
      frames.push(frames[last], pos.x, pos.y, pos.z, quat.x, quat.y, quat.z, quat.w);
    }
    frames.push(this.ms, pos.x, pos.y, pos.z, quat.x, quat.y, quat.z, quat.w);
  }
}
