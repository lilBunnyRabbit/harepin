/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { GHOST_EVERY_MS, STRIDE, is_lap } from "../car/ghost-cap";
import { Playback, SPEEDS } from "./playback";
import { DEFAULT_BUILD, build_code } from "../car/build";
import { RunTape, SOUND_STRIDE, on_tape } from "./run-tape";
import { taped_sound } from "./replay-sound";
import type { SoundFrame } from "../audio/audio";
import { COUPE } from "../car/cars";
import { MAX_REPLAYS, MAX_REPLAY_NUMBERS, MAX_SAVED_NUMBERS, MAX_TEXT, capped, pack_replay, parse_replay, watched, type SavedReplay } from "./saved";

const car = (x: number) => ({ pos: { x, y: 1, z: 0 }, quat: { x: 0, y: 0, z: 0, w: 1 }, rpm: 1000 + x * 10, throttle: x % 2, scrub: 0.5, nitro: { boosting: x >= 3 } });
const frame = (): SoundFrame => ({ rpm: 0, throttle: 0, scrub: 0, speed: 0, offroad: false, sound: COUPE.sound, redline: COUPE.redline, boost: false, held: false });

test("a tape takes a frame every 100 ms of stepped time, none while the sim holds, and the run's last pose", () => {
  const tape = new RunTape();
  tape.start("", "");
  for (let i = 0; i < 10; i++) tape.record(0, car(0), null);
  expect(tape.frames.length).toBe(STRIDE);
  expect(tape.watchable).toBe(false);
  for (let i = 1; i <= 60; i++) tape.record(0.025, car(i), null);
  expect(tape.frames.length / STRIDE).toBe(1 + Math.floor(1500 / GHOST_EVERY_MS));
  tape.record(0.03, car(61), null);
  tape.end(car(61), null);
  expect(tape.end_ms).toBeCloseTo(1530, 6);
  expect(tape.frames[tape.frames.length - STRIDE + 1]).toBe(61);
  expect(is_lap(tape.frames)).toBe(true);
  expect(tape.watchable).toBe(true);
  tape.end(car(62), null);
  expect(tape.frames[tape.frames.length - STRIDE + 1]).toBe(61);
  tape.start("", "");
  expect(tape.frames.length).toBe(0);
  expect(tape.end_ms).toBe(0);
});

test("a placement mid-run is a cut on the tape: the pose jumps there, it never slides", async () => {
  const THREE = await import("three");
  const { lap_pose } = await import("../car/ghost");
  const tape = new RunTape();
  tape.start("", "");
  tape.record(0, car(0), null);
  tape.record(0.1, car(3), null);
  tape.record(0.1, car(500), null);
  tape.record(0.1, car(503), null);
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
  expect(tape.sound.length).toBe(5 * SOUND_STRIDE);
  const heard = frame();
  taped_sound(tape, 150, heard);
  expect(heard.rpm).toBe(6000);
  taped_sound(tape, 250, heard);
  expect(heard.rpm).toBeCloseTo(6015, 6);
});

test("the tape plays the player's engine back: rpm and throttle between frames, nitro from the nearer one", () => {
  const tape = new RunTape();
  tape.start("", "");
  for (let i = 0; i <= 4; i++) tape.record(i ? 0.1 : 0, car(i), null);
  expect(tape.sound.length).toBe((tape.frames.length / STRIDE) * SOUND_STRIDE);
  const heard = frame();
  expect(taped_sound(tape, 125, heard)).toBe(true);
  expect([heard.rpm, heard.throttle, heard.scrub, heard.boost]).toEqual([1012.5, 0.75, 0.5, false]);
  taped_sound(tape, 280, heard);
  expect(heard.boost).toBe(true);
  taped_sound(tape, 9999, heard);
  expect(heard.rpm).toBe(1040);
  expect(taped_sound({ frames: tape.frames, field: [], sound: [], end_ms: tape.end_ms }, 100, heard)).toBe(false);
  tape.start("", "");
  expect(tape.sound.length).toBe(0);
});

