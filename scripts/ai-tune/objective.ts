import { CONTACT_BAND } from "../ai-race";
import type { RaceResult } from "./worker";

/**
 * Loss weights, lower is better, in the owner's order: pace in corners, then passing, then few spins. 2 points = 1% of
 * lap time against the autopilot; one more overtake a race is worth 1.5%, one spin or reset a race costs 4%. Grid order
 * only counts past `rho_soft`: some correlation is the faster cars starting ahead, and the owner asked only that the grid
 * not decide the race. `scripts/ai-ml` experiments override any of them.
 */
export interface Weights {
  pace: number;
  pass: number;
  trouble: number;
  /** Per overtake a race under the floor (today's on the same seeds), on top of `pass`: a cleaner field that stops passing loses. */
  pass_floor: number;
  reverse: number;
  hardest: number;
  /** m/s past which the worst hit of the set costs `worst` a m/s on top: the owner's 15 m/s line at level 3. */
  hit_line: number;
  worst: number;
  band: number;
  rho_soft: number;
  rho: number;
  stuck: number;
  /** Per contact a lap: positive for a clean field, negative for one that trades paint. */
  contact: number;
  /** Per second of a car's flying-lap spread. */
  lap_sd: number;
  /** Lap over the autopilot's a difficulty level aims at (NaN: none), and points per 1% the field lands off it. */
  target: number;
  target_pace: number;
}

export const WEIGHTS: Weights = { pace: 200, pass: 3, trouble: 8, pass_floor: 20, reverse: 1, hardest: 0.2, hit_line: 15, worst: 0.5, band: 20, rho_soft: 0.6, rho: 30, stuck: 200, contact: 0, lap_sd: 0, target: NaN, target_pace: 0 };
/** Lap ratio a race with no finisher counts as. */
const DNF_PACE = 1.5;

export interface Score {
  races: number;
  /** Mean of each race's field lap over the autopilot's lap on its route. */
  pace: number;
  /** Per race. */
  passes: number;
  trouble: number;
  reverses: number;
  /** Mean of each race's hardest hit, and the worst of them (m/s). */
  hardest: number;
  worst: number;
  /** Share of races outside CONTACT_BAND contacts a lap, and of races with a car stuck. */
  band: number;
  stuck: number;
  rho: number;
  /** Per race and lap, and seconds of a car's flying-lap spread. */
  contacts: number;
  lap_sd: number;
  loss: number;
}

/** `auto` maps `<seed>/<route>` to the autopilot's lap (s); `floor` is the overtakes a race the defaults made on these races' seeds. */
export function score(races: readonly { seed: number; race: RaceResult }[], auto: Record<string, number>, laps: number, floor = 0, w: Weights = WEIGHTS): Score {
  const n = races.length;
  const mean = (f: (r: RaceResult, seed: number) => number) => races.reduce((s, { seed, race }) => s + f(race, seed), 0) / n;
  const pace = mean((r, seed) => (Number.isFinite(r.lap) ? r.lap / auto[`${seed}/${r.route}`] : DNF_PACE));
  const passes = mean((r) => r.overtakes);
  const trouble = mean((r) => r.spins + r.resets);
  const reverses = mean((r) => r.reverses);
  const hardest = mean((r) => r.hardest);
  const worst = Math.max(...races.map(({ race }) => race.hardest));
  const band = mean((r) => (r.contacts / laps < CONTACT_BAND[0] || r.contacts / laps > CONTACT_BAND[1] ? 1 : 0));
  const stuck = mean((r) => (r.stuck ? 1 : 0));
  const rho = mean((r) => r.rho);
  const contacts = mean((r) => r.contacts / laps);
  const lap_sd = mean((r) => r.lap_sd ?? 0);
  const off_target = Number.isNaN(w.target) ? 0 : Math.abs(pace - w.target) * 100;
  const loss =
    w.pace * pace - w.pass * passes + w.pass_floor * Math.max(0, floor - passes) + w.trouble * trouble + w.reverse * reverses + w.hardest * hardest + w.worst * Math.max(0, worst - w.hit_line) + w.band * band + w.rho * Math.max(0, rho - w.rho_soft) + w.stuck * stuck + w.contact * contacts + w.lap_sd * lap_sd + w.target_pace * off_target;
  return { races: n, pace, passes, trouble, reverses, hardest, worst, band, stuck, rho, contacts, lap_sd, loss };
}
