import type { Build } from "../car/build";
import type { CarLimit } from "../car/car-pick";
import type { CarId } from "../car/cars";
import { utc_date } from "../runs/runs";
import { event_pay, podiumed, type EventPay } from "./credits";
import { DAILY_PODIUM, REPLAY_REWARD_SHARE } from "./prices";
import { frame_locks } from "./frames";
import { better, car_fault, empty_progress, event_of, parse_progress, season_done, season_round, standings, trophy_of, type EventResult, type Season, type SeriesEvent, type SeriesProgress } from "./series";
import type { SeriesSaves } from "./series-db";
import { chain_before, completed, SERIES_LIST, seasons_open } from "./series-seasons";
import type { Wallet } from "./wallet";

export interface Payout {
  kept: boolean;
  /** The race's credits, `pay.credits`. */
  credits: number;
  pay: EventPay;
  /** The first podium of the UTC day. */
  bonus: number;
  season_credits: number;
  /** The reward car, when this finish completed the season and the player did not own it yet. */
  car: CarId | null;
  /** The trophy this finish completed the season with, when it beats any kept before. */
  trophy: string | null;
}

/** A season pays its reward in full on its own seeds and a share on each replay round run to its end; a cup pays its first clear once, then its races only. */
export function reward_credits(season: Season, round: number): number {
  if (round === 0) return season.reward.credits;
  return season.loaner ? 0 : Math.round(season.reward.credits * REPLAY_REWARD_SHARE);
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
    return car_fault(this.season_, build, frame_locks(this.wallet.state.cars));
  }

  /** The picker's side of `car_fault`. */
  car_limit(): CarLimit {
    return { cap: this.season_.cap, car_sized_only: false, locked: frame_locks(this.wallet.state.cars) };
  }

  /** `day`: the UTC date the daily podium bonus counts against. */
  record(event: SeriesEvent, result: EventResult, day = utc_date(new Date())): Payout {
    const season = this.season_;
    const { round } = this.progress_;
    const before = this.progress_.results[event.id];
    const podiums = this.progress_.podiums ?? [];
    const pay = event_pay(season, event, result, podiums.includes(event.id) || podiumed(season, event, before), round);
    this.wallet.earn(pay.credits);
    const podium = podiumed(season, event, result);
    const bonus = podium && this.wallet.claim_daily(day, DAILY_PODIUM) ? DAILY_PODIUM : 0;
    const was_done = season_done(season, this.progress_);
    const kept = better(season, event, result, before);
    const fresh = podium && !podiums.includes(event.id);
    if (kept || fresh) {
      const results = kept ? { ...this.progress_.results, [event.id]: result } : this.progress_.results;
      this.set({ ...this.progress_, results, ...(fresh ? { podiums: [...podiums, event.id] } : {}) });
    }
    const done = season_done(season, this.progress_);
    // A done season keeps its rounds open: a better rerun can still lift the final table, and the trophy with it.
    const trophy = done && (kept || !was_done) ? this.place_best() : null;
    const paid = { kept, credits: pay.credits, pay, bonus, trophy };
    if (was_done || !done) return { ...paid, season_credits: 0, car: null };
    const season_credits = reward_credits(season, round);
    this.wallet.earn(season_credits);
    const { car } = season.reward;
    return { ...paid, season_credits, car: car && this.wallet.grant(car) ? car : null };
  }

  private place_best(): string | null {
    const place = standings(this.season_, this.progress_).findIndex((row) => row.you) + 1;
    const { best } = this.progress_;
    if (best && best <= place) return null;
    this.set({ ...this.progress_, best: place });
    return trophy_of(this.progress_);
  }

  /** A finished season runs again on new seeds against a stronger field (C5); one under way starts over where it is. The best place keeps. */
  reset() {
    const { round, best, podiums } = this.progress_;
    if (season_done(this.season_, this.progress_)) return this.set(empty_progress(this.base, round + 1, best));
    this.set({ ...empty_progress(this.base, round, best), ...(podiums ? { podiums } : {}) });
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

/** Every season's progress, in `SERIES_LIST` order, on one store and one wallet. */
export const series_list = (saves: SeriesSaves | null, wallet: Wallet): Series[] => SERIES_LIST.map((season) => new Series(season, saves, wallet));

export const series_open = (list: readonly Series[]): boolean[] =>
  seasons_open(
    list.map((one) => one.base),
    list.map((one) => completed(one.season, one.progress)),
  );

export const series_blocker = (list: readonly Series[], at: number): Season | null => chain_before(list.map((one) => one.base), at);

/** The season to show first: the latest one open, unless it is done and an earlier open one is not. */
export function series_front(list: readonly Series[]): number {
  const open = series_open(list);
  const last = open.lastIndexOf(true);
  const going = open.findIndex((on, i) => on && !season_done(list[i].season, list[i].progress));
  return going >= 0 ? going : last;
}
