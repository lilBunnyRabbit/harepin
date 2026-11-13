import { keys_text, type Bindable, type Bindings } from "./bindings";

const HINTS: [string, string, Bindable][] = [
  ["#restart-lap", "Restart lap", "restart"],
  ["#garage-btn", "Garage", "garage"],
  ["#recenter", "Recenter camera", "recenter"],
  ['.aid-key[data-aid="tcs"]', "Traction control", "tcs"],
  ['.aid-key[data-aid="abs"]', "ABS", "abs"],
  ['.aid-key[data-aid="assist"]', "Steering assist", "assist"],
  ['.aid-key[data-aid="stability"]', "Stability", "stability"],
  ['.aid-key[data-aid="auto"]', "Auto gearbox", "auto"],
];

export function show_key_hints(bindings: Bindings) {
  for (const [selector, label, action] of HINTS) {
    const node = document.querySelector<HTMLElement>(selector);
    const key = keys_text(bindings[action]);
    const title = key ? `${label} (${key})` : label;
    if (!node) continue;
    if (node.title !== title) node.title = title;
    if (node.dataset.key !== key) node.dataset.key = key;
  }
}
