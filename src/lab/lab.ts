import type { RacerStats } from "../ai/field";
import type { Build } from "../car/build";
import type { Car, Controls } from "../car/car";
import type { CarSpec } from "../car/cars";
import { CLASS_LABELS } from "../car/pi";
import { modal_open } from "../hud/input";
import { BUILD } from "../menu/update";
import type { FieldRace } from "../modes/mode";
import type { LabSpot } from "../worldgen/lab";
import { answer_of, answers_key, read_answers } from "./answers";
import { shown_trials, type Shown } from "./blind";
import { export_block, type Answers, type Device } from "./export";
import { field_rows, type FieldRow } from "./field-rows";
import { INLINE, read_code } from "./pack-code";
import { race_path, resolve_pack, type Aids, type Pack, type Question, type RaceResolved, type Resolved } from "./pack";
import { PACKS } from "./packs";
import { show_overlay } from "./lab-view.svelte";
import { Recorder, type Metrics } from "./recorder";
import { read_results, results_json, results_key } from "./results-store";

export interface LabHost {
  /** Drives `spec` drawn as `build`, with the player's aids under the trial's. Never writes the garage build. */
  drive(build: Build, spec: CarSpec, aids: Aids): void;
  /** The player's own aids, before any trial's. */
  aids(): Aids;
  /** Puts the car on `spot` once its ground is in, unless `current` has gone false by then. */
  place(spot: LabSpot, current: () => boolean): Promise<void>;
  car(): Car;
  toast(text: string): void;
  /** Whether the world loaded is `map` (a map code), or the lab world for null. */
  on_map(map: string | null): boolean;
  /** Starts race trial `r` with the player last on the grid: its route's centreline, null when this map has no such race. */
  race(r: RaceResolved, attach: (race: FieldRace | null) => void): readonly { x: number; z: number }[] | null;
  /** Each AI car's own counts; empty while the sim worker keeps them. */
  field_stats(): readonly RacerStats[];
  /** The race's cars leave and its card closes. */
  end_race(): void;
}

/** What the overlay hears: any change to show, and a trial that ended (goal met or stopped) to show the results of. */
export interface LabWatch {
  changed(): void;
  ended(index: number): void;
  /** Every drawn frame; `recorder` is null between trials. */
  frame(recorder: Recorder | null, car: Car): void;
}

export type TrialStatus = "new" | "running" | "done" | "stopped";

export interface TrialResult {
  status: TrialStatus;
  metrics: Metrics | null;
  /** A race trial's field in running order as it ended; null on a station. */
  field: FieldRow[] | null;
}

export async function load_pack(id: string): Promise<Pack> {
  if (id.startsWith(INLINE)) return read_code(id);
  const load = PACKS[id];
  if (!load) throw new Error(`no lab pack "${id}", expected one of ${Object.keys(PACKS).join(", ")} or ${INLINE}<code>`);
  return (await load()).default;
}

// Shortcuts beside the overlay: next, previous, restart, and copy the export block.
const KEYS: Record<string, number> = { "]": 1, "[": -1, "\\": 0 };
const COPY_KEY = "=";
/** With `map`, the trial a reload onto a race trial's world (or back to the lab's) picks up at. */
const TRIAL_PARAM = "trial";
const MAP_PARAM = "map";

function device(): Device {
  const input = navigator.getGamepads().some((pad) => pad !== null) ? "pad" : matchMedia("(pointer: coarse)").matches ? "touch" : "keys";
  return { input, width: innerWidth, height: innerHeight };
}

export class Lab {
  readonly trials: readonly Resolved[];
  readonly shown: readonly Shown[];
  results: TrialResult[];
  answers: Answers = {};
  watch: LabWatch | null = null;
  private index = -1;
  /** What each trial began on this session; one driven before a reload reads the player's aids at copy time. */
  private readonly ran: (Aids | null)[];
  private recorder: Recorder | null = null;
  private race: FieldRace | null = null;
  /** A race trial holds its grid until the cards close: the lights run on the wall clock, under a card too. */
  private waiting: RaceResolved | null = null;
  private ticket = 0;

  constructor(
    readonly pack: Pack,
    private readonly host: LabHost,
  ) {
    this.trials = resolve_pack(pack);
    this.shown = shown_trials(pack);
    this.results = this.trials.map(() => ({ status: "new", metrics: null, field: null }));
    this.ran = this.trials.map(() => null);
  }

  get current(): Resolved | null {
    return this.trials[this.index] ?? null;
  }

  get at(): number {
    return this.index;
  }

  /** The current trial is still measuring (or waiting for its first throttle): going back to it must not restart it. */
  get live(): boolean {
    return this.recorder !== null || this.waiting !== null;
  }

  /** The current trial counts as running once it has started measuring. */
  status(index: number): TrialStatus {
    return index === this.index && this.recorder?.started ? "running" : this.results[index].status;
  }

  start() {
    this.answers = this.load(answers_key(this.pack), (raw) => read_answers(this.pack, raw), {});
    this.results = this.load(results_key(this.pack), (raw) => read_results(this.trials, raw), this.results);
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
    const map = r.station ? null : r.trial.map;
    if (!this.host.on_map(map)) return this.load_map(r, map, index);
    this.index = index;
    this.recorder = null;
    this.waiting = null;
    const ticket = ++this.ticket;
    this.host.drive(r.build, r.spec, r.trial.aids ?? {});
    this.ran[index] = this.ran_on(r);
    // A later `begin` started while this one waited for its ground: that trial owns the car now.
    const current = () => ticket === this.ticket;
    if (!r.station) {
      this.waiting = r;
      return this.watch?.changed();
    }
    await this.host.place(r.lane.spawn, current);
    if (!current()) return;
    this.record(r);
  }

