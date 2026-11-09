import type { EngineSound } from "./cars";
import engine_worklet from "./engine.worklet.ts?worker&url";

export interface SoundFrame {
  rpm: number;
  throttle: number;
  scrub: number;
  speed: number;
  offroad: boolean;
  sound: EngineSound;
  redline: number;
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

const MASTER_GAIN = 0.55;
const ENGINE_GAIN = 0.6;
// Intake sits ahead of the cabin and the exhaust behind it: the near one is louder and brighter, the far one dull.
const VIEW_MIX = {
  chase: { intake: [0.45, 2500], exhaust: [1, 14000] },
  hood: { intake: [1, 9000], exhaust: [0.55, 1800] },
} as const;

export class Audio {
  private volume = 1;
  private muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private engine: AudioWorkletNode | null = null;
  private layers: { gain: GainNode; tone: BiquadFilterNode }[] = [];
  private sound: EngineSound | null = null;
  private cockpit = false;
  private squeal: GainNode | null = null;
  private squeal_filter: BiquadFilterNode | null = null;
  private wind: GainNode | null = null;
  private wind_filter: BiquadFilterNode | null = null;
  private gravel: GainNode | null = null;
  private last_rpm = 0;

  private gain(): number {
    return this.muted ? 0 : MASTER_GAIN * this.volume;
  }

  /** 0..1; kept until `start()` when the context doesn't exist yet. */
  set_volume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    this.master?.gain.setTargetAtTime(this.gain(), this.master.context.currentTime, 0.02);
  }

  set_muted(muted: boolean) {
    this.muted = muted;
    this.master?.gain.setTargetAtTime(this.gain(), this.master.context.currentTime, 0.02);
  }

  /** Hood view puts the listener at the intake, chase view behind the exhaust. */
  set_view(cockpit: boolean) {
    this.cockpit = cockpit;
    this.mix_layers();
  }

  private mix_layers() {
    const { ctx } = this;
    if (!ctx || this.layers.length < 2) return;
    const view = this.cockpit ? VIEW_MIX.hood : VIEW_MIX.chase;
    for (const [layer, [level, cutoff]] of [
      [this.layers[0], view.intake],
      [this.layers[1], view.exhaust],
    ] as const) {
      layer.gain.gain.setTargetAtTime(level * ENGINE_GAIN, ctx.currentTime, 0.1);
      layer.tone.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.1);
    }
  }

  start() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.noise = noise_buffer(ctx);
    const master = ctx.createGain();
    master.gain.value = this.gain();
    const limiter = ctx.createDynamicsCompressor();
    master.connect(limiter).connect(ctx.destination);
    this.master = master;

    // audioWorklet is undefined outside a secure context (LAN http) and on old Safari; the rest of the sound still runs.
    if (ctx.audioWorklet)
      ctx.audioWorklet
        .addModule(engine_worklet)
        .then(() => this.build_engine(ctx, master))
        .catch((error: unknown) => console.warn("engine sound unavailable", error));
    else console.warn("engine sound unavailable: no AudioWorklet");

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

  private build_engine(ctx: AudioContext, master: GainNode) {
    const engine = new AudioWorkletNode(ctx, "engine", { numberOfInputs: 0, outputChannelCount: [2] });
    const split = ctx.createChannelSplitter(2);
    engine.connect(split);
    this.layers = [0, 1].map((channel) => {
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      const gain = ctx.createGain();
      gain.gain.value = 0;
      split.connect(tone, channel).connect(gain).connect(master);
      return { gain, tone };
    });
    this.engine = engine;
    this.sound = null;
    this.mix_layers();
  }

  update(frame: SoundFrame) {
    const { ctx } = this;
    if (!ctx || !this.squeal || !this.squeal_filter || !this.wind || !this.wind_filter || !this.gravel) return;
    const t = ctx.currentTime;
    const { rpm, throttle, scrub, speed, offroad, sound, redline } = frame;
    const { engine } = this;
    if (engine) {
      if (sound !== this.sound) {
        this.sound = sound;
        engine.port.postMessage(sound);
      }
      const params = engine.parameters;
      params.get("rpm")?.setTargetAtTime(rpm, t, 0.012);
      params.get("throttle")?.setTargetAtTime(throttle, t, 0.02);
      params.get("limit")?.setValueAtTime(rpm > redline - 150 && throttle > 0.5 ? 1 : 0, t);
    }
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

  /** Wall hit: the impact thud plus a short metal knock, both scaled by `strength` (impact speed, m/s). */
  bonk(strength: number) {
    const level = Math.min(1, strength / 20);
    this.impact(level);
    const { ctx, master } = this;
    if (!ctx || !master || level < 0.05) return;
    const now = ctx.currentTime;
    for (const [hz, gain, decay] of [
      [410, 0.35, 0.18],
      [1130, 0.2, 0.09],
      [1870, 0.1, 0.05],
    ] as const) this.tone(hz, "triangle", now, gain * level, decay);
  }

  /** Soft two-note chime for a clean pass. */
  chime() {
    const { ctx } = this;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(1318.5, "sine", now, 0.12, 0.35);
    this.tone(1975.5, "sine", now + 0.09, 0.1, 0.5);
  }

  private tone(hz: number, type: OscillatorType, at: number, level: number, decay: number) {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = hz;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + decay + 0.02);
  }
}
