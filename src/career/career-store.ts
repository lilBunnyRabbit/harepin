import { Track, read_json, write_json, type StarRun, type Store, type Thresholds } from "../modes/track";
import { world_key, type MapSpec } from "../worldgen/kinds/kinds";
import { parse_map_code } from "../worldgen/kinds/map-code";
import { EVENTS, owner_stars, parse_stars, spot_of, type CareerEvent, type Stars } from "./career";

// No world version in the key: stars outlive a generator bump, unlike times and ghosts.
export const CAREER_KEY = "harepin:career";

export function event_map(event: CareerEvent): MapSpec {
  const read = parse_map_code(spot_of(event).map);
  if (!read.ok) throw new Error(`career event ${event.id}: map code ${spot_of(event).map} does not read`);
  return read.map;
}

/** The event's own best-time store, `harepin:career:<id>:<world_key>`, apart from the mode's free-play one. */
export function event_track(event: CareerEvent, store: Store | null): Track {
  const { seed, kind, levels } = event_map(event);
  return new Track(`career:${event.id}`, seed, [spot_of(event).level], store, kind, levels);
}

export class Career {
  private stars_: Record<string, number>;
  version = 0;

  constructor(private readonly store: Store | null) {
    this.stars_ = parse_stars(read_json(store, CAREER_KEY));
  }

  get stars(): Stars {
    return this.stars_;
  }

  record(event: CareerEvent, stars: number): boolean {
    if (stars < 1 || stars <= (this.stars_[event.id] ?? 0)) return false;
    this.stars_ = { ...this.stars_, [event.id]: stars };
    this.version++;
    write_json(this.store, CAREER_KEY, { stars: this.stars_ });
    return true;
  }

  best(event: CareerEvent): StarRun | undefined {
    return event_track(event, this.store).runs[spot_of(event).level];
  }
}

/** "Copy my times": each non-race event's `stars` and `tuned` from the player's best run, to paste into `career.ts`. */
export function owner_times(career: Career): string {
  const times: Record<string, { stars: Thresholds; tuned: string }> = {};
  for (const event of EVENTS) {
    const best = event.mode === "race" ? undefined : career.best(event);
    if (!best) continue;
    const { seed, kind, levels } = event_map(event);
    times[event.id] = { stars: owner_stars(event, best), tuned: world_key(seed, kind, levels) };
  }
  return JSON.stringify(times, null, 2);
}
