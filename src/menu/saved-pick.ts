import { parse_seed } from "../net/seed";
import { is_kind, type WorldKind } from "../worldgen/types";
import type { SavedPick } from "../world/world-pick";

export const SETTINGS_KEY = "harepin:settings";

export const parse_last_world = (raw: unknown): WorldKind | null => (is_kind(raw) ? raw : null);
export const parse_last_seed = (raw: unknown): number | null => (typeof raw === "number" ? parse_seed(String(raw)) : null);
/** Read in full by the map code parser; here only shape-checked, as the boot entry loads no kinds. */
export const parse_last_map = (raw: unknown): string | null => (typeof raw === "string" && /^[0-9A-Z-]{9,64}$/.test(raw) ? raw : null);

/** The saved world alone, for the boot entry to start generating before the settings code has loaded. */
export function read_saved_pick(): SavedPick {
  try {
    const text = localStorage.getItem(SETTINGS_KEY);
    const stored: unknown = text === null ? null : JSON.parse(text);
    if (typeof stored !== "object" || stored === null) return { last_seed: null, last_world: null, last_map: null, played: false };
    const { last_seed, last_world, last_map } = stored as Record<string, unknown>;
    return { last_seed: parse_last_seed(last_seed), last_world: parse_last_world(last_world), last_map: parse_last_map(last_map), played: true };
  } catch (error) {
    console.warn("settings: saved world unreadable", error);
    return { last_seed: null, last_world: null, last_map: null, played: false };
  }
}
