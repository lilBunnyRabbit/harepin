import type { EngineSound } from "../car/cars";
import engine_worklet from "./engine.worklet.ts?worker&url";
import { NITRO, rush_target, type RushTarget } from "./nitro-sound";

export interface SoundFrame {
  rpm: number;
  throttle: number;
  scrub: number;
  speed: number;
  offroad: boolean;
  sound: EngineSound;
  redline: number;
  boost: boolean;
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
  chase: { intake: [0.45, 1250], exhaust: [1, 7000] },
  hood: { intake: [1, 4500], exhaust: [0.55, 900] },
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
  private rush: GainNode | null = null;
  private boost_since: number | null = null;
  private last_whoosh = -Infinity;
  private readonly rush_aim: RushTarget = { level: 0, tau: 1 };
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
    this.sync_running();
  }

  private sync_running() {
    const { ctx } = this;
    if (!ctx) return;
    (document.hidden || this.muted ? ctx.suspend() : ctx.resume()).catch((error: unknown) => console.warn("audio: state change failed", error));
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

  get running() {
    return this.ctx?.state === "running";
  }

  /** Unlocks sound on a user gesture; the graph is already built, so it plays at once. */
  start() {
    if (!this.ctx) this.prepare();
    this.sync_running();
  }

  // Built before any gesture: on phones the worklet fetch and the graph took seconds after the first tap.
  prepare() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    // An installed app keeps running when it's backgrounded on phones, so the engine would keep droning from the pocket.
    document.addEventListener("visibilitychange", () => this.sync_running());
    this.sync_running();
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
    this.squeal_filter.frequency.value = 550;
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
    rumble.frequency.value = 120;
    this.gravel = ctx.createGain();
    this.gravel.gain.value = 0;
    looped(ctx, this.noise).connect(rumble).connect(this.gravel).connect(master);

    const rush_tone = ctx.createBiquadFilter();
    rush_tone.type = "lowpass";
    rush_tone.frequency.value = NITRO.rush_hz;
    rush_tone.Q.value = NITRO.rush_q;
    this.rush = ctx.createGain();
    this.rush.gain.value = 0;
    looped(ctx, this.noise).connect(rush_tone).connect(this.rush).connect(master);
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
    const { rpm, throttle, scrub, speed, offroad, sound, redline, boost } = frame;
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
    this.squeal_filter.frequency.setTargetAtTime(475 + scrub * 225, t, 0.05);
    this.squeal.gain.setTargetAtTime(scrub * 0.5, t, 0.04);
    this.wind_filter.frequency.setTargetAtTime(150 + speed * 9, t, 0.1);
    this.wind.gain.setTargetAtTime(Math.min(0.22, (speed / 70) ** 2 * 0.22), t, 0.1);
    this.gravel.gain.setTargetAtTime(offroad ? Math.min(0.5, speed / 25) * 0.5 : 0, t, 0.08);
    if (boost && this.boost_since === null) {
      const fresh = t - this.last_whoosh >= NITRO.whoosh_gap;
      // A quick re-tap skips the swell too, so tapping the button can't pump the rush.
      this.boost_since = fresh ? t : t - NITRO.rush_settle_at;
      if (fresh) this.whoosh();
    } else if (!boost) this.boost_since = null;
    const aim = rush_target(this.boost_since === null ? null : t - this.boost_since, this.rush_aim);
    this.rush?.gain.setTargetAtTime(aim.level, t, aim.tau);
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
    filter.frequency.value = 1100;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    source.connect(filter).connect(gain).connect(master);
    source.start();
    source.stop(ctx.currentTime + 0.1);
  }

  private whoosh() {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise) return;
    const now = ctx.currentTime;
    this.last_whoosh = now;
    const [low, high, settle] = NITRO.whoosh_hz;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = NITRO.whoosh_q;
    filter.frequency.setValueAtTime(low, now);
    filter.frequency.exponentialRampToValueAtTime(high, now + NITRO.whoosh_rise);
    filter.frequency.exponentialRampToValueAtTime(settle, now + NITRO.whoosh_time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(NITRO.whoosh_peak, now + NITRO.whoosh_attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + NITRO.whoosh_time);
    source.connect(filter).connect(gain).connect(master);
    source.start();
    source.stop(now + NITRO.whoosh_time + 0.05);
  }

  impact(strength: number) {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise || strength < 0.05) return;
    const now = ctx.currentTime;
    const level = Math.min(1, strength) * 0.9;
    const thump = ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(80, now);
    thump.frequency.exponentialRampToValueAtTime(30, now + 0.25);
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
    filter.frequency.value = 700;
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
      [205, 0.35, 0.18],
      [565, 0.2, 0.09],
      [935, 0.1, 0.05],
    ] as const) this.tone(hz, "triangle", now, gain * level, decay);
  }

  chime() {
    const { ctx } = this;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(659.25, "sine", now, 0.12, 0.35);
    this.tone(987.77, "sine", now + 0.09, 0.1, 0.5);
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
