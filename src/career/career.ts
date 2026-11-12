import type { CarClass } from "../car/pi";
import { SILVER_SHARE, type StarRun, type Thresholds } from "../modes/track";

// Off in the release: a load turns it on with `?career`, and an event link carries it.
export const CAREER_PARAM = "career";
export const EVENT_PARAM = "event";
// With `?career`, the career page offers "Copy my times": the owner's runs set the non-race events' stars.
export const TUNE_PARAM = "tune";

export const career_on = (params: URLSearchParams) => params.has(CAREER_PARAM) || params.has(EVENT_PARAM);

export interface Spot {
  map: string;
  level: string;
}

export interface CareerEvent {
  /** Stable forever: the store and share links key on it. */
  readonly id: string;
  readonly name: string;
  readonly mode: string;
  readonly level: string;
  /** The map it belongs on; `stand_in` runs it until that map can host the mode. */
  readonly map: string;
  readonly car: { cap: CarClass } | { preset: string };
  /** `world_key` of the map it runs on now: `career.test.ts` fails when a generator bump moves it, until re-tuned. */
  readonly tuned: string;
  /** Ms (drift: points, higher is better). Race: bot runs on `tuned` (`scripts/career.ts`); the rest: the owner's run (`owner_stars`). Without them the mode's own marks grade the run. */
  readonly stars?: Thresholds;
  /** A 3-star dev ghost ships at `ghost_path`, recorded on `tuned`. */
  readonly ghost?: true;
  readonly final?: true;
  readonly stand_in?: Spot;
}

export const TierId = {
  ROOKIE: "rookie",
  CLUB: "club",
  PRO: "pro",
} as const;
export type TierId = (typeof TierId)[keyof typeof TierId];

export interface Tier {
  readonly id: TierId;
  readonly name: string;
  readonly opens_at: number;
  readonly events: readonly CareerEvent[];
}

const MAINLAND = "1M0E5M3PK";

export const TIERS: readonly Tier[] = [
  {
    id: TierId.ROOKIE,
    name: "Rookie",
    opens_at: 0,
    events: [
      { id: "r1", name: "First lap", mode: "race", level: "circuit", map: "1C0000003", car: { cap: "c" }, tuned: "3:w11", stars: { two: 334625, three: 267700 }, ghost: true },
      { id: "r2", name: "Cones", mode: "gymkhana", level: "g2", map: "1C0000003", car: { cap: "c" }, tuned: "3:w11" },
      { id: "r3", name: "Bay", mode: "parking", level: "p1", map: "1C0000003", car: { preset: "Easy cruiser" }, tuned: "3:w11" },
      { id: "r4", name: "Sand trail", mode: "race", level: "circuit", map: "1D0000005", car: { preset: "Dirt rally" }, tuned: "5:d4", stars: { two: 169000, three: 135200 }, ghost: true },
      { id: "r5", name: "Dune gates", mode: "hunt", level: "h1", map: "1D0000005", car: { cap: "c" }, tuned: "5:d4" },
      { id: "r6", name: "Cloud sprint", mode: "duel", level: "v1", map: "1S0000002", car: { cap: "c" }, tuned: "2:sky3", ghost: true },
      { id: "r7", name: "Skyline", mode: "race", level: "circuit", map: "1S0000002", car: { cap: "c" }, tuned: "2:sky3", stars: { two: 256500, three: 205200 }, ghost: true, final: true },
    ],
  },
  {
    id: TierId.CLUB,
    name: "Club",
    opens_at: 12,
    events: [
      { id: "c1", name: "Pass streets", mode: "race", level: "street-1", map: "1A0000004", car: { cap: "b" }, tuned: "4:a4", stars: { two: 123750, three: 99000 }, ghost: true },
      { id: "c2", name: "Mountain S", mode: "drift", level: "d2", map: "1A0000004", car: { preset: "Drift" }, tuned: "4:a4" },
      { id: "c3", name: "Ice box", mode: "gymkhana", level: "g4", map: "1T0000006", car: { cap: "b" }, tuned: "6:t3" },
      { id: "c4", name: "Lake search", mode: "hunt", level: "h3", map: "1T0000006", car: { preset: "Mud basher" }, tuned: "6:t3" },
      { id: "c5", name: "Winter reverse", mode: "race", level: "circuit-rev", map: "1C0000006-W1", car: { cap: "a" }, tuned: "6:w11:W1", stars: { two: 345000, three: 276000 }, ghost: true },
      { id: "c6", name: "Mainland lap", mode: "race", level: "circuit", map: MAINLAND, car: { cap: "a" }, tuned: "8:w11", stars: { two: 166000, three: 132800 }, ghost: true, stand_in: { map: "1C0000008", level: "street-2" } },
      { id: "c7", name: "Rim to sea", mode: "race", level: "descent", map: "1V0000001", car: { cap: "a" }, tuned: "1:v5", stars: { two: 204750, three: 163800 }, ghost: true, final: true },
    ],
  },
  {
    id: TierId.PRO,
    name: "Pro",
    opens_at: 14,
    events: [
      { id: "p1", name: "Marathon", mode: "duel", level: "v5", map: MAINLAND, car: { cap: "s2" }, tuned: "8:w11", ghost: true, stand_in: { map: "1C0000008", level: "v5" } },
      { id: "p2", name: "Exposed", mode: "race", level: "circuit", map: "1S0000007-F2", car: { cap: "x" }, tuned: "7:sky3:11112", stars: { two: 243000, three: 194400 }, ghost: true },
      { id: "p3", name: "Touge", mode: "drift", level: "d5", map: "1A0000009", car: { cap: "s1" }, tuned: "9:a4" },
      { id: "p4", name: "Island sweep", mode: "hunt", level: "h5", map: "1C0000008", car: { cap: "s1" }, tuned: "8:w11" },
      { id: "p5", name: "Ice parallel", mode: "parking", level: "p7", map: "1T0000006", car: { preset: "Drift" }, tuned: "6:t3" },
      { id: "p6", name: "Precision", mode: "gymkhana", level: "g7", map: "1C0000009-W1", car: { cap: "s2" }, tuned: "9:w11:W1" },
      { id: "p7", name: "Riverbed", mode: "race", level: "descent", map: "1F0000001", car: { cap: "s1" }, tuned: "1:ic5", stars: { two: 111875, three: 89500 }, ghost: true, final: true },
    ],
  },
];

