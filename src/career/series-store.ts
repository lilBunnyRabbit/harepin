import type { Build } from "../car/build";
import type { CarLimit } from "../car/car-pick";
import type { CarId } from "../car/cars";
import { event_credits } from "./credits";
import { better, car_fault, empty_progress, event_of, parse_progress, season_done, season_round, type EventResult, type Season, type SeriesEvent, type SeriesProgress } from "./series";
import type { SeriesSaves } from "./series-db";
import { completed, SEASONS, seasons_open } from "./series-seasons";
import type { Wallet } from "./wallet";

export interface Payout {
  kept: boolean;
  credits: number;
  season_credits: number;
  /** The reward car, when this finish completed the season and the player did not own it yet. */
  car: CarId | null;
}

/** One season's progress, replaced with a new object on each change so a `$derived` over it wakes. */
export class Series {
  private progress_: SeriesProgress;
  private season_: Season;
  /** Saved progress has loaded, or failed to: until then the page shows nothing rather than an empty table. */
  ready = false;
  private changed = false;

  constructor(
    /** The season as authored; `season` is the round being raced. */
    readonly base: Season,
    private readonly saves: SeriesSaves | null,
    readonly wallet: Wallet,
  ) {
    this.progress_ = empty_progress(base);
    this.season_ = base;
  }

  async load(): Promise<void> {
    const wallet = this.wallet.load();
    try {
      const raw = await this.saves?.load(this.base.id);
      // A run recorded while the load was out is newer than anything it read.
      if (!this.changed) this.put(parse_progress(this.base, raw));
    } catch (error) {
      console.warn("series: saved progress unreadable, starting empty", error);
    }
    await wallet;
    this.ready = true;
  }

  get progress(): SeriesProgress {
    return this.progress_;
  }

  get season(): Season {
    return this.season_;
  }

  event(id: string | null): SeriesEvent | null {
    return event_of(this.season_, id);
  }

  car_fault(build: Build): string | null {
    return car_fault(this.season_, build, this.wallet.state.cars);
  }

  /** The picker's side of `car_fault`. */
  car_limit(): CarLimit {
    return { cap: this.season_.cap, car_sized_only: false, only: this.wallet.state.cars };
  }

  record(event: SeriesEvent, result: EventResult): Payout {
    const season = this.season_;
    const credits = event_credits(season, event, result);
    this.wallet.earn(credits);
    const was_done = season_done(season, this.progress_);
    const kept = better(season, event, result, this.progress_.results[event.id]);
    if (kept) this.set({ ...this.progress_, results: { ...this.progress_.results, [event.id]: result } });
    const completed = !was_done && season_done(season, this.progress_);
    if (!completed) return { kept, credits, season_credits: 0, car: null };
    // The reward's credits pay once, on the season's own seeds: a replay pays its races' credits only, so it is no farm.
    const season_credits = this.progress_.round === 0 ? season.reward.credits : 0;
    this.wallet.earn(season_credits);
    return { kept, credits, season_credits, car: this.wallet.grant(season.reward.car) ? season.reward.car : null };
  }

  /** A finished season runs again on new seeds against a stronger field (C5); one under way starts over where it is. */
  reset() {
    const { round } = this.progress_;
    this.set(empty_progress(this.base, season_done(this.season_, this.progress_) ? round + 1 : round));
  }

  private put(progress: SeriesProgress) {
    this.progress_ = progress;
    this.season_ = season_round(this.base, progress.round);
  }

  private set(progress: SeriesProgress) {
    this.put(progress);
    this.changed = true;
    this.saves?.save(progress).catch((error: unknown) => console.warn("series: progress not saved", error));
  }
}

/** Every season's progress, in `SEASONS` order, on one store and one wallet. */
export const series_list = (saves: SeriesSaves | null, wallet: Wallet): Series[] => SEASONS.map((season) => new Series(season, saves, wallet));

export const series_open = (list: readonly Series[]): boolean[] => seasons_open(list.map((one) => completed(one.season, one.progress)));

/** The season to show first: the latest one open, unless it is done and an earlier open one is not. */
export function series_front(list: readonly Series[]): number {
  const open = series_open(list);
  const last = open.lastIndexOf(true);
  const going = open.findIndex((on, i) => on && !season_done(list[i].season, list[i].progress));
  return going >= 0 ? going : last;
}
