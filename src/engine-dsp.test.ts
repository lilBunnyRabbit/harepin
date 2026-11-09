/// <reference types="bun" />
import { expect, test } from "bun:test";
import { CARS } from "./cars";
import { EngineVoice } from "./engine-dsp";

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

test("every engine fires at rpm/60 · cylinders/2, stays bounded and goes quiet on the limiter cut", () => {
  for (const spec of Object.values(CARS)) {
    const voice = new EngineVoice(RATE);
    voice.set_sound(spec.sound);
    const out = new Float32Array(RATE / 2);
    const intake = new Float32Array(128);
    const exhaust = new Float32Array(128);
    for (let i = 0; i + 128 <= out.length; i += 128) {
      voice.render({ rpm: 3000, throttle: 0.6, limit: 0 }, intake, exhaust);
      for (let s = 0; s < 128; s++) out[i + s] = exhaust[s] + intake[s];
    }
    const steady = out.subarray(RATE / 8);
    expect(steady.every((s) => Number.isFinite(s) && Math.abs(s) < 2)).toBe(true);
    const firing = (3000 / 60) * (spec.sound.cylinders / 2);
    expect(magnitude(steady, firing)).toBeGreaterThan(5 * magnitude(steady, firing * 1.37));

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
