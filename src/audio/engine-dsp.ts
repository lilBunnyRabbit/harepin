import type { EngineSound } from "../car/cars";

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

/** Transposes the whole voice: firing rate, resonances, pulse shape and limiter rhythm. Below 1 the engine fires
 *  slower than its real rpm/60 · cylinders/2 on purpose: at the true rate every preset sounded too high-pitched. */
export const PITCH = 0.5;
const FORMANT_Q = [3.5, 5, 6];
const FORMANT_LEVEL = [1, 0.7, 0.45];
const POP_RATE = 14;
// The crackle is not transposed by PITCH: an octave down through the engine's formants it turned into low thumps.
const POP_DECAY_MS = 2.2;
const POP_HZ = [1800, 5000];
const POP_Q = 1.6;
const POP_CLICK = 0.4;
const POP_LEVEL = 0.75;
const POP_CLUSTER = 0.45;
const POP_GAP_MS = [4, 28];
const LIMITER_CRACKLE = 0.6;
const CUT_ON = 0.04 / PITCH;
const CUT_OFF = 0.06 / PITCH;
const DC_POLE = 1 - 0.003 * PITCH;

function xorshift(x: number): number {
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

// Shared by the AudioWorklet and the offline WAV renderer, so the rendered WAVs are what the game plays.
export class EngineVoice {
  private sound: EngineSound | null = null;
  private seed = 0x2545f491;
  private crackle_seed = 0x6d2b79f5;
  private phase = 0;
  private next = 0;
  private env_decay = 0;
  private env_rise = 0;
  private pop = 0;
  private burst = 0;
  private burst_gap = 0;
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
  private readonly pop_tone = biquad();

  constructor(private readonly rate: number) {}

  set_sound(sound: EngineSound) {
    this.sound = sound;
    this.next = 0;
  }

  private noise(): number {
    this.seed = xorshift(this.seed);
    return (this.seed / 0xffffffff) * 2 - 1;
  }

  /** 0..1 from its own stream, so the crackle never shifts the engine's jitter. */
  private crackle_random(): number {
    this.crackle_seed = xorshift(this.crackle_seed);
    return this.crackle_seed / 0xffffffff;
  }

  private crack() {
    const { rate } = this;
    this.pop = 0.5 + 0.5 * this.crackle_random();
    bandpass(this.pop_tone, rate, POP_HZ[0] + (POP_HZ[1] - POP_HZ[0]) * this.crackle_random(), POP_Q);
    if (this.burst === 0 && this.crackle_random() < POP_CLUSTER) this.burst = 1 + Math.floor(this.crackle_random() * 3);
    else if (this.burst > 0) this.burst--;
    this.burst_gap = Math.round((rate * (POP_GAP_MS[0] + (POP_GAP_MS[1] - POP_GAP_MS[0]) * this.crackle_random())) / 1000);
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
    for (let i = 0; i < 3; i++) bandpass(this.formants[i], rate, sound.formants[i] * shift * PITCH, FORMANT_Q[i]);
    const closed = sound.muffler[0];
    lowpass(this.muffler, rate, (closed + (sound.muffler[1] - closed) * (0.25 * rev + 0.75 * load)) * PITCH, 0.8);
    bandpass(this.intake_tone, rate, (260 + rpm1 * 0.07) * PITCH, 1.6);
    bandpass(this.intake_noise, rate, (700 + rpm1 * 0.18) * PITCH, 1.1);
    bandpass(this.flutter_tone, rate, 1300 * PITCH, 2.5);

    const lifted = thr1 < 0.15 && thr0 >= 0.15;
    const boost_target = thr1 * rev * rev * 1.6;
    if (sound.turbo > 0 && lifted && this.boost > 0.3) this.flutter = this.boost;
    const overrun = thr1 < 0.08 && rpm1 > 1800 && rpm1 <= rpm0 + 5 ? Math.min(1, (rpm1 - 1800) / 2500) : 0;
    const drive = sound.drive * (0.35 + 0.65 * load);
    const norm = Math.tanh(drive);
    const rise = Math.exp(-1 / ((rate * 0.00012) / PITCH));
    const decay = Math.exp(-1 / ((rate * Math.min(sound.pulse_ms / 1000, (120 / rpm1 / sound.cylinders) * 0.45)) / PITCH));
    const pop_decay = Math.exp(-1000 / (rate * POP_DECAY_MS));
    const pop_level = POP_LEVEL * (0.4 + 0.6 * sound.crackle);

    for (let s = 0; s < n; s++) {
      const f = s / n;
      const rpm = rpm0 + (rpm1 - rpm0) * f;
      const thr = thr0 + (thr1 - thr0) * f;
      const cycle_hz = (rpm / 120) * PITCH;
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
      const unburnt = cutting ? Math.max(overrun, LIMITER_CRACKLE) : overrun;
      if (this.burst > 0) {
        if (--this.burst_gap <= 0) this.crack();
      } else if (unburnt > 0 && this.crackle_random() < (POP_RATE * sound.crackle * unburnt) / rate) this.crack();
      this.pop *= pop_decay;
      const spark = this.crackle_random() * 2 - 1;
      const crackle = this.pop * (run(this.pop_tone, spark) + POP_CLICK * spark) * pop_level;
      this.fire += ((cutting ? 0 : 1) - this.fire) * 0.01;

      let x = pulse + sound.rasp * (0.25 + 0.75 * thr) * Math.abs(pulse) * grit;
      const hp = x - this.dc_x + DC_POLE * this.dc_y;
      this.dc_x = x;
      this.dc_y = hp;
      x = hp;
      let y = 0.3 * x;
      for (let i = 0; i < 3; i++) y += FORMANT_LEVEL[i] * run(this.formants[i], x);
      y = Math.tanh(drive * y) / norm;
      exhaust[s] = run(this.muffler, y) * 0.5 + crackle;

      this.boost += (boost_target - this.boost) * 0.0002;
      this.whistle_phase = (this.whistle_phase + ((2600 + this.boost * 4500) * PITCH) / rate) % 1;
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