test("each AI car gets its own lap on the player's clock; one knocked out stops short and leaves the replay there", () => {
  const tape = new RunTape();
  let out = false;
  const rivals = { count: 2, taped: (i: number) => (i === 1 && out ? null : car(10 * (i + 1))) };
  tape.start("Cup", "Race");
  tape.record(0, car(0), rivals);
  tape.record(0.1, car(1), rivals);
  out = true;
  tape.record(0.1, car(2), rivals);
  tape.record(0.1, car(3), rivals);
  tape.end(car(3), rivals);
  expect(tape.field.map((lap) => lap.length / STRIDE)).toEqual([4, 2]);
  expect(tape.field.every(is_lap)).toBe(true);
  expect(tape.field[0][tape.field[0].length - STRIDE]).toBe(tape.end_ms);
  expect([on_tape(tape.field[1], 100), on_tape(tape.field[1], 200), on_tape(tape.field[1], 201), on_tape(tape.field[0], 300)]).toEqual([true, true, false, true]);
  expect([on_tape(undefined, 0), on_tape([], 0)]).toEqual([false, false]);
  tape.start("", "");
  expect(tape.field.length).toBe(0);
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

const META = { id: "a", at: 1000, name: "Harbour sprint", mode: "Race", map: "1A00", place: "Island · Harwar", car: build_code(DEFAULT_BUILD), cars: [build_code(DEFAULT_BUILD), build_code(DEFAULT_BUILD)] };

function saved(at: number, frames = 2): SavedReplay {
  const lap = Array.from({ length: frames }, (_, i) => [i * 100, i, 1, 0, 0, 0, 0, 1]).flat();
  return pack_replay({ frames: lap, field: [], sound: [], end_ms: (frames - 1) * 100 }, { ...META, id: String(at), at, cars: [] });
}

test("a saved replay is a rounded copy of the tape that reads back whole; an AI car with no frames is left out", () => {
  const tape = new RunTape();
  const rivals = { count: 2, taped: (i: number) => (i === 1 ? null : car(10.12345)) };
  tape.start("Harbour sprint", "Race");
  tape.record(0, car(0), rivals);
  tape.record(0.1, car(1.23456), rivals);
  const packed = pack_replay(tape, META);
  expect(packed.field.length).toBe(1);
  expect(packed.lap[STRIDE + 1]).toBe(1.235);
  expect(packed.lap).not.toBe(tape.frames);
  expect(parse_replay(structuredClone(packed))).toEqual(packed);
  const long = pack_replay(tape, { ...META, place: "Island · Harwar · Short, Smooth, Hairpins none, Jumps less, Towns less, Winter, and then some more words" });
  expect(long.place.length).toBe(MAX_TEXT);
  expect(parse_replay(structuredClone(long))).toEqual(long);
  const again = watched(packed);
  expect([again.end_ms, again.field.length, again.frames.length, again.sound.length]).toEqual([100, 1, 2 * STRIDE, 2 * SOUND_STRIDE]);
  expect(packed.sound?.[SOUND_STRIDE]).toBe(1012.346);
});

test("a stored replay with any part out of shape is none", () => {
  const good = saved(1000);
  expect(parse_replay(good)).toEqual(good);
  expect(watched(good).sound).toEqual([]);
  const heard = { ...good, sound: Array.from({ length: 2 * SOUND_STRIDE }, (_, i) => i) };
  expect(parse_replay(heard)).toEqual(heard);
  for (const bad of [[1, 2], [...heard.sound.slice(1), NaN], "loud"]) expect(parse_replay({ ...good, sound: bad })).toBeNull();
  for (const bad of [null, 7, {}, { ...good, id: "" }, { ...good, at: NaN }, { ...good, name: "x".repeat(200) }, { ...good, lap: [1, 2, 3] }, { ...good, lap: good.lap.slice(0, STRIDE) }, { ...good, field: "no" }, { ...good, field: [{ car: "not a car", lap: good.lap }] }, { ...good, field: [{ car: META.car, lap: [NaN] }] }]) expect(parse_replay(bad)).toBeNull();
  const huge = { ...good, field: [{ car: META.car, lap: Array.from({ length: MAX_REPLAY_NUMBERS / STRIDE }, (_, i) => [i, 0, 0, 0, 0, 0, 0, 1]).flat() }] };
  expect(parse_replay(huge)).toBeNull();
});

test("the newest replays keep, up to the count and the size caps; the newest keeps however big", () => {
  const many = Array.from({ length: MAX_REPLAYS + 2 }, (_, i) => saved(i));
  const { keep, drop } = capped(many);
  expect(keep.map((r) => r.at)).toEqual(Array.from({ length: MAX_REPLAYS }, (_, i) => MAX_REPLAYS + 1 - i));
  expect(drop.map((r) => r.at)).toEqual([1, 0]);
  const frames = MAX_SAVED_NUMBERS / STRIDE / 2 - 10;
  const big = capped([saved(1, frames), saved(2, frames), saved(3, frames)]);
  expect(big.keep.map((r) => r.at)).toEqual([3, 2]);
  expect(capped([saved(5, MAX_SAVED_NUMBERS / STRIDE + 8)]).keep.length).toBe(1);
  expect(capped([])).toEqual({ keep: [], drop: [] });
});
