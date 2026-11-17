import { $ } from "./hud";
import { ROTATE_QUERY, Turn, turn_step } from "./orientation";

/** Keeps a phone in landscape on the road: asks for the lock on load, on every turn and on a tap, never only once. */
export class ScreenTurn {
  private readonly prompt = $("rotate");
  private readonly loading = $("loading");
  private readonly upright = matchMedia(ROTATE_QUERY);
  private readonly touch = matchMedia("(pointer: coarse)");
  private readonly installed = matchMedia("(display-mode: fullscreen), (display-mode: standalone)");
  // iOS has no lock at all; there the prompt and the phone's own rotation are all there is.
  private readonly lockable = "lock" in screen.orientation;
  private locked = false;
  private refused = false;
  private busy = false;
  private abort: AbortController | null = null;

  start() {
    this.abort = new AbortController();
    const { signal } = this.abort;
    if (this.lockable) this.prompt.dataset.tap = "";
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType !== "touch") return;
        // Entering fullscreen closes any open popover, so a tap on a menu button would open and lose it at once.
        if (e.target instanceof Element && e.target.closest("button, [popover]")) return;
        void this.step(true);
      },
      { signal },
    );
    // A tap that closes the menu upright uncovers the prompt: asked a task later, once the menu is gone, the tap still counts.
    // Capture, so a handler that stops the click on its way up cannot hide it.
    document.addEventListener("click", () => setTimeout(() => void this.step(this.on_road())), { signal, capture: true });
    screen.orientation.addEventListener(
      "change",
      () => {
        if (this.upright.matches) this.locked = false;
        void this.step(false);
      },
      { signal },
    );
    document.addEventListener(
      "fullscreenchange",
      () => {
        if (!document.fullscreenElement) this.locked = false;
      },
      { signal },
    );
    // The loading screen goes once boot has put up the menu or the road: only then is it known which one is upright.
    const loaded = new MutationObserver(() => {
      if (this.loading.isConnected) return;
      loaded.disconnect();
      void this.step(false);
    });
    loaded.observe(document.body, { childList: true });
    signal.addEventListener("abort", () => loaded.disconnect());
  }

  /** The prompt is up and nothing stands before the road: the loading screen is gone, the menu is closed. */
  private on_road(): boolean {
    return !this.loading.isConnected && this.prompt.checkVisibility();
  }

  stop() {
    this.abort?.abort();
    this.abort = null;
  }

  private async step(tap: boolean) {
    if (this.busy) return;
    const turn = turn_step({
      touch: this.touch.matches,
      lockable: this.lockable,
      upright: this.upright.matches,
      prompt: this.on_road(),
      fullscreen: document.fullscreenElement !== null,
      installed: this.installed.matches,
      refused: this.refused,
      tap,
      locked: this.locked,
    });
    if (turn === Turn.NONE) return;
    this.busy = true;
    try {
      if (turn === Turn.FULLSCREEN) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      await screen.orientation.lock("landscape");
      this.locked = true;
    } catch (error) {
      if (turn === Turn.LOCK && !document.fullscreenElement) this.refused = true;
      console.warn("fullscreen or orientation lock refused", error);
    } finally {
      this.busy = false;
    }
  }
}
