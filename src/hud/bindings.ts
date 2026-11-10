export const HOLDS = ["throttle", "brake", "steer_left", "steer_right", "handbrake", "nitro", "precision", "rewind"] as const;
export type Hold = (typeof HOLDS)[number];

export const PRESSES = ["reset", "restart", "shift_up", "shift_down", "auto", "tcs", "abs", "assist", "camera", "recenter", "ghost", "garage", "help", "map"] as const;
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
  map: { label: "World map" },
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
  auto: { keys: ["Digit4"], pad: null },
  tcs: { keys: ["Digit1"], pad: null },
  abs: { keys: ["Digit2"], pad: null },
  assist: { keys: ["Digit3"], pad: null },
  camera: { keys: ["KeyC"], pad: 8 },
  recenter: { keys: ["KeyF"], pad: 11 },
  ghost: { keys: ["KeyG"], pad: null },
  garage: { keys: ["KeyV"], pad: null },
  help: { keys: ["KeyH"], pad: null },
  map: { keys: ["KeyM"], pad: null },
};

/** Held, they turn any key into a browser shortcut, which a bound action ignores. */
export const SHORTCUT_KEYS: readonly string[] = ["ControlLeft", "ControlRight", "MetaLeft", "MetaRight"];
/** Escape opens the menu and cancels a capture; Enter and Tab pick and move in menus; T and Enter open the chat. */
export const RESERVED_KEYS: readonly string[] = ["Escape", "Enter", "NumpadEnter", "Tab", "KeyT", ...SHORTCUT_KEYS];
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
  /** The action that had the key or button. */
  from: Bindable | null;
  /** `from` was left with nothing and took the key or button `action` gave up. */
  swapped: boolean;
}

/** `action` now answers to `code` alone. The action that had `code` keeps its other keys; left with none, it takes `action`'s old ones. */
export function rebind_key(bindings: Bindings, action: Bindable, code: string): Rebound {
  const old = bindings[action].keys;
  const next = { ...bindings, [action]: { ...bindings[action], keys: [code] } };
  const from = BINDABLE.find((other) => other !== action && bindings[other].keys.includes(code)) ?? null;
  if (!from) return { bindings: next, from, swapped: false };
  const left = bindings[from].keys.filter((key) => key !== code);
  const swapped = left.length === 0 && old.length > 0;
  next[from] = { ...bindings[from], keys: left.length > 0 ? left : old };
  return { bindings: next, from, swapped };
}

/** The action that had `button` gets `action`'s old button, or none when it had none. */
export function rebind_pad(bindings: Bindings, action: Bindable, button: number): Rebound {
  const old = bindings[action].pad;
  const next = { ...bindings, [action]: { ...bindings[action], pad: button } };
  const from = BINDABLE.find((other) => other !== action && bindings[other].pad === button) ?? null;
  if (from) next[from] = { ...bindings[from], pad: old };
  return { bindings: next, from, swapped: from !== null && old !== null };
}

const valid_key = (raw: unknown): raw is string => typeof raw === "string" && CODE.test(raw) && !RESERVED_KEYS.includes(raw);
const valid_button = (raw: unknown): raw is number => typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < PAD_BUTTONS && !RESERVED_BUTTONS.includes(raw);

const stored_keys = (raw: unknown): string[] | null => (Array.isArray(raw) && raw.length > 0 && raw.length <= MAX_KEYS && raw.every(valid_key) ? [...new Set(raw)] : null);
const stored_pad = (action: Bindable, raw: unknown): number | null | undefined => (!pad_bindable(action) ? null : raw === null || valid_button(raw) ? raw : undefined);

// M was the gearbox key before the map took it. A table saved then still holds auto on M alone: auto drops to its new
// default and M goes to the map. Anyone who moved auto off M keeps their table as it is.
function migrate(stored: Record<string, unknown>): Record<string, unknown> {
  const auto = stored.auto;
  if (stored.map !== undefined || typeof auto !== "object" || auto === null) return stored;
  const keys = (auto as Record<string, unknown>).keys;
  if (!Array.isArray(keys) || keys.length !== 1 || keys[0] !== "KeyM") return stored;
  return { ...stored, auto: { ...auto, keys: undefined }, map: { keys: ["KeyM"], pad: null } };
}

/**
 * Stored bindings are untrusted. Valid stored entries claim their keys and buttons first, in table order, so a remap
 * survives; a missing or bad entry takes whatever of its default is still free. A key or button claimed twice goes to
 * the first claimant only.
 */
export function parse_bindings(raw: unknown): Bindings {
  const stored = migrate(typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {});
  const entry = (action: Bindable) => {
    const value = stored[action];
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  };
  const taken_keys = new Set<string>();
  const taken_pads = new Set<number>();
  const keys = new Map<Bindable, string[]>();
  const pads = new Map<Bindable, number | null>();
  const claim_keys = (action: Bindable, list: string[]) => {
    const free = list.filter((key) => !taken_keys.has(key));
    for (const key of free) taken_keys.add(key);
    keys.set(action, free);
  };
  const claim_pad = (action: Bindable, button: number | null) => {
    const free = button !== null && taken_pads.has(button) ? null : button;
    if (free !== null) taken_pads.add(free);
    pads.set(action, free);
  };
  for (const action of BINDABLE) {
    const list = stored_keys(entry(action).keys);
    if (list) claim_keys(action, list);
    const button = stored_pad(action, entry(action).pad);
    if (button !== undefined) claim_pad(action, button);
  }
  for (const action of BINDABLE) {
    if (!keys.has(action)) claim_keys(action, DEFAULT_BINDINGS[action].keys);
    if (!pads.has(action)) claim_pad(action, DEFAULT_BINDINGS[action].pad);
  }
  return Object.fromEntries(BINDABLE.map((action) => [action, { keys: keys.get(action) ?? [], pad: pads.get(action) ?? null }])) as Bindings;
}
