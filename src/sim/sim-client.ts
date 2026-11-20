import { Quaternion, Vector3 } from "three";
import { Car } from "../car/car";
import type { CarSpec } from "../car/cars";
import type { World } from "../world/world";
import type { WorldJournal } from "../world/world-journal";
import type { WorldData } from "../worldgen/types";
import { FrameKind, SimHost, car_command, type FieldStart, type FrameOut, type FrameRequest, type SimCommand } from "./sim-host";
import { packet_epoch, read_packet, type Pose, type SimRequest } from "./sim-packet";

/** `?mainsim`: the sim steps on the main thread, as the lab and review shots always do, instead of in its worker. */
export const SIM_MAIN_PARAM = "mainsim";
/** `?simworker`: opt in to the sim worker while main-thread stepping is the default (player car jumped back in worker races, 0.71.4). */
export const SIM_WORKER_PARAM = "simworker";
const WORKER_WAIT_MS = 10_000;

/** A running worker that leaves `frames` frames unanswered over at least `ms` has failed: both, so neither a long main-thread stall nor a slow phone's frames alone trip it. */
export interface ReplyWait {
  ms: number;
  frames: number;
}
const REPLY_WAIT: ReplyWait = { ms: 2_000, frames: 20 };
/** Steps (1/15 s) a late reply's pose is carried on along its last step at most: past that a stalled worker shows as a stall, not a car running off. */
const AHEAD_CAP = 24;

export type SimPort = Pick<Worker, "postMessage" | "terminate" | "addEventListener">;

const sim_worker = () => new Worker(new URL("./sim-worker.ts", import.meta.url), { type: "module" });

export function open_sim_worker(make: () => SimPort = sim_worker, wait_ms = WORKER_WAIT_MS): Promise<SimPort | null> {
  let worker: SimPort;
  try {
    worker = make();
  } catch (error) {
    console.warn("Sim worker refused, the sim steps on the main thread:", error);
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const settled = new AbortController();
    const settle = (to: SimPort | null) => {
      settled.abort();
      clearTimeout(timer);
      resolve(to);
    };
    const give_up = (why: string) => {
      worker.terminate();
      console.warn(`Sim worker ${why}, the sim steps on the main thread`);
      settle(null);
    };
    const timer = setTimeout(() => give_up(`silent for ${wait_ms} ms`), wait_ms);
    worker.addEventListener("message", () => settle(worker), { signal: settled.signal });
    worker.addEventListener("error", (event) => give_up(`failed to start (${event.message || "no message"})`), { signal: settled.signal });
  });
}

/** The worker's sim when one started, else the sim on main; on main the world keeps no journal, which only the worker reads. */
export function start_sim(worker: SimPort | null, world: World, plan: WorldData, journal: WorldJournal | null, spec: CarSpec): LocalSim | WorkerSim {
  if (worker && journal) return WorkerSim.start(worker, world, plan, journal, spec);
  world.journal = null;
  return new LocalSim(new SimHost(world, spec));
}

export interface Sim {
  /** The player's car as main reads it: the stepped car itself, or a mirror of the worker's. */
  readonly car: Car;
  readonly from: { readonly pos: Vector3; readonly quat: Quaternion };
  readonly field_cars: readonly Car[];
  /** Each AI car before the last frame's last step: the field draws between this and the car at `blend`, as the player's car does. */
  readonly field_from: readonly Pose[];
  /** The last frame's share (0-1) of a step past its last one. */
  readonly blend: number;
  /** Each AI car's road points from the start, laps included, then the player's: empty with no field. */
  readonly field_progress: Float64Array;
  /** The player's touches with AI cars since the field started, counted per step. */
  readonly field_touches: number;
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

  get field_progress(): Float64Array {
    return this.host.field_progress;
  }

  get field_from(): readonly Pose[] {
    return this.host.field_from;
  }

  get blend(): number {
    return this.host.out.blend;
  }

