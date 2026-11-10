import type * as THREE from "three";
import type { CarSpec } from "../car/cars";
import type { World } from "../world/world";
import type { Body } from "./gymkhana";
import type { Track } from "./track";
import type { Bindable } from "../hud/bindings";

export const NO_SITE = "No flat ground near the start on this map";

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
  readonly needs_ground: boolean;
  /** Its bays, cone lanes and spin boxes are laid out for a car: a bigger vehicle can't play it. */
  readonly car_sized_only: boolean;
  readonly busy_notice: string;
  readonly high_view?: boolean;
  levels(world: World): readonly L[];
  /** A run, a status line saying why it can't start, or null to do nothing. */
  start(ctx: ModeCtx, level: L): ModeRun | string | null;
}

export function body_of(spec: CarSpec): Body {
  return { circles: spec.circles, radius: spec.radius, length: spec.body.length, width: spec.body.width };
}

export function turn_to(car: { pos: { x: number; z: number }; heading: number }, x: number, z: number): number {
  const bearing = Math.atan2(x - car.pos.x, z - car.pos.z);
  return Math.atan2(Math.sin(bearing - car.heading), Math.cos(bearing - car.heading));
}
