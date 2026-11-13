import type { SteerMode } from "../../car/car";
import { key_label, keys_text, pad_text, type Bindable, type Bindings } from "../../hud/bindings";
import { Device } from "../device";
import { AidPreset } from "../guide-rules";
import type { SettingsState, TouchSteer } from "../prefs";

export const LOOKS = ["Brand Dark", "Brand Light", "Forest Night", "Warm Sunset", "Ocean Breeze", "Cyberpunk", "Lavender Dream"];
export const SWATCHES = ["primary", "secondary", "accent"] as const;

export const STEER: Record<SteerMode, [string, string]> = {
  snap: ["Classic", "Turns fast, snaps straight when you let go."],
  hold: ["Hold", "The wheel stays put and centres as you roll."],
  smooth: ["Smooth", "A tap nudges; holding builds the turn."],
};
export const TOUCH_STEER: Record<TouchSteer, [string, string]> = {
  drag: ["Drag", "Put a finger down anywhere and slide to steer."],
  buttons: ["Buttons", "Left and right buttons that steer like the keyboard."],
};

const DRIVE_KEYS = ["throttle", "steer_left", "brake", "steer_right"] as const;

export interface KeyLine {
  keys: string[];
  what: string;
  note: string;
}

export function keymap(bindings: Bindings, device: Device): KeyLine[] {
  const first = (action: Bindable) => bindings[action].keys.slice(0, 1).map(key_label);
  const pad = (action: Bindable) => [pad_text(bindings, action)].filter(Boolean);
  const line = (keys: string[], what: string, note = ""): KeyLine => ({ keys, what, note });
  if (device === Device.PAD) {
    const rewind = pad("rewind");
    return [
      line(["RT", "LT"], "Gas, brake"),
      line(["L stick"], "Steer"),
      line(pad("handbrake"), "Handbrake"),
      line(pad("nitro"), "Nitro", "when fitted"),
      line([...rewind, ...pad("reset")], "Rewind, reset", rewind.length ? `hold ${rewind[0]} to rewind` : ""),
      line(["Start"], "Menu"),
    ];
  }
  if (device === Device.TOUCH)
    return [
      line(["Gas", "Brake"], "Pedals", "bottom right"),
      line(["Steer"], "Steer", "drag or arrows, bottom left"),
      line(["Nitro"], "Nitro", "when fitted"),
      line(["Rewind"], "Rewind", "hold"),
      line(["Menu"], "Menu", "top left"),
    ];
  const second = DRIVE_KEYS.map((action) => bindings[action].keys[1]);
  return [
    line(DRIVE_KEYS.flatMap(first), "Drive", second.every(Boolean) ? `or ${second.map((code) => key_label(code)).join(" ")}` : ""),
    line(bindings.handbrake.keys.map(key_label), "Handbrake"),
    line(first("nitro"), "Nitro", "when fitted"),
    line(first("rewind"), "Rewind", "hold"),
    line([...first("reset"), ...first("camera")], "Reset, camera"),
    line(["Esc"], "Menu"),
  ];
}

export const PRESETS: [AidPreset, string, string][] = [
  [AidPreset.EASY, "Easy", "Grip, brakes and slides looked after. Gears shift for you."],
  [AidPreset.BALANCED, "Balanced", "Traction, ABS and stability stay on, steering assist is off: a slide is yours to countersteer."],
  [AidPreset.PRO, "Pro", "Nothing helps. You shift yourself."],
];

export const AID_LIGHTS = [
  ["tcs", "TC"],
  ["abs", "ABS"],
  ["assist", "Steer"],
  ["stability", "STM"],
  ["auto", "Auto"],
] as const;

const MENU_KEY: Record<Device, string> = { keyboard: "Esc", pad: "Start", touch: "the menu button" };

export function controls_lede(state: SettingsState, device: Device): string {
  if (device === Device.PAD) return "Triggers drive, the left stick steers.";
  if (device === Device.TOUCH) return "Pedals on the right, steering on the left.";
  const help = state.bindings.help;
  return `These are the keys you need; ${keys_text(help) || "Settings, Controls"} lists the rest${help.keys.length ? " while driving" : ""}.`;
}

export const tour_lede = (device: Device) => `Four things worth knowing. All of them live in this menu; ${MENU_KEY[device]} opens it while driving.`;

const LATER = "Change them any time in Settings, Driving.";

export function aid_keys(bindings: Bindings): string {
  const keys = AID_LIGHTS.map(([aid, label]) => [keys_text(bindings[aid]), label] as const);
  if (!keys.every(([key]) => key)) return LATER;
  return `While driving, keys switch each one: ${keys.map(([key, label]) => `${key} ${label}`).join(", ")}.`;
}

export const aid_note = (bindings: Bindings, device: Device) => `The dash shows which aids are on. ${device === Device.KEYBOARD ? aid_keys(bindings) : LATER}`;

function shift_with(up: string, down: string): string {
  return up && down ? `Nothing helps. You shift with ${up} and ${down}.` : "Nothing helps. You shift yourself: set the keys in Settings, Controls.";
}

export function pro_text(bindings: Bindings, device: Device): string {
  if (device === Device.PAD) return shift_with(pad_text(bindings, "shift_up"), pad_text(bindings, "shift_down"));
  if (device === Device.TOUCH) return "No traction, ABS, steering assist or stability. Gears stay automatic on touch.";
  return shift_with(keys_text(bindings.shift_up), keys_text(bindings.shift_down));
}
