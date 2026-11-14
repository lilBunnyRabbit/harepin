import { mount } from "svelte";
import type { Car } from "../car/car";
import { LAB_PARAM } from "../world/world-pick";
import type { Lab, LabWatch } from "./lab";
import { progress_key, progress_text } from "./lab-text";
import LabOverlay from "./LabOverlay.svelte";
import type { Recorder } from "./recorder";

export type LabScreen = { kind: "list" } | { kind: "brief"; index: number } | { kind: "result"; index: number } | null;

const KMH = 3.6;

/** The strip's live numbers. Each is rebuilt only when the whole number it shows moves, so a frame mostly writes nothing. */
class Readout {
  goal = $state("");
  lat = $state("");
  speed = $state("");
  slip = $state("");
  private goal_key = NaN;
  private lat_key = NaN;
  private speed_key = NaN;
  private slip_key = NaN;
  private shown: Recorder | null = null;

  constructor(private readonly lab: Lab) {}

  update(recorder: Recorder, car: Car) {
    const r = this.lab.current;
    if (!r) return;
    const { goal } = r.trial;
    // A new trial may count the same number toward a different goal.
    if (recorder !== this.shown) {
      this.shown = recorder;
      this.goal_key = NaN;
    }
    const goal_key = progress_key(goal, recorder.laps, recorder.gates, recorder.time);
    if (goal_key !== this.goal_key) {
      this.goal_key = goal_key;
      this.goal = progress_text(goal, goal_key, (r.lane.start ? 1 : 0) + (r.lane.finish ? 1 : 0));
    }
    const lat_key = Math.round(recorder.lateral * 100);
    if (lat_key !== this.lat_key) {
      this.lat_key = lat_key;
      this.lat = `${(lat_key / 100).toFixed(2)} g`;
    }
    const speed_key = Math.round(Math.hypot(car.vel.x, car.vel.z) * KMH);
    if (speed_key !== this.speed_key) {
      this.speed_key = speed_key;
      this.speed = `${speed_key} km/h`;
    }
    const slip_key = Math.round(recorder.slip);
    if (slip_key !== this.slip_key) {
      this.slip_key = slip_key;
      this.slip = `${slip_key}°`;
    }
  }
}

/** Rune view of the plain `Lab`: the lab owns trials, results and answers; this only wakes the overlay when they change. */
export class LabView implements LabWatch {
  screen = $state<LabScreen>({ kind: "list" });
  /** The export block when the clipboard refused it, shown to select by hand. */
  refused = $state<string | null>(null);
  /** Live numbers show while a trial is measuring or waiting for its first throttle. */
  measuring = $state(false);
  readonly readout: Readout;
  private tick = $state(0);

  constructor(readonly lab: Lab) {
    this.readout = new Readout(lab);
  }

  read<T>(get: () => T): T {
    void this.tick;
    return get();
  }

  changed() {
    this.tick++;
  }

  ended(index: number) {
    this.tick++;
    this.screen = { kind: "result", index };
  }

  frame(recorder: Recorder | null, car: Car) {
    const measuring = recorder !== null;
    if (measuring !== this.measuring) this.measuring = measuring;
    if (recorder) this.readout.update(recorder, car);
  }

  async copy() {
    this.refused = (await this.lab.copy()) ? null : this.lab.export();
  }

  /** Answers and numbers stay in this tab's storage: opening the pack link again picks them up. */
  leave() {
    const url = new URL(location.href);
    url.searchParams.delete(LAB_PARAM);
    location.assign(url);
  }
}

export function show_overlay(lab: Lab): LabView {
  const view = new LabView(lab);
  lab.watch = view;
  const target = document.createElement("div");
  target.className = "lab-overlay";
  (document.querySelector(".dock-top") ?? document.body).append(target);
  // Keys typed into a card stay in it instead of steering or opening the menu; the strip lets them through to drive.
  target.addEventListener("keydown", (event) => {
    if (event.target instanceof Element && event.target.closest("dialog")) event.stopPropagation();
  });
  mount(LabOverlay, { target, props: { view } });
  return view;
}
