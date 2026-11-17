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
    this.observer.observe(this.el, { box: "border-box" });
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

  // The box reaches up to the top edge and its top padding is the drop under the cards there (mirror.css), so a card
  // coming or going resizes it; the frame itself is the `::after` under that padding.
  private read() {
    const { el } = this;
    const rect = el.getBoundingClientRect();
    const drop = parseFloat(getComputedStyle(el).paddingTop);
    const frame = getComputedStyle(el, "::after");
    const border = parseFloat(frame.borderTopWidth);
    const width = Math.max(0, rect.width - 2 * border);
    const height = Math.max(0, rect.height - drop - 2 * border);
    const radius = Math.max(0, parseFloat(frame.borderTopLeftRadius) - border);
    this.place(rect.left + border, rect.top + drop + border, width, height, radius);
  }
}
