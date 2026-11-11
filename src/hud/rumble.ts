export const RumbleLevel = { OFF: "off", SUBTLE: "subtle", STRONG: "strong" } as const;
export type RumbleLevel = (typeof RumbleLevel)[keyof typeof RumbleLevel];

const LEVEL_GAIN: Record<RumbleLevel, number> = { off: 0, subtle: 0.45, strong: 1 };
/** Least time between two held effects: each one outlasts it, so the motors never gap, and the pad gets ten calls a second at most. */
const HOLD_EVERY_MS = 100;
const HOLD_MS = 250;
/** An unchanged held effect is sent again this long before it runs out: frames come late, and a gap reads as a stutter. */
const REFRESH_LEAD = 90;
/** A held effect within this of the last one sent, that is still running, is not sent again. */
const SAME = 0.03;
const QUIET = 0.02;
/** Least time between two pulses; a pulse holds the held effect off until it ends, since a new effect cuts the one playing. */
const PULSE_EVERY_MS = 60;
const IMPACT_MS = 140;
const LAND_MS = 110;
/** Collision speed (m/s, from `World.collide`) a hit needs to pulse, and the one that pulses in full. */
const IMPACT_FROM = 2;
const IMPACT_FULL = 15;
/** Air time (s) before touching down counts as a landing: a wheel skipping off a bump is not one. */
const AIR_MIN = 0.2;
/** Sink speed (m/s) at touchdown a landing needs to pulse, and the one that pulses in full. */
const LAND_FROM = 2;
const LAND_FULL = 10;

export interface RumbleSense {
  /** Tyre slip past the peak, 0..1: `Car.scrub`. */
  scrub: number;
  /** m/s. */
  speed: number;
  /** Mean `loose` of the ground under the wheels that touch it, 0 sealed road .. 1 sand. */
  loose: number;
  /** Share of the touching wheels on the road's edge strip, where the circuit's kerbs sit, 0..1. */
  edge: number;
  /** No wheel on the ground. */
  airborne: boolean;
  /** Vertical speed, m/s, up positive. */
  vy: number;
  /** Hardest collision since the last update, m/s: `World.collide`. */
  impact: number;
}

/** What to play: magnitudes 0..1 for the low (strong) and high (weak) motor, for `ms`. */
export interface RumbleEffect {
  strong: number;
  weak: number;
  ms: number;
  /** A one-off knock (hit or landing), which a phone may buzz for too. */
  pulse: boolean;
}

/**
 * Pad rumble from the drive: tyres past their grip and rough or loose ground make a held buzz, landings and hits a
 * knock. Pure, so it runs headless; `update` returns an effect only when the pad should get a new call.
 */
export class Rumble {
  level: RumbleLevel = RumbleLevel.SUBTLE;
  private hold_at = -Infinity;
  private pulse_at = -Infinity;
  private busy_until = -Infinity;
  private held_until = -Infinity;
  private sent_strong = 0;
  private sent_weak = 0;
  private air = 0;
  private sink = 0;
  private readonly effect: RumbleEffect = { strong: 0, weak: 0, ms: 0, pulse: false };

  /** `now` in ms, `dt` in s since the last update. The returned effect is reused: play it before the next call. */
  update(now: number, dt: number, sense: RumbleSense): RumbleEffect | null {
    const gain = LEVEL_GAIN[this.level];
    const landed = !sense.airborne && this.air >= AIR_MIN ? this.sink : 0;
    if (sense.airborne) {
      this.air += dt;
      this.sink = Math.max(0, -sense.vy);
    } else this.air = 0;
    if (gain === 0) return null;

    const hit = ramp(sense.impact, IMPACT_FROM, IMPACT_FULL);
    const land = ramp(landed, LAND_FROM, LAND_FULL);
    if ((hit > 0 || land > 0) && now - this.pulse_at >= PULSE_EVERY_MS) {
      this.pulse_at = now;
      const ms = hit >= land ? IMPACT_MS : LAND_MS;
      this.busy_until = now + ms;
      this.held_until = -Infinity;
      const knock = Math.max(hit, land);
      return this.play(knock * gain, knock * 0.6 * gain, ms, true);
    }
    if (now < this.busy_until || now - this.hold_at < HOLD_EVERY_MS) return null;

    const rolling = Math.min(1, sense.speed / 6);
    const fast = Math.min(1, sense.speed / 25);
    const grip = sense.airborne ? 0 : sense.scrub * rolling;
    const ground = sense.airborne ? 0 : sense.loose * fast;
    const edge = sense.airborne ? 0 : sense.edge * Math.min(1, sense.speed / 12);
    const strong = Math.min(1, (grip * 0.35 + ground * 0.15 + edge * 0.25) * gain);
    const weak = Math.min(1, (grip * 0.5 + ground * 0.35 + edge * 0.6) * gain);
    // Gone quiet, the last held effect just runs out: a call to stop it would be one more call for nothing.
    if (strong < QUIET && weak < QUIET) return null;
    const same = Math.abs(strong - this.sent_strong) < SAME && Math.abs(weak - this.sent_weak) < SAME;
    if (same && now < this.held_until - REFRESH_LEAD) return null;
    this.hold_at = now;
    this.held_until = now + HOLD_MS;
    return this.play(strong, weak, HOLD_MS, false);
  }

  private play(strong: number, weak: number, ms: number, pulse: boolean): RumbleEffect {
    this.sent_strong = strong;
    this.sent_weak = weak;
    this.effect.strong = strong;
    this.effect.weak = weak;
    this.effect.ms = ms;
    this.effect.pulse = pulse;
    return this.effect;
  }
}

function ramp(value: number, from: number, full: number): number {
  return Math.max(0, Math.min(1, (value - from) / (full - from)));
}

/** What `sense_drive` reads off the car: `Car` fits it. */
export interface RumbleCar {
  readonly scrub: number;
  readonly vel: { readonly y: number; length(): number };
  readonly wheels: readonly { readonly contact: boolean; readonly point: { readonly x: number; readonly z: number } }[];
}

/** What `sense_drive` reads off the ground: `World` fits it. */
export interface RumbleGround {
  footing(x: number, z: number): { readonly loose: number };
  on_edge(x: number, z: number): boolean;
}

/** Fills `out` from the car on `ground` this frame, `impact` the hardest collision since the last frame. */
export function sense_drive(out: RumbleSense, car: RumbleCar, ground: RumbleGround, impact: number): RumbleSense {
  let touching = 0;
  let loose = 0;
  let edge = 0;
  for (const w of car.wheels) {
    if (!w.contact) continue;
    touching++;
    loose += ground.footing(w.point.x, w.point.z).loose;
    if (ground.on_edge(w.point.x, w.point.z)) edge++;
  }
  out.scrub = car.scrub;
  out.speed = car.vel.length();
  out.loose = touching ? loose / touching : 0;
  out.edge = touching ? edge / touching : 0;
  out.airborne = touching === 0;
  out.vy = car.vel.y;
  out.impact = impact;
  return out;
}
