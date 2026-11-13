import { mount } from "svelte";
import { WorldKind } from "../../worldgen/types";
import { Device, detect_device } from "../device";
import { DEFAULT_SETTINGS, type SettingKey, type SettingsState } from "../prefs";
import GuidePanel from "./GuidePanel.svelte";
import GuideSkip from "./GuideSkip.svelte";
import GuideSteps from "./GuideSteps.svelte";
import "./guide-shell.css";

export const GUIDE_STEPS = [
  { id: "you", label: "You", title: "Welcome to Harepin" },
  { id: "look", label: "Look", title: "Pick a look" },
  { id: "controls", label: "Controls", title: "How you drive" },
  { id: "help", label: "Help", title: "How much help?" },
  { id: "car", label: "Car", title: "Pick a car" },
  { id: "tour", label: "What's here", title: "What's here" },
  { id: "drive", label: "Drive", title: "Ready to drive" },
] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number]["id"];

// A theme pick reloads the page so the world takes the colours; this param brings the guide back on Look.
export const GUIDE_PARAM = "guide";
export const ROLLED_VISIT = "rolled";

export interface GuideHost {
  state(): SettingsState;
  set<K extends SettingKey>(key: K, value: SettingsState[K]): void;
  name(): string;
  car_code(): string;
  use_car(code: string): void;
  readonly kind: WorldKind;
  picture(name: string): HTMLImageElement;
  skip(): void;
  drive(kind: WorldKind): void;
  reload_on_look(rolled: boolean): void;
}

export class GuideState {
  open = $state(false);
  step = $state(0);
  found = $state<Device>(detect_device());
  device = $state<Device>(Device.KEYBOARD);
  world: WorldKind = $state(WorldKind.MAINLAND);
  rolled_visit = $state(false);
  prefs = $state.raw<SettingsState>(DEFAULT_SETTINGS);
  car = $state("");

  constructor(readonly host: GuideHost) {
    this.device = this.found;
    this.world = host.kind;
    this.prefs = host.state();
    this.car = host.car_code();
  }

  get id(): GuideStep {
    return GUIDE_STEPS[this.step].id;
  }

  set<K extends SettingKey>(key: K, value: SettingsState[K]) {
    this.host.set(key, value);
    this.prefs = this.host.state();
  }

  use_car(code: string) {
    this.host.use_car(code);
    this.car = this.host.car_code();
  }

  go(at: number) {
    this.step = Math.max(0, Math.min(GUIDE_STEPS.length - 1, at));
    if (this.id === "drive") this.set("guide_seen", true);
  }

  found_device(device: Device) {
    if (this.found === device) return;
    this.found = this.device = device;
  }
}

export class Guide {
  readonly rail = document.createElement("div");
  readonly panel = document.createElement("div");
  readonly skip_button = document.createElement("div");
  private readonly guide: GuideState;
  private abort: AbortController | null = null;

  constructor(host: GuideHost) {
    this.guide = new GuideState(host);
    this.rail.className = "guide-rail";
    this.panel.className = "guide-host";
    this.skip_button.className = "guide-skip";
    mount(GuideSteps, { target: this.rail, props: { guide: this.guide } });
    mount(GuidePanel, { target: this.panel, props: { guide: this.guide } });
    mount(GuideSkip, { target: this.skip_button, props: { onskip: () => host.skip() } });
  }

  get id(): GuideStep {
    return this.guide.id;
  }

  focus_name() {
    if (this.id === "you") this.panel.querySelector("input")?.focus();
  }

  start(step: GuideStep = "you", rolled = false) {
    this.stop();
    this.abort = new AbortController();
    const { signal } = this.abort;
    const { guide } = this;
    addEventListener("gamepadconnected", () => guide.found_device(Device.PAD), { signal });
    addEventListener("pointerdown", (event: PointerEvent) => event.pointerType === "touch" && guide.found_device(Device.TOUCH), { signal });
    guide.rolled_visit = rolled;
    guide.world = guide.host.kind;
    guide.prefs = guide.host.state();
    guide.car = guide.host.car_code();
    guide.open = true;
    guide.go(GUIDE_STEPS.findIndex(({ id }) => id === step));
  }

  stop() {
    this.abort?.abort();
    this.abort = null;
    this.guide.open = false;
  }

  back(): boolean {
    if (this.guide.step === 0) return false;
    this.guide.go(this.guide.step - 1);
    return true;
  }

  step_by(step: number) {
    this.guide.go(this.guide.step + step);
  }
}
