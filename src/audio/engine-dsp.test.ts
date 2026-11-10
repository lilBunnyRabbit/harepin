/// <reference types="bun" />
import { expect, test } from "bun:test";
import { CARS, type EngineSound } from "../car/cars";
import { type EngineInput, EngineVoice, PITCH } from "./engine-dsp";

const RATE = 48000;

function magnitude(samples: Float32Array, hz: number): number {
  const w = (2 * Math.PI * hz) / RATE;
  let re = 0;
  let im = 0;
  for (let i = 0; i < samples.length; i++) {
    re += samples[i] * Math.cos(w * i);
    im -= samples[i] * Math.sin(w * i);
  }
  return Math.hypot(re, im);
}

test("every engine fires at rpm/60 · cylinders/2 · PITCH, stays bounded and goes quiet on the limiter cut", () => {
  for (const spec of Object.values(CARS)) {
    const voice = new EngineVoice(RATE);
    voice.set_sound(spec.sound);
    const out = new Float32Array(RATE / 2 / PITCH);
    const intake = new Float32Array(128);
    const exhaust = new Float32Array(128);
    for (let i = 0; i + 128 <= out.length; i += 128) {
      voice.render({ rpm: 3000, throttle: 0.6, limit: 0 }, intake, exhaust);
      for (let s = 0; s < 128; s++) out[i + s] = exhaust[s] + intake[s];
    }
    const steady = out.subarray(RATE / 8 / PITCH);
    expect(steady.every((s) => Number.isFinite(s) && Math.abs(s) < 2)).toBe(true);
    const firing = (3000 / 60) * (spec.sound.cylinders / 2) * PITCH;
    // 1.43 sits between cycle orders for 4, 6 and 8 cylinders; 1.37 lands on the crossplane V8's 11th-order lope.
    expect(magnitude(steady, firing)).toBeGreaterThan(5 * magnitude(steady, firing * 1.43));

    let quiet = 0;
    for (let block = 0; block < 300; block++) {
      voice.render({ rpm: spec.redline, throttle: 1, limit: 1 }, intake, exhaust);
      let energy = 0;
      for (let s = 0; s < 128; s++) energy += exhaust[s] ** 2;
      if (Math.sqrt(energy / 128) < 0.01) quiet++;
    }
    expect(quiet).toBeGreaterThan(60);
  }
});

function burble_of(sound: EngineSound, at: (block: number) => EngineInput, blocks: number): Float32Array {
  const voices = [new EngineVoice(RATE), new EngineVoice(RATE)];
  voices[0].set_sound(sound);
  voices[1].set_sound({ ...sound, crackle: 0 });
  const out = new Float32Array(blocks * 128);
  const intake = new Float32Array(128);
  const exhaust = new Float32Array(128);
  for (let block = 0; block < blocks; block++) {
    voices[0].render(at(block), intake, exhaust);
    out.set(exhaust, block * 128);
    voices[1].render(at(block), intake, exhaust);
    for (let s = 0; s < 128; s++) out[block * 128 + s] -= exhaust[s];
  }
  return out;
}

/** Each pop's length until its 5 ms RMS envelope stays 20 dB under the pop's peak. */
function pop_lengths_ms(samples: Float32Array): number[] {
  const W = 240;
  const env: number[] = [];
  for (let i = 0; i + W <= samples.length; i += W) {
    let e = 0;
    for (let s = 0; s < W; s++) e += samples[i + s] ** 2;
    env.push(Math.sqrt(e / W));
  }
  const floor = Math.max(...env) * 0.05;
  const lengths: number[] = [];
  for (let i = 0; i < env.length; i++) {
    if (env[i] < floor) continue;
    let peak = 0;
    let j = i;
    for (let below = 0; j < env.length && below < 2; j++) {
      peak = Math.max(peak, env[j]);
      below = env[j] < peak * 0.1 ? below + 1 : 0;
    }
    lengths.push(((j - 2 - i) * W * 1000) / RATE);
    i = j;
  }
  return lengths;
}

test("overrun burble is sparse rounded low pops with no click, pitched with the car, silent on the limiter", () => {
  for (const spec of Object.values(CARS).filter((car) => car.sound.crackle >= 0.2)) {
    const blocks = Math.floor((3 * RATE) / 128);
    const overrun = burble_of(spec.sound, (block) => ({ rpm: spec.redline - (spec.redline - 2000) * (block / blocks), throttle: 0, limit: 0 }), blocks);
    let body = 0;
    let click = 0;
    let power = 0;
    let weighted = 0;
    const window = overrun.subarray(0, RATE);
    for (let hz = 20; hz <= 8000; hz += 20) {
      const p = magnitude(window, hz) ** 2;
      power += p;
      weighted += hz * p;
      if (hz >= 80 && hz <= 500) body += p;
      if (hz >= 2000) click += p;
    }
    expect(body / power).toBeGreaterThan(0.85);
    expect(click / power).toBeLessThan(0.001);
    expect(weighted / power).toBeGreaterThan(spec.sound.formants[0] * 0.8);
    expect(weighted / power).toBeLessThan(spec.sound.formants[0] * 2);
    const lengths = pop_lengths_ms(overrun).sort((a, b) => a - b);
    expect(lengths.length).toBeGreaterThan(1);
    expect(lengths[0]).toBeGreaterThanOrEqual(20);
    expect(lengths[lengths.length - 1]).toBeLessThan(80);

    const limiter = burble_of(spec.sound, () => ({ rpm: spec.redline, throttle: 1, limit: 1 }), blocks);
    expect(limiter.every((s) => s === 0)).toBe(true);
  }
});
