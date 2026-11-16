import { key_label, type Bindable, type Bindings } from "./bindings";
import type { PauseAct } from "./pause-view.svelte";

/** Pause acts that are also driving actions answer to the player's keys for them. */
const BOUND: readonly (readonly [PauseAct, Bindable])[] = [
  ["reset", "reset"],
  ["garage", "garage"],
  ["camera", "camera"],
];
/** The rest have no binding; a player key above wins a clash. */
const FIXED: readonly (readonly [PauseAct, string])[] = [
  ["showroom", "KeyM"],
  ["settings", "KeyO"],
  ["chat", "KeyT"],
  ["leave", "KeyL"],
];

export interface PauseKeys {
  /** `KeyboardEvent.code` to the act it runs. */
  acts: Readonly<Record<string, PauseAct>>;
  /** The key cap each act shows; an act with no key is missing. */
  caps: Readonly<Partial<Record<PauseAct, string>>>;
}

export function pause_keys(bindings: Bindings): PauseKeys {
  const acts: Record<string, PauseAct> = {};
  const caps: Partial<Record<PauseAct, string>> = {};
  const claim = (act: PauseAct, codes: readonly string[]) => {
    const free = codes.filter((code) => acts[code] === undefined);
    for (const code of free) acts[code] = act;
    if (free.length) caps[act] = key_label(free[0]);
  };
  for (const [act, action] of BOUND) claim(act, bindings[action].keys);
  for (const [act, code] of FIXED) claim(act, [code]);
  return { acts, caps };
}

/** A button's tooltip with its key, "Camera (C)". */
export const with_cap = (label: string, cap: string | undefined) => (cap ? `${label} (${cap})` : label);
