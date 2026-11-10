/** The part of the browser's CloseWatcher this uses; TypeScript's DOM types don't ship it yet. */
export interface Watcher {
  addEventListener(type: "close", listener: () => void): void;
  destroy(): void;
}

export interface BackHost {
  create_watcher: (() => Watcher) | null;
  push_guard(): void;
}

export const GUARD_STATE = "harepin-back";

/**
 * Turns the phone's system Back into the game's own back (B / Esc), so it never closes the installed app. A
 * CloseWatcher hears it where the browser has one; elsewhere a single history entry is popped and pushed again. Never
 * more than one watcher or entry at a time.
 */
export class SystemBack {
  private watcher: Watcher | null = null;
  private guarded = false;
  /** Esc reaches a CloseWatcher too; the game already handled that key, so its close is not a second back. */
  private escaped = false;
  private abort: AbortController | null = null;

  constructor(
    private readonly host: BackHost,
    private readonly on_back: () => void,
  ) {}

  get armed(): boolean {
    return this.watcher !== null || this.guarded;
  }

  start() {
    this.abort = new AbortController();
    const { signal } = this.abort;
    // A touch only activates the page on release, so pointerdown alone could never arm on a phone.
    window.addEventListener("pointerdown", () => this.gesture(), { capture: true, signal });
    window.addEventListener("pointerup", () => this.gesture(), { capture: true, signal });
    window.addEventListener("keydown", (event) => this.gesture(event.key), { capture: true, signal });
    window.addEventListener("keyup", (event) => this.key_up(event.key), { capture: true, signal });
    window.addEventListener("popstate", (event) => this.popped(event.state), { signal });
    this.begin(window.history.state);
  }

  /**
   * A reload keeps the history entry, so a page that opens on its own guard is already guarded. A CloseWatcher arms
   * at once: the spec grants one without a gesture, and Back before the first tap must not close the app either.
   */
  begin(state: unknown) {
    if (!this.host.create_watcher && state === GUARD_STATE) this.guarded = true;
    if (this.host.create_watcher) this.arm();
  }

  stop() {
    this.abort?.abort();
    this.abort = null;
    this.watcher?.destroy();
    this.watcher = null;
  }

  gesture(key = "") {
    if (key === "Escape") this.escaped = true;
    this.arm();
  }

  key_up(key: string) {
    if (key === "Escape") this.escaped = false;
  }

  closed() {
    this.watcher = null;
    const escaped = this.escaped;
    this.escaped = false;
    if (!escaped) this.on_back();
    this.arm();
  }

  /** Browsers on this path don't drop entries pushed without a gesture (only Chrome does, and it has CloseWatcher). */
  popped(state: unknown) {
    if (state === GUARD_STATE || !this.guarded) return;
    this.on_back();
    this.host.push_guard();
  }

  private arm() {
    if (this.armed) return;
    if (this.host.create_watcher) {
      const watcher = this.host.create_watcher();
      watcher.addEventListener("close", () => this.closed());
      this.watcher = watcher;
      return;
    }
    this.host.push_guard();
    this.guarded = true;
  }
}
