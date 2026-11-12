import { CHANGELOG } from "../changelog";
import { releases_since } from "../version";
import { el } from "./setting-rows";
import { BUILD, release_view } from "./update";
import "./updated-card.css";

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

function write_seen(version: string) {
  try {
    localStorage.setItem(SEEN_KEY, version);
  } catch (error) {
    console.warn("updated: seen version not saved", error);
  }
}

export function show_updated(show_notes: () => void): void {
  const { version, returning } = BOOT_SEEN;
  write_seen(BUILD.version);
  // A player from before this card has no seen version: show them the current release alone.
  const seen = version ?? (returning ? null : BUILD.version);
  const releases = seen === null ? CHANGELOG.slice(0, 1) : releases_since(CHANGELOG, seen, BUILD.version);
  if (releases.length === 0) return;

  const card = el("dialog", "updated");
  card.setAttribute("aria-labelledby", "updated-title");
  const box = el("div", "updated-box");
  const head = el("header", "updated-head");
  const title = el("h2", "", `Updated to v${BUILD.version}`);
  title.id = "updated-title";
  const since = seen === null ? releases[0].title : releases.length === 1 ? `From v${seen}` : `${releases.length} releases since v${seen}`;
  head.append(title, el("p", "updated-since", since));

  const notes = el("div", "updated-notes");
  notes.tabIndex = 0;
  notes.append(...releases.slice(0, MAX_RELEASES).map((release) => release_view(release, false)));

  const foot = el("footer", "updated-foot");
  const more = el("button", "updated-more", "Full notes");
  more.type = "button";
  const ok = el("button", "updated-ok", "Got it");
  ok.type = "button";
  ok.autofocus = true;
  foot.append(more, ok);

  box.append(head, notes, foot);
  card.append(box);
  ok.addEventListener("click", () => card.close());
  more.addEventListener("click", () => {
    card.close();
    show_notes();
  });
  // The box fills the dialog edge to edge, so a click on the dialog itself is the backdrop.
  card.addEventListener("click", (event) => {
    if (event.target === card) card.close();
  });
  // Esc closes the card only; the menu behind keeps its page. Arrows go on to the menu's pad navigation.
  card.addEventListener("keydown", (event) => {
    if (!event.key.startsWith("Arrow")) event.stopPropagation();
  });
  card.addEventListener("close", () => card.remove());
  document.body.append(card);
  card.showModal();
}
