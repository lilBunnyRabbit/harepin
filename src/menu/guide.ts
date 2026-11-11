import { SteerMode } from "../car/car";
import { STATS, build_spec, parse_build, stats } from "../car/build";
import { PRESETS as CAR_PRESETS } from "../car/presets";
import { build_badge } from "./class-badge";
import { STAT_NAMES, stat_rating } from "./garage-meters";
import { AidPreset, preset_aids, preset_of, random_name, rolled_name } from "./guide-rules";
import { generate_theme } from "../theme/random-theme";
import { el, icon } from "./setting-rows";
import { key_label, keys_text, pad_text, type Bindable, type Bindings } from "../hud/bindings";
import { TouchSteer, type SettingKey, type SettingsState } from "./prefs";
import { THEMES, choose_theme, current_theme, derive_theme, find_saved, find_theme, load_saved_themes, store_saved_themes, with_saved, without_saved } from "../theme/theme";
import type { WorldKind } from "../worldgen/types";
import { LISTED, MINIS } from "../worlds/worlds";
import "./guide.css";

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

const Device = {
  KEYBOARD: "keyboard",
  PAD: "pad",
  TOUCH: "touch",
} as const;
type Device = (typeof Device)[keyof typeof Device];

const DEVICES: [Device, string][] = [
  [Device.KEYBOARD, "Keyboard"],
  [Device.PAD, "Controller"],
  [Device.TOUCH, "Touch"],
];

const LOOKS = ["Brand Dark", "Brand Light", "Forest Night", "Warm Sunset", "Ocean Breeze", "Cyberpunk", "Lavender Dream"];
const SWATCHES = ["primary", "secondary", "accent"] as const;

const STEER: Record<SteerMode, [string, string]> = {
  snap: ["Classic", "Turns fast, snaps straight when you let go."],
  hold: ["Hold", "The wheel stays put and centres as you roll."],
  smooth: ["Smooth", "A tap nudges; holding builds the turn."],
};
const TOUCH_STEER: Record<TouchSteer, [string, string]> = {
  drag: ["Drag", "Put a finger down anywhere and slide to steer."],
  buttons: ["Buttons", "Left and right buttons that steer like the keyboard."],
};

const DRIVE_KEYS = ["throttle", "steer_left", "brake", "steer_right"] as const;

function keymap(bindings: Bindings): Record<Device, [string[], string, string][]> {
  const first = (action: Bindable) => bindings[action].keys.slice(0, 1).map(key_label);
  const pad = (action: Bindable) => [pad_text(bindings, action)].filter(Boolean);
  const second = DRIVE_KEYS.map((action) => bindings[action].keys[1]);
  const rewind = pad("rewind");
  return {
    keyboard: [
      [DRIVE_KEYS.flatMap(first), "Drive", second.every(Boolean) ? `or ${second.map((code) => key_label(code)).join(" ")}` : ""],
      [bindings.handbrake.keys.map(key_label), "Handbrake", ""],
      [first("nitro"), "Nitro", "when fitted"],
      [first("rewind"), "Rewind", "hold"],
      [[...first("reset"), ...first("camera")], "Reset, camera", ""],
      [["Esc"], "Menu", ""],
    ],
    pad: [
      [["RT", "LT"], "Gas, brake", ""],
      [["L stick"], "Steer", ""],
      [pad("handbrake"), "Handbrake", ""],
      [pad("nitro"), "Nitro", "when fitted"],
      [[...rewind, ...pad("reset")], "Rewind, reset", rewind.length ? `hold ${rewind[0]} to rewind` : ""],
      [["Start"], "Menu", ""],
    ],
    touch: [
      [["Gas", "Brake"], "Pedals", "bottom right"],
      [["Steer"], "Steer", "drag or arrows, bottom left"],
      [["Nitro"], "Nitro", "when fitted"],
      [["Rewind"], "Rewind", "hold"],
      [["Menu"], "Menu", "top left"],
    ],
  };
}

const PRESETS: [AidPreset, string, string][] = [
  [AidPreset.EASY, "Easy", "Grip, brakes and slides looked after. Gears shift for you."],
  [AidPreset.BALANCED, "Balanced", "Traction, ABS and stability stay on, steering assist is off: a slide is yours to countersteer."],
  [AidPreset.PRO, "Pro", "Nothing helps. You shift yourself."],
];
const AID_LIGHTS = [
  ["tcs", "TC"],
  ["abs", "ABS"],
  ["assist", "Steer"],
  ["stability", "STM"],
  ["auto", "Auto"],
] as const;

