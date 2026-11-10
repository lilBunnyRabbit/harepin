import type { Bindable } from "../hud/bindings";
import { read_json, write_json, type Store } from "../modes/track";

export const GOALS_KEY = "harepin:goals";

export const GoalId = {
  SKY: "sky",
  NEW_MAP: "new_map",
  MAP: "map",
  CAR: "car",
  BUS: "bus",
  TUNE: "tune",
  PAINT: "paint",
  BUILD: "build",
  LAP: "lap",
  BEST: "best",
  MODES: "modes",
  REWIND: "rewind",
  CAMERA: "camera",
  FRIEND: "friend",
} as const;
export type GoalId = (typeof GoalId)[keyof typeof GoalId];

export const GoTo = {
  DRIVE: "drive",
  SKY: "sky",
  WORLD: "world",
  GARAGE: "garage",
  MODES: "modes",
  ONLINE: "online",
  CAMERA: "camera",
} as const;
export type GoTo = (typeof GoTo)[keyof typeof GoTo];

export interface Goal {
  id: GoalId;
  title: string;
  /** One line on how; `{key}` reads as the keys bound to `key`. */
  hint: string;
  go: GoTo;
  key?: Bindable;
}

export const GOALS: readonly Goal[] = [
  { id: GoalId.SKY, title: "Drive Sky Track", hint: "A floating road above the clouds, with jumps and boost pads", go: GoTo.SKY },
  { id: GoalId.NEW_MAP, title: "Roll a new map", hint: "Every number is a different island: roll one, or type a friend's", go: GoTo.WORLD },
  { id: GoalId.MAP, title: "Find yourself on the map", hint: "Press {key} while driving to see the whole map", go: GoTo.WORLD, key: "map" },
  { id: GoalId.CAR, title: "Change car", hint: "Pick another body in the garage, from hatch to formula", go: GoTo.GARAGE },
  { id: GoalId.BUS, title: "Take the bus", hint: "The biggest thing in the garage. Mind the corners", go: GoTo.GARAGE },
  { id: GoalId.TUNE, title: "Tune a part", hint: "Swap the engine, tyres, aero or brakes and feel the change", go: GoTo.GARAGE },
  { id: GoalId.PAINT, title: "Paint your car", hint: "Pick a colour, a decal and a race number", go: GoTo.GARAGE },
  { id: GoalId.BUILD, title: "Save a build", hint: "Keep a car you like under a name in the garage's Builds", go: GoTo.GARAGE },
  { id: GoalId.LAP, title: "Finish a lap", hint: "Drive through every gate on the circuit back to the start", go: GoTo.DRIVE },
  { id: GoalId.BEST, title: "Beat your best lap", hint: "Your ghost drives your best line: pass it", go: GoTo.DRIVE },
  { id: GoalId.MODES, title: "Play every mode", hint: "Finish one run each of race, gymkhana, parking, drift, gate hunt and ghost duel", go: GoTo.MODES },
  { id: GoalId.REWIND, title: "Rewind a mistake", hint: "Hold {key} to run time back", go: GoTo.DRIVE, key: "rewind" },
  { id: GoalId.CAMERA, title: "Try another camera", hint: "Press {key} for the cockpit view", go: GoTo.CAMERA, key: "camera" },
  { id: GoalId.FRIEND, title: "Drive with a friend", hint: "Join a room, or send your invite link and wait for them here", go: GoTo.ONLINE },
];

const MODE_PART = "mode:";

export const mode_part = (mode: string) => `${MODE_PART}${mode}`;

export function parse_done(raw: unknown, mode_ids: readonly string[]): Set<string> {
  const known = new Set<string>([...GOALS.map((goal) => goal.id), ...mode_ids.map(mode_part)]);
  const done = new Set<string>();
  if (!Array.isArray(raw)) return done;
  for (const id of raw) if (typeof id === "string" && known.has(id)) done.add(id);
  return done;
}

export interface Steps {
  done: number;
  total: number;
}

export class Goals {
  on_done: ((goal: Goal) => void) | null = null;
  private readonly finished: Set<string>;
  private version_ = 0;

  constructor(
    private readonly store: Store | null,
    private readonly mode_ids: readonly string[],
  ) {
    this.finished = parse_done(read_json(store, GOALS_KEY), mode_ids);
  }

  get version(): number {
    return this.version_;
  }

  is_done(id: GoalId): boolean {
    return this.finished.has(id);
  }

  get count(): number {
    return GOALS.filter((goal) => this.finished.has(goal.id)).length;
  }

  sorted(): Goal[] {
    return [...GOALS.filter((goal) => !this.is_done(goal.id)), ...GOALS.filter((goal) => this.is_done(goal.id))];
  }

  steps(id: GoalId): Steps | null {
    if (id !== GoalId.MODES) return null;
    return { done: this.mode_ids.filter((mode) => this.finished.has(mode_part(mode))).length, total: this.mode_ids.length };
  }

  done(id: GoalId) {
    if (this.finished.has(id)) return;
    this.finished.add(id);
    this.save();
    const goal = GOALS.find((g) => g.id === id);
    if (goal) this.on_done?.(goal);
  }

  played(mode: string) {
    const part = mode_part(mode);
    if (!this.mode_ids.includes(mode) || this.finished.has(part)) return;
    this.finished.add(part);
    this.save();
    if (this.mode_ids.every((m) => this.finished.has(mode_part(m)))) this.done(GoalId.MODES);
  }

  /** Marks what saved data already proves, without a toast: a returning player doesn't start at zero. */
  catch_up(proven: () => Iterable<string>) {
    if (this.count === GOALS.length) return;
    const on_done = this.on_done;
    this.on_done = null;
    for (const id of proven()) {
      if (id.startsWith(MODE_PART)) this.played(id.slice(MODE_PART.length));
      else {
        const goal = GOALS.find((g) => g.id === id);
        if (goal) this.done(goal.id);
      }
    }
    this.on_done = on_done;
  }

  private save() {
    this.version_++;
    write_json(this.store, GOALS_KEY, [...this.finished]);
  }
}