  private record(r: Resolved, lane = r.lane) {
    this.recorder = new Recorder(lane, r.trial.goal);
    this.recorder.placed(this.host.car());
    this.watch?.changed();
    const index = this.index;
    const shown = this.shown[index];
    this.host.toast(`Trial ${index + 1}/${this.trials.length} ${shown.label}: ${shown.try}${shown.open ? ` (${CLASS_LABELS[r.class]} ${r.pi})` : ""}`);
  }

  /** Every physics step, after the car's. */
  step(dt: number, car: Car, input: Controls) {
    const recorder = this.recorder;
    if (!recorder) return;
    const started = recorder.started;
    recorder.step(dt, car, input);
    if (recorder.done || this.race?.done) {
      this.finish("done");
      this.watch?.ended(this.index);
    } else if (!started && recorder.started) this.watch?.changed();
  }

  frame() {
    const waiting = this.waiting;
    if (waiting && !modal_open()) {
      this.waiting = null;
      const line = this.host.race(waiting, (race) => (this.race = race));
      if (line) this.record(waiting, { ...waiting.lane, path: race_path(line) });
      else this.host.toast(`Trial ${waiting.trial.id}: no closed route "${waiting.lane.name}" on this map`);
    }
    this.watch?.frame(this.recorder, this.host.car());
  }

  placed(car: Car) {
    this.recorder?.placed(car);
  }

  /** Stop: the trial keeps what it measured and its results card opens. */
  end_trial() {
    if (this.index < 0) return;
    // Before the first throttle there is nothing to stop: the card opens and the trial keeps waiting.
    if (this.recorder?.started) this.finish("stopped");
    this.watch?.ended(this.index);
  }

  answer(trial: string, question: Question, value: unknown) {
    const checked = answer_of(question, value);
    const row = (this.answers[trial] ??= {});
    if (checked === null) delete row[question.id];
    else row[question.id] = checked;
    this.save(answers_key(this.pack), JSON.stringify(this.answers));
    this.watch?.changed();
  }

  /** A running trial goes in with what it has measured so far. */
  export(): string {
    const results = this.results.map((r, i): TrialResult => (i === this.index && this.recorder?.started ? { status: "running", metrics: this.recorder.metrics(), field: this.field_now() } : r));
    const aids = this.trials.map((r, i) => (results[i].status === "new" ? null : (this.ran[i] ?? this.ran_on(r))));
    return export_block(this.pack, this.trials, results, this.answers, BUILD.version, device(), new Date(), aids);
  }

  private field_now(): FieldRow[] | null {
    return this.race ? field_rows(this.race.places(), this.host.field_stats()) : null;
  }

  /** A world loads once a page: a trial on another map reloads onto it, its answers and numbers kept in the tab's storage. */
  private load_map(r: Resolved, map: string | null, index: number) {
    const url = new URL(location.href);
    // Already asked for and not what loaded: reloading again would loop.
    if (url.searchParams.get(MAP_PARAM) === map) return this.host.toast(`Trial ${r.trial.id}: its map did not load`);
    if (map === null) url.searchParams.delete(MAP_PARAM);
    else url.searchParams.set(MAP_PARAM, map);
    url.searchParams.set(TRIAL_PARAM, String(index));
    location.assign(url);
  }

  private ran_on(r: Resolved): Aids {
    return { ...this.host.aids(), ...r.trial.aids };
  }

  /** False when the browser refused the clipboard. */
  async copy(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(this.export());
      this.host.toast("Lab results copied");
      return true;
    } catch (error) {
      console.warn("lab: clipboard refused", error);
      this.host.toast("Copy refused by the browser");
      return false;
    }
  }

  private finish(status: "done" | "stopped") {
    const recorder = this.recorder;
    if (!recorder || this.index < 0) return;
    // Left before driving: whatever an earlier attempt measured stands.
    if (recorder.started) {
      this.results[this.index] = { status, metrics: recorder.metrics(), field: this.field_now() };
      this.save(results_key(this.pack), results_json(this.trials, this.results));
    }
    this.recorder = null;
    if (this.race) this.host.end_race();
    this.watch?.changed();
  }

  // A reload or a crash mid-pack keeps what was answered and driven; storage that refuses only loses that.
  private load<T>(key: string, read: (raw: unknown) => T, empty: T): T {
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? empty : read(JSON.parse(raw));
    } catch (error) {
      console.warn(`lab: stored ${key} dropped`, error);
      return empty;
    }
  }

  private save(key: string, json: string) {
    try {
      sessionStorage.setItem(key, json);
    } catch (error) {
      console.warn(`lab: ${key} not stored`, error);
    }
  }
}

export async function open_lab(id: string, host: LabHost): Promise<Lab> {
  const lab = new Lab(await load_pack(id), host);
  lab.start();
  const view = show_overlay(lab);
  const asked = new URLSearchParams(location.search).get(TRIAL_PARAM);
  const at = asked === null ? 0 : Math.max(0, Math.min(lab.trials.length - 1, Math.trunc(Number(asked)) || 0));
  // Back from a reload onto the trial's map: its brief, as a tap on its tile would have shown.
  if (asked !== null) view.screen = { kind: "brief", index: at };
  await lab.begin(at);
  return lab;
}