const MINI_NAMES = new Intl.ListFormat("en", { type: "conjunction" }).format(MINIS.map((w) => w.name));

const TOUR: [string, string, string, string][] = [
  ["mainland", "Mainland", `Six kilometres of towns and open road, where the lobby meets. Mini maps: ${MINI_NAMES}.`, "Play"],
  ["icon-modes", "Modes", "Race, gymkhana, parking, drift, hunt, duel. Stars and best times for each.", "Play, Modes"],
  ["icon-paint", "Garage", "Switch cars, from a hatchback to a city bus. Swap engine, tyres and paint, save builds.", "Garage"],
  ["icon-share", "Friends", "Send a link and friends drive your map with you. Race the lobby.", "Online"],
];

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

function detect(): Device {
  if (matchMedia("(pointer: coarse)").matches) return Device.TOUCH;
  if (navigator.getGamepads().some((pad) => pad?.connected)) return Device.PAD;
  return Device.KEYBOARD;
}

function button(cls: string, ...content: (Node | string)[]): HTMLButtonElement {
  const node = el("button", cls);
  node.type = "button";
  node.append(...content);
  return node;
}

function pressed(node: HTMLElement, on: boolean): HTMLElement {
  node.setAttribute("aria-pressed", String(on));
  return node;
}

export class Guide {
  readonly rail = el("nav", "guide-rail");
  readonly panel = el("section", "guide-panel");
  readonly skip_button = button("guide-skip", "Skip guide");
  private step = 0;
  private found: Device = detect();
  private device: Device = this.found;
  private world: WorldKind;
  private readonly name_input = el("input", "guide-name");
  private readonly name_tag = el("span", "guide-tag");
  private rolled_visit = false;
  private abort: AbortController | null = null;

  constructor(private readonly host: GuideHost) {
    this.world = host.kind;
    this.rail.setAttribute("aria-label", "Guide steps");
    this.panel.setAttribute("aria-label", "First-run guide");
    this.skip_button.addEventListener("click", () => host.skip());
    GUIDE_STEPS.forEach(({ label }, at) => {
      const step = button("guide-step", el("span", "guide-n"), el("span", "", label));
      step.addEventListener("click", () => this.go(at));
      this.rail.append(step);
    });
    const name = this.name_input;
    name.type = "text";
    name.maxLength = 24;
    name.autocomplete = "off";
    name.enterKeyHint = "done";
    name.setAttribute("aria-label", "Your name");
    name.addEventListener("input", () => (this.name_tag.textContent = name.value.trim() || host.name()));
    name.addEventListener("change", () => this.commit_name());
    name.addEventListener("keydown", (event) => {
      if (event.key === "Enter") name.blur();
    });
  }

  focus_name() {
    if (this.id === "you") this.name_input.focus();
  }

  get id(): GuideStep {
    return GUIDE_STEPS[this.step].id;
  }

  start(step: GuideStep = "you", rolled = false) {
    this.stop();
    this.abort = new AbortController();
    const { signal } = this.abort;
    addEventListener("gamepadconnected", () => this.found_device(Device.PAD), { signal });
    addEventListener("pointerdown", (event: PointerEvent) => event.pointerType === "touch" && this.found_device(Device.TOUCH), { signal });
    this.rolled_visit = rolled;
    this.world = this.host.kind;
    this.go(GUIDE_STEPS.findIndex(({ id }) => id === step));
  }

  stop() {
    this.abort?.abort();
    this.abort = null;
  }

  go(at: number) {
    if (this.id === "you") this.commit_name();
    this.step = Math.max(0, Math.min(GUIDE_STEPS.length - 1, at));
    if (this.id === "drive") this.host.set("guide_seen", true);
    this.render();
  }

  back(): boolean {
    if (this.step === 0) return false;
    this.go(this.step - 1);
    return true;
  }

  step_by(step: number) {
    this.go(this.step + step);
  }

  first(): HTMLElement | null {
    return this.panel.querySelector<HTMLElement>("[aria-pressed='true'], input, .guide-copy button") ?? this.panel.querySelector("footer .menu-go");
  }

  private found_device(device: Device) {
    if (this.found === device) return;
    this.found = this.device = device;
    if (this.id === "controls" || this.id === "help" || this.id === "tour") this.render();
  }

  private commit_name() {
    const name = this.name_input.value.trim();
    const next = name ? name : null;
    if (next !== this.host.state().name) this.host.set("name", next);
  }

