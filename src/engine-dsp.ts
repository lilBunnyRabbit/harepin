import type { EngineSound } from "./cars";

/** Per-block engine inputs; the voice ramps between blocks so automation steps never click. */
export interface EngineInput {
  rpm: number;
  throttle: number;
  limit: number;
}

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

function biquad(): Biquad {
  return { b0: 0, b1: 0, b2: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0 };
}

function bandpass(f: Biquad, rate: number, hz: number, q: number) {
  const w = (2 * Math.PI * Math.min(hz, rate * 0.45)) / rate;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  f.b0 = alpha / a0;
  f.b1 = 0;
  f.b2 = -alpha / a0;
  f.a1 = (-2 * Math.cos(w)) / a0;
  f.a2 = (1 - alpha) / a0;
}

function lowpass(f: Biquad, rate: number, hz: number, q: number) {
  const w = (2 * Math.PI * Math.min(hz, rate * 0.45)) / rate;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  f.b0 = (1 - cos) / 2 / a0;
  f.b1 = (1 - cos) / a0;
  f.b2 = f.b0;
  f.a1 = (-2 * cos) / a0;
  f.a2 = (1 - alpha) / a0;
}

function run(f: Biquad, x: number): number {
  const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
  f.x2 = f.x1;
  f.x1 = x;
  f.y2 = f.y1;
  f.y1 = y;
  return y;
}

const FORMANT_Q = [3.5, 5, 6];
const FORMANT_LEVEL = [1, 0.7, 0.45];
const POP_RATE = 14;
const CUT_ON = 0.04;
const CUT_OFF = 0.06;

// Shared by the AudioWorklet and the offline WAV renderer, so the rendered WAVs are what the game plays.
export class EngineVoice {
  private sound: EngineSound | null = null;
  private seed = 0x2545f491;
  private phase = 0;
  private next = 0;
  private env_decay = 0;
  private env_rise = 0;
  private pop = 0;
  private fire = 1;
  private rpm = 900;
  private throttle = 0;
  private cut_clock = 0;
  private boost = 0;
  private flutter = 0;
  private flutter_phase = 0;
  private whistle_phase = 0;
  private dc_x = 0;
  private dc_y = 0;
  private readonly formants = [biquad(), biquad(), biquad()];
  private readonly muffler = biquad();
  private readonly intake_tone = biquad();
  private readonly intake_noise = biquad();
  private readonly flutter_tone = biquad();

  constructor(private readonly rate: number) {}

  set_sound(sound: EngineSound) {
    this.sound = sound;
    this.next = 0;
  }

  private noise(): number {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return (this.seed / 0xffffffff) * 2 - 1;
  }

