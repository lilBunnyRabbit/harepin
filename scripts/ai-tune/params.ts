import { AI_TUNING, type AiTuning } from "../../src/ai/tuning";

export interface Param {
  name: string;
  lo: number;
  hi: number;
  /** Whole numbers only: the value indexes road points, and a fraction reads the line between them. */
  whole?: boolean;
  read: (t: AiTuning) => number;
  write: (t: AiTuning, v: number) => void;
}

export const PARAMS: readonly Param[] = [
  { name: "line_grip", lo: 5, hi: 7.5, read: (t) => t.line_grip, write: (t, v) => (t.line_grip = v) },
  { name: "fast_grip", lo: 6, hi: 8.5, read: (t) => t.fast_grip, write: (t, v) => (t.fast_grip = v) },
  { name: "line_brake", lo: 2, hi: 3.5, read: (t) => t.line_brake, write: (t, v) => (t.line_brake = v) },
  { name: "late_brake", lo: 3, hi: 5.5, read: (t) => t.late_brake, write: (t, v) => (t.late_brake = v) },
  { name: "crest_light", lo: 0.2, hi: 0.8, read: (t) => t.crest_light, write: (t, v) => (t.crest_light = v) },
  { name: "pass_grip", lo: 1.1, hi: 1.7, read: (t) => t.pass_grip, write: (t, v) => (t.pass_grip = v) },
  { name: "pass_max", lo: 7, hi: 9.2, read: (t) => t.pass_max, write: (t, v) => (t.pass_max = v) },
  { name: "aim_base", lo: 4, hi: 12, read: (t) => t.aim_base, whole: true, write: (t, v) => (t.aim_base = v) },
  { name: "aim_per", lo: 2, hi: 5, read: (t) => t.aim_per, write: (t, v) => (t.aim_per = v) },
  { name: "steer_gain", lo: 2.5, hi: 6.5, read: (t) => t.steer_gain, write: (t, v) => (t.steer_gain = v) },
  { name: "steer_damp", lo: 0.3, hi: 2, read: (t) => t.steer_damp, write: (t, v) => (t.steer_damp = v) },
  { name: "rub", lo: 0, hi: 1.4, read: (t) => t.rub, write: (t, v) => (t.rub = v) },
  { name: "pace_lo", lo: 0.92, hi: 1, read: (t) => t.pace[0], write: (t, v) => (t.pace[0] = v) },
  { name: "pace_hi", lo: 0.99, hi: 1.06, read: (t) => t.pace[1], write: (t, v) => (t.pace[1] = v) },
  { name: "brake_margin_hi", lo: 0, hi: 1.5, read: (t) => t.brake_margin[1], write: (t, v) => (t.brake_margin[1] = v) },
];

export type Values = Record<string, number>;

/** `values` with every whole parameter rounded, as the tuning object must hold them. */
export const whole = (values: Values): Values => Object.fromEntries(Object.entries(values).map(([name, v]) => [name, PARAMS.find((p) => p.name === name)?.whole ? Math.round(v) : v]));

export const defaults = (): Values => Object.fromEntries(PARAMS.map((p) => [p.name, p.read(AI_TUNING)]));

/** Writes `values` over the tuning object; a name not in PARAMS is an error, so a stale run file cannot pass silently. */
export function apply(values: Values) {
  for (const [name, v] of Object.entries(values)) {
    const p = PARAMS.find((q) => q.name === name);
    if (!p) throw new Error(`unknown tuning parameter ${name}`);
    p.write(AI_TUNING, v);
  }
}
