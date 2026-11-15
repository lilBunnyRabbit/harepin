import type { RaceResult } from "./worker";

/**
 * Loss weights, lower is better. 1 point = 1% of lap time against the autopilot; one more overtake a race is worth 1.5%,
 * one spin or reset a race costs 4%. Grid order only counts past RHO_SOFT: some correlation is the faster cars starting
 * ahead, and the owner asked only that the grid not decide the race.
 */
const W_PACE = 100;
const W_PASS = 1.5;
const W_TROUBLE = 4;
const W_REVERSE = 1;
const W_HARDEST = 0.2;
/** m/s past which the worst hit of the set costs W_WORST a m/s on top: the owner's 15 m/s line at level 3. */
const HIT_LINE = 15;
const W_WORST = 0.5;
/** Contacts a lap a race should sit in: the owner's band, kept here while ai-race.ts gates on a looser one. */
const CONTACT_BAND = [0, 8] as const;
const W_BAND = 20;
const RHO_SOFT = 0.6;
const W_RHO = 30;
const W_STUCK = 100;
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
  loss: number;
}

/** `auto` maps `<seed>/<route>` to the autopilot's lap (s). */
export function score(races: readonly { seed: number; race: RaceResult }[], auto: Record<string, number>, laps: number): Score {
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
  const loss =
    W_PACE * pace - W_PASS * passes + W_TROUBLE * trouble + W_REVERSE * reverses + W_HARDEST * hardest + W_WORST * Math.max(0, worst - HIT_LINE) + W_BAND * band + W_RHO * Math.max(0, rho - RHO_SOFT) + W_STUCK * stuck;
  return { races: n, pace, passes, trouble, reverses, hardest, worst, band, stuck, rho, loss };
}
