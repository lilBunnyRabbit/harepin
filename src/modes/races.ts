import type { Route } from "../worldgen/types";
import { RouteTracker, type RoutePoint } from "./route";
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
  { id: "circuit-rev", name: "Circuit reversed", brings: () => "The circuit the wrong way round: every corner is new." },
];

const listed = (routes: readonly { id: string }[]) => LEVELS.filter((level) => routes.some((r) => r.id === level.id));

export function race_levels(routes: readonly { id: string }[], place: string): RaceLevel[] {
  return listed(routes).map(({ id, name, brings }) => ({ id, name, brings: brings(place) }));
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
