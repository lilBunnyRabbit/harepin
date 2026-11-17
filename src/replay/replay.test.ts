/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { GHOST_EVERY_MS, STRIDE, is_lap } from "../car/ghost-cap";
import { Playback, SPEEDS } from "./playback";
import { RunTape } from "./run-tape";

const car = (x: number) => ({ pos: { x, y: 1, z: 0 }, quat: { x: 0, y: 0, z: 0, w: 1 } });

test("a tape takes a frame every 100 ms of stepped time, none while the sim holds, and the run's last pose", () => {
  const tape = new RunTape();
  tape.start();
  for (let i = 0; i < 10; i++) tape.record(0, car(0));
  expect(tape.frames.length).toBe(STRIDE);
  expect(tape.watchable).toBe(false);
  for (let i = 1; i <= 60; i++) tape.record(0.025, car(i));
  expect(tape.frames.length / STRIDE).toBe(1 + Math.floor(1500 / GHOST_EVERY_MS));
  tape.record(0.03, car(61));
  tape.end(car(61));
  expect(tape.end_ms).toBeCloseTo(1530, 6);
  expect(tape.frames[tape.frames.length - STRIDE + 1]).toBe(61);
  expect(is_lap(tape.frames)).toBe(true);
  expect(tape.watchable).toBe(true);
  tape.end(car(62));
  expect(tape.frames[tape.frames.length - STRIDE + 1]).toBe(61);
  tape.start();
  expect(tape.frames.length).toBe(0);
  expect(tape.end_ms).toBe(0);
});

test("a placement mid-run is a cut on the tape: the pose jumps there, it never slides", async () => {
  const THREE = await import("three");
  const { lap_pose } = await import("../car/ghost");
  const tape = new RunTape();
  tape.start();
  tape.record(0, car(0));
  tape.record(0.1, car(3));
  tape.record(0.1, car(500));
  tape.record(0.1, car(503));
  expect(tape.frames.length / STRIDE).toBe(5);
  expect(is_lap(tape.frames)).toBe(true);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  lap_pose(tape.frames, 99, pos, quat);
  expect(pos.x).toBeCloseTo(2.97, 6);
  lap_pose(tape.frames, 150, pos, quat);
  expect(pos.x).toBe(500);
  lap_pose(tape.frames, 250, pos, quat);
  expect(pos.x).toBeCloseTo(501.5, 6);
});

test("playback runs at its speed, pauses on the tape's end and starts over from there", () => {
  const clock = new Playback();
  clock.open(10_000);
  expect(clock.jumped).toBe(true);
  clock.jumped = false;
  clock.advance(1);
  expect(clock.ms).toBe(1000);
  clock.next_speed();
  clock.next_speed();
  expect(clock.speed).toBe(4);
  clock.advance(1);
  expect(clock.ms).toBe(5000);
  clock.next_speed();
  expect(clock.speed).toBe(SPEEDS[0]);
  clock.advance(1);
  expect(clock.ms).toBe(5250);
  clock.toggle();
  clock.advance(1);
  expect(clock.ms).toBe(5250);
  expect(clock.jumped).toBe(false);
  clock.seek(99_000);
  expect(clock.ms).toBe(10_000);
  expect(clock.jumped).toBe(true);
  clock.toggle();
  clock.advance(100);
  expect(clock.paused).toBe(true);
  expect(clock.ms).toBe(10_000);
  clock.toggle();
  expect(clock.paused).toBe(false);
  expect(clock.ms).toBe(0);
});
