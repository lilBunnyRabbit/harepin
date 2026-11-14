import { mount, unmount } from "svelte";
import { CHANGELOG } from "../changelog";
import { releases_on_boot } from "../version";
import { BUILD } from "./update";
import UpdatedCard from "./UpdatedCard.svelte";

const SEEN_KEY = "harepin:seen-version";
const MAX_RELEASES = 3;

interface Seen {
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

// Read when the bundle loads, before the boot writes its first keys: a new player has none yet.
const BOOT_SEEN = read_seen();

function write_seen(version: string): boolean {
  try {
    localStorage.setItem(SEEN_KEY, version);
    return true;
  } catch (error) {
    console.warn("updated: seen version not saved", error);
    return false;
  }
}

let closed_now = false;

/** The card just closed in this task: a system Back that closed it is not also a back for the menu. */
export function card_closed_now(): boolean {
  return closed_now;
}

export function show_updated(show_notes: (version: string | null) => void): void {
  const { version, returning } = BOOT_SEEN;
  // Unsaved, the card would come back on every boot.
  if (!write_seen(BUILD.version)) return;
  const releases = releases_on_boot(CHANGELOG, version, returning, BUILD.version);
  if (releases.length === 0) return;

  const since = version === null ? "From an earlier version" : releases.length === 1 ? `From v${version}` : `${releases.length} releases since v${version}`;
  const target = document.createElement("div");
  document.body.append(target);
  const card = mount(UpdatedCard, {
    target,
    props: {
      version: BUILD.version,
      since,
      releases: releases.slice(0, MAX_RELEASES),
      onnotes: show_notes,
      // A boot-time dialog shares the app's CloseWatcher group, so one Back closes both in the same task.
      onclosed: () => {
        closed_now = true;
        setTimeout(() => {
          closed_now = false;
          void unmount(card);
          target.remove();
        });
      },
    },
  });
}
