import "./area-fade.css";

/** A wait shorter than this never shows the fade, so a teleport onto ground already in stays instant. */
const SHOW_AFTER_MS = 120;

/** Covers the screen while a teleport waits for the chunks around its spot, or for good once the world fails. */
export class AreaFade {
  private readonly el: HTMLElement;
  private readonly text: HTMLElement;
  private pending = 0;
  private failed = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement("div");
    this.el.id = "area-fade";
    this.text = document.createElement("p");
    this.text.textContent = "Loading area";
    this.el.append(this.text);
    parent.append(this.el);
  }

  // A failed world never comes back, so the wait stays pending: nothing after it should run on missing ground.
  async cover<T>(wait: Promise<T>): Promise<T> {
    this.pending++;
    const timer = setTimeout(() => this.el.toggleAttribute("data-shown", true), SHOW_AFTER_MS);
    try {
      return await wait;
    } catch (error) {
      this.fail(error);
      return new Promise<T>(() => {});
    } finally {
      clearTimeout(timer);
      if (--this.pending === 0 && !this.failed) this.el.toggleAttribute("data-shown", false);
    }
  }

  fail(error: unknown) {
    if (this.failed) return;
    this.failed = true;
    console.error(error);
    this.text.textContent = "The world failed to load";
    const reload = document.createElement("button");
    reload.textContent = "Reload";
    reload.addEventListener("click", () => location.reload());
    this.el.append(reload);
    this.el.toggleAttribute("data-shown", true);
  }
}
