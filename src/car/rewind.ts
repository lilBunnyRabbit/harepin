const REWIND_SECONDS = 10;
const START_CAPACITY = 1024;

export interface RewindPart<S = unknown> {
  snapshot(): S;
  /** `rewound_ms`: how far back the restored frame was taken. */
  restore(snapshot: S, rewound_ms: number): void;
}

interface Slot {
  at: number;
  snapshots: unknown[];
}

export class Rewind {
  private slots: Slot[];
  private head = 0;
  private count = 0;

  constructor(private readonly parts: RewindPart[]) {
    this.slots = Rewind.alloc(START_CAPACITY, parts.length);
  }

  private static alloc(capacity: number, parts: number): Slot[] {
    return Array.from({ length: capacity }, () => ({ at: 0, snapshots: new Array<unknown>(parts) }));
  }

  get can_step() {
    return this.count > 1;
  }

  private slot(i: number) {
    return this.slots[(this.head + i) % this.slots.length];
  }

  record(now: number) {
    if (this.count === this.slots.length) this.grow();
    const slot = this.slot(this.count++);
    slot.at = now;
    this.parts.forEach((part, i) => (slot.snapshots[i] = part.snapshot()));
    while (this.count && now - this.slot(0).at > REWIND_SECONDS * 1000) {
      this.slot(0).snapshots.fill(undefined);
      this.head = (this.head + 1) % this.slots.length;
      this.count--;
    }
  }

  /** Drops the newest frame and restores the one before it; false when there is nothing left to restore. */
  step(now: number): boolean {
    if (this.count > 1) this.slot(--this.count).snapshots.fill(undefined);
    if (!this.count) return false;
    const slot = this.slot(this.count - 1);
    this.parts.forEach((part, i) => part.restore(slot.snapshots[i], now - slot.at));
    return true;
  }

  clear() {
    for (let i = 0; i < this.count; i++) this.slot(i).snapshots.fill(undefined);
    this.count = 0;
  }

  // A frame rate high enough to fill the buffer inside the window doubles it instead of shortening the window.
  private grow() {
    const next = Rewind.alloc(this.slots.length * 2, this.parts.length);
    for (let i = 0; i < this.count; i++) next[i] = this.slot(i);
    this.slots = next;
    this.head = 0;
  }
}
