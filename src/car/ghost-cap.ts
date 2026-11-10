/** Past the cap a free drive after the start line stops growing the recording; no lap that slow is worth replaying. */
const MIN_CAP_MS = 10 * 60_000;
/** Average speed, m/s, below which a lap no longer counts as one: a long circuit's cap grows with its length. */
const SLOW_LAP_MPS = 8;

/** Recording cap for a lap of `length_m` metres; at least ten minutes. */
export function lap_cap_ms(length_m: number): number {
  return Math.max(MIN_CAP_MS, (length_m / SLOW_LAP_MPS) * 1000);
}
