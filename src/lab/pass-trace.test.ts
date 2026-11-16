import { describe, expect, test } from "bun:test";
import { race_line } from "../ai/line";
import { ring } from "../ai/test-road";
import type { Controls } from "../car/car";
import { line_corners, line_phases, pass_lines_of, PassTrace, Phase, type PassField } from "./pass-trace";

const DT = 1 / 360;
const R = 200;
const road = ring(R);
const line = race_line(road, [], 1);
const N = road.length;
const gas: Controls = { steer: 0, throttle: 1, brake: 0, handbrake: 0, analog: true };
const brakes: Controls = { steer: 0, throttle: 0, brake: 0.5, handbrake: 0, analog: true };

interface Runner {
  /** Metres round the ring from its first point, and m/s. */
  at: number;
  v: number;
  pos: { x: number; z: number };
  vel: { x: number; z: number };
}

const runner = (at: number, v: number): Runner => ({ at, v, pos: { x: 0, z: 0 }, vel: { x: 0, z: 0 } });

function move(car: Runner, dt: number): number {
  car.at += car.v * dt;
  const a = car.at / R;
  car.pos.x = Math.cos(a) * R;
  car.pos.z = Math.sin(a) * R;
  car.vel.x = -Math.sin(a) * car.v;
  car.vel.z = Math.cos(a) * car.v;
  return Math.round(car.at / 2);
}

/** One AI car and the player on the ring; `drive` runs them for `seconds` and keeps the field's road points as the real field does. */
function grid(ai: Runner, you: Runner) {
  const stats = { resets: 0 };
  const field = { line, racers: [{ car: ai, driver: { controls: brakes }, stats }], progress: new Float64Array(2).fill(NaN), t: 0 };
  const seen: PassField = field;
  const trace = new PassTrace(seen);
  const drive = (seconds: number) => {
    for (let k = 0; k < seconds / DT; k++) {
      field.progress[0] = move(ai, DT);
      field.progress[1] = move(you, DT);
      field.t += DT;
      trace.step(you, gas);
    }
  };
  return { trace, drive, stats };
}

const pass_lines = (trace: PassTrace) => trace.lines().filter((l) => l.startsWith(" p "));

describe("pass trace", () => {
  test("a pass the player makes is kept as the cars drew level, with the gap before and after", () => {
    const { trace, drive } = grid(runner(40, 20), runner(20, 25));
    drive(12);
    const [head, ...rest] = trace.lines();
    expect(head).toBe(" passes 1 24 1 1256.6 2");
    expect(rest.filter((l) => l.startsWith(" ft "))).toHaveLength(24);
    const [pass] = pass_lines(trace);
    const word = pass.trim().split(" ");
    expect(word.slice(1, 6)).toEqual(["4", "made", "car=0", "lap=1", "at=120.1"]);
    expect(word).toContain("you=25/0/1/0");
    expect(word).toContain("ai=20/0/0/0.5");
    expect(word).toContain("side=0.6");
    const [before, after] = word.find((w) => w.startsWith("gap="))!.slice(4).split("/").map(Number);
    expect(before).toBeCloseTo(-10, 0);
    expect(after).toBeCloseTo(13, 0);
    expect(pass_lines_of(trace.lines())).toEqual(trace.lines());
  });

  test("a pass the player loses reads the other way", () => {
    const { trace, drive } = grid(runner(20, 25), runner(40, 20));
    drive(8);
    expect(pass_lines(trace)).toHaveLength(1);
    expect(pass_lines(trace)[0]).toContain(" lost car=0 ");
  });

  test("drawing level and dropping back is no pass", () => {
    const you = runner(20, 25);
    const { trace, drive } = grid(runner(40, 20), you);
    drive(4.2);
    you.v = 15;
    drive(4);
    expect(pass_lines(trace)).toHaveLength(0);
  });

  test("an AI car put back, or the player placed or rewound, moves the order without a pass", () => {
    const ai = runner(40, 20);
    const you = runner(20, 20);
    const { trace, drive, stats } = grid(ai, you);
    drive(1);
    ai.at -= 60;
    stats.resets++;
    drive(1);
    you.at -= 100;
    drive(1);
    you.at += 200;
    trace.placed();
    drive(1);
    expect(pass_lines(trace)).toHaveLength(0);
  });
});

describe("line phases", () => {
  const speed = new Float64Array(N).fill(40);
  const bend = new Float64Array(N);
  // A corner at road points 100-130, tightest at 115, braked for from 60 and pulled out of to 170.
  for (let i = 60; i < 115; i++) speed[i] = 40 - (i - 60) * 0.5;
  for (let i = 115; i <= 170; i++) speed[i] = 12.5 + (i - 115) * 0.5;
  for (let i = 100; i <= 130; i++) bend[i] = -1 / (20 + Math.abs(i - 115) * 4);
  const bent = { ...line, speed, bend };
  const names = Object.values(Phase);

  test("a corner reads braking, apex, exit, and the rest straight", () => {
    const phases = line_phases(bent);
    expect([30, 80, 115, 140, 220].map((i) => names[phases[i]])).toEqual([Phase.STRAIGHT, Phase.BRAKING, Phase.APEX, Phase.EXIT, Phase.STRAIGHT]);
  });

  test("a point in the braking zone names the bend it slows for", () => {
    const corners = line_corners(bent);
    expect(1 / corners[80]).toBeCloseTo(-20);
    expect(corners[300]).toBe(0);
  });
});
