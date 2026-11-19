/// <reference types="bun" />
import { afterAll, describe, expect, spyOn, test } from "bun:test";
import { Vector3 } from "three";
import { Car, type Controls } from "../car/car";
import { COUPE, RALLY } from "../car/cars";
import { personalities } from "../ai/field";
import { World } from "../world/world";
import { WorldJournal } from "../world/world-journal";
import { generate } from "../worldgen/index";
import { slice_tiles } from "../worldgen/tiles";
import { RouteKind } from "../worldgen/types";
import { LocalSim, open_sim_worker, start_sim, WorkerSim, type SimPort } from "./sim-client";
import { FrameKind, SimHost, type FrameRequest, type SimCommand } from "./sim-host";
import { packet_size, read_packet, write_packet, type SimRequest } from "./sim-packet";

const SEED = 1;
const FIELD = 6;

function controls_at(k: number): Controls {
  return { steer: Math.sin(k / 35) * 0.7, throttle: k % 300 < 220 ? 1 : 0, brake: k % 300 >= 240 ? 0.6 : 0, handbrake: k % 500 > 480 ? 1 : 0, analog: true };
}

function script(frames: number): { request: FrameRequest; commands: SimCommand[] }[] {
  const out: { request: FrameRequest; commands: SimCommand[] }[] = [];
  let now = 0;
  for (let k = 0; k < frames; k++) {
    now += 1000 / 60;
    const kind = k % 400 >= 380 ? FrameKind.REWIND : k % 400 >= 370 ? FrameKind.HOLD : FrameKind.STEP;
    const commands: SimCommand[] = [];
    if (k % 250 === 100) commands.push({ type: "shift", by: -1 });
    if (k % 600 === 300) commands.push({ type: "refill" });
    if (k % 450 === 200) commands.push({ type: "drag", keep: 0.8 });
    if (k === 700) commands.push({ type: "aids", aids: { tcs: false, abs: true, assist: false, stability: false, auto: true, shift_mode: "normal", steer_mode: "hold", drift_full_lock: true } });
    out.push({ request: { kind, steps: kind === FrameKind.STEP ? 5 + (k % 3) : 0, controls: controls_at(k), now, blend: (k % 7) / 7, peers: k % 90 < 30 ? [{ id: "peer", x: 0, y: 0, z: 0 }] : [] }, commands });
  }
  return out;
}

describe("sim packet", () => {
  test("a mirror read from the packet matches the stepped car field for field", () => {
    const world = new World(SEED);
    const host = new SimHost(world, RALLY);
    const p = world.road[world.clear_spawn(0)];
    host.apply({ type: "park", x: p.x, z: p.z, heading: Math.atan2(p.tx, p.tz) });
    for (const { request } of script(200)) host.frame(request);
    const packet = new Float64Array(packet_size(host.car, host.field_cars));
    write_packet(packet, 3, host.out, host.car, host.from, host.field_cars, host.field_from, host.field_progress);
    const mirror = new Car(RALLY);
    const from = { pos: mirror.pos.clone(), quat: mirror.quat.clone() };
    const frame = { ...host.out };
    read_packet(packet, frame, mirror, from, [], [], new Float64Array(0));
    const again = new Float64Array(packet.length);
    write_packet(again, 3, frame, mirror, from, [], [], new Float64Array(0));
    expect([...again]).toEqual([...packet]);
    expect(mirror.pos.equals(host.car.pos) && mirror.quat.equals(host.car.quat) && from.pos.equals(host.from.pos)).toBe(true);
    expect(mirror.scrub).toBe(host.car.scrub);
    expect(mirror.forward_speed).toBe(host.car.forward_speed);
  });

  test("each AI car's pose before the frame's last step rides along, and a held frame draws the field where it stands", () => {
    const world = new World(SEED);
    const route = world.routes.find((r) => r.kind === RouteKind.CIRCUIT);
    if (!route) throw new Error(`seed ${SEED} has no circuit`);
    world.place(route.closure);
    const host = new SimHost(world, COUPE);
    host.apply({ type: "field", route: route.id, specs: [COUPE, COUPE], traits: personalities(SEED, 2), seed: SEED, laps: 1 });
    const steps = script(120).filter(({ request }) => request.kind === FrameKind.STEP);
    for (const { request } of steps) host.frame(request);
    const [car] = host.field_cars;
    const before = host.field_from[0].pos.clone();
    expect(before.distanceTo(car.pos)).toBeGreaterThan(0);
    expect(before.distanceTo(car.pos)).toBeLessThan(0.2);
    const packet = new Float64Array(packet_size(host.car, host.field_cars));
    write_packet(packet, 0, host.out, host.car, host.from, host.field_cars, host.field_from, host.field_progress);
    const mirrors = [new Car(COUPE), new Car(COUPE)];
    const froms = mirrors.map((m) => ({ pos: m.pos.clone(), quat: m.quat.clone() }));
    read_packet(packet, { ...host.out }, new Car(COUPE), { pos: new Car(COUPE).pos, quat: new Car(COUPE).quat }, mirrors, froms, new Float64Array(3));
    expect(froms[0].pos.equals(before) && mirrors[0].pos.equals(car.pos)).toBe(true);
    host.frame({ ...steps[0].request, kind: FrameKind.HOLD, steps: 0 });
    expect(host.field_from[0].pos.equals(car.pos)).toBe(true);
  });
});

