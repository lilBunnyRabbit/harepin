/// <reference types="vite-plugin-pwa/client" />
import { mount, unmount } from "svelte";
import { registerSW } from "virtual:pwa-register";
import { UpdateState, compare_versions, parse_version_file, type RemoteVersion, type VersionInfo } from "../version";
import Changelog from "./Changelog.svelte";
import UpdateToast from "./UpdateToast.svelte";
import { UpdateView } from "./update-view.svelte";
import "./update.css";

declare const __HAREPIN_VERSION__: VersionInfo;
export const BUILD: VersionInfo = __HAREPIN_VERSION__;

const CHECK_EVERY_MS = 15 * 60 * 1000;
const VISIBLE_CHECK_GAP_MS = 60 * 1000;
const BUSY_POLL_MS = 1500;
const TOAST_MS = 4000;
// updateSW(true) reloads once the new worker takes control; past this, clear this app's worker and caches instead.
const RELOAD_TIMEOUT_MS = 6000;
const UPDATE_PARAM = "__upd";

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

export function show_version(parent: HTMLElement): void {
  parent.append(el("span", "version-tag", `v${BUILD.version}`));
}

/** The "Downloading update" / "Update ready" chip, shared by the menu bar and the drive screen. */
export class UpdateChip {
  readonly root = el("button");
  private readonly label = el("span");

  constructor(class_name: string) {
    this.root.className = class_name;
    this.root.type = "button";
    this.root.hidden = true;
    this.root.append(el("span", "menu-update-dot"), this.label);
  }

  show(state: UpdateState, text?: string): void {
    this.root.hidden = state === UpdateState.NONE;
    this.root.dataset.state = state;
    this.label.textContent = text ?? (state === UpdateState.READY ? "Update ready" : "Downloading update");
    this.root.title = state === UpdateState.READY ? "A new version is ready: tap to update" : "A new version is downloading";
  }
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
  private readonly view = new UpdateView();
  private toast: ReturnType<typeof mount> | null = null;
  private readonly chip = new UpdateChip("drive-update");
  private check_timer = 0;
  private toast_wait = 0;
  private apply_wait = 0;
  private toast_timer = 0;
  private last_check = 0;

  constructor(private readonly host: UpdateHost) {
    this.chip.root.addEventListener("click", () => {
      if (this.state !== UpdateState.READY) return this.host.show_notes();
      this.request_apply((text) => this.chip.show(UpdateState.READY, text));
    });
  }

  get state(): UpdateState {
    if (this.waiting) return UpdateState.READY;
    return this.coming ? UpdateState.COMING : UpdateState.NONE;
  }

  changelog_view(): HTMLElement {
    const page = el("div");
    const say = (text: string) => {
      if (this.view.pending) this.view.pending.status = text;
    };
    mount(Changelog, { target: page, props: { view: this.view, build: BUILD, onapply: () => this.request_apply(say) } });
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
    this.toast = mount(UpdateToast, { target: document.body, props: { view: this.view, onopen: this.open_notes } });
    document.body.append(this.chip.root);
  }

  stop(): void {
    clearInterval(this.check_timer);
    clearInterval(this.toast_wait);
    clearInterval(this.apply_wait);
    clearTimeout(this.toast_timer);
    document.removeEventListener("visibilitychange", this.on_visible);
    if (this.toast) void unmount(this.toast);
    this.toast = null;
    this.chip.root.remove();
  }

  // The worker only reports once the whole build is cached; the small version file says it is coming right away.
  private async peek(): Promise<void> {
    const remote = await fetch_remote();
    this.coming = !!this.registration && !!remote && compare_versions(remote.version, BUILD.version) > 0;
    if (!this.applying) this.chip.show(this.state);
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
    if (!this.applying) this.chip.show(this.state);
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
    this.view.toast = true;
    clearTimeout(this.toast_timer);
    this.toast_timer = window.setTimeout(() => this.hide_toast(), TOAST_MS);
  }

  private hide_toast(): void {
    clearTimeout(this.toast_timer);
    this.view.toast = false;
  }

  private show_pending(remote: RemoteVersion | null): void {
    if (this.applying) return;
    const status = `${remote ? `v${BUILD.version} → v${remote.version}` : `You have v${BUILD.version}`} · the game reloads`;
    this.view.pending = { remote, status, applying: false };
  }

  private request_apply(say: (text: string) => void): void {
    if (this.applying) return;
    this.applying = true;
    this.chip.root.disabled = true;
    if (this.view.pending) this.view.pending.applying = true;
    if (this.host.busy()) say("Updating when this run ends");
    clearInterval(this.apply_wait);
    this.apply_wait = this.when_idle(() => {
      say("Updating…");
      void this.apply();
    });
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
