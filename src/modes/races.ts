import type { Route } from "../worldgen/types";
import { RouteTracker, bend, straights, type RoutePoint } from "./route";
import { stars_for } from "./track";

/** Route points past its gate a car may get and still take it; past that the gate was skipped. */
export const GATE_REACH = 10;
const GATE_SLACK = 2;
/** Held at the line this long before the clock runs, in a solo race; the lobby holds its own countdown. */
export const COUNTDOWN_MS = 3000;

export interface RaceLevel {
  id: string;
  name: string;
  brings: string;
  /** A speed trap level: the route it runs on. The score is the km/h through its traps, the finish still required. */
  trap?: string;
  goal?: string;
}

interface LevelDef {
  id: string;
  name: string;
  /** `place` is what the world calls itself: "island", "mainland". */
  brings(place: string): string;
}

/** In progression order; a seed lists only the routes it generated, so one without a canyon skips the offroad ids. */
const LEVELS: readonly LevelDef[] = [
  { id: "circuit", name: "Circuit", brings: (place) => `One lap of the ${place} circuit from a standing start.` },
  { id: "street-1", name: "Town to town", brings: () => "Through the back streets of one town, round the circuit and into the next." },
  { id: "offroad-1", name: "Trail", brings: (place) => `Point to point across the ${place} on dirt.` },
  { id: "street-2", name: "Cross town", brings: () => "Another pair of towns, every corner a square one." },
  { id: "offroad-2", name: "Long trail", brings: () => "The longer way across, on dirt." },
  { id: "descent", name: "Rim to sea", brings: () => "One way off the crater rim: down the hairpins and the gully to the sea." },
  { id: "sprint", name: "Circuit sprint", brings: (place) => `The twistiest stretch of the ${place} circuit, one way from a standing start.` },
  { id: "circuit-rev", name: "Circuit reversed", brings: () => "The circuit the wrong way round: every corner is new." },
];

/** After every race; compact worlds only, as a streamed world's chunks are not read for the straights (risk 10). */
const TRAP_LEVELS: readonly (LevelDef & { route: string })[] = [
  { id: "trap", name: "Speed trap", route: "circuit", brings: (place) => `Radar traps on the ${place} circuit's longest straights: every km/h through them scores, then over the line.` },
];

const TRAP_GOAL = "Hit each radar trap flat out, then drive through the gates to the finish line.";

const listed = (routes: readonly { id: string }[]) => LEVELS.filter((level) => routes.some((r) => r.id === level.id));

export function race_levels(routes: readonly { id: string }[], place: string, streamed = false): RaceLevel[] {
  const races = listed(routes).map(({ id, name, brings }) => ({ id, name, brings: brings(place) }));
  if (streamed) return races;
  const traps = TRAP_LEVELS.filter((level) => routes.some((r) => r.id === level.route)).map(({ id, name, brings, route }) => ({ id, name, brings: brings(place), trap: route, goal: TRAP_GOAL }));
  return [...races, ...traps];
}

export interface RaceChoice {
  id: string;
  name: string;
  /** Metres, one lap of a closed route. */
  length: number;
  /** Laps only apply to a closed route; the lobby runs any other once. */
  closed: boolean;
}

/** What a lobby route picker lists: every route of the seed, in progression order. */
export function race_choices(routes: readonly Pick<Route, "id" | "length" | "closed">[]): RaceChoice[] {
  return listed(routes).flatMap((level) => {
    const route = routes.find((r) => r.id === level.id);
    return route ? [{ id: level.id, name: level.name, length: route.length, closed: route.closed }] : [];
  });
}

export interface RaceCourse {
  route: Route;
  /** The driven line: a closed route's points with its first point again at the end. */
  line: RoutePoint[];
  gates: number[];
}

export function race_course(route: Route): RaceCourse {
  const line = route.closed ? [...route.points, route.points[0]] : [...route.points];
  const gates: number[] = [];
  let from = 1;
  for (const gate of route.checkpoints) {
    let best = from;
    for (let i = from; i < line.length; i++) if ((line[i].x - gate.x) ** 2 + (line[i].z - gate.z) ** 2 < (line[best].x - gate.x) ** 2 + (line[best].z - gate.z) ** 2) best = i;
    gates.push(best);
    from = Math.min(line.length - 1, best + 1);
  }
  gates[gates.length - 1] = line.length - 1;
  return { route, line, gates };
}

export const RaceStatus = { READY: "ready", RUNNING: "running", DONE: "done" } as const;
export type RaceStatus = (typeof RaceStatus)[keyof typeof RaceStatus];

export class RaceRun {
  status: RaceStatus = RaceStatus.READY;
  clock = 0;
  started = 0;
  ended = 0;
  next = 0;
  readonly tracker: RouteTracker;

  constructor(
    readonly course: RaceCourse,
    private readonly countdown_ms = COUNTDOWN_MS,
  ) {
    this.tracker = new RouteTracker(course.line);
  }

  /** Ms left before the clock runs; the car is held until then. */
  get countdown(): number {
    return this.status === RaceStatus.READY ? Math.max(0, this.countdown_ms - this.clock) : 0;
  }

