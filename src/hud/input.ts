import type { Controls } from "../car/car";
import { BINDABLE, DEFAULT_BINDINGS, MENU_BUTTON, PRESSES, type Action, type Bindable, type Bindings, type Hold } from "./bindings";
import { Touch } from "./touch";
import { axis_value, DEFAULT_PAD_RESPONSE, type PadResponse } from "./pad-curve";
import type { RumbleEffect } from "./rumble";

/** A key or pad button caught for a binding; null when the capture ended without one (the menu closed). */
export type Caught = { kind: "key"; code: string } | { kind: "pad"; button: number };

const IMPACT_VIBRATE_MS = 60;
const PRECISION_STEER = 0.5;
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

/** A menu press: the d-pad, A and B, the bumpers as tab switches, the triggers as section switches, Y as the page's second action. */
export type Nav = "up" | "down" | "left" | "right" | "accept" | "back" | "prev" | "next" | "sub_prev" | "sub_next" | "alt";

const PAD_NAV: [number, Nav][] = [
  [12, "up"],
  [13, "down"],
  [14, "left"],
  [15, "right"],
  [0, "accept"],
  [1, "back"],
  [3, "alt"],
  [4, "prev"],
  [5, "next"],
  [6, "sub_prev"],
  [7, "sub_next"],
];

export const typing = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;

export class Input {
  private keys = new Set<string>();
  private readonly key_binds = new Map<string, Bindable>();
  private readonly pad_binds = new Map<number, Bindable>();
  private bindings: Bindings = DEFAULT_BINDINGS;
  private catcher: ((caught: Caught | null) => void) | null = null;
  private catch_fresh = false;
  private queued: Action[] = [];
  private pad_prev: boolean[] = [];
  private nav_prev: boolean[] = [];
  /** Pad buttons that were down when a panel closed; they drive nothing until let go. */
  private held = new Set<number>();
  private was_blocked = false;
  pad: Gamepad | null = null;
  /** Pads whose rumble threw, by `Gamepad.id`: left still. */
  private readonly numb = new Set<string>();
  /** Menu presses on the pad since the last `read`, for a panel open over the game. */
  nav: Nav[] = [];
  private stick_nav: Nav | null = null;
  private stick_repeat_at = 0;
  readonly touch: Touch;
  readonly mouse: MouseLook;
  look: Look = no_look();
  /** While true (garage, settings or a pad menu open), only the pad's menu press gets through and the car gets no input; those panels close themselves on Escape. */
  blocked: () => boolean = () => false;

