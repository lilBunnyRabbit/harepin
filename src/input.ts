import type { Controls } from "./car";
import { Touch } from "./touch";

export type Action = "reset" | "camera" | "shift_up" | "shift_down" | "auto" | "tcs" | "abs" | "assist" | "ghost" | "help" | "garage" | "settings" | "recenter" | "menu" | "restart";

const KEY_ACTIONS: Record<string, Action> = {
  KeyR: "reset",
  KeyC: "camera",
  KeyE: "shift_up",
  KeyQ: "shift_down",
  KeyM: "auto",
  Digit1: "tcs",
  Digit2: "abs",
  Digit3: "assist",
  KeyG: "ghost",
  KeyH: "help",
  KeyV: "garage",
  KeyF: "recenter",
  KeyL: "restart",
  Escape: "settings",
};

const IMPACT_VIBRATE_MS = 60;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 32;
const STICK_DEAD = 0.12;
/** Left stick tilt that counts as a menu press, then the wait before it repeats and the repeat gap. */
const NAV_TILT = 0.5;
const NAV_REPEAT_DELAY_MS = 400;
const NAV_REPEAT_MS = 120;

/** Camera look input gathered since the last read. */
export interface Look {
  /** Mouse drag in CSS px, +x right, +y down. */
  dx: number;
  dy: number;
  /** Wheel `deltaY` in px, positive pulls the camera out. */
  zoom: number;
  /** Two-finger pinch as the log of old over new finger spread: positive (fingers closing) pulls the camera out. */
  pinch: number;
  /** A mouse button is held on the canvas. */
  dragging: boolean;
  /** Right stick after the dead zone, -1..1, +x right, +y down; 0 when centred. */
  stick_x: number;
  stick_y: number;
}

const no_look = (): Look => ({ dx: 0, dy: 0, zoom: 0, pinch: 0, dragging: false, stick_x: 0, stick_y: 0 });

interface Point {
  x: number;
  y: number;
}

const spread = (fingers: Map<number, Point>) => {
  const [a, b] = [...fingers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};

/** Left or right mouse drag, a one-finger drag, a two-finger pinch and the wheel on the game canvas; HUD, panels and touch controls sit above it and keep their own pointers. */
export class MouseLook {
  private dx = 0;
  private dy = 0;
  private zoom = 0;
  private pinch = 0;
  private pointer: number | null = null;
  private readonly fingers = new Map<number, Point>();
  private last_x = 0;
  private last_y = 0;
  private abort: AbortController | null = null;
  private queued: Action[] = [];
  private tap = { time: -Infinity, x: 0, y: 0 };

  constructor(private readonly canvas: HTMLElement) {}

  start() {
    this.abort = new AbortController();
    const { signal } = this.abort;
    const { canvas } = this;
    canvas.addEventListener("pointerdown", (e) => this.down(e), { signal });
    canvas.addEventListener("pointermove", (e) => this.move(e), { signal });
    canvas.addEventListener(
      "lostpointercapture",
      (e) => {
        this.fingers.delete(e.pointerId);
        if (e.pointerId === this.pointer) this.pointer = null;
      },
      { signal },
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), { signal });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoom += e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
      },
      { signal, passive: false },
    );
  }

  stop() {
    this.abort?.abort();
    this.abort = null;
    this.pointer = null;
    this.fingers.clear();
  }

  take(): Pick<Look, "dx" | "dy" | "zoom" | "pinch" | "dragging"> {
    const look = { dx: this.dx, dy: this.dy, zoom: this.zoom, pinch: this.pinch, dragging: this.pointer !== null };
    this.dx = this.dy = this.zoom = this.pinch = 0;
    return look;
  }

  take_actions(): Action[] {
    const actions = this.queued;
    this.queued = [];
    return actions;
  }

  private down(e: PointerEvent) {
    if (e.pointerType === "touch" && this.fingers.size === 1) {
      this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if ((e.button !== 0 && e.button !== 2) || this.pointer !== null) return;
    // The second tap starts no drag: a held finger counts as looking and would cancel the recenter it asked for.
    if (e.pointerType === "touch" && this.double_tapped(e)) return;
    this.pointer = e.pointerId;
    this.last_x = e.clientX;
    this.last_y = e.clientY;
    if (e.pointerType === "touch") this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.canvas.setPointerCapture(e.pointerId);
  }

  private move(e: PointerEvent) {
    const finger = this.fingers.get(e.pointerId);
    if (finger && this.fingers.size === 2) {
      const before = spread(this.fingers);
      finger.x = e.clientX;
      finger.y = e.clientY;
      const after = spread(this.fingers);
      if (before > 0 && after > 0) this.pinch += Math.log(before / after);
    } else if (finger) {
      finger.x = e.clientX;
      finger.y = e.clientY;
    }
    if (e.pointerId !== this.pointer) return;
    // Two fingers down only zoom; the drag finger's position still tracks so lifting the other does not jump the view.
    if (this.fingers.size < 2) {
      this.dx += e.clientX - this.last_x;
      this.dy += e.clientY - this.last_y;
    }
    this.last_x = e.clientX;
    this.last_y = e.clientY;
  }

  // Mobile browsers do not fire dblclick reliably for a double tap.
  private double_tapped(e: PointerEvent): boolean {
    const { tap } = this;
    if (e.timeStamp - tap.time < DOUBLE_TAP_MS && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < DOUBLE_TAP_PX) {
      this.queued.push("recenter");
      tap.time = -Infinity;
      return true;
    }
    this.tap = { time: e.timeStamp, x: e.clientX, y: e.clientY };
    return false;
  }
}

