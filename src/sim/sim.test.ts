/// <reference types="bun" />
import { afterAll, describe, expect, test } from "bun:test";
import { Car, type Controls } from "../car/car";
import { COUPE, RALLY } from "../car/cars";
import { personalities } from "../ai/field";
import { World } from "../world/world";
import { WorldJournal } from "../world/world-journal";
import { generate } from "../worldgen/index";
import { slice_tiles } from "../worldgen/tiles";
import { RouteKind } from "../worldgen/types";
import { LocalSim, WorkerSim } from "./sim-client";
import { FrameKind, SimHost, type FrameRequest, type SimCommand } from "./sim-host";
import { packet_size, read_packet, write_packet } from "./sim-packet";

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
    if (k === 700) commands.push({ type: "aids", aids: { tcs: false, abs: true, assist: false, stability: false, auto: true, steer_mode: "hold", drift_full_lock: true } });
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
    write_packet(packet, 3, host.out, host.car, host.from, host.field_cars);
    const mirror = new Car(RALLY);
    const from = { pos: mirror.pos.clone(), quat: mirror.quat.clone() };
    const frame = { ...host.out };
    read_packet(packet, frame, mirror, from, []);
    const again = new Float64Array(packet.length);
    write_packet(again, 3, frame, mirror, from, []);
    expect([...again]).toEqual([...packet]);
    expect(mirror.pos.equals(host.car.pos) && mirror.quat.equals(host.car.quat) && from.pos.equals(host.from.pos)).toBe(true);
    expect(mirror.scrub).toBe(host.car.scrub);
    expect(mirror.forward_speed).toBe(host.car.forward_speed);
  });
});

describe("sim worker", () => {
  const workers: Worker[] = [];
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
    const worker = new Worker(new URL("./sim-worker.ts", import.meta.url), { type: "module" });
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
        write_packet(want, packet[1], local.host.out, local.car, local.from, local.field_cars);
        if (differ < 0 && (want.length !== packet.length || want.some((v, i) => !Object.is(v, packet[i])))) differ = frames;
        frames++;
      }
    };
    await run(script(900));
    world.place(route.closure);
    both({ type: "field", route: route.id, specs: Array.from({ length: FIELD }, () => COUPE), traits: personalities(SEED, FIELD), seed: SEED });
    await run(script(900));
    const p2 = world.road[world.clear_spawn(10)];
    both({ type: "park", x: p2.x, z: p2.z, heading: Math.atan2(p2.tx, p2.tz) });
    both({ type: "swap", spec: RALLY, timed: true, x: p2.x, z: p2.z, heading: 0 });
    await run(script(300));

    expect(differ).toBe(-1);
    expect(local.field_cars.length).toBe(FIELD);
    expect(local.host.field?.racers.some((r) => r.driver.progress > 50)).toBe(true);
    expect(local.car.spec.id).toBe(RALLY.id);
  }, 60_000);
});
