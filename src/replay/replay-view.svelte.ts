import { mount } from "svelte";
import ReplayBar from "./ReplayBar.svelte";

// The frame loop writes the clock every frame; in steps this size only a new one wakes the bar.
const CLOCK_STEP_MS = 100;

export interface ReplayActs {
  toggle(): void;
  seek(ms: number): void;
  next_speed(): void;
  swap_camera(): void;
  close(): void;
}

export class ReplayView {
  shown = $state(false);
  paused = $state(false);
  free = $state(false);
  speed = $state(1);
  ms = $state(0);
  end_ms = $state(0);

  constructor(readonly acts: ReplayActs) {}

  clock(ms: number) {
    this.ms = Math.round(ms / CLOCK_STEP_MS) * CLOCK_STEP_MS;
  }

  mount(target: HTMLElement) {
    mount(ReplayBar, { target, props: { view: this } });
  }
}
