import { Idb } from "../store/idb";
import { STRIDE, is_lap } from "./ghost-cap";

const STORE = "ghosts";
const GHOST_PREFIX = "harepin:ghost:";

interface SavedGhost {
  key: string;
  lap: number[];
}

const db = new Idb();

export function lap_end_ms(lap: readonly number[]): number {
  return lap[lap.length - STRIDE];
}

/** The faster lap; a tie keeps `kept`. */
export function faster(kept: number[] | null, other: number[] | null): number[] | null {
  if (!kept) return other;
  if (!other) return kept;
  return lap_end_ms(other) < lap_end_ms(kept) ? other : kept;
}

export function stored_lap(value: unknown): number[] | null {
  if (typeof value !== "object" || value === null || !("lap" in value)) return null;
  return is_lap(value.lap) ? value.lap : null;
}

export function parse_lap(text: string | null): number[] | null {
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    console.warn("ghost: saved lap is not JSON, ignoring it", error);
    return null;
  }
  if (is_lap(parsed)) return parsed;
  console.warn("ghost: saved lap has the wrong shape, ignoring it");
  return null;
}

function local(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("ghost: old saved lap unreadable", error);
    return null;
  }
}

// An old build in another tab may have written a newer lap since it was read: only the copy that went in is dropped.
function drop_local(key: string, text: string) {
  try {
    if (localStorage.getItem(key) === text) localStorage.removeItem(key);
  } catch (error) {
    console.warn("ghost: old saved lap not cleared", error);
  }
}

async function move(key: string): Promise<number[] | null> {
  const text = local(key);
  const old = parse_lap(text);
  let best = old;
  await db.update(STORE, key, (stored) => {
    const kept = stored_lap(stored);
    best = faster(kept, old);
    return best && best !== kept ? ({ key, lap: best } satisfies SavedGhost) : undefined;
  });
  // A malformed copy goes too: it never races.
  if (text !== null) drop_local(key, text);
  return best;
}

export async function load_ghost(key: string): Promise<number[] | null> {
  try {
    return await move(key);
  } catch (error) {
    console.warn("ghost: saved laps unreadable, racing the old copy", error);
    return parse_lap(local(key));
  }
}

export async function save_ghost(key: string, lap: readonly number[]): Promise<void> {
  const rounded = lap.map((v) => Math.round(v * 1000) / 1000);
  try {
    await db.update(STORE, key, (stored) => (faster(stored_lap(stored), rounded) === rounded ? ({ key, lap: rounded } satisfies SavedGhost) : undefined));
  } catch (error) {
    console.warn("ghost: IndexedDB refused the best lap, keeping it in localStorage", error);
    try {
      localStorage.setItem(key, JSON.stringify(rounded));
    } catch (fallback) {
      console.warn("ghost: best lap not saved", fallback);
    }
  }
}

export async function sweep_ghosts(): Promise<void> {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(GHOST_PREFIX)) await move(key);
  } catch (error) {
    console.warn("ghost: old saved laps stay in localStorage", error);
  }
}
