import { mount } from "svelte";
import type { Bindings } from "../hud/bindings";
import type { LastInput } from "../hud/last-input";
import type { TouchSteer } from "../menu/prefs";
import FirstRunStrip from "./FirstRun.svelte";
import { FirstRun } from "./first-run";
import { GOALS, GoalId, type Goals } from "./goals";

export interface FirstRunHost {
  readonly goals: Goals;
  bindings(): Bindings;
  touch_steer(): TouchSteer;
  /** The input last used, as `:root[data-input]` holds it. */
  input(): string | undefined;
  /** `away`: the first flag stands on another map, so no distance leads to it. */
  readonly flag: { readonly distance: number | null; readonly turn: number; readonly away: boolean };
  open_steps(): void;
}

/** The first run lasts until the flag goal is done, here or anywhere else that marks it. */
export class FirstRunView {
  shown = $state(false);
  step = $state(0);
  input = $state<LastInput>("keys");
  done = $state(0);
  readonly total = GOALS.length;
  private readonly run = new FirstRun();

  constructor(readonly host: FirstRunHost) {
    this.done = host.goals.count;
  }

  update(speed: number, heading: number, roaming: boolean) {
    const shown = roaming && !this.host.goals.is_done(GoalId.FLAG);
    if (shown !== this.shown) {
      this.shown = shown;
      this.done = this.host.goals.count;
    }
    if (!shown) return;
    const input = this.host.input();
    if (input !== this.input && (input === "keys" || input === "pad" || input === "touch")) this.input = input;
    if (!this.run.update(speed, heading, this.host.flag.distance)) return;
    this.step = this.run.step;
    if (this.run.over) this.reach();
  }

  /** The flag reached. Travel to its map counts: the event starts under it as the map loads. */
  reach() {
    this.shown = false;
    this.host.goals.done(GoalId.FLAG);
  }

  skip() {
    this.shown = false;
    this.host.goals.skip(GoalId.FLAG);
  }
}

export function show_first_run(host: FirstRunHost): FirstRunView {
  const view = new FirstRunView(host);
  const target = document.createElement("div");
  target.className = "first-run-dock";
  document.body.append(target);
  mount(FirstRunStrip, { target, props: { view } });
  return view;
}
