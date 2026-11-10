import { keys_text, type Bindable, type Bindings } from "./bindings";

const HINTS: [string, string, Bindable][] = [
  ["#restart-lap", "Restart lap", "restart"],
  ["#recenter", "Recenter camera", "recenter"],
  ['[data-aid="tcs"]', "Traction control", "tcs"],
  ['[data-aid="abs"]', "ABS", "abs"],
  ['[data-aid="assist"]', "Steer assist", "assist"],
  ['[data-aid="auto"]', "Auto gearbox", "auto"],
];

export function show_key_hints(bindings: Bindings) {
  for (const [selector, label, action] of HINTS) {
    const node = document.querySelector<HTMLElement>(selector);
    const key = keys_text(bindings[action]);
    const title = key ? `${label} (${key})` : label;
    if (node && node.title !== title) node.title = title;
  }
}