  get field_touches(): number {
    return this.host.out.touches;
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
 *
 * A worker that fails once running (an error, a reply main can't read, or silence while frames go out) hands the sim to
 * main: the mirror is the whole car the worker last sent, so main steps on from it. An AI field can't be rebuilt from
 * its poses, so main starts it again from its grid and `on_fall_back` hears so.
 */
export class WorkerSim implements Sim {
  private mirror: Car;
  private readonly mirror_from = { pos: new Vector3(), quat: new Quaternion() };
  private mirror_field: readonly Car[] = [];
  private mirror_field_from: readonly Pose[] = [];
  private mirror_progress = new Float64Array(0);
  private readonly out: FrameOut = { kind: FrameKind.FREE, steps: 0, stepped: 0, impact: 0, blend: 0, touches: 0 };
  private readonly read: FrameOut = { kind: FrameKind.FREE, steps: 0, stepped: 0, impact: 0, blend: 0, touches: 0 };
  private readonly commands: SimCommand[] = [];
  private replies: Float64Array[] = [];
  private readonly unread: number[] = [];
  private reply_blend = 0;
  private request_blend = 0;
  private reply_epoch = -1;
  private epoch = 0;
  private field: FieldStart | null = null;
  private failure: string | null = null;
  /** ms: when the first frame since the last reply went out; NaN while none waits. */
  private waiting_since = Number.NaN;
  private unanswered = 0;
  private main: LocalSim | null = null;
  /** Called once the sim moved to main; `field` is true when an AI field was running and started again from its grid. */
  on_fall_back: ((field: boolean) => void) | null = null;

  private constructor(
    private readonly worker: SimPort,
    private readonly world: World,
    spec: CarSpec,
    private readonly wait: ReplyWait,
  ) {
    this.mirror = new Car(spec);
  }

  static start(worker: SimPort, world: World, plan: WorldData, journal: WorldJournal, spec: CarSpec, wait = REPLY_WAIT): WorkerSim {
    const sim = new WorkerSim(worker, world, spec, wait);
    worker.addEventListener("message", (event: MessageEvent<Float64Array>) => {
      sim.replies.push(event.data);
      sim.waiting_since = Number.NaN;
      sim.unanswered = 0;
    });
    worker.addEventListener("error", (event: ErrorEvent) => (sim.failure ??= `failed (${event.message || "no message"})`));
    worker.addEventListener("messageerror", () => (sim.failure ??= "sent a reply main can't read"));
    worker.postMessage({ type: "init", seed: world.seed, plan, levels: world.levels, spec } satisfies SimRequest);
    journal.pipe((op) => {
      if (!sim.main) sim.commands.push({ type: "world", op });
    });
    return sim;
  }

  get car(): Car {
    return this.main?.car ?? this.mirror;
  }

  get from(): Pose {
    return this.main?.from ?? this.mirror_from;
  }

  get field_cars(): readonly Car[] {
    return this.main?.field_cars ?? this.mirror_field;
  }

  get field_from(): readonly Pose[] {
    return this.main?.field_from ?? this.mirror_field_from;
  }

  get field_progress(): Float64Array {
    return this.main?.field_progress ?? this.mirror_progress;
  }

  get field_touches(): number {
    return this.main?.field_touches ?? this.out.touches;
  }

  get blend(): number {
    return this.main?.blend ?? this.out.blend;
  }

  get on_main(): boolean {
    return this.main !== null;
  }

  send(command: SimCommand) {
    if (this.main) return this.main.send(command);
    if (command.type === "place" || command.type === "park" || command.type === "swap" || command.type === "refill") {
      this.mirror = car_command(this.mirror, command, this.world);
      this.epoch++;
    } else if (command.type === "shift" || command.type === "aids") this.mirror = car_command(this.mirror, command, this.world);
    else if (command.type === "field") {
      this.field = command;
      this.mirror_field = command.specs.map((spec) => new Car(spec));
      this.mirror_field_from = this.mirror_field.map((car) => ({ pos: car.pos.clone(), quat: car.quat.clone() }));
      this.mirror_progress = new Float64Array(command.specs.length + 1).fill(NaN);
      this.epoch++;
    } else if (command.type === "field_stop") {
      this.field = null;
      this.mirror_field = [];
      this.mirror_field_from = [];
      this.mirror_progress = new Float64Array(0);
      this.epoch++;
    }
    this.commands.push(command);
  }

  frame(request: FrameRequest): FrameOut {
    if (!this.main && this.unanswered >= this.wait.frames && performance.now() - this.waiting_since >= this.wait.ms) this.failure ??= `silent for ${this.unanswered} frames`;
    if (!this.main && this.failure !== null) this.fall_back(this.failure);
    if (this.main) return this.main.frame(request);
    const { out, read } = this;
    this.worker.postMessage({ type: "frame", epoch: this.epoch, commands: this.commands, frame: request } satisfies SimRequest);
    this.commands.length = 0;
    const draws = this.request_blend;
    this.request_blend = request.blend;
    this.unread.push(request.kind === FrameKind.STEP ? request.steps : -1);
    if (Number.isNaN(this.waiting_since)) this.waiting_since = performance.now();
    this.unanswered++;
    out.steps = 0;
    out.stepped = 0;
    out.impact = 0;
    let fresh = false;
    for (const reply of this.replies) {
      this.unread.shift();
      if (packet_epoch(reply) < this.epoch) continue;
      read_packet(reply, read, this.mirror, this.mirror_from, this.mirror_field, this.mirror_field_from, this.mirror_progress);
      if (!fresh || read.kind === FrameKind.STEP) out.kind = read.kind;
      fresh = true;
      out.steps += read.steps;
      out.stepped += read.stepped;
      out.impact = Math.max(out.impact, read.impact);
      this.reply_blend = read.blend;
      this.reply_epoch = this.epoch;
      out.touches = read.touches;
    }
    this.replies.length = 0;
    out.blend = this.drawn_blend(draws);
    this.mirror.nitro.barred = this.mirror_field.length > 0;
    return out;
  }

  stop() {
    this.worker.terminate();
  }

  /**
   * Main draws frame N from the reply to frame N-1. A reply that misses its frame (the worker busy, or its message
   * landing just after the frame starts) left the car standing for a frame and then jumping two: against a chase cam
   * moving on, it snapped back and forth. While replies are late, the last one read is carried on along its last step
   * to where frame N-1 asked the sim to be, so the car moves with main's clock and the next reply lands where this one
   * drew it, give or take a frame's change of speed. `previous`: frame N-1's blend.
   */
  private drawn_blend(previous: number): number {
    if (this.unread.length < 2 || this.reply_epoch !== this.epoch) return this.reply_blend;
    let steps = 0;
    for (let i = 0; i < this.unread.length - 1; i++) {
      if (this.unread[i] < 0) return this.reply_blend;
      steps += this.unread[i];
    }
    return steps > AHEAD_CAP ? this.reply_blend + AHEAD_CAP : previous + steps;
  }

  /**
   * Main's world already holds every op the journal sent and the mirror every car command, so the commands not yet
   * posted go. The rewind starts empty: it can't step back past the hand-over.
   */
  private fall_back(why: string) {
    console.warn(`Sim worker ${why}, the sim steps on the main thread`);
    this.worker.terminate();
    this.world.journal = null;
    this.commands.length = 0;
    this.replies.length = 0;
    const host = new SimHost(this.world, this.mirror.spec);
    host.car = this.mirror;
    host.from.pos.copy(this.mirror_from.pos);
    host.from.quat.copy(this.mirror_from.quat);
    this.main = new LocalSim(host);
    const { field } = this;
    if (field) host.apply({ type: "field", ...field });
    // After the caller's frame, not inside it: a listener that restarts a run sends commands of its own.
    queueMicrotask(() => this.on_fall_back?.(field !== null));
  }
}