  /** Fills `intake` and `exhaust` (same length) for one block. */
  render(input: EngineInput, intake: Float32Array, exhaust: Float32Array) {
    const sound = this.sound;
    const n = intake.length;
    if (!sound) {
      intake.fill(0);
      exhaust.fill(0);
      return;
    }
    const { rate } = this;
    const rpm0 = this.rpm;
    const rpm1 = Math.max(300, input.rpm);
    const thr0 = this.throttle;
    const thr1 = Math.max(0, Math.min(1, input.throttle));
    const load = thr1;
    const rev = Math.min(1, rpm1 / 8000);

    const shift = 1 + sound.shift * (0.4 * load + rev);
    for (let i = 0; i < 3; i++) bandpass(this.formants[i], rate, sound.formants[i] * shift, FORMANT_Q[i]);
    const [closed, open] = sound.muffler;
    lowpass(this.muffler, rate, closed + (open - closed) * (0.25 * rev + 0.75 * load), 0.8);
    bandpass(this.intake_tone, rate, 260 + rpm1 * 0.07, 1.6);
    bandpass(this.intake_noise, rate, 700 + rpm1 * 0.18, 1.1);
    bandpass(this.flutter_tone, rate, 1300, 2.5);

    const lifted = thr1 < 0.15 && thr0 >= 0.15;
    const boost_target = thr1 * rev * rev * 1.6;
    if (sound.turbo > 0 && lifted && this.boost > 0.3) this.flutter = this.boost;
    const overrun = thr1 < 0.08 && rpm1 > 1800 && rpm1 <= rpm0 + 5 ? Math.min(1, (rpm1 - 1800) / 2500) : 0;
    const drive = sound.drive * (0.35 + 0.65 * load);
    const norm = Math.tanh(drive);
    const rise = Math.exp(-1 / (rate * 0.00012));
    const decay = Math.exp(-1 / (rate * Math.min(sound.pulse_ms / 1000, (120 / rpm1 / sound.cylinders) * 0.45)));

    for (let s = 0; s < n; s++) {
      const f = s / n;
      const rpm = rpm0 + (rpm1 - rpm0) * f;
      const thr = thr0 + (thr1 - thr0) * f;
      const cycle_hz = rpm / 120;
      this.phase += cycle_hz / rate;

      if (input.limit > 0.5) this.cut_clock = (this.cut_clock + 1 / rate) % (CUT_ON + CUT_OFF);
      else this.cut_clock = 0;
      const cutting = input.limit > 0.5 && this.cut_clock > CUT_ON;

      while (this.phase * sound.cylinders >= this.next + 1) {
        const k = this.next % sound.cylinders;
        this.next++;
        if (cutting) continue;
        const idle_lope = Math.max(0, 1 - rpm / 4000);
        const jitter = 1 + sound.jitter * (0.35 + idle_lope) * this.noise();
        const fuel = overrun > 0 ? 0.18 : 0.3 + 0.7 * thr;
        const amp = sound.pulses[k] * jitter * fuel;
        this.env_decay += amp;
        this.env_rise += amp;
      }
      if (this.phase >= 1) {
        this.phase -= 1;
        this.next -= sound.cylinders;
      }

      this.env_decay *= decay;
      this.env_rise *= rise;
      const pulse = this.env_decay - this.env_rise;
      const grit = this.noise();
      if (overrun > 0 && Math.abs(this.noise()) < (POP_RATE * sound.crackle * overrun) / rate) this.pop = 0.6 + 0.4 * Math.abs(this.noise());
      this.pop *= 0.9975;
      this.fire += ((cutting ? 0 : 1) - this.fire) * 0.01;

      let x = pulse + sound.rasp * (0.25 + 0.75 * thr) * Math.abs(pulse) * grit + this.pop * grit * 1.4;
      const hp = x - this.dc_x + 0.997 * this.dc_y;
      this.dc_x = x;
      this.dc_y = hp;
      x = hp;
      let y = 0.3 * x;
      for (let i = 0; i < 3; i++) y += FORMANT_LEVEL[i] * run(this.formants[i], x);
      y = Math.tanh(drive * y) / norm;
      exhaust[s] = run(this.muffler, y) * 0.5 + this.pop * grit * 0.3 * sound.crackle;

      this.boost += (boost_target - this.boost) * 0.0002;
      this.whistle_phase = (this.whistle_phase + (2600 + this.boost * 4500) / rate) % 1;
      this.flutter *= 0.99993;
      this.flutter_phase = (this.flutter_phase + 17 / rate) % 1;
      const chop = Math.max(0, Math.sin(2 * Math.PI * this.flutter_phase)) ** 3;
      const intake_in = run(this.intake_tone, x) * (0.6 + 0.6 * thr) + run(this.intake_noise, grit) * thr * this.fire * (0.3 + rev) * 0.5 * sound.rasp;
      const turbo = sound.turbo * (Math.sin(2 * Math.PI * this.whistle_phase) * this.boost * 0.05 + run(this.flutter_tone, grit) * this.flutter * chop * 0.9);
      intake[s] = Math.tanh((intake_in + turbo) * 1.5) * 0.35 * sound.intake;
    }
    this.rpm = rpm1;
    this.throttle = thr1;
  }
}
