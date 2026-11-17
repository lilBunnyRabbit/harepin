import type * as THREE from "three";
import type { Difficulty } from "../ai/difficulty";
import type { FieldCar } from "../ai/field";
import type { RivalCars } from "../ai/field-pick";
import type { FieldView } from "../ai/field-view";
import type { Build } from "../car/build";
import type { Rating } from "../car/pi";
import type { CarSpec } from "../car/cars";
import type { Sim } from "../sim/sim-client";
import type { World } from "../world/world";
import type { Body, Pose } from "./gymkhana";
import type { Thresholds, Track } from "./track";
import type { Bindable } from "../hud/bindings";
import type { Hits } from "./hits";
import type { DrawnGround } from "./marks";
import type { NextCard } from "./result";
import type { RoutePoint } from "./route";
import { atan2, cos, hypot, sin } from "../sim-math";

export const NO_SITE = "No flat ground near the start on this map";
// The map draws it for a run on a stretch of road that is no route of its own: a duel, a drift zone, a gate hunt.
export const CIRCUIT = "circuit";

export interface Driven {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  readonly heading: number;
  readonly spec: CarSpec;
  readonly wheels: readonly { readonly contact: boolean }[];
}

export interface Level {
  id: string;
  name: string;
  brings: string;
  /** Said as its run starts in place of the mode's goal. */
  goal?: string;
}

export interface Finish {
  title: string;
  stars: number;
  lines: HTMLElement[];
  /** Where the player finished against other cars, 1 for a win; absent where nothing races them. */
  place?: number;
  /** The run's name where the title says only how it ended: the card's heading. */
  name?: string;
  /** Gymkhana and parking show their card without the chime. */
  quiet?: boolean;
  /** Rows of a finish order, kept current by the run while the card shows. */
  standings?: HTMLElement[];
}

/** What a race needs to run an AI field: the sim hosting it, and the player's car its presets match. */
export interface FieldHost {
  readonly sim: Sim;
  build(): Build;
  /** The player's car as it drives, which the field's class follows. */
  rating(): Rating;
  /** The field drives the player's car too: a dev autopilot for shots and frame-time runs. */
  readonly autopilot: boolean;
  /** One per AI car on the grid, pole first: F3's six, fewer for a frame-time baseline, any mix in a lab trial. */
  readonly cars: readonly FieldCar[];
  difficulty(): Difficulty;
  /** Hears the race once it is built and null once it is gone: the lab reads its order. */
  attach?(race: FieldRace | null): void;
  /** A series event's rules and names; free play and the lab race the plain field. */
  readonly event?: FieldEvent;
  /** The cars the field drives; the player's class when absent. */
  readonly rivals?: RivalCars;
}

/** How the player's race ended, for a series event to score. */
export interface FieldOutcome {
  /** Car indices, winner first; the player's is the field's size. */
  order: readonly number[];
  /** No touch with another car. */
  clean: boolean;
  /** In the lead as the player passed half the race distance. */
  led: boolean;
  /** Set a lap no other car beat; never in a one-lap race, where it would only repeat the win. */
  fastest: boolean;
  /** Started from the last grid slot. */
  from_back: boolean;
}

export interface FieldEvent {
  readonly name: string;
  /** One per AI car, pole first. */
  readonly names: readonly string[];
  readonly knockout: boolean;
  /** ms: the race ends here, placed by distance; null to race the laps out. */
  readonly limit_ms: number | null;
  /** The player's grid slot, 0 on pole; last when absent. */
  readonly grid?: number;
  /** Laps a race to the line runs; the route's par decides when absent. A timed race runs the most a field may. */
  readonly laps?: number;
  /** Called once as the player's race ends; returns lines for the result card. */
  finish(outcome: FieldOutcome): HTMLElement[];
  /** What the result card's Next does; read once the result has scored, so it can name what the result opened. */
  readonly next: { readonly label: string; go(): void; ticket?(): NextCard | null };
}

/** A car's place in a field race now. */
export interface FieldPlace {
  /** The AI car's index in the field; the player's is the field's size. */
  car: number;
  you: boolean;
  name: string;
  /** s from the start; Infinity while still racing. */
  finish: number;
  /** s behind the leader: how long ago the leader stood where this car is; NaN before it is past the line. */
  gap: number;
}

export interface FieldRace {
  /** The player has finished. */
  readonly done: boolean;
  /** Leader first. */
  places(): FieldPlace[];
}

