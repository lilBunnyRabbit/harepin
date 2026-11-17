import "./mirror.css";

/** The mirror's frame in the HUD; it tells the renderer where on the canvas its glass sits. */
export class MirrorFrame {
  // Read in the observer, where layout is fresh, so no frame forces one. The frame is centred, so a window resize moves
  // it without resizing it: the app is observed too.
  private readonly observer = new ResizeObserver(() => this.read());

  constructor(
    private readonly el: HTMLElement,
    private readonly app: HTMLElement,
    private readonly place: (left: number, top: number, width: number, height: number, radius: number) => void,
  ) {}

  start() {
    this.observer.observe(this.el);
    this.observer.observe(this.app);
  }

  stop() {
    this.observer.disconnect();
  }

  show(on: boolean) {
    if (this.el.hidden !== on) return;
    this.el.hidden = !on;
    document.documentElement.toggleAttribute("data-mirror", on);
  }

  private read() {
    const { el } = this;
    const rect = el.getBoundingClientRect();
    const border = el.clientLeft;
    const width = Math.max(0, rect.width - 2 * border);
    const height = Math.max(0, rect.height - 2 * border);
    const radius = Math.max(0, parseFloat(getComputedStyle(el).borderTopLeftRadius) - border);
    this.place(rect.left + border, rect.top + border, width, height, radius);
  }
}
