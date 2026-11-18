import { mount, unmount } from "svelte";
import { CHANGELOG } from "../changelog";
import { releases_on_boot } from "../version";
import { BUILD } from "./update";
import { BOOT_SEEN, write_seen } from "./seen-version";
import UpdatedCard from "./UpdatedCard.svelte";

const MAX_RELEASES = 3;

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
