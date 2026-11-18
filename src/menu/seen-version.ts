const SEEN_KEY = "harepin:seen-version";

export interface Seen {
  version: string | null;
  returning: boolean;
}

function read_seen(): Seen {
  try {
    const version = localStorage.getItem(SEEN_KEY);
    const returning = Object.keys(localStorage).some((key) => key.startsWith("harepin:") && key !== SEEN_KEY);
    return { version, returning };
  } catch (error) {
    console.warn("updated: last seen version unreadable", error);
    return { version: null, returning: false };
  }
}

/** Read when the bundle loads, before the boot writes its first keys (a new player has none yet) or this build's version. */
export const BOOT_SEEN: Seen = read_seen();

export function write_seen(version: string): boolean {
  try {
    localStorage.setItem(SEEN_KEY, version);
    return true;
  } catch (error) {
    console.warn("updated: seen version not saved", error);
    return false;
  }
}
