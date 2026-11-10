import { $ } from "./hud";
import type { Action } from "./bindings";
import { TouchSteer } from "../menu/prefs";
import "./touch.css";

const STEER_RANGE = 70;
const STEER_DEADZONE = 6;
const STEER_CURVE = 1.4;
/** Least pedal a zone press gives: a thumb landing low on a pedal, or below it, still drives. */
const PEDAL_FLOOR = 0.25;

const CONTROLS = ["steer", "left", "right", "pedals", "throttle", "brake", "handbrake", "nitro", "rewind", "reset", "camera"] as const;
type Control = (typeof CONTROLS)[number];

interface Finger {
  control: Control;
  /** What the finger works now: its control, or for a zone the key it is over, which changes as it slides. */
  part: Control;
  el: HTMLElement;
  origin: number;
  /** Steer -1..1 or pedal 0..1; held buttons use 1. */
  value: number;
  /** Order of the last update, so the most recent steer finger wins. */
  touched: number;
}

const control_of = (el: HTMLElement): Control | null => CONTROLS.find((c) => c === el.dataset.touch) ?? null;

export class Touch {
  steer = 0;
  throttle = 0;
  brake = 0;
  handbrake = 0;
  rewind = false;
  nitro = false;
  used = false;
  private fingers = new Map<number, Finger>();
  private queued: Action[] = [];
  private ring = $("steer-ring");
  private knob = $("steer-knob");
  private abort: AbortController | null = null;
  private tick = 0;
  private steer_mode: TouchSteer = TouchSteer.DRAG;
  private nitro_key = $("nitro-key");

  constructor(private root: HTMLElement) {}

  get active() {
    return this.fingers.size > 0;
  }

  /** Buttons give -1, 0 or 1 like keys, so the car ramps them the way it ramps the keyboard. */
  get buttons() {
    return this.steer_mode === TouchSteer.BUTTONS;
  }

  show_nitro(fitted: boolean) {
    this.nitro_key.hidden = !fitted;
    if (!fitted) this.set_nitro(false);
  }

  /** Turns the burn off once the tank runs dry, so the next tap starts a fresh one. */
  tank_empty() {
    this.set_nitro(false);
  }

  private set_nitro(on: boolean) {
    this.nitro = on;
    this.nitro_key.setAttribute("aria-pressed", String(on));
  }

  set_steer_mode(mode: TouchSteer) {
    this.steer_mode = mode;
    this.root.dataset.steer = mode;
    this.sync();
  }

