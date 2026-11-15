import type { Triple } from "../car/cars";
import { checked_view, view_key, type ViewState } from "./view-state";

export const NOTES_KEY = "harepin.cars.notes";
export const NOTE_LENGTH = 1000;
export const MAX_NOTES = 200;
const PIN_REACH = 40;

export interface Note {
  text: string;
  /** Point on the asset, in its own frame, the pin was dropped on; null for a note on the whole asset. */
  pin: Triple | null;
  view: ViewState;
}

/** Per `view_key`, oldest first. */
export type Notes = Record<string, Note[]>;

const finite_pin = (x: unknown): x is Triple => Array.isArray(x) && x.length === 3 && x.every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= PIN_REACH);

export function checked_note(x: unknown): Note | null {
  if (typeof x !== "object" || x === null) return null;
  const n = x as Record<string, unknown>;
  if (typeof n.text !== "string") return null;
  const pin = n.pin === null ? null : finite_pin(n.pin) ? n.pin : undefined;
  const view = checked_view(n.view);
  if (pin === undefined || !view) return null;
  return { text: n.text.slice(0, NOTE_LENGTH), pin: pin && (pin.map((v) => Math.round(v * 1000) / 1000) as Triple), view };
}

// A note whose view no longer fits (a car renamed, a build code a deploy no longer reads) is dropped, not the store.
export function parse_notes(raw: unknown): Notes {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Notes = {};
  for (const [key, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const notes = list
      .map(checked_note)
      .filter((note): note is Note => note !== null && view_key(note.view) === key)
      .slice(0, MAX_NOTES);
    if (notes.length) out[key] = notes;
  }
  return out;
}

export function pin_numbers(list: readonly Note[]): (number | null)[] {
  let n = 0;
  return list.map((note) => (note.pin ? ++n : null));
}

export function load_notes(storage: Storage = localStorage): Notes {
  try {
    const text = storage.getItem(NOTES_KEY);
    return text === null ? {} : parse_notes(JSON.parse(text));
  } catch (error) {
    console.warn("cars: saved notes unreadable", error);
    return {};
  }
}

export function store_notes(notes: Notes, storage: Storage = localStorage): boolean {
  try {
    storage.setItem(NOTES_KEY, JSON.stringify(notes));
    return true;
  } catch (error) {
    console.warn("cars: notes not saved", error);
    return false;
  }
}