  constructor(touch_root: HTMLElement, canvas: HTMLElement) {
    this.touch = new Touch(touch_root);
    this.mouse = new MouseLook(canvas);
    window.addEventListener("keydown", (e) => {
      if (e.repeat || typing(e.target)) return;
      // Menu presses (arrows, Enter, Q / E) stay with the menu whatever they are bound to.
      if (this.blocked()) return;
      // Ctrl or Cmd with a bound key is a browser shortcut (Ctrl+R reloads), not a reset.
      if (chord(e, "ctrlKey", "Control") || chord(e, "metaKey", "Meta")) return;
      const bound = this.key_binds.get(e.code);
      const action: Action | undefined = e.code === "Escape" ? "settings" : is_press(bound) ? bound : undefined;
      // Escape that closes a popover (modes) is consumed by it, not a request for settings.
      if (action === "settings" && document.querySelector(":popover-open")) return;
      this.keys.add(e.code);
      if (action) this.queued.push(action);
      if (bound && !chord(e, "altKey", "Alt")) e.preventDefault();
    });
    // Capture phase, ahead of the focused row: its own Enter or Space handler would read a Space meant for binding as a cancel.
    window.addEventListener(
      "keydown",
      (e) => {
        if (!this.catcher) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat && e.code) this.stop_catch({ kind: "key", code: e.code });
      },
      { capture: true },
    );
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }

  private down(hold: Hold): boolean {
    for (const code of this.bindings[hold].keys) if (this.keys.has(code)) return true;
    return false;
  }

  set_bindings(bindings: Bindings) {
    this.bindings = bindings;
    this.key_binds.clear();
    this.pad_binds.clear();
    for (const action of BINDABLE) {
      for (const code of bindings[action].keys) this.key_binds.set(code, action);
      const button = bindings[action].pad;
      if (button !== null) this.pad_binds.set(button, action);
    }
  }

  /** The next key or new pad button press goes to `on` instead of the game or the menu; null stops listening. */
  listen(on: ((caught: Caught | null) => void) | null) {
    this.catcher = on;
    this.catch_fresh = on !== null;
  }

  rewind = false;
  precision = false;
  pad_response: PadResponse = DEFAULT_PAD_RESPONSE;

  read(): { controls: Controls; actions: Action[] } {
    this.pad = navigator.getGamepads?.().find((p) => p && p.connected) ?? null;
    const actions = this.queued;
    this.queued = [];
    this.nav = [];
    const key_steer = (this.down("steer_right") ? 1 : 0) - (this.down("steer_left") ? 1 : 0);
    const controls: Controls = {
      steer: key_steer * (this.precision && this.down("precision") ? PRECISION_STEER : 1),
      throttle: this.down("throttle") ? 1 : 0,
      brake: this.down("brake") ? 1 : 0,
      handbrake: this.down("handbrake") ? 1 : 0,
      analog: false,
      nitro: this.down("nitro"),
    };
    this.rewind = this.down("rewind");
    const pad = this.pad;
    this.look = { ...no_look(), ...this.mouse.take() };
    const blocked = this.blocked();
    if (this.catcher && !blocked) this.stop_catch(null);
    const catching = this.catcher !== null;
    // B backs out of the garage and A fits a part there; still held as the panel closes they would fire nitro or the
    // handbrake. Keys need no latch: presses made while blocked never reach `keys`.
    if (pad && this.was_blocked && !blocked) pad.buttons.forEach((b, i) => b.pressed && this.held.add(i));
    this.was_blocked = blocked;
    for (const i of this.held) if (!pad?.buttons[i]?.pressed) this.held.delete(i);
    const caught = pad && this.catcher ? this.catch_pad(pad) : null;
    if (pad) {
      const [x, y] = [pad.axes[2] ?? 0, pad.axes[3] ?? 0];
      const tilt = Math.hypot(x, y);
      if (tilt > STICK_DEAD) {
        const scale = Math.min(1, (tilt - STICK_DEAD) / (1 - STICK_DEAD)) / tilt;
        this.look.stick_x = x * scale;
        this.look.stick_y = y * scale;
      }
      const stick = axis_value(pad.axes[0] ?? 0, this.pad_response.steer);
      const rt = axis_value(this.button(7)?.value ?? 0, this.pad_response.throttle);
      const lt = axis_value(this.button(6)?.value ?? 0, this.pad_response.brake);
      const handbrake = this.pad_down("handbrake");
      if (Math.abs(stick) > 0 || rt > 0.02 || lt > 0.02 || handbrake) {
        if (key_steer === 0) {
          controls.steer = stick;
          controls.analog = true;
        }
        controls.throttle = Math.max(controls.throttle, rt);
        controls.brake = Math.max(controls.brake, lt);
        controls.handbrake = Math.max(controls.handbrake, handbrake ? 1 : 0);
      }
      if (this.pad_down("rewind")) this.rewind = true;
      if (this.pad_down("nitro")) controls.nitro = true;
      for (const [button, nav] of PAD_NAV) {
        const pressed = !!pad.buttons[button]?.pressed;
        if (pressed && !this.nav_prev[button]) this.nav.push(nav);
        this.nav_prev[button] = pressed;
      }
      this.stick_press(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      for (let i = 0; i < pad.buttons.length; i++) {
        const pressed = pad.buttons[i].pressed;
        const action = i === MENU_BUTTON ? "menu" : this.pad_binds.get(i);
        if (pressed && !this.pad_prev[i] && is_press(action)) actions.push(action);
        this.pad_prev[i] = pressed;
      }
    }
    if (catching) {
      this.nav = [];
      actions.length = 0;
    }
    if (caught) this.stop_catch(caught);
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
      return { controls: { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: false }, actions: actions.filter((a) => a === "menu") };
    }
    return { controls, actions };
  }

  // Buttons already down when the capture starts (the A that opened it) count only once let go and pressed again.
  private catch_pad(pad: Gamepad): Caught | null {
    if (this.catch_fresh) {
      this.catch_fresh = false;
      pad.buttons.forEach((b, i) => b.pressed && this.held.add(i));
      return null;
    }
    const i = pad.buttons.findIndex((b, i) => b.pressed && !this.held.has(i));
    if (i < 0) return null;
    this.held.add(i);
    return { kind: "pad", button: i };
  }

  private button(i: number): GamepadButton | undefined {
    return this.held.has(i) ? undefined : this.pad?.buttons[i];
  }

  private pad_down(hold: Hold): boolean {
    const i = this.bindings[hold].pad;
    return i !== null && !!this.button(i)?.pressed;
  }

  private stop_catch(caught: Caught | null) {
    const done = this.catcher;
    this.listen(null);
    done?.(caught);
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

  /** A hit, on a phone driven by touch with no pad: one short buzz. */
  buzz() {
    if (!this.pad && this.touch.used) navigator.vibrate?.(IMPACT_VIBRATE_MS);
  }

  /** Plays `effect` on the pad's motors, through whichever rumble API the browser has; a pad without one stays still. */
  rumble(effect: RumbleEffect) {
    const pad = this.pad as (Gamepad & PadHaptics) | null;
    if (!pad || this.numb.has(pad.id)) return;
    try {
      const dual = pad.vibrationActuator;
      if (dual?.playEffect) {
        dual.playEffect("dual-rumble", { duration: effect.ms, strongMagnitude: Math.min(1, effect.strong), weakMagnitude: Math.min(1, effect.weak) }).catch(superseded);
        return;
      }
      const motor = pad.hapticActuators?.[0];
      if (motor?.pulse) void Promise.resolve(motor.pulse(Math.min(1, Math.max(effect.strong, effect.weak)), effect.ms)).catch(superseded);
    } catch (error) {
      // A pad whose API throws (motors listed but missing, a browser that half ships it) would throw ten times a
      // second; it stays still from then on.
      console.warn("pad rumble off for", pad.id, error);
      this.numb.add(pad.id);
    }
  }
}

/** The rumble APIs browsers ship: `vibrationActuator` (Chromium, Safari) and the older `hapticActuators` (Firefox). */
interface PadHaptics {
  vibrationActuator?: { playEffect?(type: "dual-rumble", params: { duration: number; strongMagnitude: number; weakMagnitude: number }): Promise<unknown> } | null;
  hapticActuators?: readonly { pulse?(value: number, ms: number): Promise<unknown> | boolean }[];
}

/** A rumble promise rejects when the next effect cuts it short, which every refresh does by design. */
function superseded() {}

const PRESS_SET: ReadonlySet<string> = new Set([...PRESSES, "menu"]);
const is_press = (action: string | undefined): action is Action => action !== undefined && PRESS_SET.has(action);

type Modifier = "ctrlKey" | "metaKey" | "altKey";
const chord = (e: KeyboardEvent, held: Modifier, own: string) => e[held] && !e.code.startsWith(own);
