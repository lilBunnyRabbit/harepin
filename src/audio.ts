export interface SoundFrame {
  rpm: number;
  throttle: number;
  scrub: number;
  speed: number;
  offroad: boolean;
}

function noise_buffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function looped(ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start();
  return source;
}

function drive_curve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private oscillators: OscillatorNode[] = [];
  private body: BiquadFilterNode | null = null;
  private engine: GainNode | null = null;
  private intake: GainNode | null = null;
  private intake_filter: BiquadFilterNode | null = null;
  private squeal: GainNode | null = null;
  private squeal_filter: BiquadFilterNode | null = null;
  private wind: GainNode | null = null;
  private wind_filter: BiquadFilterNode | null = null;
  private gravel: GainNode | null = null;
  private last_rpm = 0;

  start() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.noise = noise_buffer(ctx);
    const master = ctx.createGain();
    master.gain.value = 0.55;
    const limiter = ctx.createDynamicsCompressor();
    master.connect(limiter).connect(ctx.destination);
    this.master = master;

    const shaper = ctx.createWaveShaper();
    shaper.curve = drive_curve(2.5);
    this.body = ctx.createBiquadFilter();
    this.body.type = "lowpass";
    this.body.Q.value = 2;
    this.engine = ctx.createGain();
    this.engine.gain.value = 0;
    shaper.connect(this.body).connect(this.engine).connect(master);
    for (const [type, level] of [
      ["sawtooth", 0.45],
      ["square", 0.3],
      ["sawtooth", 0.18],
      ["triangle", 0.35],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(shaper);
      osc.start();
      this.oscillators.push(osc);
    }

    this.intake_filter = ctx.createBiquadFilter();
    this.intake_filter.type = "bandpass";
    this.intake_filter.Q.value = 1.2;
    this.intake = ctx.createGain();
    this.intake.gain.value = 0;
    looped(ctx, this.noise).connect(this.intake_filter).connect(this.intake).connect(master);

    this.squeal_filter = ctx.createBiquadFilter();
    this.squeal_filter.type = "bandpass";
    this.squeal_filter.frequency.value = 1100;
    this.squeal_filter.Q.value = 9;
    this.squeal = ctx.createGain();
    this.squeal.gain.value = 0;
    looped(ctx, this.noise).connect(this.squeal_filter).connect(this.squeal).connect(master);

    this.wind_filter = ctx.createBiquadFilter();
    this.wind_filter.type = "lowpass";
    this.wind = ctx.createGain();
    this.wind.gain.value = 0;
    looped(ctx, this.noise).connect(this.wind_filter).connect(this.wind).connect(master);

    const rumble = ctx.createBiquadFilter();
    rumble.type = "lowpass";
    rumble.frequency.value = 180;
    this.gravel = ctx.createGain();
    this.gravel.gain.value = 0;
    looped(ctx, this.noise).connect(rumble).connect(this.gravel).connect(master);
  }

  update(frame: SoundFrame) {
    const { ctx } = this;
    if (!ctx || !this.body || !this.engine || !this.intake || !this.intake_filter || !this.squeal || !this.squeal_filter || !this.wind || !this.wind_filter || !this.gravel) return;
    const t = ctx.currentTime;
    const { rpm, throttle, scrub, speed, offroad } = frame;
    const firing = (rpm / 60) * 2;
    const [a, b, c, d] = this.oscillators;
    a.frequency.setTargetAtTime(firing, t, 0.015);
    b.frequency.setTargetAtTime(firing / 2, t, 0.015);
    c.frequency.setTargetAtTime(firing * 1.5, t, 0.015);
    d.frequency.setTargetAtTime(firing / 4, t, 0.015);
    const load = Math.max(throttle, 0.15);
    this.body.frequency.setTargetAtTime(220 + load * 2400 + rpm * 0.18, t, 0.04);
    const limiter = rpm > 7150 && throttle > 0.5 ? 0.55 + Math.random() * 0.45 : 1;
    this.engine.gain.setTargetAtTime((0.05 + load * 0.11) * limiter, t, 0.03);
    this.intake_filter.frequency.setTargetAtTime(400 + rpm * 0.35, t, 0.05);
    this.intake.gain.setTargetAtTime(throttle * (rpm / 7300) * 0.12, t, 0.05);
    this.squeal_filter.frequency.setTargetAtTime(950 + scrub * 450, t, 0.05);
    this.squeal.gain.setTargetAtTime(scrub * 0.5, t, 0.04);
    this.wind_filter.frequency.setTargetAtTime(300 + speed * 18, t, 0.1);
    this.wind.gain.setTargetAtTime(Math.min(0.22, (speed / 70) ** 2 * 0.22), t, 0.1);
    this.gravel.gain.setTargetAtTime(offroad ? Math.min(0.5, speed / 25) * 0.5 : 0, t, 0.08);
    if (this.last_rpm - rpm > 1200 && throttle > 0.3) this.blip(0.05);
    this.last_rpm = rpm;
  }

  private blip(level: number) {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise) return;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    source.connect(filter).connect(gain).connect(master);
    source.start();
    source.stop(ctx.currentTime + 0.1);
  }

  impact(strength: number) {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise || strength < 0.05) return;
    const now = ctx.currentTime;
    const level = Math.min(1, strength) * 0.9;
    const thump = ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(120, now);
    thump.frequency.exponentialRampToValueAtTime(40, now + 0.25);
    const thump_gain = ctx.createGain();
    thump_gain.gain.setValueAtTime(level, now);
    thump_gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    thump.connect(thump_gain).connect(master);
    thump.start();
    thump.stop(now + 0.32);
    const crash = ctx.createBufferSource();
    crash.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400;
    const crash_gain = ctx.createGain();
    crash_gain.gain.setValueAtTime(level * 0.6, now);
    crash_gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    crash.connect(filter).connect(crash_gain).connect(master);
    crash.start();
    crash.stop(now + 0.22);
  }
}
