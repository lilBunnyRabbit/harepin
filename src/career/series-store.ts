import { better, empty_progress, parse_progress, type EventResult, type Season, type SeriesEvent, type SeriesProgress } from "./series";
import type { SeriesSaves } from "./series-db";

/** One season's progress, replaced with a new object on each change so a `$derived` over it wakes. */
export class Series {
  private progress_: SeriesProgress;
  /** Saved progress has loaded, or failed to: until then the page shows nothing rather than an empty table. */
  ready = false;
  private changed = false;

  constructor(
    readonly season: Season,
    private readonly saves: SeriesSaves | null,
  ) {
    this.progress_ = empty_progress(season);
  }

  async load(): Promise<void> {
    try {
      const raw = await this.saves?.load(this.season.id);
      // A run recorded while the load was out is newer than anything it read.
      if (!this.changed) this.progress_ = parse_progress(this.season, raw);
    } catch (error) {
      console.warn("series: saved progress unreadable, starting empty", error);
    }
    this.ready = true;
  }

  get progress(): SeriesProgress {
    return this.progress_;
  }

  record(event: SeriesEvent, result: EventResult): boolean {
    if (!better(this.season, event, result, this.progress_.results[event.id])) return false;
    this.set({ season: this.season.id, results: { ...this.progress_.results, [event.id]: result } });
    return true;
  }

  reset() {
    this.set(empty_progress(this.season));
  }

  private set(progress: SeriesProgress) {
    this.progress_ = progress;
    this.changed = true;
    this.saves?.save(progress).catch((error: unknown) => console.warn("series: progress not saved", error));
  }
}
