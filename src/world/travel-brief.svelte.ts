import { mount, unmount } from "svelte";
import type { Build } from "../car/build";
import type { Travel } from "./travel";
import TravelBrief from "./TravelBrief.svelte";

/** A load step's label and how far along the bar it stands, 0 to 1. */
export interface BriefStep {
  label: string;
  share: number;
}

export class BriefView {
  step = $state.raw<BriefStep>({ label: "", share: 0 });
  ready = $state(false);

  constructor(
    readonly travel: Travel,
    readonly build: Build,
  ) {}
}

/** The travel briefing over the loading screen: where the load is going, how far along it is, and Start once the map stands. */
export class Brief {
  private readonly view: BriefView;
  private readonly shown: ReturnType<typeof mount>;
  private go: () => void = () => {};
  /** Settles when the player starts; the map is ready by then. */
  readonly started = new Promise<void>((resolve) => (this.go = resolve));

  constructor(loading: HTMLElement, travel: Travel, build: Build) {
    this.view = new BriefView(travel, build);
    this.shown = mount(TravelBrief, { target: loading, props: { view: this.view, onstart: () => this.go() } });
    void this.started.then(() => unmount(this.shown));
  }

  step(label: string, share: number) {
    this.view.step = { label, share };
  }

  ready() {
    this.view.step = { label: "Ready", share: 1 };
    this.view.ready = true;
  }
}
