import { key_label, type Bindings } from "./bindings";
import type { PauseAct, PauseAid, PauseCard } from "./pause-view.svelte";

export interface PauseRow {
  act: PauseAct;
  label: string;
  icon: string;
  /** The `KeyboardEvent.code` that runs it; absent, the row takes the player's Reset keys. */
  key?: string;
}

/** Each pause state's rows, top to bottom. */
export const ROWS: Readonly<Record<PauseCard["kind"], readonly PauseRow[]>> = {
  roam: [
    { act: "map", label: "Map", icon: "icon-globe", key: "KeyM" },
    { act: "events", label: "Events", icon: "icon-modes", key: "KeyE" },
    { act: "garage", label: "Garage", icon: "icon-car", key: "KeyG" },
    { act: "online", label: "Online", icon: "icon-people", key: "KeyO" },
    { act: "showroom", label: "Showroom", icon: "logo-mark", key: "KeyH" },
    { act: "settings", label: "Settings", icon: "icon-settings", key: "KeyS" },
    { act: "reset", label: "Reset car", icon: "icon-reset-car" },
  ],
  event: [
    { act: "reset", label: "Restart", icon: "icon-restart" },
    { act: "leave", label: "Leave event", icon: "icon-close", key: "KeyQ" },
    { act: "garage", label: "Car and parts", icon: "icon-car", key: "KeyG" },
    { act: "showroom", label: "Showroom", icon: "logo-mark", key: "KeyH" },
    { act: "settings", label: "Settings", icon: "icon-settings", key: "KeyS" },
  ],
};
/** The aid chips flip on the player's aid keys, as they do on the road. */
const AIDS: readonly PauseAid[] = ["tcs", "abs", "assist", "stability", "auto", "lights"];

export interface PauseKeys {
  /** `KeyboardEvent.code` to the act it runs. */
  acts: Readonly<Record<string, PauseAct>>;
  /** `KeyboardEvent.code` to the aid chip it flips. */
  flips: Readonly<Record<string, PauseAid>>;
  /** The key cap each act shows; an act with no key is missing. */
  caps: Readonly<Partial<Record<PauseAct, string>>>;
}

/**
 * The pause is modal, so its keys never reach the car and need not dodge the driving ones. Reset's keys claim first,
 * then the aids', then the rows'; chat and camera keep theirs where still free.
 */
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
  for (const row of ROWS[kind]) if (row.key) claim(row.act, [row.key]);
  claim("chat", ["KeyT"]);
  claim("camera", bindings.camera.keys);
  return { acts, flips, caps };
}

export type PausePress = { act: PauseAct } | { aid: PauseAid };

/**
 * The act or aid a key press runs, or null. A claimed press stops here: the pause closes during its dispatch, so the
 * menu it opens and the driving input, both listening on `window`, would read the same press (E stepping Events to
 * Garage, Q and E shifting the gearbox).
 */
export function pause_press(keys: PauseKeys, event: Pick<KeyboardEvent, "code" | "repeat" | "ctrlKey" | "metaKey" | "altKey" | "preventDefault" | "stopPropagation">): PausePress | null {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return null;
  const act = keys.acts[event.code];
  const aid = keys.flips[event.code];
  const press: PausePress | null = act ? { act } : aid ? { aid } : null;
  if (!press) return null;
  event.preventDefault();
  event.stopPropagation();
  return press;
}

/** A button's tooltip with its key, "Camera (C)". */
export const with_cap = (label: string, cap: string | undefined) => (cap ? `${label} (${cap})` : label);
