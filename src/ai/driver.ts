import type { Car, Controls } from "../car/car";
import type { RaceLine } from "./line";

/** Road points of aim past the car, plus one per this many m/s: pure pursuit, as the autopilot steers. */
const AIM_BASE = 7;
const AIM_PER = 3;
/** Under this pace (m/s) a bend is a hairpin and the aim stays short, or it cuts across the inside. */
const HAIRPIN_PACE = 15;
const AIM_HAIRPIN = 5;
const STEER_GAIN = 3;
const TRACK_BACK = 5;
const TRACK_AHEAD = 40;
/** m/s over the plan before the brake comes on, and m/s of overspeed per unit of pedal (capped at BRAKE_MAX). */
const BRAKE_SLACK = 1;
const BRAKE_PER = 10;
const BRAKE_MAX = 0.5;
/** Slip angle (rad) at which the driver is fully off the brake. */
const SLIDE_LET_GO = 0.15;

export interface Personality {
  /** Share of the line's planned speed it drives at, 0.90-1.0. */
  pace: number;
}

export const STEADY: Personality = { pace: 1 };

const wrap_angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Follows a `RaceLine` and writes pedals and wheel into its own `controls` every physics step, like a player's input. */
export class Driver {
  readonly controls: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
  index = 0;
  laps = 0;
  /** Metres off the line the driver aims for (along the road's right normal), set by the field's awareness. */
  lane = 0;

  constructor(
    readonly line: RaceLine,
    readonly personality: Personality = STEADY,
  ) {}

  /** Road points from the start, laps included: the field's running order. */
  get progress(): number {
    return this.laps * this.line.road.length + this.index;
  }

  place(index: number) {
    this.index = index;
    this.laps = 0;
  }

  track(car: Car) {
    const { road } = this.line;
    const n = road.length;
    let best = this.index;
    let best_d = Infinity;
    for (let k = -TRACK_BACK; k <= TRACK_AHEAD; k++) {
      const i = (((this.index + k) % n) + n) % n;
      const d = (road[i].x - car.pos.x) ** 2 + (road[i].z - car.pos.z) ** 2;
      if (d < best_d) {
        best_d = d;
        best = i;
      }
    }
    if (best < this.index - n / 2) this.laps++;
    else if (best > this.index + n / 2) this.laps--;
    this.index = best;
  }

  drive(car: Car): Controls {
    this.track(car);
    const { line } = this;
    const n = line.road.length;
    const vx = car.vel.x;
    const vz = car.vel.z;
    const speed = Math.hypot(vx, vz);
    const target = line.speed[this.index] * this.personality.pace;
    const look = target < HAIRPIN_PACE ? AIM_HAIRPIN : AIM_BASE + Math.floor(speed / AIM_PER);
    const at = (this.index + look) % n;
    const p = line.road[at];
    const room = line.room[at];
    const extra = Math.max(-room, Math.min(room, line.offset[at] + this.lane)) - line.offset[at];
    const ax = line.x[at] + p.tz * extra;
    const az = line.z[at] + -p.tx * extra;
    const err = wrap_angle(Math.atan2(ax - car.pos.x, az - car.pos.z) - car.heading);
    let airborne = true;
    for (let w = 0; w < car.wheels.length; w++) if (car.wheels[w].contact) airborne = false;
    const slide = speed > 5 ? Math.abs(wrap_angle(Math.atan2(vx, vz) - car.heading)) : 0;
    const ease = Math.max(0, 1 - slide / SLIDE_LET_GO);
    const c = this.controls;
    c.steer = airborne ? 0 : Math.max(-1, Math.min(1, -err * STEER_GAIN));
    c.throttle = speed < target ? 1 : 0;
    c.brake = speed > target + BRAKE_SLACK ? Math.min(BRAKE_MAX, (speed - target) / BRAKE_PER) * Math.max(0.2, 1 - Math.abs(err) * 4) * ease : 0;
    return c;
  }
}
