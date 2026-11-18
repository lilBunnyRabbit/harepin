import { MAX_PAINT, type Decal } from "../car/build";
import type { CarId } from "../car/cars";
import type { CarClass } from "../car/pi";
import type { Stage } from "../modes/championship";
import { SILVER_SHARE, type StarRun, type Thresholds } from "../modes/track";

export const EVENT_PARAM = "event";
// `?tune` (old links: `?career&tune`) opens every tier and adds "Copy my times": the owner's runs set the non-race events' stars.
export const TUNE_PARAM = "tune";

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
  /** The route leaves tarmac: the bot fields that set its marks fit no road tyre (sport, semi-slick, slicks). */
  readonly off_tarmac?: true;
  /** `world_key` of the map it runs on now: `career.test.ts` fails when a generator bump moves it, until re-tuned. */
  readonly tuned: string;
  /** Ms (drift: points, higher is better). Race: bot runs on `tuned` (`scripts/career.ts`); the rest: the owner's run (`owner_stars`). Without them the mode's own marks grade the run. */
  readonly stars?: Thresholds;
  /** A 3-star dev ghost ships at `ghost_path`, recorded on `tuned`. */
  readonly ghost?: true;
  readonly final?: true;
  readonly stand_in?: Spot;
  /** A championship: run back to back on `map`, the first being `mode` and `level`. `stars` then grade the total points. */
  readonly stages?: readonly Stage[];
}

export const TierId = {
  ROOKIE: "rookie",
  CLUB: "club",
  PRO: "pro",
  ELITE: "elite",
  LEGEND: "legend",
} as const;
export type TierId = (typeof TierId)[keyof typeof TierId];

export interface Tier {
  readonly id: TierId;
  readonly name: string;
  readonly opens_at: number;
  /** 3 stars = the owner's run (race: the bot median) times this; above 1 the owner's run earns 3 stars with room. */
  readonly margin: number;
  readonly events: readonly CareerEvent[];
  /**
   * `paint`: the build paint index, past `MAX_PAINT`, earned at `paint_at` stars in the tier. `decal`: earned at the
   * tier's max; none while the tier can still grow. `badge`: the letter on the tier's metal shield. `car`: a car only
   * this tier gives.
   */
  readonly rewards: { readonly paint: number; readonly paint_at: number; readonly decal?: Decal; readonly badge: string; readonly car?: CarId };
}

const MAINLAND = "1M0E5M3PK";

