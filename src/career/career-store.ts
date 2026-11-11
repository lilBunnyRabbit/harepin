import { Track, read_json, write_json, type StarRun, type Store } from "../modes/track";
import type { MapSpec } from "../worldgen/kinds/kinds";
import { parse_map_code } from "../worldgen/kinds/map-code";
import { parse_stars, spot_of, type CareerEvent, type Stars } from "./career";

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
