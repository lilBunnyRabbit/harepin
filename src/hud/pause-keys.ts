import { key_label, type Bindings } from "./bindings";
import type { PauseAct, PauseAid, PauseCard } from "./pause-view.svelte";

/** Each pause's doors in tile order, with the letter that opens each. */
export const DOORS: Readonly<Record<PauseCard["kind"], readonly (readonly [PauseAct, string])[]>> = {
  roam: [
    ["map", "KeyM"],
    ["events", "KeyE"],
    ["garage", "KeyG"],
    ["online", "KeyO"],
  ],
  event: [
    ["garage", "KeyC"],
    ["showroom", "KeyH"],
    ["settings", "KeyS"],
  ],
};
/** The aid chips flip on the player's aid keys, as they do on the road. */
const AIDS: readonly PauseAid[] = ["tcs", "abs", "assist", "stability", "auto", "lights"];
/** The pause is modal, so its keys never reach the car and need not dodge the driving ones. */
const FIXED: readonly (readonly [PauseAct, string])[] = [
  ["leave", "KeyQ"],
  ["chat", "KeyT"],
  ["settings", "KeyO"],
];

export interface PauseKeys {
  /** `KeyboardEvent.code` to the act it runs. */
  acts: Readonly<Record<string, PauseAct>>;
  /** `KeyboardEvent.code` to the aid chip it flips. */
  flips: Readonly<Record<string, PauseAid>>;
  /** The key cap each act shows; an act with no key is missing. */
  caps: Readonly<Partial<Record<PauseAct, string>>>;
}

/** Reset's keys claim first, then the aids', then the doors; camera keeps the player's keys where still free. */
export function pause_keys(bindings: Bindings, kind: PauseCard["kind"]): PauseKeys {
  const taken = new Set<string>();
  const acts: Record<string, PauseAct> = {};
  const flips: Record<string, PauseAid> = {};
  const caps: Partial<Record<PauseAct, string>> = {};
  const claim = (act: PauseAct, codes: readonly string[]) => {
    const free = codes.filter((code) => !taken.has(code));
    for (const code of free) {
      taken.add(code);
      acts[code] = act;
    }
    if (free.length && caps[act] === undefined) caps[act] = key_label(free[0]);
  };
  claim("reset", bindings.reset.keys);
  for (const aid of AIDS)
    for (const code of bindings[aid].keys)
      if (!taken.has(code)) {
        taken.add(code);
        flips[code] = aid;
      }
  for (const [act, code] of DOORS[kind]) claim(act, [code]);
  for (const [act, code] of FIXED) claim(act, [code]);
  claim("camera", bindings.camera.keys);
  return { acts, flips, caps };
}

/** A button's tooltip with its key, "Camera (C)". */
export const with_cap = (label: string, cap: string | undefined) => (cap ? `${label} (${cap})` : label);
