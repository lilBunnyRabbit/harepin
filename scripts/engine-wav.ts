import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CARS } from "../src/cars";
import { EngineVoice, PITCH, type EngineInput } from "../src/engine-dsp";

const RATE = 48000;
const BLOCK = 128;
const out_dir = process.argv[2] ?? "dist-audio";
mkdirSync(out_dir, { recursive: true });

function render(id: keyof typeof CARS, seconds: number, at: (t: number) => EngineInput, intake_mix: number): Float32Array {
  const voice = new EngineVoice(RATE);
  voice.set_sound(CARS[id].sound);
  const out = new Float32Array(Math.floor((seconds * RATE) / BLOCK) * BLOCK);
  const intake = new Float32Array(BLOCK);
  const exhaust = new Float32Array(BLOCK);
  for (let i = 0; i < out.length; i += BLOCK) {
    voice.render(at(i / RATE), intake, exhaust);
    for (let s = 0; s < BLOCK; s++) out[i + s] = exhaust[s] + intake[s] * intake_mix;
  }
  return out;
}

function sweep(id: keyof typeof CARS): (t: number) => EngineInput {
  const { idle, redline } = CARS[id];
  let rpm = idle;
  let last = 0;
  return (t) => {
    const dt = t - last;
    last = t;
    if (t < 1.5) return { rpm: idle, throttle: 0, limit: 0 };
    if (t < 5.5) return { rpm: idle + (redline - idle) * ((t - 1.5) / 4) ** 0.8, throttle: 1, limit: 0 };
    if (t < 6.5) return { rpm: redline - 60 + 60 * Math.sin(t * 90), throttle: 1, limit: 1 };
    if (t < 6.5 + dt * 1.5) rpm = redline;
    const blip = (t > 9 && t < 9.25) || (t > 10 && t < 10.25);
    rpm += blip ? (4800 - rpm) * dt * 9 : (idle - rpm) * dt * 0.9;
    return { rpm, throttle: blip ? 1 : 0, limit: 0 };
  };
}

function wav(path: string, samples: Float32Array) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const gain = 0.89 / Math.max(peak, 1e-6);
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + samples.length * 2, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(RATE, 24);
  data.writeUInt32LE(RATE * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(samples[i] * gain * 32767), 44 + i * 2);
  writeFileSync(path, data);
  return peak;
}

function magnitude(samples: Float32Array, hz: number): number {
  const w = (2 * Math.PI * hz) / RATE;
  let re = 0;
  let im = 0;
  for (let i = 0; i < samples.length; i++) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (samples.length - 1));
    re += samples[i] * hann * Math.cos(w * i);
    im -= samples[i] * hann * Math.sin(w * i);
  }
  return Math.hypot(re, im);
}

for (const id of Object.keys(CARS) as (keyof typeof CARS)[]) {
  const { cylinders } = CARS[id].sound;
  for (const [view, mix] of [["chase", 0.5], ["hood", 1.6]] as const) wav(join(out_dir, `${id}-${view}.wav`), render(id, 11, sweep(id), mix));
  const rpm = 3000;
  const steady = render(id, 1, () => ({ rpm, throttle: 0.6, limit: 0 }), 0.5).subarray(RATE / 4);
  const firing = (rpm / 60) * (cylinders / 2) * PITCH;
  const bins: [number, number][] = [];
  for (let hz = 10; hz <= 1200; hz += 2.5) bins.push([hz, magnitude(steady, hz)]);
  const peaks = bins.filter(([, m], i) => i > 0 && i < bins.length - 1 && m > bins[i - 1][1] && m >= bins[i + 1][1]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const top = peaks[0][1];
  const order = (hz: number) => (hz / ((rpm / 120) * PITCH)).toFixed(1);
  console.log(`${id.padEnd(7)} firing ${firing.toFixed(0)} Hz at ${rpm} rpm (cycle order ${cylinders}); peaks ${peaks.map(([hz, m]) => `${hz.toFixed(0)} Hz (order ${order(hz)}, ${(20 * Math.log10(m / top)).toFixed(0)} dB)`).join(", ")}`);
}
console.log(`wrote ${out_dir}/<car>-chase.wav and <car>-hood.wav`);