const PAD_ACTIONS: [number, Action][] = [
  [3, "reset"],
  [8, "camera"],
  [5, "shift_up"],
  [4, "shift_down"],
  [11, "recenter"],
  [9, "menu"],
];

/** A menu press: the d-pad, A and B, and the bumpers as tab switches. */
export type Nav = "up" | "down" | "left" | "right" | "accept" | "back" | "prev" | "next";

const PAD_NAV: [number, Nav][] = [
  [12, "up"],
  [13, "down"],
  [14, "left"],
  [15, "right"],
  [0, "accept"],
  [1, "back"],
  [4, "prev"],
  [5, "next"],
];

export const typing = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;

export class Input {
  private keys = new Set<string>();
  private queued: Action[] = [];
  private pad_prev: boolean[] = [];
  private nav_prev: boolean[] = [];
  /** Pad buttons that were down when a panel closed; they drive nothing until let go. */
  private held = new Set<number>();
  private was_blocked = false;
  pad: Gamepad | null = null;
  /** Menu presses on the pad since the last `read`, for a panel open over the game. */
  nav: Nav[] = [];
  private stick_nav: Nav | null = null;
  private stick_repeat_at = 0;
  readonly touch: Touch;
  readonly mouse: MouseLook;
  look: Look = no_look();
  /** While true (garage, settings or a pad menu open), only garage, help and menu presses get through and the car gets no input; those panels close themselves on Escape. */
  blocked: () => boolean = () => false;

