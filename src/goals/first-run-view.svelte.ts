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
  readonly flag: { readonly distance: number | null; readonly turn: number };
  open_steps(): void;
}

export class FirstRunView {
  shown = $state(false);
  step = $state(0);
  input = $state<LastInput>("keys");
  done = $state(0);
  readonly total = GOALS.length;
  private readonly run = new FirstRun();
  private over: boolean;

  constructor(readonly host: FirstRunHost) {
    this.over = host.goals.is_done(GoalId.FLAG);
    this.done = host.goals.count;
  }

  update(speed: number, heading: number, roaming: boolean) {
    if (this.over) return;
    if (roaming !== this.shown) {
      this.shown = roaming;
      this.done = this.host.goals.count;
    }
    if (!roaming) return;
    const input = document.documentElement.dataset.input;
    if (input !== this.input && (input === "keys" || input === "pad" || input === "touch")) this.input = input;
    if (!this.run.update(speed, heading, this.host.flag.distance)) return;
    this.step = this.run.step;
    if (!this.run.over) return;
    this.over = true;
    this.shown = false;
    this.host.goals.done(GoalId.FLAG);
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
