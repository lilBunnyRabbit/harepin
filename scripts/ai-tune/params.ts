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
  { name: "line_grip", lo: 5, hi: 8.5, read: (t) => t.line_grip, write: (t, v) => (t.line_grip = v) },
  { name: "fast_grip", lo: 6, hi: 9.5, read: (t) => t.fast_grip, write: (t, v) => (t.fast_grip = v) },
  { name: "line_brake", lo: 4, hi: 10, read: (t) => t.line_brake, write: (t, v) => (t.line_brake = v) },
  { name: "late_brake", lo: 5, hi: 11.5, read: (t) => t.late_brake, write: (t, v) => (t.late_brake = v) },
  { name: "crest_light", lo: 0.2, hi: 0.8, read: (t) => t.crest_light, write: (t, v) => (t.crest_light = v) },
  { name: "pass_grip", lo: 1.1, hi: 1.7, read: (t) => t.pass_grip, write: (t, v) => (t.pass_grip = v) },
  { name: "pass_max", lo: 7, hi: 9.2, read: (t) => t.pass_max, write: (t, v) => (t.pass_max = v) },
  { name: "aim_base", lo: 4, hi: 12, read: (t) => t.aim_base, whole: true, write: (t, v) => (t.aim_base = v) },
  { name: "aim_per", lo: 2, hi: 5, read: (t) => t.aim_per, write: (t, v) => (t.aim_per = v) },
  { name: "steer_gain", lo: 2.5, hi: 8, read: (t) => t.steer_gain, write: (t, v) => (t.steer_gain = v) },
  { name: "steer_damp", lo: 0.3, hi: 2, read: (t) => t.steer_damp, write: (t, v) => (t.steer_damp = v) },
  { name: "rub", lo: 0, hi: 2, read: (t) => t.rub, write: (t, v) => (t.rub = v) },
  { name: "pace_lo", lo: 0.92, hi: 1, read: (t) => t.pace[0], write: (t, v) => (t.pace[0] = v) },
  { name: "pace_hi", lo: 0.99, hi: 1.06, read: (t) => t.pace[1], write: (t, v) => (t.pace[1] = v) },
  { name: "brake_margin_hi", lo: 0, hi: 1.5, read: (t) => t.brake_margin[1], write: (t, v) => (t.brake_margin[1] = v) },
];

/** The driver's pedal, aim and grip-band limits and the level 3 personality rows: `scripts/ai-ml` searches them, `ai-tune.ts` keeps to PARAMS. */
export const DRIVER_PARAMS: readonly Param[] = [
  { name: "aside_grip", lo: 0.7, hi: 1, read: (t) => t.aside_grip, write: (t, v) => (t.aside_grip = v) },
  { name: "brake_max", lo: 0.3, hi: 1, read: (t) => t.brake_max, write: (t, v) => (t.brake_max = v) },
  { name: "late_pedal", lo: 0.5, hi: 1, read: (t) => t.late_pedal, write: (t, v) => (t.late_pedal = v) },
  { name: "brake_slack", lo: 0.2, hi: 2.5, read: (t) => t.brake_slack, write: (t, v) => (t.brake_slack = v) },
  { name: "brake_per", lo: 2, hi: 15, read: (t) => t.brake_per, write: (t, v) => (t.brake_per = v) },
  { name: "brake_gain", lo: 8, hi: 18, read: (t) => t.brake_gain, write: (t, v) => (t.brake_gain = v) },
  { name: "line_drive", lo: 4, hi: 9, read: (t) => t.line_drive, write: (t, v) => (t.line_drive = v) },
  { name: "line_power", lo: 90, hi: 200, read: (t) => t.line_power, write: (t, v) => (t.line_power = v) },
  { name: "brake_turn", lo: 0, hi: 6, read: (t) => t.brake_turn, write: (t, v) => (t.brake_turn = v) },
  { name: "slide_let_go", lo: 0.06, hi: 0.35, read: (t) => t.slide_let_go, write: (t, v) => (t.slide_let_go = v) },
  { name: "hairpin_pace", lo: 8, hi: 22, read: (t) => t.hairpin_pace, write: (t, v) => (t.hairpin_pace = v) },
  { name: "aim_hairpin", lo: 3, hi: 8, whole: true, read: (t) => t.aim_hairpin, write: (t, v) => (t.aim_hairpin = v) },
  { name: "hairpin_radius", lo: 12, hi: 40, read: (t) => t.hairpin_radius, write: (t, v) => (t.hairpin_radius = v) },
  { name: "fast_radius", lo: 50, hi: 140, read: (t) => t.fast_radius, write: (t, v) => (t.fast_radius = v) },
  { name: "brake_margin_lo", lo: 0, hi: 0.8, read: (t) => t.brake_margin[0], write: (t, v) => (t.brake_margin[0] = v) },
  { name: "aggression3_lo", lo: 0, hi: 0.8, read: (t) => t.aggression[2][0], write: (t, v) => (t.aggression[2][0] = v) },
  { name: "aggression3_hi", lo: 0.3, hi: 1, read: (t) => t.aggression[2][1], write: (t, v) => (t.aggression[2][1] = v) },
  { name: "mistakes3_lo", lo: 0, hi: 0.3, read: (t) => t.mistakes[2][0], write: (t, v) => (t.mistakes[2][0] = v) },
  { name: "mistakes3_hi", lo: 0, hi: 0.8, read: (t) => t.mistakes[2][1], write: (t, v) => (t.mistakes[2][1] = v) },
];

export const ALL_PARAMS: readonly Param[] = [...PARAMS, ...DRIVER_PARAMS];

export const param = (name: string): Param => {
  const p = ALL_PARAMS.find((q) => q.name === name);
  if (!p) throw new Error(`unknown tuning parameter ${name}`);
  return p;
};

export type Values = Record<string, number>;

/** `values` with every whole parameter rounded, as the tuning object must hold them. */
export const whole = (values: Values): Values => Object.fromEntries(Object.entries(values).map(([name, v]) => [name, ALL_PARAMS.find((p) => p.name === name)?.whole ? Math.round(v) : v]));

export const defaults = (): Values => Object.fromEntries(PARAMS.map((p) => [p.name, p.read(AI_TUNING)]));

/** Writes `values` over the tuning object; a name not in ALL_PARAMS is an error, so a stale run file cannot pass silently. */
export function apply(values: Values) {
  for (const [name, v] of Object.entries(whole(values))) param(name).write(AI_TUNING, v);
}