  constructor(touch_root: HTMLElement, canvas: HTMLElement) {
    this.touch = new Touch(touch_root);
    this.mouse = new MouseLook(canvas);
    window.addEventListener("keydown", (e) => {
      if (e.repeat || typing(e.target)) return;
      const action = KEY_ACTIONS[e.code];
      if (this.blocked()) {
        if (action === "garage" || action === "help") this.queued.push(action);
        return;
      }
      // Escape that closes a popover (modes) is consumed by it, not a request for settings.
      if (action === "settings" && document.querySelector(":popover-open")) return;
      this.keys.add(e.code);
      if (action) this.queued.push(action);
      if (e.code.startsWith("Arrow") || e.code === "Space" || e.code === "Backspace") e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }

  private down(...codes: string[]) {
    return codes.some((c) => this.keys.has(c));
  }

  rewind = false;

  read(): { controls: Controls; actions: Action[] } {
    this.pad = navigator.getGamepads?.().find((p) => p && p.connected) ?? null;
    const actions = this.queued;
    this.queued = [];
    this.nav = [];
    const key_steer = (this.down("KeyD", "ArrowRight") ? 1 : 0) - (this.down("KeyA", "ArrowLeft") ? 1 : 0);
    const controls: Controls = {
      steer: key_steer,
      throttle: this.down("KeyW", "ArrowUp") ? 1 : 0,
      brake: this.down("KeyS", "ArrowDown") ? 1 : 0,
      handbrake: this.down("Space") ? 1 : 0,
      analog: false,
      nitro: this.down("ShiftLeft", "ShiftRight"),
    };
    this.rewind = this.down("Backspace");
    const pad = this.pad;
    this.look = { ...no_look(), ...this.mouse.take() };
    const blocked = this.blocked();
    // B backs out of the garage and A fits a part there; still held as the panel closes they would fire nitro or the
    // handbrake. Keys need no latch: presses made while blocked never reach `keys`.
    if (pad && this.was_blocked && !blocked) pad.buttons.forEach((b, i) => b.pressed && this.held.add(i));
    this.was_blocked = blocked;
    for (const i of this.held) if (!pad?.buttons[i]?.pressed) this.held.delete(i);
    const button = (i: number) => (this.held.has(i) ? undefined : pad?.buttons[i]);
    if (pad) {
      const [x, y] = [pad.axes[2] ?? 0, pad.axes[3] ?? 0];
      const tilt = Math.hypot(x, y);
      if (tilt > STICK_DEAD) {
        const scale = Math.min(1, (tilt - STICK_DEAD) / (1 - STICK_DEAD)) / tilt;
        this.look.stick_x = x * scale;
        this.look.stick_y = y * scale;
      }
      const raw = pad.axes[0] ?? 0;
      const dead = Math.max(0, Math.abs(raw) - 0.08) / 0.92;
      const stick = Math.sign(raw) * dead ** 1.4;
      const rt = button(7)?.value ?? 0;
      const lt = button(6)?.value ?? 0;
      if (Math.abs(stick) > 0 || rt > 0.02 || lt > 0.02 || button(0)?.pressed) {
        if (key_steer === 0) {
          controls.steer = stick;
          controls.analog = true;
        }
        controls.throttle = Math.max(controls.throttle, rt);
        controls.brake = Math.max(controls.brake, lt);
        controls.handbrake = Math.max(controls.handbrake, button(0)?.pressed ? 1 : 0);
      }
      if (button(2)?.pressed) this.rewind = true;
      if (button(1)?.pressed) controls.nitro = true;
      for (const [button, nav] of PAD_NAV) {
        const pressed = !!pad.buttons[button]?.pressed;
        if (pressed && !this.nav_prev[button]) this.nav.push(nav);
        this.nav_prev[button] = pressed;
      }
      this.stick_press(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      for (const [button, action] of PAD_ACTIONS) {
        const pressed = !!pad.buttons[button]?.pressed;
        if (pressed && !this.pad_prev[button]) actions.push(action);
        this.pad_prev[button] = pressed;
      }
    }
    const touch = this.touch;
    if (touch.active) {
      if (touch.buttons) {
        if (controls.steer === 0) controls.steer = touch.steer;
      } else {
        if (Math.abs(touch.steer) >= Math.abs(controls.steer)) controls.steer = touch.steer;
        controls.analog = true;
      }
      controls.throttle = Math.max(controls.throttle, touch.throttle);
      controls.brake = Math.max(controls.brake, touch.brake);
      controls.handbrake = Math.max(controls.handbrake, touch.handbrake);
      if (touch.rewind) this.rewind = true;
      if (touch.nitro) controls.nitro = true;
    }
    actions.push(...touch.take_actions(), ...this.mouse.take_actions());
    if (this.blocked()) {
      this.rewind = false;
      this.look = no_look();
      return { controls: { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: false }, actions: actions.filter((a) => a === "garage" || a === "help" || a === "menu") };
    }
    return { controls, actions };
  }

  private stick_press(x: number, y: number) {
    const dir: Nav | null = Math.max(Math.abs(x), Math.abs(y)) < NAV_TILT ? null : Math.abs(x) > Math.abs(y) ? (x < 0 ? "left" : "right") : y < 0 ? "up" : "down";
    const now = performance.now();
    if (dir !== this.stick_nav) {
      this.stick_nav = dir;
      this.stick_repeat_at = now + NAV_REPEAT_DELAY_MS;
      if (dir) this.nav.push(dir);
    } else if (dir && now >= this.stick_repeat_at) {
      this.stick_repeat_at = now + NAV_REPEAT_MS;
      this.nav.push(dir);
    }
  }

  rumble(weak: number, strong: number, impact = false) {
    const actuator = (this.pad as (Gamepad & { vibrationActuator?: { playEffect?: (type: string, params: object) => Promise<unknown> } }) | null)?.vibrationActuator;
    if (!actuator?.playEffect) {
      if (impact && this.touch.used) navigator.vibrate?.(IMPACT_VIBRATE_MS);
      return;
    }
    if (weak < 0.02 && strong < 0.02) return;
    actuator.playEffect("dual-rumble", { duration: 120, weakMagnitude: Math.min(1, weak), strongMagnitude: Math.min(1, strong) }).catch(() => {});
  }
}
