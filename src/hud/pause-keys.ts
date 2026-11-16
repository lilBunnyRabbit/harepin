import { key_label, type Bindings } from "./bindings";
import type { PauseAct, PauseCard } from "./pause-view.svelte";

/** Each pause's doors in tile order; the digits 1-4 open them. */
export const DOORS: Readonly<Record<PauseCard["kind"], readonly PauseAct[]>> = {
  roam: ["map", "events", "garage", "online"],
  event: ["garage", "showroom", "settings"],
};
const DIGITS = ["Digit1", "Digit2", "Digit3", "Digit4"];
/** The pause is modal, so its keys never reach the car and need not dodge the driving ones. */
const FIXED: readonly (readonly [PauseAct, string])[] = [
  ["leave", "KeyQ"],
  ["chat", "KeyT"],
  ["settings", "KeyO"],
];

export interface PauseKeys {
  /** `KeyboardEvent.code` to the act it runs. */
  acts: Readonly<Record<string, PauseAct>>;
  /** The key cap each act shows; an act with no key is missing. */
  caps: Readonly<Partial<Record<PauseAct, string>>>;
}

/** Reset keeps the player's Reset keys and claims first; camera keeps theirs too. */
export function pause_keys(bindings: Bindings, kind: PauseCard["kind"]): PauseKeys {
  const acts: Record<string, PauseAct> = {};
  const caps: Partial<Record<PauseAct, string>> = {};
  const claim = (act: PauseAct, codes: readonly string[]) => {
    const free = codes.filter((code) => acts[code] === undefined);
    for (const code of free) acts[code] = act;
    if (free.length && caps[act] === undefined) caps[act] = key_label(free[0]);
  };
  claim("reset", bindings.reset.keys);
  DOORS[kind].forEach((act, i) => claim(act, [DIGITS[i]]));
  for (const [act, code] of FIXED) claim(act, [code]);
  claim("camera", bindings.camera.keys);
  return { acts, caps };
}

/** A button's tooltip with its key, "Camera (C)". */
export const with_cap = (label: string, cap: string | undefined) => (cap ? `${label} (${cap})` : label);