  render() {
    const step = GUIDE_STEPS[this.step];
    [...this.rail.children].forEach((node, at) => {
      node.setAttribute("aria-current", String(at === this.step));
      node.classList.toggle("done", at < this.step);
      const n = node.firstElementChild;
      if (n) n.textContent = at < this.step ? "✓" : String(at + 1);
    });
    this.panel.dataset.step = step.id;
    const copy = el("div", "guide-copy");
    copy.append(el("h2", "guide-title", step.title));
    const lede = this.lede();
    if (lede) copy.append(el("p", "guide-lede", lede));
    const visual = el("div", "guide-visual");
    this[step.id](copy, visual);
    this.panel.replaceChildren(copy, ...(visual.childElementCount ? [visual] : []), this.footer());
  }

  private lede(): string {
    const menu = { keyboard: "Esc", pad: "Start", touch: "the menu button" }[this.device];
    switch (this.id) {
      case "you":
        return "A small driving game: a mainland to roam, mini maps for quick runs, friends a link away. First, a name.";
      case "look":
        return "Colours for the menu, the HUD and the whole world. The game reloads in each one you pick.";
      case "controls":
        return {
          keyboard: `These are the keys you need; ${keys_text(this.host.state().bindings.help) || "Settings, Controls"} lists the rest${this.host.state().bindings.help.keys.length ? " while driving" : ""}.`,
          pad: "Triggers drive, the left stick steers.",
          touch: "Pedals on the right, steering on the left.",
        }[this.device];
      case "help":
        return "Aids keep the car tidy while you learn. Turn any of them off later.";
      case "car":
        return "A ready-made build to start in. Swap any part later in the Garage.";
      case "tour":
        return `Four things worth knowing. All of them live in this menu; ${menu} opens it while driving.`;
      case "drive":
        return "Where to first? The mainland is where everyone meets; switch any time from Play.";
    }
  }

  private footer(): HTMLElement {
    const foot = el("footer", "guide-foot");
    if (this.step > 0) {
      const back = button("guide-back", icon("icon-back"), el("span", "", "Back"));
      back.addEventListener("click", () => this.back());
      foot.append(back);
    }
    const last = this.step === GUIDE_STEPS.length - 1;
    if (last) {
      foot.append(el("span", "guide-small", "Run this guide again from Settings."));
      const drive = button("menu-go guide-go guide-drive", "Drive");
      drive.addEventListener("click", () => this.host.drive(this.world));
      foot.append(drive);
      return foot;
    }
    if (this.step > 0) foot.append(el("span", "guide-small guide-count", `Step ${this.step + 1} of ${GUIDE_STEPS.length}`));
    const next = button("menu-go guide-go", this.step === 0 ? "Start" : "Next");
    next.addEventListener("click", () => this.go(this.step + 1));
    foot.append(next);
    return foot;
  }

  private field(label: string, ...content: HTMLElement[]): HTMLElement {
    const field = el("div", "guide-field");
    field.append(el("span", "guide-eyebrow", label), ...content);
    return field;
  }

  private seg<T extends string>(label: string, options: readonly (readonly [T, string])[], value: T, pick: (value: T) => void, mark?: T): HTMLElement {
    const seg = el("div", "guide-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", label);
    for (const [option, text] of options) {
      const node = pressed(button("", ...(option === mark ? [el("i", "guide-found")] : []), text), option === value);
      if (option === mark) node.title = "Found on this device";
      node.addEventListener("click", () => pick(option));
      seg.append(node);
    }
    return seg;
  }

  private you(copy: HTMLElement, visual: HTMLElement) {
    const name = this.host.state().name;
    this.name_input.value = name ?? "";
    this.name_input.placeholder = this.host.name();
    this.name_tag.textContent = name ?? this.host.name();
    const dice = button("guide-dice", icon("icon-dice"));
    dice.title = "Another name";
    dice.setAttribute("aria-label", "Another name");
    dice.addEventListener("click", () => {
      const next = random_name(this.name_input.value.trim() || this.host.name());
      this.name_input.value = next;
      this.name_tag.textContent = next;
      this.host.set("name", next);
    });
    const row = el("div", "guide-name-row");
    row.append(this.name_input, dice);
    copy.append(this.field("Your name", row, el("span", "guide-small", "Others see it above your car. Change it any time from the name chip in the menu.")));
    visual.append(this.shot(this.name_tag));
  }

  private shot(...over: HTMLElement[]): HTMLElement {
    const shot = el("div", "guide-shot");
    shot.append(this.host.picture(this.host.kind), ...over);
    return shot;
  }

  private dash(): HTMLElement {
    const dash = el("div", "guide-dash");
    const speed = el("div", "guide-speed");
    speed.append(el("b", "", "48"), el("span", "guide-small", "km/h"), el("span", "guide-gear", "3"));
    const rev = el("div", "guide-rev");
    rev.append(el("i"));
    dash.append(speed, rev, this.lights(this.host.state()));
    return dash;
  }

