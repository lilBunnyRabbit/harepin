import { $ } from "./hud";
import type { Action } from "./input";

const STEER_RANGE = 70;
const STEER_DEADZONE = 6;
const STEER_CURVE = 1.4;

export const TouchSteer = { DRAG: "drag", BUTTONS: "buttons" } as const;
export type TouchSteer = (typeof TouchSteer)[keyof typeof TouchSteer];

const CONTROLS = ["steer", "left", "right", "throttle", "brake", "handbrake", "rewind", "reset", "camera"] as const;
type Control = (typeof CONTROLS)[number];

interface Finger {
  control: Control;
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
  used = false;
  private fingers = new Map<number, Finger>();
  private queued: Action[] = [];
  private ring = $("steer-ring");
  private knob = $("steer-knob");
  private abort: AbortController | null = null;
  private tick = 0;
  private steer_mode: TouchSteer = TouchSteer.DRAG;

  constructor(private root: HTMLElement) {}

  get active() {
    return this.fingers.size > 0;
  }

  /** Buttons give -1, 0 or 1 like keys, so the car ramps them the way it ramps the keyboard. */
  get buttons() {
    return this.steer_mode === TouchSteer.BUTTONS;
  }

  set_steer_mode(mode: TouchSteer) {
    this.steer_mode = mode;
    this.root.dataset.steer = mode;
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
    el.setPointerCapture(e.pointerId);
    const finger: Finger = { control, el, origin: e.clientX, value: 0, touched: 0 };
    this.fingers.set(e.pointerId, finger);
    if (control === "steer") {
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
    if (finger.control === "steer") {
      const dx = Math.max(-STEER_RANGE, Math.min(STEER_RANGE, e.clientX - finger.origin));
      const dead = Math.max(0, Math.abs(dx) - STEER_DEADZONE) / (STEER_RANGE - STEER_DEADZONE);
      finger.value = Math.sign(dx) * dead ** STEER_CURVE;
      this.knob.style.translate = `${dx}px 0`;
    } else if (finger.control === "throttle" || finger.control === "brake") {
      const rect = finger.el.getBoundingClientRect();
      finger.value = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
    } else finger.value = 1;
    this.sync();
  }

  private release(id: number) {
    if (!this.fingers.delete(id)) return;
    this.sync();
  }

  // Every control is derived from the fingers still down, so lifting one of two fingers on a pedal keeps it held.
  private sync() {
    const all = [...this.fingers.values()];
    const max = (control: Control) => Math.max(0, ...all.filter((f) => f.control === control).map((f) => f.value));
    const steer = all.filter((f) => f.control === "steer").sort((a, b) => b.touched - a.touched)[0];
    this.steer = this.buttons ? max("right") - max("left") : (steer?.value ?? 0);
    this.throttle = max("throttle");
    this.brake = max("brake");
    this.handbrake = max("handbrake");
    this.rewind = max("rewind") > 0;
    this.ring.hidden = !steer;
    if (!steer) this.knob.style.translate = "";
    for (const el of this.root.querySelectorAll<HTMLElement>("[data-touch]")) {
      const held = all.filter((f) => f.el === el);
      if (held.length) el.dataset.held = "true";
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
