import type { EngineSound } from "./car/cars";
import { EngineVoice, type EngineInput } from "./engine-dsp";

declare const sampleRate: number;
declare function registerProcessor(name: string, processor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

class EngineProcessor extends AudioWorkletProcessor {
  static parameterDescriptors = [
    { name: "rpm", defaultValue: 900, minValue: 0, maxValue: 12000, automationRate: "k-rate" },
    { name: "throttle", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    { name: "limit", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
  ];

  private readonly voice = new EngineVoice(sampleRate);
  private readonly input: EngineInput = { rpm: 900, throttle: 0, limit: 0 };

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<EngineSound>) => this.voice.set_sound(event.data);
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][], params: Record<string, Float32Array>): boolean {
    const output = outputs[0];
    const intake = output[0];
    const exhaust = output[1];
    const { input } = this;
    input.rpm = params.rpm[0];
    input.throttle = params.throttle[0];
    input.limit = params.limit[0];
    this.voice.render(input, intake, exhaust);
    return true;
  }
}

registerProcessor("engine", EngineProcessor);
