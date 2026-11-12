import type * as THREE from "three";
import type { CarSpec } from "../car/cars";
import type { World } from "../world/world";
import type { Body, Pose } from "./gymkhana";
import type { Thresholds, Track } from "./track";
import type { Bindable } from "../hud/bindings";
import type { Hits } from "./hits";
import type { RoutePoint } from "./route";

export const NO_SITE = "No flat ground near the start on this map";
// The map draws it for a run on a stretch of road that is no route of its own: a duel, a drift zone, a gate hunt.
export const CIRCUIT = "circuit";

export interface Driven {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  readonly heading: number;
  readonly spec: CarSpec;
}

export interface Level {
  id: string;
  name: string;
  brings: string;
}

export interface Finish {
  title: string;
  stars: number;
  lines: HTMLElement[];
  /** Gymkhana and parking show their card without the chime. */
  quiet?: boolean;
}

export interface ModeCtx {
  readonly scene: THREE.Scene;
  readonly world: World;
  readonly start_index: number;
  readonly camera: THREE.Camera;
  readonly track: Track;
  /** Set while a lobby race runs on a route of its own: called at each lap's end, true while laps remain. */
  lobby_lap(): (() => boolean) | null;
  race_busy(): boolean;
  /** A career event's hit counter for the run, fresh per call; null in free play, which has no hit penalty. */
  hits(): Hits | null;
  /** The star marks a run is graded on: a career event's own when tuned on this world, else `own`, the mode's (ms, or points for drift). */
  thresholds(own: Thresholds): Thresholds;
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
  hint(turn: number): void;
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
}

export interface ModeRun {
  /** `sim_dt`: seconds of physics stepped this frame, 0 while the sim is paused. Returns the status line, or null to keep it. */
  update(sim_dt: number, car: Driven): string | null;
  finished(): Finish | null;
  readonly holding?: boolean;
  readonly route?: RouteRun;
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
  levels(world: World): readonly L[];
  /** A run, a status line saying why it can't start, or null to do nothing. */
  start(ctx: ModeCtx, level: L): ModeRun | string | null;
}

// Horizontal speed only: the car drops onto its spawn, and that fall would read as driving off.
export function pose_of(car: Driven): Pose {
  return { x: car.pos.x, z: car.pos.z, heading: car.heading, speed: Math.hypot(car.vel.x, car.vel.z) };
}

export function body_of(spec: CarSpec): Body {
  return { circles: spec.circles, radius: spec.radius, length: spec.body.length, width: spec.body.width };
}

export function turn_to(car: { pos: { x: number; z: number }; heading: number }, x: number, z: number): number {
  const bearing = Math.atan2(x - car.pos.x, z - car.pos.z);
  return Math.atan2(Math.sin(bearing - car.heading), Math.cos(bearing - car.heading));
}