export const EVENTS: readonly CareerEvent[] = TIERS.flatMap((tier) => tier.events);

export const event_of = (id: string | null): CareerEvent | null => EVENTS.find((event) => event.id === id) ?? null;

// The key's colons can't go in a file name on every system.
export const ghost_path = (event: CareerEvent) => `career/${event.id}.${event.tuned.replaceAll(":", "-")}.json`;

export const tier_of = (event: CareerEvent): Tier => TIERS.find((tier) => tier.events.includes(event)) ?? TIERS[0];

export function spot_of(event: CareerEvent): Spot {
  if (event.stand_in) return event.stand_in;
  return { map: event.map, level: event.level };
}

export type Stars = Readonly<Record<string, number>>;

export const MAX_EVENT_STARS = 3;

export const tier_max = (tier: Tier) => tier.events.length * MAX_EVENT_STARS;

export const tier_stars = (stars: Stars, tier: Tier) => tier.events.reduce((sum, event) => sum + (stars[event.id] ?? 0), 0);

export function tier_open(stars: Stars, tier: Tier): boolean {
  const before = TIERS[TIERS.indexOf(tier) - 1];
  return !before || tier_stars(stars, before) >= tier.opens_at;
}

export function current_tier(stars: Stars): Tier {
  return TIERS.findLast((tier) => tier_open(stars, tier)) ?? TIERS[0];
}

/** The next unplayed event after `after` in its tier, wrapping; then the next open tier's first unplayed; else null. */
export function next_event(stars: Stars, after: CareerEvent): CareerEvent | null {
  const tier = tier_of(after);
  const at = tier.events.indexOf(after);
  const rest = [...tier.events.slice(at + 1), ...tier.events.slice(0, at)];
  const here = rest.find((event) => !stars[event.id]);
  if (here) return here;
  for (const later of TIERS.slice(TIERS.indexOf(tier) + 1)) {
    if (!tier_open(stars, later)) return null;
    const open = later.events.find((event) => !stars[event.id]);
    if (open) return open;
  }
  return null;
}

export function suggested(stars: Stars, count: number): CareerEvent[] {
  const tier = current_tier(stars);
  return tier.events
    .filter((event) => (stars[event.id] ?? 0) < MAX_EVENT_STARS)
    .map((event, i) => ({ event, i, have: stars[event.id] ?? 0 }))
    .sort((a, b) => a.have - b.have || a.i - b.i)
    .slice(0, count)
    .map(({ event }) => event);
}

export function tier_line(stars: Stars, tier: Tier): string {
  const total = `${tier.name} ${tier_stars(stars, tier)}/${tier_max(tier)} ★`;
  const next = TIERS[TIERS.indexOf(tier) + 1];
  if (!next) return total;
  return `${total} · ${next.name} ${tier_open(stars, next) ? "open" : `at ${next.opens_at}`}`;
}

export function parse_stars(raw: unknown): Record<string, number> {
  const stars: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return stars;
  const held = (raw as Record<string, unknown>).stars;
  if (!held || typeof held !== "object" || Array.isArray(held)) return stars;
  for (const [id, value] of Object.entries(held)) if (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_EVENT_STARS) stars[id] = value as number;
  return stars;
}

/** Star marks from the owner's best run: 3 stars = that run, 2 stars a quarter slower, or for drift a quarter fewer points. */
export function owner_stars(event: CareerEvent, run: StarRun): Thresholds {
  if (event.mode === "drift") {
    const three = Math.round(run.score ?? 0);
    return { two: Math.round(three / SILVER_SHARE), three };
  }
  return { two: Math.round(run.ms * SILVER_SHARE), three: run.ms };
}
