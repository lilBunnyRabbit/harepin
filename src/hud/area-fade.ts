import "./area-fade.css";

/** A wait shorter than this never shows the fade, so a teleport onto ground already in stays instant. */
const SHOW_AFTER_MS = 120;

/** Covers the screen while a teleport waits for the chunks around its spot. */
export class AreaFade {
  private readonly el: HTMLElement;
  private pending = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement("div");
    this.el.id = "area-fade";
    this.el.textContent = "Loading area";
    parent.append(this.el);
  }

  async cover<T>(wait: Promise<T>): Promise<T> {
    this.pending++;
    const timer = setTimeout(() => this.el.toggleAttribute("data-shown", true), SHOW_AFTER_MS);
    try {
      return await wait;
    } finally {
      clearTimeout(timer);
      if (--this.pending === 0) this.el.toggleAttribute("data-shown", false);
    }
  }
}