  private look(copy: HTMLElement, visual: HTMLElement) {
    const active = current_theme();
    const tiles = el("div", "guide-tiles");
    const tile = (label: string, name: string | null, on: boolean, art: Element[]) => {
      const node = pressed(button("guide-tile"), on);
      const swatch = el("span", "guide-swatch");
      const theme = name ? find_theme(name) : null;
      if (theme) swatch.style.background = theme.background;
      swatch.append(...art);
      node.append(swatch, el("span", "guide-tile-name", label));
      return node;
    };
    const dots = (name: string) => {
      const theme = find_theme(name);
      return SWATCHES.map((token) => {
        const dot = el("i");
        if (theme) dot.style.background = theme[token];
        return dot;
      });
    };
    for (const name of LOOKS) {
      const node = tile(name, name, name === active, dots(name));
      node.addEventListener("click", () => this.pick_theme(name));
      tiles.append(node);
    }
    const rolled = this.rolled_visit && !THEMES[active];
    const roll = tile(rolled ? "Roll again" : "Roll one", rolled ? active : null, rolled, rolled ? dots(active) : [icon("icon-dice")]);
    roll.classList.add("guide-roll");
    roll.addEventListener("click", () => this.roll());
    tiles.append(roll);
    copy.append(tiles, el("span", "guide-small", "Make your own later: Settings, Display."));
    const tag = el("span", "guide-tag", this.host.state().name ?? this.host.name());
    visual.append(this.shot(tag, this.dash()));
  }

  private pick_theme(name: string) {
    const active = current_theme();
    if (name === active) return;
    if (this.rolled_visit && !THEMES[active]) store_saved_themes(without_saved(load_saved_themes(), active));
    choose_theme(name);
    this.host.reload_on_look(false);
  }

  private roll() {
    const saved = load_saved_themes();
    const active = current_theme();
    const replace = this.rolled_visit && find_saved(saved, active) ? active : null;
    const name = replace ?? rolled_name(saved.map((theme) => theme.name));
    const base = generate_theme({ mode: Math.random() < 0.5 ? "dark" : "light", harmony: "any", vibrance: 0.5, contrast: 0.5 });
    if (!store_saved_themes(with_saved(saved, name, derive_theme(base)))) return;
    choose_theme(name);
    this.host.reload_on_look(true);
  }

  private controls(copy: HTMLElement, visual: HTMLElement) {
    const state = this.host.state();
    copy.append(
      this.seg("Device", DEVICES, this.device, (device) => {
        this.device = device;
        this.render();
      }, this.found),
    );
    if (this.device === Device.KEYBOARD) {
      const options = Object.values(SteerMode).map((mode) => [mode, STEER[mode][0]] as const);
      copy.append(this.field("Steering feel", this.seg("Steering feel", options, state.steer_mode, (mode) => this.pick("steer_mode", mode)), el("span", "guide-small", STEER[state.steer_mode][1])));
    } else if (this.device === Device.TOUCH) {
      const options = Object.values(TouchSteer).map((mode) => [mode, TOUCH_STEER[mode][0]] as const);
      copy.append(this.field("Touch steering", this.seg("Touch steering", options, state.touch_steer, (mode) => this.pick("touch_steer", mode)), el("span", "guide-small", TOUCH_STEER[state.touch_steer][1])));
    } else copy.append(this.field("Steering feel", el("span", "guide-small", "The stick steers as far as you push it. Nothing to set.")));
    const keys = el("div", "guide-keys");
    keys.dataset.device = this.device;
    for (const [glyphs, what, note] of keymap(state.bindings)[this.device]) {
      const caps = el("span", glyphs.length === 4 ? "guide-wasd" : "guide-caps");
      for (const glyph of glyphs) caps.append(el("kbd", glyph.length > 2 ? "guide-wide" : "", glyph));
      const label = el("span", "guide-what", what);
      if (note) label.append(el("small", "", note));
      keys.append(caps, label);
    }
    const card = el("div", "guide-card");
    card.append(keys);
    visual.append(card);
  }

  private pick<K extends SettingKey>(key: K, value: SettingsState[K]) {
    this.host.set(key, value);
    this.render();
  }

