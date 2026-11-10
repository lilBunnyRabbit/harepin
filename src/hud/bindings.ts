export const HOLDS = ["throttle", "brake", "steer_left", "steer_right", "handbrake", "nitro", "precision", "rewind"] as const;
export type Hold = (typeof HOLDS)[number];

export const PRESSES = ["reset", "restart", "shift_up", "shift_down", "auto", "tcs", "abs", "assist", "camera", "recenter", "ghost", "garage", "help"] as const;
export type Press = (typeof PRESSES)[number];

/** Settings (Esc) and menu (Start) keep their menu role and never enter the binding table. */
export type Action = Press | "settings" | "menu";

export type Bindable = Hold | Press;
export const BINDABLE: readonly Bindable[] = [...HOLDS, ...PRESSES];

export interface Binding {
  /** `KeyboardEvent.code` values. */
  keys: string[];
  /** Standard-mapping gamepad button index. */
  pad: number | null;
}

export type Bindings = Record<Bindable, Binding>;

interface BindInfo {
  label: string;
  /** Set when the pad side is a stick or trigger, or nothing: shown as is and never rebound. */
  fixed_pad?: string;
}

export const BIND_INFO: Record<Bindable, BindInfo> = {
  throttle: { label: "Gas", fixed_pad: "RT" },
  brake: { label: "Brake", fixed_pad: "LT" },
  steer_left: { label: "Steer left", fixed_pad: "L stick" },
  steer_right: { label: "Steer right", fixed_pad: "L stick" },
  handbrake: { label: "Handbrake" },
  nitro: { label: "Nitro" },
  precision: { label: "Precision steer", fixed_pad: "" },
  rewind: { label: "Rewind" },
  reset: { label: "Reset" },
  restart: { label: "Restart lap" },
  shift_up: { label: "Shift up" },
  shift_down: { label: "Shift down" },
  auto: { label: "Auto gearbox" },
  tcs: { label: "Traction control" },
  abs: { label: "Anti-lock brakes" },
  assist: { label: "Steering assist" },
  camera: { label: "Camera" },
  recenter: { label: "Recenter camera" },
  ghost: { label: "Ghost car" },
  garage: { label: "Garage" },
  help: { label: "Key list" },
};

export const DEFAULT_BINDINGS: Bindings = {
  throttle: { keys: ["KeyW", "ArrowUp"], pad: null },
  brake: { keys: ["KeyS", "ArrowDown"], pad: null },
  steer_left: { keys: ["KeyA", "ArrowLeft"], pad: null },
  steer_right: { keys: ["KeyD", "ArrowRight"], pad: null },
  handbrake: { keys: ["Space"], pad: 0 },
  nitro: { keys: ["ShiftLeft", "ShiftRight"], pad: 1 },
  precision: { keys: ["KeyX"], pad: null },
  rewind: { keys: ["Backspace"], pad: 2 },
  reset: { keys: ["KeyR"], pad: 3 },
  restart: { keys: ["KeyL"], pad: null },
  shift_up: { keys: ["KeyE"], pad: 5 },
  shift_down: { keys: ["KeyQ"], pad: 4 },
  auto: { keys: ["KeyM"], pad: null },
  tcs: { keys: ["Digit1"], pad: null },
  abs: { keys: ["Digit2"], pad: null },
  assist: { keys: ["Digit3"], pad: null },
  camera: { keys: ["KeyC"], pad: 8 },
  recenter: { keys: ["KeyF"], pad: 11 },
  ghost: { keys: ["KeyG"], pad: null },
  garage: { keys: ["KeyV"], pad: null },
  help: { keys: ["KeyH"], pad: null },
};

/** Escape opens the menu and cancels a capture; Enter and Tab pick and move in menus; T and Enter open the chat. */
export const RESERVED_KEYS: readonly string[] = ["Escape", "Enter", "NumpadEnter", "Tab", "KeyT"];
export const MENU_BUTTON = 9;
/** The triggers stay analog gas and brake; Start opens the menu and cancels a capture. */
export const RESERVED_BUTTONS: readonly number[] = [6, 7, MENU_BUTTON];
const PAD_BUTTONS = 17;
const MAX_KEYS = 4;
const CODE = /^[A-Za-z0-9]{1,32}$/;

