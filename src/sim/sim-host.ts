import { Quaternion, Vector3 } from "three";
import { Field } from "../ai/field";
import type { Personality } from "../ai/driver";
import { Car, type Controls, type SteerMode } from "../car/car";
import type { CarSpec } from "../car/cars";
import { peer_pass, type Near, type NitroSnapshot } from "../car/nitro";
import { Rewind, type RewindPart } from "../car/rewind";
import { PadTimer } from "../world/sky-pads";
import type { World } from "../world/world";
import { WorldReplay, type WorldOp } from "../world/world-journal";

export const DT = 1 / 360;
const NEAR_GAP = 1.2;
const NEAR_PEER = 4;
/** A free-drive field never finishes. */
const FIELD_LAPS = 1e6;

/** What a frame does with the sim: `FREE` neither steps nor holds (a review replay sets the pose itself). */
export const FrameKind = { HOLD: 0, STEP: 1, REWIND: 2, FREE: 3 } as const;
export type FrameKind = (typeof FrameKind)[keyof typeof FrameKind];

export interface PeerSpot {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface FrameRequest {
  kind: FrameKind;
  steps: number;
  controls: Controls;
  /** ms: the rewind buffer's clock, recorded after a `STEP` and restored to on a `REWIND`. */
  now: number;
  blend: number;
  peers: readonly PeerSpot[];
}

export interface CarAids {
  tcs: boolean;
  abs: boolean;
  assist: boolean;
  stability: boolean;
  auto: boolean;
  steer_mode: SteerMode;
  drift_full_lock: boolean;
}

export interface FieldStart {
  route: string;
  specs: readonly CarSpec[];
  traits: readonly Personality[];
  seed: number;
}

export type CarCommand =
  | { type: "place"; x: number; y: number; z: number; heading: number }
  | { type: "park"; x: number; z: number; heading: number }
  | { type: "swap"; spec: CarSpec; timed: boolean; x: number; z: number; heading: number }
  | { type: "shift"; by: number }
  | { type: "aids"; aids: CarAids }
  | { type: "refill" }
  | { type: "drag"; keep: number };

export type SimCommand = CarCommand | { type: "rewind_clear" } | ({ type: "field" } & FieldStart) | { type: "world"; op: WorldOp };

export interface FrameOut {
  kind: FrameKind;
  steps: number;
  /** s: `DT` summed once a step, as main always added it. */
  stepped: number;
  /** m/s: the hardest hit of the frame's steps, on a wall or a car. */
  impact: number;
  blend: number;
}

/**
 * Applies a command to the player's car; a swap hands back the new car. The host runs it on the car it steps, and the
 * worker client on its mirror at once, so both stand in the same spot before the next step.
 */
export function car_command(car: Car, command: CarCommand, world: World): Car {
  if (command.type === "place") car.place(command.x, command.y, command.z, command.heading);
  else if (command.type === "park") car.park(command.x, command.z, command.heading, world);
  else if (command.type === "swap") {
    const next = new Car(command.spec);
    next.nitro.carry(car.nitro, command.timed);
    next.park(command.x, command.z, command.heading, world);
    return next;
  } else if (command.type === "shift") car.shift(command.by);
  else if (command.type === "aids") Object.assign(car, command.aids);
  else if (command.type === "drag") car.vel.multiplyScalar(command.keep);
  else car.nitro.refill();
  return car;
}

interface BodyFrame {
  pos: Vector3;
  quat: Quaternion;
  vel: Vector3;
  ang: Vector3;
  gear: number;
  omega: number[];
}

/**
 * The whole sim of one player: the car, boost pads, the near-miss pass, an AI field and the car's rewind. Main runs it
 * in place or the sim worker hosts it; either way main only sends commands and frames and reads the car back.
 */
export class SimHost {
  car: Car;
  readonly pads = new PadTimer();
  /** Car body, nitro and pads; the lap clock rewinds on main, recorded and stepped with the same `now`. */
  readonly rewind: Rewind;
  field: Field | null = null;
  field_cars: readonly Car[] = [];
  /** The car before the frame's last step: the drawn car sits between this and `car`. */
  readonly from = { pos: new Vector3(), quat: new Quaternion() };
  readonly out: FrameOut = { kind: FrameKind.HOLD, steps: 0, stepped: 0, impact: 0, blend: 0 };
  on_step: ((dt: number, car: Car, controls: Controls) => void) | null = null;
  private readonly replay: WorldReplay;
  private readonly miss: { near: Near; touched: boolean } = { near: null, touched: false };