describe("nitro and the AI field", () => {
  const world = new World(SEED);
  const circuit = world.routes.find((r) => r.kind === RouteKind.CIRCUIT);
  if (!circuit) throw new Error(`seed ${SEED} has no circuit`);
  const route = circuit;
  world.place(route.closure);
  const spec = { ...COUPE, nitro: 4 };
  const gas: Controls = { steer: 0, throttle: 1, brake: 0, handbrake: 0, analog: true, nitro: true };

  function drive(field: boolean): { host: SimHost; boosted: boolean } {
    const host = new SimHost(world, spec);
    const p = route.points[0];
    host.apply({ type: "park", x: p.x, z: p.z, heading: Math.atan2(p.tx, p.tz) });
    if (field) host.apply({ type: "field", route: route.id, specs: [COUPE], traits: personalities(SEED, 1), seed: SEED, laps: 1 });
    let boosted = false;
    for (let k = 0; k < 180; k++) {
      host.frame({ kind: FrameKind.STEP, steps: 6, controls: gas, now: k * 1000 / 60, blend: 0, peers: [] });
      boosted ||= host.car.nitro.boosting;
    }
    return { host, boosted };
  }

  test("free roam and a lobby race, with no AI field: the nitro input burns the tank", () => {
    const { host, boosted } = drive(false);
    expect(host.car.nitro.usable).toBe(true);
    expect(boosted).toBe(true);
    expect(host.car.nitro.fill).toBeLessThan(4);
  });

  test("an AI race: the nitro input does nothing, the tank stays as it was and the HUD hides it", () => {
    const { host, boosted } = drive(true);
    expect(host.car.nitro.usable).toBe(false);
    expect(boosted).toBe(false);
    expect(host.car.nitro.fill).toBe(4);
    host.apply({ type: "field_stop" });
    host.frame({ kind: FrameKind.HOLD, steps: 0, controls: gas, now: 0, blend: 0, peers: [] });
    expect(host.car.nitro.usable).toBe(true);
  });
});

