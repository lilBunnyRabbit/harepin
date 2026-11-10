/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from "virtual:pwa-register";
import { CHANGELOG, ChangeKind, type Release } from "../changelog";
import { newer_releases, parse_version_file, type RemoteVersion, type VersionInfo } from "../version";
import "./update.css";

declare const __HAREPIN_VERSION__: VersionInfo;
export const BUILD: VersionInfo = __HAREPIN_VERSION__;

const CHECK_EVERY_MS = 30 * 60 * 1000;
const VISIBLE_CHECK_GAP_MS = 60 * 1000;
const BUSY_POLL_MS = 1500;
// updateSW(true) reloads once the new worker takes control; past this, clear this app's worker and caches instead.
const RELOAD_TIMEOUT_MS = 6000;
const UPDATE_PARAM = "__upd";

const KIND_LABEL: Record<ChangeKind, string> = {
  [ChangeKind.NEW]: "New",
  [ChangeKind.IMPROVED]: "Improved",
  [ChangeKind.FIXED]: "Fixed",
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, class_name = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (class_name) node.className = class_name;
  if (text) node.textContent = text;
  return node;
}

function change_list(releases: Release[]): HTMLUListElement {
  const list = el("ul", "update-changes");
  for (const release of releases) {
    for (const change of release.changes) {
      const item = el("li");
      item.append(el("span", `update-kind update-kind-${change.kind}`, KIND_LABEL[change.kind]), el("span", "", change.text));
      list.append(item);
    }
  }
  return list;
}

export function show_version(parent: HTMLElement): void {
  parent.append(el("span", "version-tag", `v${BUILD.version}`));
}

/** Every release, newest first: the What's new page in Settings. */
export function changelog_view(): HTMLElement {
  const body = el("div", "changelog");
  // Focusable so the pad can scroll a list taller than the screen.
  body.tabIndex = 0;
  body.append(el("p", "changelog-build", `You have v${BUILD.version} · ${BUILD.commit}`));
  for (const release of CHANGELOG) {
    const section = el("section", "changelog-release");
    const line = el("p", "changelog-line");
    line.append(el("b", "", `v${release.version}`), el("span", "", release.title), el("time", "", release.date));
    section.append(line, change_list([release]));
    body.append(section);
  }
  return body;
}

async function fetch_remote(): Promise<RemoteVersion | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: "no-store" });
    if (!res.ok) return null;
    return parse_version_file(await res.json());
  } catch (error) {
    console.warn("update: version.json unreachable, showing the update without notes", error);
    return null;
  }
}

export class Updater {
  private update_sw: ((reload?: boolean) => Promise<void>) | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private card: HTMLElement | null = null;
  private check_timer = 0;
  private busy_timer = 0;
  private last_check = 0;

  constructor(private readonly busy: () => boolean) {}

  start(): void {
    const stripped = new URL(location.href);
    if (stripped.searchParams.has(UPDATE_PARAM)) {
      stripped.searchParams.delete(UPDATE_PARAM);
      history.replaceState(history.state, "", stripped);
    }
    this.update_sw = registerSW({
      immediate: true,
      onNeedRefresh: () => void this.offer(),
      // The browser's own check runs about a minute after load; asking now shows a waiting update on reload.
      onRegisteredSW: (_url, registration) => {
        this.registration = registration ?? null;
        this.check();
      },
    });
    this.check_timer = window.setInterval(this.check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", this.on_visible);
  }

  stop(): void {
    clearInterval(this.check_timer);
    clearInterval(this.busy_timer);
    document.removeEventListener("visibilitychange", this.on_visible);
    this.card?.remove();
    this.card = null;
  }

  private readonly check = (): void => {
    this.last_check = Date.now();
    this.registration?.update().catch((error: unknown) => console.warn("update: check failed", error));
  };

  private readonly on_visible = (): void => {
    if (document.visibilityState === "visible" && Date.now() - this.last_check > VISIBLE_CHECK_GAP_MS) this.check();
  };

  private async offer(): Promise<void> {
    const remote = await fetch_remote();
    this.when_idle(() => this.show_card(remote));
  }

  private when_idle(run: () => void): void {
    clearInterval(this.busy_timer);
    if (!this.busy()) return run();
    this.busy_timer = window.setInterval(() => {
      if (this.busy()) return;
      clearInterval(this.busy_timer);
      run();
    }, BUSY_POLL_MS);
  }

  private show_card(remote: RemoteVersion | null): void {
    this.card?.remove();
    const card = el("section", "update-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-labelledby", "update-title");
    const title = el("b", "update-title", remote ? `Harepin v${remote.version} is ready` : "A new Harepin is ready");
    title.id = "update-title";
    const notes = remote ? newer_releases(remote.notes, BUILD.version) : [];
    const status = el("p", "update-status", `You have v${BUILD.version}`);
    const later = el("button", "update-later", "Later");
    const now = el("button", "update-now", "Update now");
    later.type = now.type = "button";
    later.addEventListener("click", () => this.dismiss());
    now.addEventListener("click", () => {
      now.disabled = later.disabled = true;
      if (this.busy()) status.textContent = "Updating when this run ends";
      this.when_idle(() => {
        status.textContent = "Updating…";
        void this.apply();
      });
    });
    const actions = el("div", "update-actions");
    actions.append(later, now);
    card.append(title, status);
    if (notes.length) card.append(el("p", "update-heading", "What's new"), change_list(notes));
    card.append(actions);
    document.body.append(card);
    this.card = card;
    now.focus({ preventScroll: true });
  }

  private dismiss(): void {
    clearInterval(this.busy_timer);
    this.card?.remove();
    this.card = null;
  }

  private async apply(): Promise<void> {
    if (this.update_sw) {
      await this.update_sw(true);
      await new Promise((done) => setTimeout(done, RELOAD_TIMEOUT_MS));
    }
    // Still here: the waiting worker never took over. Only this app's worker and caches go: the origin is shared.
    const scope = this.registration?.scope ?? new URL(import.meta.env.BASE_URL, location.href).href;
    try {
      await this.registration?.unregister();
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.includes(scope)).map((key) => caches.delete(key)));
    } catch (error) {
      console.warn("update: could not clear the old worker, reloading anyway", error);
    }
    const url = new URL(location.href);
    url.searchParams.set(UPDATE_PARAM, String(Date.now()));
    location.replace(url);
  }
}
