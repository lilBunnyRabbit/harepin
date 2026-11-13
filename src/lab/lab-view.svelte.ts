import { mount } from "svelte";
import type { Lab, LabWatch } from "./lab";
import LabOverlay from "./LabOverlay.svelte";

export type LabScreen = { kind: "list" } | { kind: "result"; index: number } | null;

/** Rune view of the plain `Lab`: the lab owns trials, results and answers; this only wakes the overlay when they change. */
export class LabView implements LabWatch {
  screen = $state<LabScreen>({ kind: "list" });
  /** The export block when the clipboard refused it, shown to select by hand. */
  refused = $state<string | null>(null);
  private tick = $state(0);

  constructor(readonly lab: Lab) {}

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

  async copy() {
    this.refused = (await this.lab.copy()) ? null : this.lab.export();
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