describe("sim worker", () => {
  const workers: SimPort[] = [];
  afterAll(() => {
    for (const w of workers) w.terminate();
  });

  test("a solo drive and a 6-car field step bit-identically on main and through the worker", async () => {
    const data = generate(SEED);
    const journal = new WorldJournal();
    const world = new World(SEED, data, []);
    world.journal = journal;
    const plan = structuredClone(data);
    slice_tiles(data.terrain).forEach((tile, index) => {
      world.tiles.add(index, tile);
      journal.tile(index, tile);
    });
    const local = new LocalSim(new SimHost(world, COUPE));
    const worker = await open_sim_worker();
    if (!worker) throw new Error("the sim worker did not start");
    workers.push(worker);
    const remote = WorkerSim.start(worker, world, plan, journal, COUPE);
    let reply: (packet: Float64Array) => void = () => {};
    worker.addEventListener("message", (event: MessageEvent<Float64Array>) => reply(event.data));
    const both = (command: SimCommand) => {
      local.send(command);
      remote.send(command);
    };
    const route = world.routes.find((r) => r.kind === RouteKind.CIRCUIT);
    if (!route) throw new Error(`seed ${SEED} has no circuit`);
    const p = world.road[world.clear_spawn(-40)];
    both({ type: "place", x: p.x, y: world.height(p.x, p.z) + 1, z: p.z, heading: Math.atan2(p.tx, p.tz) });

    let frames = 0;
    let differ = -1;
    const run = async (steps: ReturnType<typeof script>) => {
      for (const { request, commands } of steps) {
        for (const command of commands) both(command);
        const answer = new Promise<Float64Array>((resolve) => (reply = resolve));
        local.frame(request);
        remote.frame(request);
        const packet = await answer;
        const want = new Float64Array(packet_size(local.car, local.field_cars));
        write_packet(want, packet[1], local.host.out, local.car, local.from, local.field_cars, local.field_from, local.field_progress);
        if (differ < 0 && (want.length !== packet.length || want.some((v, i) => !Object.is(v, packet[i])))) differ = frames;
        frames++;
      }
    };
    await run(script(900));
    world.place(route.closure);
    both({ type: "field", route: route.id, specs: Array.from({ length: FIELD }, () => COUPE), traits: personalities(SEED, FIELD), seed: SEED, laps: 2 });
    await run(script(450));
    both({ type: "field_seen", mask: 0 });
    await run(script(450));
    const p2 = world.road[world.clear_spawn(10)];
    both({ type: "park", x: p2.x, z: p2.z, heading: Math.atan2(p2.tx, p2.tz) });
    both({ type: "swap", spec: RALLY, timed: true, x: p2.x, z: p2.z, heading: 0 });
    await run(script(300));
    const progress = [...local.field_progress];
    both({ type: "field_stop" });
    await run(script(60));

    expect(differ).toBe(-1);
    expect(progress).toHaveLength(FIELD + 1);
    expect(progress.every(Number.isFinite)).toBe(true);
    expect(local.field_cars).toHaveLength(0);
    expect(Math.max(...progress.slice(0, FIELD))).toBeGreaterThan(50);
    expect(local.car.spec.id).toBe(RALLY.id);
  }, 60_000);
});

/** Steps a host on its own world as the sim worker does, replying in the same task; from frame `fail_at` on it errors or goes silent. */
class FailingWorker extends EventTarget {
  terminated = false;
  /** While set, replies wait for `release`, as a busy worker's land after main's next frame has started. */
  late = false;
  private readonly held: Float64Array[] = [];
  private host: SimHost | null = null;
  private frames = 0;

  constructor(
    private readonly fail_at: number,
    private readonly how: "error" | "silent",
  ) {
    super();
  }

  postMessage(request: SimRequest) {
    if (request.type === "init") {
      this.host = new SimHost(new World(request.seed, structuredClone(request.plan), undefined, request.levels), request.spec);
      return;
    }
    if (!this.host) throw new Error("a frame before init");
    if (this.frames++ >= this.fail_at) {
      if (this.how === "error") this.dispatchEvent(new ErrorEvent("error", { message: "boom" }));
      return;
    }
    for (const command of request.commands) this.host.apply(command);
    const frame = this.host.frame(request.frame);
    const out = new Float64Array(packet_size(this.host.car, this.host.field_cars));
    write_packet(out, request.epoch, frame, this.host.car, this.host.from, this.host.field_cars, this.host.field_from, this.host.field_progress);
    if (this.late) this.held.push(out);
    else this.dispatchEvent(new MessageEvent("message", { data: out }));
  }

  release() {
    for (const data of this.held.splice(0)) this.dispatchEvent(new MessageEvent("message", { data }));
  }

  terminate() {
    this.terminated = true;
  }
}

