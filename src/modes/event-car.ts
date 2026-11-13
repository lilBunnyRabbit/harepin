import { EVENT_PARAM, type CareerEvent } from "../career/career";
import { build_code, parse_build } from "../car/build";
import { limit_text, same_machine, within, type CarLimit } from "../car/car-pick";
import { rating, type CarClass } from "../car/pi";
import { PRESETS } from "../car/presets";
import { RUN_PARAM } from "../runs/runs";

export interface CarHooks {
  /** The step before a start that asks which car runs it: its code, or null when the player backs out. Events only for now. */
  pick_car: ((title: string, limit: CarLimit, own: string, signal: AbortSignal) => Promise<string | null>) | null;
  /** Puts `code` on the car; unsaved, a reload brings back the player's own car. */
  fit_car: ((code: string, save: boolean) => void) | null;
  car_code: (() => string) | null;
  /** Writes `code` as the saved car without fitting it. */
  save_car: ((code: string) => void) | null;
}

const preset_code = (name: string): string | null => {
  const build = parse_build(PRESETS.find((p) => p.name === name)?.code);
  return build && build_code(build);
};

/** The car an event runs on: a fixed preset or a pick under its class cap, lent over the player's own until they leave. */
export class EventCar {
  private pick: AbortController | null = null;
  /** The player's own car while an event runs on another one, put back when they leave the event. */
  private kept: string | null = null;
  private fitting_ = false;

  constructor(private readonly hooks: CarHooks) {}

  /** True while an event fits its car or gives the player's back: a garage change the player did not make. */
  get fitting(): boolean {
    return this.fitting_;
  }

  /** True while an event runs on a car it lent the player. */
  get borrowed(): boolean {
    return this.kept !== null;
  }

  get picking(): boolean {
    return this.pick !== null;
  }

  get can_pick(): boolean {
    return this.hooks.pick_car !== null;
  }

  cancel_pick() {
    this.pick?.abort();
  }

  // A fixed preset goes on with no step; a class cap asks, with the cars over it greyed.
  async ready(event: CareerEvent, limit: (cap: CarClass) => CarLimit): Promise<boolean> {
    const { car } = event;
    if ("preset" in car) {
      const code = preset_code(car.preset);
      if (code) this.wear(code);
      return true;
    }
    if (!this.hooks.pick_car) return true;
    const code = await this.ask(event.name, limit(car.cap));
    if (code === null) {
      // A cancelled pick must not reopen on reload, so the event leaves the URL; map params stay.
      const url = new URL(location.href);
      url.searchParams.delete(EVENT_PARAM);
      url.searchParams.delete(RUN_PARAM);
      history.replaceState(history.state, "", url);
      return false;
    }
    this.wear(code);
    return true;
  }

  async ask(title: string, limit: CarLimit): Promise<string | null> {
    const { pick_car, car_code } = this.hooks;
    if (!pick_car) return null;
    const pick = new AbortController();
    this.pick = pick;
    try {
      const own = this.kept ?? car_code?.() ?? "";
      return await pick_car(title, limit, own, pick.signal);
    } finally {
      if (this.pick === pick) this.pick = null;
    }
  }

  /** A picked car back on: the player's own is no longer a loan, so their garage edits stay theirs. */
  swap(code: string) {
    if (code === this.kept) this.give_back();
    else this.wear(code);
  }

  wear_preset(event: CareerEvent | null) {
    const car = event?.car;
    const code = car && "preset" in car ? preset_code(car.preset) : null;
    if (code) this.wear(code);
  }

  private wear(code: string) {
    const { fit_car, car_code } = this.hooks;
    if (!fit_car || !car_code || code === car_code()) return;
    this.kept ??= car_code();
    this.fit(code, false);
  }

  give_back() {
    const kept = this.kept;
    this.kept = null;
    if (kept !== null) this.fit(kept, true);
  }

  release() {
    this.kept = null;
  }

  /** The garage saved the event car; the player's own stays the saved one, for a reload mid-run. */
  save_kept() {
    if (this.kept !== null) this.hooks.save_car?.(this.kept);
  }

  private fit(code: string, save: boolean) {
    this.fitting_ = true;
    try {
      this.hooks.fit_car?.(code, save);
    } finally {
      this.fitting_ = false;
    }
  }

  wrong(event: CareerEvent | null): string | null {
    if (!event || !this.hooks.car_code) return null;
    const { car } = event;
    const build = parse_build(this.hooks.car_code());
    if (!build) return null;
    if ("preset" in car) {
      const preset = parse_build(preset_code(car.preset));
      return !preset || same_machine(build, preset) ? null : `${event.name}: ${car.preset} only`;
    }
    return within(rating(build).class, car.cap) ? null : `${event.name}: ${limit_text(car.cap)}`;
  }

  pi(): number | null {
    const build = parse_build(this.hooks.car_code?.());
    return build && rating(build).pi;
  }
}