  start() {
    this.abort = new AbortController();
    const { signal } = this.abort;
    this.root.addEventListener("pointerdown", (e) => this.down(e), { signal });
    this.root.addEventListener("pointermove", (e) => this.move(e), { signal });
    this.root.addEventListener("lostpointercapture", (e) => this.release(e.pointerId), { signal });
    this.root.addEventListener("contextmenu", (e) => e.preventDefault(), { signal });
    const first_touch = new AbortController();
    signal.addEventListener("abort", () => first_touch.abort());
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType !== "touch") return;
        // Entering fullscreen closes any open popover, so a first tap on a menu button would open and lose it at once.
        if (e.target instanceof Element && e.target.closest("button, [popover]")) return;
        first_touch.abort();
        void this.fullscreen();
      },
      { signal: first_touch.signal },
    );
  }

  stop() {
    this.abort?.abort();
    this.abort = null;
    for (const id of [...this.fingers.keys()]) this.release(id);
  }

  take_actions(): Action[] {
    const actions = this.queued;
    this.queued = [];
    return actions;
  }

  private down(e: PointerEvent) {
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-touch]") : null;
    const control = el && control_of(el);
    if (!el || !control) return;
    e.preventDefault();
    this.used = true;
    if (control === "reset" || control === "camera") {
      this.queued.push(control);
      return;
    }
    // The right thumb holds gas, so nitro is a tap on the left: on until the tank is empty or it is tapped again.
    if (control === "nitro") {
      this.set_nitro(!this.nitro);
      return;
    }
    el.setPointerCapture(e.pointerId);
    const finger: Finger = { control, part: control, el, origin: e.clientX, value: 0, touched: 0 };
    this.fingers.set(e.pointerId, finger);
    if (control === "steer" && !this.buttons) {
      this.ring.hidden = false;
      this.ring.style.translate = `${e.clientX}px ${e.clientY}px`;
    }
    this.update(finger, e);
  }

  private move(e: PointerEvent) {
    const finger = this.fingers.get(e.pointerId);
    if (finger) this.update(finger, e);
  }

  private update(finger: Finger, e: PointerEvent) {
    finger.touched = ++this.tick;
    if (finger.control === "steer" && this.buttons) {
      // In button steering the whole steer zone is the two keys: each side of the line between them steers that way, and a
      // held finger crossing it switches without lifting, so a thumb that misses the small key still turns.
      const left = this.root.querySelector('[data-touch="left"]')?.getBoundingClientRect();
      const right = this.root.querySelector('[data-touch="right"]')?.getBoundingClientRect();
      const mid = left && right ? (left.right + right.left) / 2 : innerWidth / 4;
      finger.value = e.clientX < mid ? -1 : 1;
    } else if (finger.control === "steer") {
      const dx = Math.max(-STEER_RANGE, Math.min(STEER_RANGE, e.clientX - finger.origin));
      const dead = Math.max(0, Math.abs(dx) - STEER_DEADZONE) / (STEER_RANGE - STEER_DEADZONE);
      finger.value = Math.sign(dx) * dead ** STEER_CURVE;
      this.knob.style.translate = `${dx}px 0`;
    } else if (finger.control === "pedals") this.pedal(finger, e);
    else finger.value = 1;
    this.sync();
  }

  /**
   * The pedal zone covers the lower right; the visible keys only mark where its parts are. Right of the line between the
   * two columns is gas, left of it brake, and a press that lands in the brake column above the line between the handbrake
   * key and the brake pedal is the handbrake. A held gas or brake finger only ever switches between the two as it slides,
   * so a thumb drifting up at full gas stays on gas.
   */
  private pedal(finger: Finger, e: PointerEvent) {
    const gas = this.key("throttle");
    const brake = this.key("brake");
    const over_gas = e.clientX >= (brake.right + gas.left) / 2;
    if (finger.part === "pedals") {
      const handbrake = this.key("handbrake");
      finger.part = over_gas ? "throttle" : e.clientY < (handbrake.bottom + brake.top) / 2 ? "handbrake" : "brake";
    } else if (finger.part !== "handbrake") finger.part = over_gas ? "throttle" : "brake";
    if (finger.part === "handbrake") {
      finger.value = 1;
      return;
    }
    const rect = finger.part === "throttle" ? gas : brake;
    const travel = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
    finger.value = PEDAL_FLOOR + (1 - PEDAL_FLOOR) * travel;
  }

  private key(control: Control): DOMRect {
    const el = this.root.querySelector(`[data-touch="${control}"]`);
    if (!el) throw new Error(`touch key ${control} is missing`);
    return el.getBoundingClientRect();
  }

  private release(id: number) {
    if (!this.fingers.delete(id)) return;
    this.sync();
  }

  // Every control is derived from the fingers still down, so lifting one of two fingers on a pedal keeps it held.
  private sync() {
    const all = [...this.fingers.values()];
    const max = (control: Control) => Math.max(0, ...all.filter((f) => f.part === control).map((f) => f.value));
    const steer = all.filter((f) => f.control === "steer").sort((a, b) => b.touched - a.touched)[0];
    const zone = (side: number) => all.some((f) => f.control === "steer" && f.value === side);
    const left = Math.max(max("left"), zone(-1) ? 1 : 0);
    const right = Math.max(max("right"), zone(1) ? 1 : 0);
    this.steer = this.buttons ? right - left : (steer?.value ?? 0);
    this.throttle = max("throttle");
    this.brake = max("brake");
    this.handbrake = max("handbrake");
    this.rewind = max("rewind") > 0;
    this.ring.hidden = !steer || this.buttons;
    if (!steer) this.knob.style.translate = "";
    for (const el of this.root.querySelectorAll<HTMLElement>("[data-touch]")) {
      const held = all.filter((f) => f.el === el || (f.control === "pedals" && f.part === el.dataset.touch));
      const zone_held = this.buttons && ((el.dataset.touch === "left" && left > 0) || (el.dataset.touch === "right" && right > 0));
      if (held.length || zone_held) el.dataset.held = "true";
      else delete el.dataset.held;
      if (el.classList.contains("pedal")) el.style.setProperty("--level", String(Math.max(0, ...held.map((f) => f.value))));
    }
  }

  // Android honours the lock only in fullscreen; iOS has neither, which is what the portrait overlay is for.
  private async fullscreen() {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      await screen.orientation.lock("landscape");
    } catch (error) {
      console.warn("fullscreen or orientation lock refused", error);
    }
  }
}