describe("sim worker failure", () => {
  const data = generate(SEED);
  const gas: Controls = { steer: 0, throttle: 1, brake: 0, handbrake: 0, analog: true };
  const step = (k: number): FrameRequest => ({ kind: FrameKind.STEP, steps: 6, controls: gas, now: (k * 1000) / 60, blend: 0, peers: [] });

  function failing(fail_at: number, how: "error" | "silent") {
    const world = new World(SEED, data);
    world.journal = new WorldJournal();
    const worker = new FailingWorker(fail_at, how);
    const sim = WorkerSim.start(worker, world, data, world.journal, COUPE, { ms: 0, frames: 5 });
    const p = world.road[world.clear_spawn(0)];
    sim.send({ type: "park", x: p.x, z: p.z, heading: Math.atan2(p.tx, p.tz) });
    return { world, worker, sim };
  }

  function drive(sim: WorkerSim, from: number, frames: number): number[] {
    const moved: number[] = [];
    for (let k = from; k < from + frames; k++) {
      const before = sim.car.pos.clone();
      sim.frame(step(k));
      moved.push(before.distanceTo(sim.car.pos));
    }
    return moved;
  }

  test.each(["error", "silent"] as const)("a worker that turns %s mid-drive hands the car to main, which drives on from where it stood", (how) => {
    const { world, worker, sim } = failing(60, how);
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const before = drive(sim, 0, 60);
    expect(sim.on_main).toBe(false);
    const mirror = sim.car;
    const after = drive(sim, 60, 60);
    const warned = warn.mock.calls.length;
    warn.mockRestore();
    expect(sim.on_main).toBe(true);
    expect(sim.car).toBe(mirror);
    expect(worker.terminated).toBe(true);
    expect(world.journal).toBeNull();
    expect(warned).toBe(1);
    const pace = Math.max(...before.slice(-10));
    expect(pace).toBeGreaterThan(0.05);
    expect(Math.max(...after.slice(0, 10))).toBeLessThan(pace * 1.5);
    expect(after.slice(-10).every((m) => m > pace * 0.5)).toBe(true);
  });

  test("replies landing every other frame in pairs still draw the car moving a frame's way each frame, never standing or jumping back", () => {
    const on_time = failing(Number.POSITIVE_INFINITY, "silent");
    const late = failing(Number.POSITIVE_INFINITY, "silent");
    on_time.worker.late = true;
    late.worker.late = true;
    const drawn = (of: WorkerSim, into: Vector3) => into.lerpVectors(of.from.pos, of.car.pos, of.blend);
    const want = new Vector3();
    const was = new Vector3();
    const got = new Vector3();
    const off: number[] = [];
    const moved: number[] = [];
    const steady: number[] = [];
    let acc = 0;
    for (let k = 0; k < 120; k++) {
      acc += 6.5;
      const request = { ...step(k), steps: Math.floor(acc), blend: acc % 1 };
      acc %= 1;
      on_time.worker.release();
      if (k < 60 || k % 2 === 1) late.worker.release();
      drawn(late.sim, was);
      on_time.sim.frame(request);
      late.sim.frame(request);
      if (k < 64) continue;
      const step_of = drawn(late.sim, got).distanceTo(was);
      off.push(got.distanceTo(drawn(on_time.sim, want)) / step_of);
      if (moved.length) steady.push(step_of / moved[moved.length - 1]);
      moved.push(step_of);
    }
    expect(late.sim.on_main).toBe(false);
    expect(Math.min(...moved)).toBeGreaterThan(0.05);
    expect(Math.max(...off)).toBeLessThan(0.05);
    expect(Math.min(...steady)).toBeGreaterThan(0.9);
    expect(Math.max(...steady)).toBeLessThan(1.1);
  });

  test("an AI field running when the worker fails starts again from its grid on main, and main hears so", async () => {
    const { world, sim } = failing(80, "error");
    const route = world.routes.find((r) => r.kind === RouteKind.CIRCUIT);
    if (!route) throw new Error(`seed ${SEED} has no circuit`);
    world.place(route.closure);
    sim.send({ type: "field", route: route.id, specs: [COUPE, COUPE], traits: personalities(SEED, 2), seed: SEED, laps: 2 });
    const heard: boolean[] = [];
    sim.on_fall_back = (field) => heard.push(field);
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    drive(sim, 0, 120);
    warn.mockRestore();
    await Promise.resolve();
    expect(heard).toEqual([true]);
    expect(sim.field_cars).toHaveLength(2);
    expect([...sim.field_progress].every(Number.isFinite)).toBe(true);
  });

  test("a worker refused or silent at start leaves the sim on main, and the world keeps no journal", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const refused = await open_sim_worker(() => {
      throw new Error("refused");
    });
    const silent = new FailingWorker(0, "silent");
    const quiet = await open_sim_worker(() => silent, 10);
    warn.mockRestore();
    expect(refused).toBeNull();
    expect(quiet).toBeNull();
    expect(silent.terminated).toBe(true);
    const world = new World(SEED, data);
    world.journal = new WorldJournal();
    const sim = start_sim(quiet, world, data, world.journal, COUPE);
    expect(sim).toBeInstanceOf(LocalSim);
    expect(world.journal).toBeNull();
  });
});
