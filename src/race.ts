import type { World } from "./world";

const BEST_KEY = "harepin:best";
const SPLITS_KEY = "harepin:splits";
const GATE_RADIUS = 15;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export interface RaceSnapshot {
  next: number;
  started: number;
  splits: number[];
}

export class Race {
  next = 0;
  started = 0;
  last: number | null = null;
  best: number | null = load<number | null>(BEST_KEY, null);
  best_splits: number[] = load<number[]>(SPLITS_KEY, []);
  splits: number[] = [];
  lap_flash = 0;
  delta: number | null = null;
  delta_flash = 0;
  on_lap: ((improved: boolean) => void) | null = null;
  on_start: (() => void) | null = null;

  constructor(private world: World) {}

  get gates() {
    return this.world.checkpoints.length;
  }

  update(x: number, z: number, now: number) {
    const cp = this.world.checkpoints[this.next];
    if (Math.hypot(x - cp.x, z - cp.z) > GATE_RADIUS) return;
    if (this.next === 0) {
      if (this.started) {
        const lap = now - this.started;
        this.splits.push(lap);
        this.last = lap;
        this.show_delta(this.gates, lap, now);
        const improved = !this.best || lap < this.best;
        if (improved) {
          this.best = lap;
          this.best_splits = [...this.splits];
          save(BEST_KEY, lap);
          save(SPLITS_KEY, this.best_splits);
        }
        this.on_lap?.(improved);
        this.lap_flash = now;
      }
      this.started = now;
      this.splits = [];
      this.on_start?.();
    } else if (this.started) {
      const split = now - this.started;
      this.splits.push(split);
      this.show_delta(this.next, split, now);
    }
    this.next = (this.next + 1) % this.gates;
  }

  private show_delta(gate: number, split: number, now: number) {
    const reference = this.best_splits[gate - 1];
    if (reference === undefined) return;
    this.delta = split - reference;
    this.delta_flash = now;
  }

  snapshot(): RaceSnapshot {
    return { next: this.next, started: this.started, splits: [...this.splits] };
  }

  restore(snapshot: RaceSnapshot, rewound_ms: number) {
    this.next = snapshot.next;
    this.started = snapshot.started ? snapshot.started + rewound_ms : 0;
    this.splits = snapshot.splits;
  }
}