export interface ModeCtx {
  readonly scene: THREE.Scene;
  readonly world: World;
  /** What a run's marks drape on: the world, or on a streamed world the circuit's own height where a chunk is not in yet. */
  readonly ground: DrawnGround;
  readonly start_index: number;
  /** `?debug&at=`: the point along its route a race run starts on; 0 is the start line. */
  readonly route_at: number;
  readonly camera: THREE.Camera;
  readonly track: Track;
  /** Set while a lobby race runs on a route of its own: called at each lap's end, true while laps remain. */
  lobby_lap(): (() => boolean) | null;
  race_busy(): boolean;
  /** A career event's hit counter for the run, fresh per call; null in free play, which has no hit penalty. */
  hits(): Hits | null;
  /** Laps a solo race runs on a closed route: a built run's choice, else 1. Its marks grade the whole run. */
  readonly laps: number;
  /** The star marks a run is graded on: a career event's own when tuned on this world, else `own`, the mode's (ms, or points for drift). */
  thresholds(own: Thresholds): Thresholds;
  /** The AI field a free-play race runs against; null in events, Runs, lobby races and without the dev flag. */
  field(): FieldHost | null;
  /** A career event's shipped 3-star ghost lap; null in free play or when it has none. */
  dev_ghost(): Promise<number[] | null>;
  /** The player's ghost setting. */
  ghosts(): boolean;
  high(): boolean;
  /** The keys bound to `action` now, as the player reads them; empty when none. */
  key_of(action: Bindable): string;
  spawn(x: number, z: number, heading: number): void;
  spawn_on(p: { x: number; z: number; tx: number; tz: number }): void;
  chime(): void;
  /** Points the gate arrow `turn` radians off the car's nose; `wrong` shows the wrong-way card with it. */
  hint(turn: number, wrong?: boolean): void;
  hide_hint(): void;
  exit(): void;
}

/** The route a run drives and its next gate, for the map and pace notes; one object the run keeps current. */
export interface RouteRun {
  readonly id: string;
  gate: { x: number; z: number } | null;
  /** The run's other gates still to take, after `gate` in driving order, marked on the map. */
  later: readonly { x: number; z: number }[];
  /** Where a fall puts the car back: the last gate taken, the start before any; without one, where it last stood safely. */
  respawn?: RoutePoint;
  /** Index into the route's points the car has reached: the close-up map lights the route only from there on. Absent, all of it. */
  progress?: number;
}

/** The top card's fields after the clock, each in a slot of its own, in this order. */
export const STATUS_FIELDS = ["place", "lap", "gap", "gates"] as const;
export type StatusField = (typeof STATUS_FIELDS)[number];
/** A mode's caption per field it shows; a field without one never shows. */
export type StatusCaptions = Partial<Record<StatusField, string>>;

/** A run's status, one object it keeps and rewrites each frame. */
export interface ModeStatus extends Record<StatusField, string | null> {
  name: string;
  /** The big readout: the run's clock, a countdown, a score. */
  clock: string;
}

/** A field this run never has is null and leaves its slot out; "" keeps the slot, blank, so the others stay put. */
export function mode_status(name: string): ModeStatus {
  return { name, clock: "", place: null, lap: null, gap: null, gates: null };
}

export interface ModeRun {
  /** `sim_dt`: seconds of physics stepped this frame, 0 while the sim is paused. Returns the run's status, or null to keep the last. */
  update(sim_dt: number, car: Driven): ModeStatus | null;
  finished(): Finish | null;
  /** A run whose fields mean something else than its mode's, such as a speed trap's traps; the mode's when absent. */
  readonly captions?: StatusCaptions;
  readonly holding?: boolean;
  readonly route?: RouteRun;
  /** The AI cars the run races, for its replay's tape. */
  readonly field?: FieldView;
  /** On a streamed world, the ground where `inside` streamed in: what the run laid there on stand-in ground goes down on it. */
  ground_in?(inside: (x: number, z: number) => boolean): void;
  dispose(): void;
}

export interface ModeDef<L extends Level = Level> {
  readonly id: string;
  readonly name: string;
  /** One line said as a run starts: what to do to finish it. */
  readonly goal: string;
  readonly needs_ground: boolean;
  /** Its bays, cone lanes and spin boxes are laid out for a car: a bigger vehicle can't play it. */
  readonly car_sized_only: boolean;
  readonly busy_notice: string;
  readonly high_view?: boolean;
  /** Runs on a streamed world: it reads terrain only where the car is, so the chunks at its start are all it waits on. */
  readonly streams?: boolean;
  /** What each top card field means in this mode. */
  readonly status: StatusCaptions;
  /** How a scored run's points read; drift's bare points when absent. */
  readonly score_text?: (score: number) => string;
  levels(world: World): readonly L[];
  /** A run, a status line saying why it can't start, or null to do nothing. */
  start(ctx: ModeCtx, level: L): ModeRun | string | null;
}

// Horizontal speed only: the car drops onto its spawn, and that fall would read as driving off.
export function pose_of(car: Driven): Pose {
  return { x: car.pos.x, z: car.pos.z, heading: car.heading, speed: hypot(car.vel.x, car.vel.z) };
}

export function airborne(car: Driven): boolean {
  for (const wheel of car.wheels) if (wheel.contact) return false;
  return true;
}

export function body_of(spec: CarSpec): Body {
  return { circles: spec.circles, radius: spec.radius, length: spec.body.length, width: spec.body.width };
}

export function turn_to(car: { pos: { x: number; z: number }; heading: number }, x: number, z: number): number {
  const bearing = atan2(x - car.pos.x, z - car.pos.z);
  return atan2(sin(bearing - car.heading), cos(bearing - car.heading));
}
