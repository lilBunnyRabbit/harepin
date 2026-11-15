import { Quaternion, Vector3 } from "three";
import { Car } from "../car/car";
import type { CarSpec } from "../car/cars";
import type { World } from "../world/world";
import type { WorldJournal } from "../world/world-journal";
import type { WorldData } from "../worldgen/types";
import { FrameKind, SimHost, car_command, type FrameOut, type FrameRequest, type SimCommand } from "./sim-host";
import { packet_epoch, read_packet, type SimRequest } from "./sim-packet";

/** `?simworker`: the sim runs in a worker and main draws from its replies. */
export const SIM_WORKER_PARAM = "simworker";

export interface Sim {
  /** The player's car as main reads it: the stepped car itself, or a mirror of the worker's. */
  readonly car: Car;
  readonly from: { readonly pos: Vector3; readonly quat: Quaternion };
  readonly field_cars: readonly Car[];
  send(command: SimCommand): void;
  frame(request: FrameRequest): FrameOut;
}

export class LocalSim implements Sim {
  constructor(readonly host: SimHost) {}

  get car(): Car {
    return this.host.car;
  }

  get from() {
    return this.host.from;
  }

  get field_cars(): readonly Car[] {
    return this.host.field_cars;
  }

  send(command: SimCommand) {
    this.host.apply(command);
  }

  frame(request: FrameRequest): FrameOut {
    return this.host.frame(request);
  }
}

/**
 * The sim in a worker. Each frame posts the commands since the last one and the frame's request, and reads the replies
 * that came since: main draws frame N from the reply to frame N-1. A command that moves the car also moves the mirror at
 * once and starts a new epoch, so a reply from before it never pulls the car back.
 */
export class WorkerSim implements Sim {
  car: Car;
  readonly from = { pos: new Vector3(), quat: new Quaternion() };
  field_cars: readonly Car[] = [];
  private readonly out: FrameOut = { kind: FrameKind.FREE, steps: 0, stepped: 0, impact: 0, blend: 0 };
  private readonly read: FrameOut = { kind: FrameKind.FREE, steps: 0, stepped: 0, impact: 0, blend: 0 };
  private readonly commands: SimCommand[] = [];
  private replies: Float64Array[] = [];
  private epoch = 0;

  private constructor(
    private readonly worker: Worker,
    private readonly world: World,
    spec: CarSpec,
  ) {
    this.car = new Car(spec);
  }

  static start(worker: Worker, world: World, plan: WorldData, journal: WorldJournal, spec: CarSpec): WorkerSim {
    const sim = new WorkerSim(worker, world, spec);
    worker.addEventListener("message", (event: MessageEvent<Float64Array>) => sim.replies.push(event.data));
    worker.addEventListener("error", (event) => console.error(`sim worker: ${event.message}`));
    worker.postMessage({ type: "init", seed: world.seed, plan, levels: world.levels, spec } satisfies SimRequest);
    journal.pipe((op) => sim.commands.push({ type: "world", op }));
    return sim;
  }

  send(command: SimCommand) {
    if (command.type === "place" || command.type === "park" || command.type === "swap" || command.type === "refill") {
      this.car = car_command(this.car, command, this.world);
      this.epoch++;
    } else if (command.type === "shift" || command.type === "aids") this.car = car_command(this.car, command, this.world);
    else if (command.type === "field") {
      this.field_cars = command.specs.map((spec) => new Car(spec));
      this.epoch++;
    }
    this.commands.push(command);
  }

  frame(request: FrameRequest): FrameOut {
    const { out, read } = this;
    this.worker.postMessage({ type: "frame", epoch: this.epoch, commands: this.commands, frame: request } satisfies SimRequest);
    this.commands.length = 0;
    out.steps = 0;
    out.stepped = 0;
    out.impact = 0;
    let fresh = false;
    for (const reply of this.replies) {
      if (packet_epoch(reply) < this.epoch) continue;
      read_packet(reply, read, this.car, this.from, this.field_cars);
      if (!fresh || read.kind === FrameKind.STEP) out.kind = read.kind;
      fresh = true;
      out.steps += read.steps;
      out.stepped += read.stepped;
      out.impact = Math.max(out.impact, read.impact);
      out.blend = read.blend;
    }
    this.replies.length = 0;
    return out;
  }

  stop() {
    this.worker.terminate();
  }
}
