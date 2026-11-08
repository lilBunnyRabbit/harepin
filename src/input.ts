import type { Controls } from "./car";
import { Touch } from "./touch";

export type Action = "reset" | "camera" | "shift_up" | "shift_down" | "auto" | "tcs" | "abs" | "assist" | "ghost" | "help";

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
};

const IMPACT_VIBRATE_MS = 60;

const PAD_ACTIONS: [number, Action][] = [
  [3, "reset"],
  [8, "camera"],
  [5, "shift_up"],
  [4, "shift_down"],
];

export const typing = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;

export class Input {
  private keys = new Set<string>();
  private queued: Action[] = [];
  private pad_prev: boolean[] = [];
  pad: Gamepad | null = null;
  readonly touch: Touch;

  constructor(touch_root: HTMLElement) {
    this.touch = new Touch(touch_root);
    window.addEventListener("keydown", (e) => {
      if (e.repeat || typing(e.target)) return;
      this.keys.add(e.code);
      const action = KEY_ACTIONS[e.code];
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
    const key_steer = (this.down("KeyD", "ArrowRight") ? 1 : 0) - (this.down("KeyA", "ArrowLeft") ? 1 : 0);
    const controls: Controls = {
      steer: key_steer,
      throttle: this.down("KeyW", "ArrowUp") ? 1 : 0,
      brake: this.down("KeyS", "ArrowDown") ? 1 : 0,
      handbrake: this.down("Space") ? 1 : 0,
      analog: false,
    };
    this.rewind = this.down("Backspace");
    const pad = this.pad;
    if (pad) {
      const raw = pad.axes[0] ?? 0;
      const dead = Math.max(0, Math.abs(raw) - 0.08) / 0.92;
      const stick = Math.sign(raw) * dead ** 1.4;
      const rt = pad.buttons[7]?.value ?? 0;
      const lt = pad.buttons[6]?.value ?? 0;
      if (Math.abs(stick) > 0 || rt > 0.02 || lt > 0.02 || pad.buttons[0]?.pressed) {
        if (key_steer === 0) {
          controls.steer = stick;
          controls.analog = true;
        }
        controls.throttle = Math.max(controls.throttle, rt);
        controls.brake = Math.max(controls.brake, lt);
        controls.handbrake = Math.max(controls.handbrake, pad.buttons[0]?.pressed ? 1 : 0);
      }
      if (pad.buttons[2]?.pressed) this.rewind = true;
      for (const [button, action] of PAD_ACTIONS) {
        const pressed = !!pad.buttons[button]?.pressed;
        if (pressed && !this.pad_prev[button]) actions.push(action);
        this.pad_prev[button] = pressed;
      }
    }
    const touch = this.touch;
    if (touch.active) {
      if (Math.abs(touch.steer) >= Math.abs(controls.steer)) controls.steer = touch.steer;
      controls.analog = true;
      controls.throttle = Math.max(controls.throttle, touch.throttle);
      controls.brake = Math.max(controls.brake, touch.brake);
      controls.handbrake = Math.max(controls.handbrake, touch.handbrake);
      if (touch.rewind) this.rewind = true;
    }
    actions.push(...touch.take_actions());
    return { controls, actions };
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