export const TIERS: readonly Tier[] = [
  {
    id: TierId.ROOKIE,
    name: "Rookie",
    opens_at: 0,
    margin: 1,
    rewards: { paint: MAX_PAINT + 1, paint_at: 10, decal: "sky", badge: "R" },
    events: [
      { id: "r1", name: "First lap", mode: "race", level: "circuit", map: "1C0000003", car: { cap: "c" }, tuned: "3:w14", stars: { two: 336000, three: 268800 }, ghost: true },
      { id: "r2", name: "Cones", mode: "gymkhana", level: "g2", map: "1C0000003", car: { cap: "c" }, tuned: "3:w14", stars: { two: 56774, three: 45419 } },
      { id: "r3", name: "Bay", mode: "parking", level: "p1", map: "1C0000003", car: { preset: "Easy cruiser" }, tuned: "3:w14", stars: { two: 6098, three: 4878 } },
      { id: "r4", name: "Sand trail", mode: "race", level: "circuit", map: "1D0000005", car: { preset: "Dirt rally" }, tuned: "5:d7", stars: { two: 169000, three: 135200 }, ghost: true },
      { id: "r5", name: "Dune gates", mode: "hunt", level: "h1", map: "1D0000005", car: { cap: "c" }, tuned: "5:d7", stars: { two: 45990, three: 36792 } },
      { id: "r6", name: "Cloud sprint", mode: "duel", level: "v1", map: "1S0000002", car: { cap: "c" }, tuned: "2:sky6", stars: { two: 24684, three: 19747 } },
      { id: "r7", name: "Skyline", mode: "race", level: "circuit", map: "1S0000002", car: { cap: "c" }, tuned: "2:sky6", stars: { two: 257250, three: 205800 }, ghost: true, final: true },
    ],
  },
  {
    id: TierId.CLUB,
    name: "Club",
    opens_at: 12,
    margin: 1,
    rewards: { paint: MAX_PAINT + 2, paint_at: 10, decal: "volcano", badge: "C" },
    events: [
      { id: "c1", name: "Pass streets", mode: "race", level: "street-1", map: "1A0000004", car: { cap: "b" }, tuned: "4:a7", stars: { two: 125125, three: 100100 }, ghost: true },
      { id: "c2", name: "Mountain S", mode: "drift", level: "d2", map: "1A0000004", car: { preset: "Drift" }, tuned: "4:a7", stars: { two: 230, three: 287 } },
      { id: "c3", name: "Ice box", mode: "gymkhana", level: "g4", map: "1T0000006", car: { cap: "b" }, tuned: "6:t7", stars: { two: 21680, three: 17344 } },
      { id: "c4", name: "Lake search", mode: "hunt", level: "h3", map: "1T0000006", car: { preset: "Mud basher" }, tuned: "6:t7", stars: { two: 71680, three: 57344 } },
      { id: "c5", name: "Winter reverse", mode: "race", level: "circuit-rev", map: "1C0000006-W1", car: { cap: "a" }, tuned: "6:w14:W1", stars: { two: 345125, three: 276100 }, ghost: true },
      { id: "c6", name: "Mainland sprint", mode: "race", level: "sprint", map: MAINLAND, car: { cap: "a" }, tuned: "475664083:m13", stars: { two: 576750, three: 461400 } },
      { id: "c7", name: "Rim to sea", mode: "race", level: "descent", map: "1V0000001", car: { cap: "a" }, tuned: "1:v8", stars: { two: 199250, three: 159400 }, ghost: true, final: true },
    ],
  },
  {
    id: TierId.PRO,
    name: "Pro",
    opens_at: 14,
    margin: 1,
    rewards: { paint: MAX_PAINT + 3, paint_at: 10, decal: "ice", badge: "P" },
    events: [
      { id: "p1", name: "Marathon", mode: "duel", level: "v5", map: MAINLAND, car: { cap: "s2" }, tuned: "475664083:m13", stars: { two: 211200, three: 192000 } },
      { id: "p2", name: "Exposed", mode: "race", level: "circuit", map: "1S0000007-F2", car: { cap: "x" }, tuned: "7:sky6:11112", stars: { two: 245000, three: 196000 }, ghost: true },
      { id: "p3", name: "Touge", mode: "drift", level: "d5", map: "1A0000009", car: { cap: "s1" }, tuned: "9:a7", stars: { two: 267, three: 334 } },
      { id: "p4", name: "Island sweep", mode: "hunt", level: "h5", map: "1C0000008", car: { cap: "s1" }, tuned: "8:w14", stars: { two: 246871, three: 197497 } },
      { id: "p5", name: "Ice parallel", mode: "parking", level: "p7", map: "1T0000006", car: { preset: "Dirt rally" }, tuned: "6:t7", stars: { two: 21066, three: 16853 } },
      { id: "p6", name: "Precision", mode: "gymkhana", level: "g7", map: "1C0000009-W1", car: { cap: "s2" }, tuned: "9:w14:W1", stars: { two: 55608, three: 44486 } },
      { id: "p7", name: "Riverbed", mode: "race", level: "descent", map: "1F0000001", car: { cap: "s1" }, off_tarmac: true, tuned: "1:ic9", stars: { two: 68750, three: 55000 }, ghost: true, final: true },
    ],
  },
  {
    id: TierId.ELITE,
    name: "Elite",
    opens_at: 16,
    margin: 1.03,
    rewards: { paint: MAX_PAINT + 4, paint_at: 18, decal: "dunes", badge: "E" },
    events: [
      { id: "e1", name: "Crater ring", mode: "race", level: "circuit", map: "1V0000002", car: { cap: "s1" }, tuned: "2:v8", stars: { two: 70375, three: 56300 }, ghost: true },
      { id: "e2", name: "Long trail", mode: "race", level: "offroad-2", map: "1C0000011", car: { preset: "Dirt rally" }, tuned: "33:w14", stars: { two: 293250, three: 234600 }, ghost: true },
      { id: "e3", name: "Tight garage", mode: "parking", level: "p8", map: "1D0000007", car: { cap: "s1" }, tuned: "7:d7" },
      { id: "e4", name: "Rim drift", mode: "drift", level: "d4", map: "1F0000002", car: { preset: "Drift" }, tuned: "2:ic9" },
      { id: "e5", name: "Ash gates", mode: "hunt", level: "h4", map: "1V0000002", car: { cap: "s2" }, tuned: "2:v8" },
      { id: "e6", name: "Down-class duel", mode: "duel", level: "v4", map: "1S0000011", car: { cap: "b" }, tuned: "33:sky6", stars: { two: 101500, three: 81200 } },
      { id: "e7", name: "Frozen slalom", mode: "gymkhana", level: "g6", map: "1T0000008", car: { cap: "s1" }, tuned: "8:t7" },
      { id: "e8", name: "Drift chain", mode: "drift", level: "d6", map: "1A0000009", car: { preset: "Drift" }, tuned: "9:a7" },
      { id: "e9", name: "Speed traps", mode: "race", level: "trap", map: "1S0000002", car: { cap: "x" }, tuned: "2:sky6" },
      { id: "e10", name: "Long jump", mode: "jump", level: "j2", map: "1C0000003", car: { cap: "s2" }, tuned: "3:w14" },
      {
        id: "e11",
        name: "Island cup",
        mode: "race",
        level: "circuit",
        map: "1C0000008",
        car: { cap: "s1" },
        tuned: "8:w14",
        stages: [
          { mode: "race", level: "circuit", stars: { two: 343250, three: 274600 } },
          { mode: "jump", level: "j1" },
          { mode: "duel", level: "v3", stars: { two: 89625, three: 71700 } },
        ],
      },
      { id: "e12", name: "Dune crossing", mode: "race", level: "crossing", map: "1B0000004", car: { cap: "x" }, off_tarmac: true, tuned: "4:bd17", stars: { two: 185750, three: 148600 }, ghost: true, final: true },
    ],
  },
  {
    id: TierId.LEGEND,
    name: "Legend",
    opens_at: 27,
    margin: 1.03,
    rewards: { paint: MAX_PAINT + 5, paint_at: 18, decal: "velodrome", badge: "L", car: "fujin" },
    events: [
      { id: "l1", name: "Coast to coast", mode: "race", level: "trip", map: MAINLAND, car: { cap: "s1" }, tuned: "475664083:m13", stars: { two: 653375, three: 522700 } },
      { id: "l2", name: "Black ice", mode: "gymkhana", level: "g7", map: "1T0000006", car: { cap: "x" }, tuned: "6:t7" },
      { id: "l3", name: "Pit garage", mode: "parking", level: "p8", map: "1V0000002", car: { preset: "Maxed F1" }, tuned: "2:v8" },
      { id: "l4", name: "Glass chain", mode: "drift", level: "d6", map: "1F0000002", car: { preset: "Drift" }, tuned: "2:ic9" },
      { id: "l5", name: "Ash sweep", mode: "hunt", level: "h5", map: "1V0000002", car: { cap: "a" }, tuned: "2:v8" },
      { id: "l6", name: "High banks", mode: "race", level: "banked", map: "1S0000007-F2Q2", car: { cap: "x" }, tuned: "7:sky6:12112", stars: { two: 131500, three: 105200 } },
      { id: "l7", name: "Road kicker", mode: "jump", level: "j3", map: "1A0000009", car: { cap: "x" }, tuned: "9:a7" },
      { id: "l8", name: "Canyon traps", mode: "race", level: "trap", map: "1F0000001", car: { cap: "x" }, tuned: "1:ic9" },
      { id: "l9", name: "Mountain marathon", mode: "duel", level: "v5", map: "1A0000004", car: { cap: "b" }, tuned: "4:a7", stars: { two: 151750, three: 121400 } },
      { id: "l10", name: "Wrong way round", mode: "race", level: "circuit-rev", map: "1C0000011", car: { cap: "x" }, tuned: "33:w14", stars: { two: 350125, three: 280100 } },
      {
        id: "l11",
        name: "Legend cup",
        mode: "race",
        level: "street-2",
        map: "1D0000007",
        car: { cap: "s2" },
        tuned: "7:d7",
        stages: [
          { mode: "race", level: "street-2", stars: { two: 138750, three: 111000 } },
          { mode: "gymkhana", level: "g7" },
          { mode: "drift", level: "d4" },
          { mode: "jump", level: "j3" },
          { mode: "duel", level: "v5", stars: { two: 123500, three: 98800 } },
        ],
      },
      { id: "l12", name: "Velodrome final", mode: "race", level: "circuit", map: "1S0000004-W1", car: { cap: "x" }, tuned: "4:sky6:W1", stars: { two: 219000, three: 175200 }, ghost: true, final: true },
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

/** Two saves of the career: per event the most stars, in the save's `{ stars }` shape. */
export function merge_stars(kept: unknown, other: unknown): { stars: Record<string, number> } {
  const stars = parse_stars(kept);
  for (const [id, value] of Object.entries(parse_stars(other))) stars[id] = Math.max(stars[id] ?? 0, value);
  return { stars };
}

/** Star marks from the owner's best run: 3 stars = that run eased by the tier's margin, 2 stars a quarter slower, or for a scored run (drift points, jump metres) a quarter less. */
export function owner_stars(event: CareerEvent, run: StarRun): Thresholds {
  const { margin } = tier_of(event);
  if (run.score !== undefined) {
    const three = Math.round((run.score ?? 0) / margin);
    return { two: Math.round(three / SILVER_SHARE), three };
  }
  const three = Math.round(run.ms * margin);
  return { two: Math.round(three * SILVER_SHARE), three };
}