  constructor(
    private readonly world: World,
    spec: CarSpec,
  ) {
    this.car = new Car(spec);
    this.replay = new WorldReplay(world);
    const body: RewindPart<BodyFrame> = {
      snapshot: (into) => {
        const car = this.car;
        const f = into ?? { pos: new Vector3(), quat: new Quaternion(), vel: new Vector3(), ang: new Vector3(), gear: 0, omega: [] };
        f.pos.copy(car.pos);
        f.quat.copy(car.quat);
        f.vel.copy(car.vel);
        f.ang.copy(car.ang);
        f.gear = car.gear;
        f.omega.length = car.wheels.length;
        for (let i = 0; i < car.wheels.length; i++) f.omega[i] = car.wheels[i].omega;
        return f;
      },
      restore: (f) => {
        const car = this.car;
        car.pos.copy(f.pos);
        car.quat.copy(f.quat);
        car.vel.copy(f.vel);
        car.ang.copy(f.ang);
        car.gear = f.gear;
        car.parked = false;
        for (let i = 0; i < car.wheels.length; i++) car.wheels[i].omega = f.omega[i];
        car.forget_slide();
      },
    };
    const nitro: RewindPart<NitroSnapshot> = { snapshot: (into) => this.car.nitro.snapshot(into), restore: (s) => this.car.nitro.restore(s) };
    this.rewind = new Rewind([body, nitro, this.pads]);
  }

  apply(command: SimCommand) {
    if (command.type === "rewind_clear") this.rewind.clear();
    else if (command.type === "field") this.start_field(command);
    else if (is_car(command)) {
      if (command.type === "place" || command.type === "park" || command.type === "swap") this.pads.clear();
      this.car = car_command(this.car, command, this.world);
      if (command.type === "swap" && this.field) this.field.rival = this.car;
    } else this.replay.apply(command.op);
  }

  frame(request: FrameRequest): FrameOut {
    const { car, out } = this;
    out.kind = request.kind;
    out.steps = 0;
    out.stepped = 0;
    out.impact = 0;
    out.blend = request.blend;
    if (request.kind !== FrameKind.STEP) {
      if (request.kind === FrameKind.REWIND) this.rewind.step(request.now);
      car.nitro.cut();
      return out;
    }
    const { world, field } = this;
    const { controls } = request;
    for (let i = 0; i < request.steps; i++) {
      this.from.pos.copy(car.pos);
      this.from.quat.copy(car.quat);
      car.step(DT, controls, world);
      this.pads.step(DT, car, world);
      out.stepped += DT;
      out.impact = Math.max(out.impact, world.collide(car));
      if (field) {
        field.step(DT, FIELD_LAPS);
        out.impact = Math.max(out.impact, field.impacts[field.racers.length]);
      }
      this.on_step?.(DT, car, controls);
    }
    out.steps = request.steps;
    const { near, touched } = this.near_miss(out.impact, request.peers);
    car.nitro.pass(near, touched, car.vel.length());
    this.rewind.record(request.now);
    return out;
  }

  private start_field({ route, specs, traits, seed }: FieldStart) {
    const on = this.world.routes.find((r) => r.id === route);
    if (!on) throw new Error(`no route ${route} for the field`);
    this.field = new Field(this.world, on, specs, traits, seed);
    this.field.rival = this.car;
    this.field_cars = this.field.racers.map((r) => r.car);
  }

  private near_miss(impact: number, peers: readonly PeerSpot[]): { near: Near; touched: boolean } {
    const { car, miss } = this;
    miss.near = null;
    miss.touched = false;
    if (!car.nitro.fitted) return miss;
    miss.touched = impact > 0;
    const solid = this.world.grazes(car, NEAR_GAP);
    if (solid) {
      miss.near = solid;
      return miss;
    }
    let id: string | null = null;
    let nearest = 0;
    for (const peer of peers) {
      const dx = peer.x - car.pos.x;
      const dy = peer.y - car.pos.y;
      const dz = peer.z - car.pos.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (id !== null && !(distance < nearest)) continue;
      id = peer.id;
      nearest = distance;
    }
    const pass = id !== null ? peer_pass(nearest, NEAR_PEER) : null;
    if (id !== null && pass?.close) {
      miss.near = id;
      miss.touched = pass.touched;
    }
    return miss;
  }
}

const CAR_COMMANDS: ReadonlySet<SimCommand["type"]> = new Set(["place", "park", "swap", "shift", "aids", "refill", "drag"]);

function is_car(command: SimCommand): command is CarCommand {
  return CAR_COMMANDS.has(command.type);
}
