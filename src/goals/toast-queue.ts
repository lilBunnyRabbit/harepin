/** Longer than the HUD toast's own 1200 ms, so a queued note never cuts the one before it short. */
const GAP_MS = 1400;
const RETRY_MS = 300;

interface Note {
  text: string;
  hold?: number;
}

export class ToastQueue {
  private readonly waiting: Note[] = [];
  private timer = 0;

  constructor(
    private readonly show: (text: string, hold?: number) => void,
    private readonly busy: () => boolean,
  ) {}

  /** `hold` keeps a note up longer than the HUD toast's default, for one that needs reading, like an error. */
  push(text: string, hold?: number) {
    this.waiting.push({ text, hold });
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
    const note = this.waiting.shift();
    if (!note) return;
    this.show(note.text, note.hold);
    this.timer = window.setTimeout(() => this.next(), Math.max(GAP_MS, note.hold ?? 0));
  }
}
