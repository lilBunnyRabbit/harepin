export const NITRO = {
  /** Sweeps up to `whoosh_hz[1]` over `whoosh_rise` s, then settles to `whoosh_hz[2]`. */
  whoosh_hz: [250, 1100, 450] as const,
  whoosh_q: 1.2,
  whoosh_rise: 0.18,
  whoosh_attack: 0.05,
  whoosh_peak: 0.5,
  whoosh_time: 0.6,
  /** Tapping the button retriggers no sooner than this, s. */
  whoosh_gap: 0.4,
  rush_hz: 650,
  /** Q in dB, as a lowpass BiquadFilterNode reads it. */
  rush_q: 0,
  rush_peak: 0.5,
  rush_hold: 0.18,
  rush_settle_at: 0.35,
  rush_attack: 0.05,
  rush_settle: 0.6,
  rush_release: 0.3,
} as const;

export interface RushTarget {
  level: number;
  tau: number;
}

/** `held`: seconds since the boost lit, or `null` off boost. */
export function rush_target(held: number | null, out: RushTarget): RushTarget {
  if (held === null) {
    out.level = 0;
    out.tau = NITRO.rush_release;
  } else if (held < NITRO.rush_settle_at) {
    out.level = NITRO.rush_peak;
    out.tau = NITRO.rush_attack;
  } else {
    out.level = NITRO.rush_hold;
    out.tau = NITRO.rush_settle;
  }
  return out;
}
