/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from "virtual:pwa-register";
import { CHANGELOG, ChangeKind, type Release } from "../changelog";
import { UpdateState, compare_versions, newer_releases, parse_version_file, type RemoteVersion, type VersionInfo } from "../version";
import "./update.css";

declare const __HAREPIN_VERSION__: VersionInfo;
export const BUILD: VersionInfo = __HAREPIN_VERSION__;

const CHECK_EVERY_MS = 30 * 60 * 1000;
const VISIBLE_CHECK_GAP_MS = 60 * 1000;
const BUSY_POLL_MS = 1500;
const TOAST_MS = 4000;
// updateSW(true) reloads once the new worker takes control; past this, clear this app's worker and caches instead.
const RELOAD_TIMEOUT_MS = 6000;
const UPDATE_PARAM = "__upd";

const KIND_LABEL: Record<ChangeKind, string> = {
  [ChangeKind.NEW]: "New",
  [ChangeKind.IMPROVED]: "Improved",
  [ChangeKind.FIXED]: "Fixed",
};

export interface UpdateHost {
  /** A lobby race or gymkhana run: no toast and no reload until it ends. */
  busy(): boolean;
  menu_open(): boolean;
  show_notes(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, class_name = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (class_name) node.className = class_name;
  if (text) node.textContent = text;
  return node;
}

function change_list(release: Release): HTMLUListElement {
  const list = el("ul", "update-changes");
  for (const change of release.changes) {
    const item = el("li");
    item.append(el("span", `update-kind update-kind-${change.kind}`, KIND_LABEL[change.kind]), el("span", "", change.text));
    list.append(item);
  }
  return list;
}

function release_view(release: Release, fresh: boolean): HTMLElement {
  const section = el("section", "changelog-release");
  const line = el("p", "changelog-line");
  line.append(el("b", "", `v${release.version}`), el("span", "", release.title));
  if (fresh) line.append(el("span", "changelog-fresh", "New"));
  line.append(el("time", "", release.date));
  section.append(line, change_list(release));
  return section;
}

export function show_version(parent: HTMLElement): void {
  parent.append(el("span", "version-tag", `v${BUILD.version}`));
}

async function fetch_remote(): Promise<RemoteVersion | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: "no-store" });
    if (!res.ok) return null;
    return parse_version_file(await res.json());
  } catch {
    return null;
  }
}

export class Updater {
  private update_sw: ((reload?: boolean) => Promise<void>) | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private waiting = false;
  private coming = false;
  private applying = false;
  private readonly pending = el("div", "changelog-pending");
  private readonly toast = el("button", "update-toast");
  private check_timer = 0;
  private toast_wait = 0;
  private apply_wait = 0;
  private toast_timer = 0;
  private last_check = 0;

  constructor(private readonly host: UpdateHost) {
    this.pending.hidden = true;
    this.toast.type = "button";
    this.toast.hidden = true;
    this.toast.append(el("b", "", "Update ready"), el("span", "", "· in the menu"));
  }

  get state(): UpdateState {
    if (this.waiting) return UpdateState.READY;
    return this.coming ? UpdateState.COMING : UpdateState.NONE;
  }

  changelog_view(): HTMLElement {
    const page = el("div", "changelog-page");
    const body = el("div", "changelog");
    // Focusable so the pad can scroll a list taller than the screen.
    body.tabIndex = 0;
    body.append(el("p", "changelog-build", `You have v${BUILD.version} · ${BUILD.commit}`));
    for (const release of CHANGELOG) body.append(release_view(release, false));
    page.append(this.pending, body);
    return page;
  }

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
    this.toast.addEventListener("click", this.open_notes);
    document.body.append(this.toast);
  }

  stop(): void {
    clearInterval(this.check_timer);
    clearInterval(this.toast_wait);
    clearInterval(this.apply_wait);
    clearTimeout(this.toast_timer);
    document.removeEventListener("visibilitychange", this.on_visible);
    this.toast.removeEventListener("click", this.open_notes);
    this.toast.remove();
  }

  // The worker only reports once the whole build is cached; the small version file says it is coming right away.
  private async peek(): Promise<void> {
    const remote = await fetch_remote();
    this.coming = !!this.registration && !!remote && compare_versions(remote.version, BUILD.version) > 0;
  }

  private readonly check = (): void => {
    this.last_check = Date.now();
    void this.peek();
    this.registration?.update().catch((error: unknown) => console.warn("update: check failed", error));
  };

  private readonly on_visible = (): void => {
    if (document.visibilityState === "visible" && Date.now() - this.last_check > VISIBLE_CHECK_GAP_MS) this.check();
  };

  private readonly open_notes = (): void => {
    this.hide_toast();
    this.host.show_notes();
  };

  private async offer(): Promise<void> {
    const remote = await fetch_remote();
    if (!remote) console.warn("update: version.json unreachable, showing the update without notes");
    this.waiting = true;
    this.show_pending(remote);
    // In the menu the chip already says it.
    if (this.host.menu_open()) return;
    clearInterval(this.toast_wait);
    this.toast_wait = this.when_idle(() => {
      if (!this.host.menu_open()) this.show_toast();
    });
  }

  private when_idle(run: () => void): number {
    if (!this.host.busy()) {
      run();
      return 0;
    }
    const timer = window.setInterval(() => {
      if (this.host.busy()) return;
      clearInterval(timer);
      run();
    }, BUSY_POLL_MS);
    return timer;
  }

  private show_toast(): void {
    this.toast.hidden = false;
    clearTimeout(this.toast_timer);
    this.toast_timer = window.setTimeout(() => this.hide_toast(), TOAST_MS);
  }

  private hide_toast(): void {
    clearTimeout(this.toast_timer);
    this.toast.hidden = true;
  }

  private show_pending(remote: RemoteVersion | null): void {
    if (this.applying) return;
    const head = el("div", "changelog-update");
    const text = el("div", "changelog-update-text");
    const status = el("p", "", `${remote ? `v${BUILD.version} → v${remote.version}` : `You have v${BUILD.version}`} · the game reloads`);
    text.append(el("b", "", "Update ready"), status);
    const now = el("button", "changelog-update-now", "Update now");
    now.type = "button";
    now.addEventListener("click", () => {
      now.disabled = true;
      this.applying = true;
      if (this.host.busy()) status.textContent = "Updating when this run ends";
      clearInterval(this.apply_wait);
      this.apply_wait = this.when_idle(() => {
        status.textContent = "Updating…";
        void this.apply();
      });
    });
    head.append(text, now);
    const notes = remote ? newer_releases(remote.notes, BUILD.version) : [];
    this.pending.replaceChildren(head, ...notes.map((release) => release_view(release, true)));
    this.pending.hidden = false;
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
