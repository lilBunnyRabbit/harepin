/** Longer than the HUD toast's own 1200 ms, so a queued note never cuts the one before it short. */
const GAP_MS = 1400;
const RETRY_MS = 300;

export class ToastQueue {
  private readonly waiting: string[] = [];
  private timer = 0;

  constructor(
    private readonly show: (text: string) => void,
    private readonly busy: () => boolean,
  ) {}

  push(text: string) {
    this.waiting.push(text);
    if (!this.timer) this.next();
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = 0;
    this.waiting.length = 0;
  }

  private next() {
    this.timer = 0;
    if (!this.waiting.length) return;
    if (this.busy()) {
      this.timer = window.setTimeout(() => this.next(), RETRY_MS);
      return;
    }
    const text = this.waiting.shift();
    if (text === undefined) return;
    this.show(text);
    this.timer = window.setTimeout(() => this.next(), GAP_MS);
  }
}
