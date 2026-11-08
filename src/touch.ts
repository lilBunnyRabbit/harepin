import { $ } from "./hud";
import type { Action } from "./input";

const STEER_RANGE = 70;
const STEER_DEADZONE = 6;
const STEER_CURVE = 1.4;

const CONTROLS = ["steer", "throttle", "brake", "handbrake", "rewind", "reset", "camera"] as const;
type Control = (typeof CONTROLS)[number];

interface Finger {
  control: Control;
  el: HTMLElement;
  origin: number;
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

  constructor(private root: HTMLElement) {}

  get active() {
    return this.fingers.size > 0;
  }

  start() {
    this.abort = new AbortController();
    const { signal } = this.abort;
    this.root.addEventListener("pointerdown", (e) => this.down(e), { signal });
    this.root.addEventListener("pointermove", (e) => this.move(e), { signal });
    this.root.addEventListener("lostpointercapture", (e) => this.release(e.pointerId), { signal });
    this.root.addEventListener("contextmenu", (e) => e.preventDefault(), { signal });
    document.addEventListener("pointerdown", (e) => e.pointerType === "touch" && void this.fullscreen(), { once: true, signal });
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
    el.dataset.held = "true";
    this.fingers.set(e.pointerId, { control, el, origin: e.clientX });
    if (control === "steer") {
      this.ring.hidden = false;
      this.ring.style.translate = `${e.clientX}px ${e.clientY}px`;
    }
    this.update(this.fingers.get(e.pointerId), e);
  }

  private move(e: PointerEvent) {
    this.update(this.fingers.get(e.pointerId), e);
  }

  private update(finger: Finger | undefined, e: PointerEvent) {
    if (!finger) return;
    switch (finger.control) {
      case "steer": {
        const dx = Math.max(-STEER_RANGE, Math.min(STEER_RANGE, e.clientX - finger.origin));
        const dead = Math.max(0, Math.abs(dx) - STEER_DEADZONE) / (STEER_RANGE - STEER_DEADZONE);
        this.steer = Math.sign(dx) * dead ** STEER_CURVE;
        this.knob.style.translate = `${dx}px 0`;
        break;
      }
      case "throttle":
      case "brake": {
        const rect = finger.el.getBoundingClientRect();
        const value = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
        this[finger.control] = value;
        finger.el.style.setProperty("--level", String(value));
        break;
      }
      case "handbrake":
        this.handbrake = 1;
        break;
      case "rewind":
        this.rewind = true;
        break;
    }
  }

  private release(id: number) {
    const finger = this.fingers.get(id);
    if (!finger) return;
    this.fingers.delete(id);
    delete finger.el.dataset.held;
    switch (finger.control) {
      case "steer":
        this.steer = 0;
        this.ring.hidden = true;
        this.knob.style.translate = "";
        break;
      case "throttle":
      case "brake":
        this[finger.control] = 0;
        finger.el.style.setProperty("--level", "0");
        break;
      case "handbrake":
        this.handbrake = 0;
        break;
      case "rewind":
        this.rewind = false;
        break;
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