  private help(copy: HTMLElement, visual: HTMLElement) {
    const touch = this.device === Device.TOUCH;
    const state = this.host.state();
    const current = preset_of(state, touch);
    const list = el("div", "guide-aids");
    for (const [preset, name, text] of PRESETS) {
      const aids = preset_aids(preset, touch);
      const node = pressed(button("guide-aid", el("b", "", name), this.lights(aids)), preset === current);
      node.append(el("span", "", preset === AidPreset.PRO ? this.pro_text() : text));
      node.addEventListener("click", () => {
        for (const [key] of AID_LIGHTS) this.host.set(key, aids[key]);
        this.render();
      });
      list.append(node);
    }
    copy.append(list);
    visual.append(this.dash());
    const picked = PRESETS.find(([preset]) => preset === current);
    if (picked) {
      const line = el("span", "guide-picked");
      line.append(el("b", "", `${picked[1]}. `), el("span", "guide-small", picked[0] === AidPreset.PRO ? this.pro_text() : picked[2]));
      visual.append(line);
    }
    const note = this.device === Device.KEYBOARD ? this.aid_keys() : "Change them any time in Settings, Driving.";
    visual.append(el("span", "guide-small", `The dash shows which aids are on. ${note}`));
  }

  private aid_keys(): string {
    const { bindings } = this.host.state();
    const keys = (["tcs", "abs", "assist", "stability", "auto"] as const).map((aid) => keys_text(bindings[aid]));
    if (!keys.every(Boolean)) return "Change them any time in Settings, Driving.";
    return `${keys.slice(0, -1).join(", ")} and ${keys.at(-1)} switch each one while driving.`;
  }

  private shift_with(up: string, down: string): string {
    return up && down ? `Nothing helps. You shift with ${up} and ${down}.` : "Nothing helps. You shift yourself: set the keys in Settings, Controls.";
  }

  private pro_text(): string {
    const { bindings } = this.host.state();
    if (this.device === Device.PAD) return this.shift_with(pad_text(bindings, "shift_up"), pad_text(bindings, "shift_down"));
    if (this.device === Device.TOUCH) return "No traction, ABS, steering assist or stability. Gears stay automatic on touch.";
    return this.shift_with(keys_text(bindings.shift_up), keys_text(bindings.shift_down));
  }

  private lights(aids: Pick<SettingsState, "tcs" | "abs" | "assist" | "stability" | "auto">): HTMLElement {
    const row = el("span", "guide-lights");
    for (const [key, label] of AID_LIGHTS) row.append(el("i", aids[key] ? "on" : "", label));
    return row;
  }

  private car(copy: HTMLElement) {
    const fitted = this.host.car_code();
    const cards = el("div", "guide-cars");
    CAR_PRESETS.forEach(({ name, blurb, code }, at) => {
      const build = parse_build(code);
      if (!build) return;
      const rated = stats(build_spec(build));
      const card = pressed(button("guide-car"), code === fitted);
      const head = el("span", "guide-car-head");
      head.append(el("b", "", name), build_badge(build));
      if (at === 0) head.append(el("span", "guide-badge", "Recommended"));
      const hint = STATS.filter((key) => key !== "braking").map((key) => `${STAT_NAMES[key]} ${stat_rating(key, rated[key])}`).join(" · ");
      card.append(head, el("span", "guide-car-blurb", blurb), el("span", "guide-car-stats", hint));
      card.addEventListener("click", () => {
        this.host.use_car(code);
        this.render();
        this.panel.querySelector<HTMLElement>(`.guide-car[aria-pressed="true"]`)?.focus({ focusVisible: false });
      });
      cards.append(card);
    });
    copy.append(cards);
  }

  private tour(copy: HTMLElement) {
    const pics = el("div", "guide-pics");
    for (const [art, title, text, where] of TOUR) {
      const card = el("div", "guide-pic");
      const top = el("span", "guide-pic-art");
      top.append(art.startsWith("icon-") ? icon(art) : this.host.picture(art));
      const words = el("span", "guide-pic-text");
      words.append(el("b", "", title), el("span", "", text));
      card.append(top, el("span", "guide-where", where), words);
      pics.append(card);
    }
    copy.append(pics);
  }

  private drive(copy: HTMLElement) {
    const pics = el("div", "guide-worlds");
    for (const { kind, name: title, note: text } of LISTED) {
      const card = pressed(button("guide-world"), kind === this.world);
      const words = el("span", "guide-pic-text");
      words.append(el("b", "", title), el("span", "", text));
      card.append(this.host.picture(kind), words);
      card.addEventListener("click", () => {
        this.world = kind;
        this.render();
        this.panel.querySelector<HTMLElement>(`.guide-world[aria-pressed="true"]`)?.focus({ focusVisible: false });
      });
      pics.append(card);
    }
    copy.append(pics);
  }
}
