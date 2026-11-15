import { read_json, write_json, type Store } from "../modes/track";
import { better, empty_progress, parse_progress, type EventResult, type Season, type SeriesEvent, type SeriesProgress } from "./series";

export const SERIES_KEY = "harepin:series";

/** One season's progress, replaced with a new object on each change so a `$derived` over it wakes. */
export class Series {
  private progress_: SeriesProgress;

  constructor(
    readonly season: Season,
    private readonly store: Store | null,
  ) {
    this.progress_ = parse_progress(season, read_json(store, this.key));
  }

  private get key(): string {
    return `${SERIES_KEY}:${this.season.id}`;
  }

  get progress(): SeriesProgress {
    return this.progress_;
  }

  /** True when the run is the event's new best for the player. */
  record(event: SeriesEvent, result: EventResult): boolean {
    if (!better(this.season, event, result, this.progress_.results[event.id])) return false;
    this.progress_ = { season: this.season.id, results: { ...this.progress_.results, [event.id]: result } };
    write_json(this.store, this.key, this.progress_);
    return true;
  }

  reset() {
    this.progress_ = empty_progress(this.season);
    write_json(this.store, this.key, this.progress_);
  }
}

/** Tab storage, as the lab keeps its answers: the series' save format is not settled, so nothing outlives the tab. */
export function session_store(): Store | null {
  try {
    return sessionStorage;
  } catch (error) {
    console.warn("sessionStorage unavailable, series progress stays in memory", error);
    return null;
  }
}