  elapsed(): number {
    if (this.status === RaceStatus.READY) return 0;
    return (this.status === RaceStatus.DONE ? this.ended : this.clock) - this.started;
  }

  stars(): number {
    return stars_for(this.elapsed(), this.course.route.par_ms);
  }

  /** The next gate on the line; null once the last is taken. */
  get gate(): RoutePoint | null {
    return this.course.line[this.course.gates[this.next]] ?? null;
  }

  get missed(): boolean {
    return this.status === RaceStatus.RUNNING && this.tracker.index > this.course.gates[this.next] + GATE_REACH;
  }

  /** The gate taken this step, or -1. */
  update(dt_ms: number, x: number, z: number): number {
    if (this.status === RaceStatus.DONE) return -1;
    this.clock += dt_ms;
    const index = this.tracker.update(x, z);
    if (this.status === RaceStatus.READY) {
      if (this.clock < this.countdown_ms) return -1;
      this.status = RaceStatus.RUNNING;
      this.started = this.countdown_ms;
    }
    const at = this.course.gates[this.next];
    if (index < at || index > at + GATE_REACH || this.tracker.offset > this.course.route.gate_hw + GATE_SLACK) return -1;
    const taken = this.next++;
    if (this.next >= this.course.gates.length) {
      this.status = RaceStatus.DONE;
      this.ended = this.clock;
    }
    return taken;
  }
}

/**
 * Whether gate `i` of `count` shows while gate `next` is the one to take. A circuit's finish sits on its start line,
 * right under the car at the start, so it waits until it is the next gate.
 */
export function gate_shown(i: number, next: number, count: number, closed: boolean): boolean {
  return closed && i === count - 1 ? i === next : i >= next;
}

export const TRAPS = 3;
/** Route points from the start line kept clear of traps: a standing start is no speed run. */
const TRAP_FROM = 25;
/** Route points a trap keeps off a gate, so the two bands never lie on one another. */
export const TRAP_CLEAR = 4;
const KMH = 3.6;
/** A speed trap score as it reads: the only race runs that carry one. */
export const kmh = (score: number) => `${Math.round(score)} km/h`;

/** Route points a trap sits back from a straight's end: the end is where the bend starts. */
export const TRAP_BACK = 10;
/** Route points of road a fallback trap is centred on: the window it is ranked on, and how far apart two straights' traps keep. */
export const TRAP_SPAN = 40;
/** Route points a fallback trap keeps from every other trap and from the start line: it never doubles one up, nor times a car still pulling away. */
export const TRAP_GAP = 150;

/**
 * Line indices of the speed traps, in driving order: near the far end of each of the line's longest straights, short of
 * the bend and off its gates. A line with fewer straights than `count` (sweepers merge into one) fills up from the middle
 * of its gentlest stretches, spaced apart.
 */
export function trap_points(line: readonly RoutePoint[], gates: readonly number[], count = TRAPS): number[] {
  const picked: number[] = [];
  const place = (from: number, to: number, gap: number, first: number) => {
    let at = Math.min(to, line.length - 1 - TRAP_CLEAR);
    for (const gate of gates) if (Math.abs(gate - at) < TRAP_CLEAR) at = gate - TRAP_CLEAR;
    const fits = at >= from && at >= first && gates.every((gate) => Math.abs(gate - at) >= TRAP_CLEAR) && picked.every((p) => Math.abs(p - at) >= gap);
    if (!fits || picked.length >= count) return false;
    picked.push(at);
    return true;
  };
  for (const { from, to } of straights(line)) place(from, Math.max(from + ((to - from) >> 1), to - TRAP_BACK), TRAP_SPAN, TRAP_FROM);
  if (picked.length < count) {
    const windows: [number, number][] = [];
    for (let start = 0; start + TRAP_SPAN <= line.length; start++) windows.push([start, bend(line, start, TRAP_SPAN)]);
    windows.sort((a, b) => a[1] - b[1]);
    for (const [start] of windows) place(start, start + (TRAP_SPAN >> 1), TRAP_GAP, TRAP_GAP);
    // A lap too short to space them all that far still gets its traps, as close as two straights' traps may sit.
    for (const [start] of windows) place(start, start + (TRAP_SPAN >> 1), TRAP_SPAN, TRAP_FROM);
  }
  return picked.sort((a, b) => a - b);
}

/** The traps of a speed trap run, in order: a trap passed off the line, or skipped, scores 0. */
export class TrapRun {
  next = 0;
  /** Km/h through each trap passed so far, rounded. */
  readonly kmh: number[] = [];

  constructor(
    readonly at: readonly number[],
    private readonly gate_hw: number,
  ) {}

  get total(): number {
    return this.kmh.reduce((sum, kmh) => sum + kmh, 0);
  }

  /** The km/h through the trap passed this step, 0 for one missed, or null. `speed` in m/s. */
  update(index: number, offset: number, speed: number): number | null {
    const at = this.at[this.next];
    if (at === undefined || index < at) return null;
    const missed = index > at + GATE_REACH;
    if (!missed && offset > this.gate_hw + GATE_SLACK) return null;
    const kmh = missed ? 0 : Math.round(speed * KMH);
    this.kmh.push(kmh);
    this.next++;
    return kmh;
  }
}