const PAD_NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Start", "L3", "R3", "D-pad up", "D-pad down", "D-pad left", "D-pad right", "Home"];
const ARROWS: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };
const MODIFIERS: Record<string, string> = { Shift: "Shift", Control: "Ctrl", Alt: "Alt", Meta: "Meta" };

export const pad_bindable = (action: Bindable) => BIND_INFO[action].fixed_pad === undefined;

export function key_label(code: string): string {
  const letter = /^Key([A-Z])$/.exec(code) ?? /^Digit(\d)$/.exec(code);
  if (letter) return letter[1];
  if (ARROWS[code]) return ARROWS[code];
  const modifier = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code);
  if (modifier) return `${modifier[2][0]} ${MODIFIERS[modifier[1]]}`;
  const numpad = /^Numpad(.+)$/.exec(code);
  if (numpad) return `Num ${numpad[1]}`;
  return code;
}

export const pad_label = (button: number) => PAD_NAMES[button] ?? `Button ${button}`;

export const keys_text = (binding: Binding) => binding.keys.map(key_label).join(", ");

export const pad_text = (bindings: Bindings, action: Bindable) => {
  const fixed = BIND_INFO[action].fixed_pad;
  if (fixed !== undefined) return fixed;
  const button = bindings[action].pad;
  return button === null ? "" : pad_label(button);
};

export interface Rebound {
  bindings: Bindings;
  /** The action that held the key or button and took the old one in exchange. */
  swapped: Bindable | null;
}

/** `action` now answers to `code` alone; an action that had `code` takes `action`'s old keys in its place. */
export function rebind_key(bindings: Bindings, action: Bindable, code: string): Rebound {
  const old = bindings[action].keys;
  const next = { ...bindings, [action]: { ...bindings[action], keys: [code] } };
  const swapped = BINDABLE.find((other) => other !== action && bindings[other].keys.includes(code)) ?? null;
  if (swapped) {
    const keys = bindings[swapped].keys.flatMap((key) => (key === code ? old.filter((k) => !bindings[swapped].keys.includes(k)) : [key]));
    next[swapped] = { ...bindings[swapped], keys };
  }
  return { bindings: next, swapped };
}

export function rebind_pad(bindings: Bindings, action: Bindable, button: number): Rebound {
  const old = bindings[action].pad;
  const next = { ...bindings, [action]: { ...bindings[action], pad: button } };
  const swapped = BINDABLE.find((other) => other !== action && bindings[other].pad === button) ?? null;
  if (swapped) next[swapped] = { ...bindings[swapped], pad: old };
  return { bindings: next, swapped };
}

const valid_key = (raw: unknown): raw is string => typeof raw === "string" && CODE.test(raw) && !RESERVED_KEYS.includes(raw);
const valid_button = (raw: unknown): raw is number => typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < PAD_BUTTONS && !RESERVED_BUTTONS.includes(raw);

function parse_binding(action: Bindable, raw: unknown): Binding {
  const fallback = DEFAULT_BINDINGS[action];
  if (typeof raw !== "object" || raw === null) return fallback;
  const { keys, pad } = raw as Record<string, unknown>;
  const clean = Array.isArray(keys) && keys.length <= MAX_KEYS && keys.every(valid_key) ? [...new Set(keys)] : fallback.keys;
  const button = !pad_bindable(action) ? null : pad === null || valid_button(pad) ? pad : fallback.pad;
  return { keys: clean, pad: button };
}

function unique(bindings: Bindings): boolean {
  const keys = BINDABLE.flatMap((action) => bindings[action].keys);
  const pads = BINDABLE.flatMap((action) => bindings[action].pad ?? []);
  return new Set(keys).size === keys.length && new Set(pads).size === pads.length;
}

/** Stored bindings are untrusted: a bad entry takes its default, and a table where two actions share a key or button is dropped whole. */
export function parse_bindings(raw: unknown): Bindings {
  if (typeof raw !== "object" || raw === null) return DEFAULT_BINDINGS;
  const stored = raw as Record<string, unknown>;
  const parsed = Object.fromEntries(BINDABLE.map((action) => [action, parse_binding(action, stored[action])])) as Bindings;
  return unique(parsed) ? parsed : DEFAULT_BINDINGS;
}
