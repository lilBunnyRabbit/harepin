import { Idb } from "../store/idb";
import { capped, parse_replay, type SavedReplay } from "./saved";

const STORE = "replays";

const db = new Idb();

export async function load_replays(): Promise<SavedReplay[]> {
  try {
    const stored = await db.entries(STORE);
    return capped(stored.flatMap(([, value]) => parse_replay(value) ?? [])).keep;
  } catch (error) {
    console.warn("replay: saved replays unreadable", error);
    return [];
  }
}

/** The oldest replays past the caps go with the save. */
export async function save_replay(replay: SavedReplay): Promise<boolean> {
  try {
    await db.put(STORE, replay);
    const stored = await db.entries(STORE);
    const { keep } = capped(stored.flatMap(([, value]) => parse_replay(value) ?? []));
    // A value that no longer parses goes too: it would never play, and it is not counted against the caps.
    for (const [key] of stored) if (!keep.some((kept) => kept.id === key)) await db.delete(STORE, key);
    return keep.some((kept) => kept.id === replay.id);
  } catch (error) {
    console.warn("replay: not saved", error);
    return false;
  }
}

export async function delete_replay(id: string): Promise<boolean> {
  try {
    await db.delete(STORE, id);
    return true;
  } catch (error) {
    console.warn("replay: not deleted", error);
    return false;
  }
}
