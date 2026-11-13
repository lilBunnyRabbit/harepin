import type { Build } from "../car/build";
import type { Car, Controls } from "../car/car";
import type { CarSpec } from "../car/cars";
import { CLASS_LABELS } from "../car/pi";
import { BUILD } from "../menu/update";
import type { LabSpot } from "../worldgen/lab";
import { export_block, type Answers, type Device } from "./export";
import { INLINE, read_code } from "./pack-code";
import { resolve_pack, type Aids, type Pack, type Resolved } from "./pack";
import { PACKS } from "./packs";
import { Recorder, type Metrics } from "./recorder";

export interface LabHost {
  /** Drives `spec` drawn as `build`, with the player's aids under the trial's. Never writes the garage build. */
  drive(build: Build, spec: CarSpec, aids: Aids): void;
  /** Puts the car on `spot` once its ground is in, unless `current` has gone false by then. */
  place(spot: LabSpot, current: () => boolean): Promise<void>;
  car(): Car;
  toast(text: string): void;
}

export type TrialStatus = "new" | "running" | "done" | "stopped";

export interface TrialResult {
  status: TrialStatus;
  metrics: Metrics | null;
}

export async function load_pack(id: string): Promise<Pack> {
  if (id.startsWith(INLINE)) return read_code(id);
  const load = PACKS[id];
  if (!load) throw new Error(`no lab pack "${id}", expected one of ${Object.keys(PACKS).join(", ")} or ${INLINE}<code>`);
  return (await load()).default;
}

// Until the overlay lands these keys walk the pack (next, previous, restart) and copy the export block.
const KEYS: Record<string, number> = { "]": 1, "[": -1, "\\": 0 };
const COPY_KEY = "=";

function device(): Device {
  const input = navigator.getGamepads().some((pad) => pad !== null) ? "pad" : matchMedia("(pointer: coarse)").matches ? "touch" : "keys";
  return { input, width: innerWidth, height: innerHeight };
}

export class Lab {
  readonly trials: readonly Resolved[];
  readonly results: TrialResult[];
  readonly answers: Answers = {};
  private index = -1;
  private recorder: Recorder | null = null;
  private ticket = 0;

  constructor(
    readonly pack: Pack,
    private readonly host: LabHost,
  ) {
    this.trials = resolve_pack(pack);
    this.results = this.trials.map(() => ({ status: "new", metrics: null }));
  }

  get current(): Resolved | null {
    return this.trials[this.index] ?? null;
  }

  start() {
    addEventListener("keydown", this.on_key);
  }

  stop() {
    removeEventListener("keydown", this.on_key);
  }

  private readonly on_key = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === COPY_KEY) return void this.copy();
    const step = KEYS[event.key];
    if (step === undefined) return;
    const next = Math.max(0, Math.min(this.trials.length - 1, this.index + step));
    void this.begin(next);
  };

  async begin(index: number) {
    this.finish("stopped");
    const r = this.trials[index];
    this.index = index;
    this.recorder = null;
    const ticket = ++this.ticket;
    this.host.drive(r.build, r.spec, r.trial.aids ?? {});
    // A later `begin` started while this one waited for its ground: that trial owns the car now.
    const current = () => ticket === this.ticket;
    await this.host.place(r.lane.spawn, current);
    if (!current()) return;
    this.recorder = new Recorder(r.lane, r.trial.goal);
    this.recorder.placed(this.host.car());
    this.host.toast(`Trial ${index + 1}/${this.trials.length} ${r.trial.id}: ${r.trial.try} (${CLASS_LABELS[r.class]} ${r.pi})`);
  }

  /** Every physics step, after the car's. */
  step(dt: number, car: Car, input: Controls) {
    const recorder = this.recorder;
    if (!recorder) return;
    recorder.step(dt, car, input);
    if (recorder.done) {
      this.finish("done");
      this.host.toast(`${this.trials[this.index].trial.id} done: ${this.index + 1 < this.trials.length ? "] for the next trial" : "pack done"}`);
    }
  }

  placed(car: Car) {
    this.recorder?.placed(car);
  }

  /** A running trial goes in with what it has measured so far. */
  export(): string {
    const results = this.results.map((r, i): TrialResult => (i === this.index && this.recorder?.started ? { status: "running", metrics: this.recorder.metrics() } : r));
    return export_block(this.pack, this.trials, results, this.answers, BUILD.version, device(), new Date());
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.export());
      this.host.toast("Lab results copied");
    } catch (error) {
      console.warn("lab: clipboard refused", error);
      this.host.toast("Copy refused by the browser");
    }
  }

  private finish(status: "done" | "stopped") {
    const recorder = this.recorder;
    if (!recorder || this.index < 0) return;
    // Left before driving: whatever an earlier attempt measured stands.
    if (recorder.started) this.results[this.index] = { status, metrics: recorder.metrics() };
    this.recorder = null;
  }
}

export async function open_lab(id: string, host: LabHost): Promise<Lab> {
  const lab = new Lab(await load_pack(id), host);
  lab.start();
  await lab.begin(0);
  return lab;
}
