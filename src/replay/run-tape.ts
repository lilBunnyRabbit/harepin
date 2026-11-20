import { GHOST_EVERY_MS, STRIDE, lap_cap_ms } from "../car/ghost-cap";

/** m/s no car reaches: farther than this apart, two poses are a placement (a reset, a fall put back), not a drive. */
export const TELEPORT_MPS = 150;

interface Posed {
  readonly pos: { readonly x: number; readonly y: number; readonly z: number };
  readonly quat: { readonly x: number; readonly y: number; readonly z: number; readonly w: number };
}

/** Numbers per player frame on `sound`: rpm, throttle, scrub, nitro (1 boosting). */
export const SOUND_STRIDE = 4;

/** What the engine and tyres sound from: the player's car carries it, the AI field does not. */
export interface Heard {
  readonly rpm: number;
  readonly throttle: number;
  readonly scrub: number;
  readonly nitro: { readonly boosting: boolean };
}

/** The AI cars of a run: car i's pose now, null while it is not on the track. */
export interface Rivals {
  readonly count: number;
  taped(i: number): Posed | null;
}

/** What a replay plays: the player's lap and one per AI car, all on one clock. */
export interface Watched {
  readonly frames: readonly number[];
  readonly field: readonly (readonly number[])[];
  /** `SOUND_STRIDE` numbers per player frame; empty on a replay saved before sound was taped. */
  readonly sound: readonly number[];
  readonly end_ms: number;
}

// One take's grace covers the gap between a car's last frame and the take that would have followed it.
export function on_tape(lap: readonly number[] | undefined, ms: number): lap is readonly number[] {
  return lap !== undefined && lap.length > 0 && ms >= lap[0] - GHOST_EVERY_MS && ms <= lap[lap.length - STRIDE] + GHOST_EVERY_MS;
}

// A ghost lap's layout, so `lap_pose` reads it, but at the car's own height: the replay draws the car that drove, not a ghost's coupe.
export class RunTape implements Watched {
  readonly frames: number[] = [];
  /** A car off the track takes no frames: its lap starts late or stops short. */
  readonly field: number[][] = [];
  readonly sound: number[] = [];
  name = "";
  mode = "";
  private ms = 0;
  private readonly cap_ms = lap_cap_ms(0);

  start(name: string, mode: string) {
    this.frames.length = 0;
    this.field.length = 0;
    this.sound.length = 0;
    this.name = name;
    this.mode = mode;
    this.ms = 0;
  }

  /** `sim_dt`: seconds stepped since the last call; a held sim adds none, so a countdown takes no tape. */
  record(sim_dt: number, car: Posed & Heard, rivals: Rivals | null) {
    this.ms += sim_dt * 1000;
    const { frames } = this;
    if (this.ms > this.cap_ms) return;
    if (frames.length && this.ms - frames[frames.length - STRIDE] < GHOST_EVERY_MS) return;
    this.take(car, rivals);
  }

  end(car: Posed & Heard, rivals: Rivals | null) {
    if (this.ms <= this.cap_ms && this.ms > this.end_ms) this.take(car, rivals);
  }

  private take(car: Posed & Heard, rivals: Rivals | null) {
    // A cut's first frame is already the car at its new place, so it sounds as the car does there.
    const takes = this.push(this.frames, car) ? 2 : 1;
    for (let i = 0; i < takes; i++) this.sound.push(car.rpm, car.throttle, car.scrub, car.nitro.boosting ? 1 : 0);
    if (!rivals) return;
    const { field } = this;
    while (field.length < rivals.count) field.push([]);
    for (let i = 0; i < rivals.count; i++) {
      const rival = rivals.taped(i);
      if (rival) this.push(field[i], rival);
    }
  }

  get end_ms(): number {
    const { frames } = this;
    return frames.length ? frames[frames.length - STRIDE] : 0;
  }

  get watchable(): boolean {
    return this.end_ms > 0;
  }

  /** True when the frame went on as a cut, two frames at once. */
  private push(frames: number[], { pos, quat }: Posed): boolean {
    const last = frames.length - STRIDE;
    // A placement goes on the tape as a cut: a second frame at the last one's time, so `lap_pose` never blends across it.
    const cut = last >= 0 && Math.hypot(pos.x - frames[last + 1], pos.y - frames[last + 2], pos.z - frames[last + 3]) > (TELEPORT_MPS * (this.ms - frames[last])) / 1000;
    if (cut) frames.push(frames[last], pos.x, pos.y, pos.z, quat.x, quat.y, quat.z, quat.w);
    frames.push(this.ms, pos.x, pos.y, pos.z, quat.x, quat.y, quat.z, quat.w);
    return cut;
  }
}
