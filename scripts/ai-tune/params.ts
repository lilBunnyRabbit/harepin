export interface AiTuning {
  line_grip: number;
  line_brake: number;
  late_brake: number;
  pass_grip: number;
  aim_base: number;
  aim_per: number;
  steer_gain: number;
  steer_damp: number;
  pace: [number, number];
  brake_margin: [number, number];
  aggression: [number, number][];
  mistakes: [number, number][];
}

export const AI_TUNING: AiTuning = {
  line_grip: 6,
  line_brake: 2.5,
  late_brake: 4,
  pass_grip: 1.4,
  aim_base: 7,
  aim_per: 3,
  steer_gain: 3,
  steer_damp: 1,
  pace: [0.96, 1.02],
  brake_margin: [0, 0.8],
  aggression: [[0, 0.6], [0.1, 0.8], [0.2, 1], [0.4, 1], [0.6, 1]],
  mistakes: [[0, 0.1], [0.02, 0.2], [0.05, 0.3], [0.1, 0.4], [0.2, 0.5]],
};

export interface Param {
  name: string;
  lo: number;
  hi: number;
  read: (t: AiTuning) => number;
  write: (t: AiTuning, v: number) => void;
}

const LEVEL = 2;

export const PARAMS: readonly Param[] = [
  { name: "line_grip", lo: 5, hi: 7.5, read: (t) => t.line_grip, write: (t, v) => (t.line_grip = v) },
  { name: "line_brake", lo: 2, hi: 3.5, read: (t) => t.line_brake, write: (t, v) => (t.line_brake = v) },
  { name: "late_brake", lo: 3, hi: 5.5, read: (t) => t.late_brake, write: (t, v) => (t.late_brake = v) },
  { name: "pass_grip", lo: 1.1, hi: 1.7, read: (t) => t.pass_grip, write: (t, v) => (t.pass_grip = v) },
  { name: "aim_base", lo: 4, hi: 12, read: (t) => t.aim_base, write: (t, v) => (t.aim_base = v) },
  { name: "aim_per", lo: 2, hi: 5, read: (t) => t.aim_per, write: (t, v) => (t.aim_per = v) },
  { name: "steer_gain", lo: 1.5, hi: 5, read: (t) => t.steer_gain, write: (t, v) => (t.steer_gain = v) },
  { name: "steer_damp", lo: 0.3, hi: 2, read: (t) => t.steer_damp, write: (t, v) => (t.steer_damp = v) },
  { name: "pace_lo", lo: 0.92, hi: 1, read: (t) => t.pace[0], write: (t, v) => (t.pace[0] = v) },
  { name: "pace_hi", lo: 0.99, hi: 1.06, read: (t) => t.pace[1], write: (t, v) => (t.pace[1] = v) },
  { name: "brake_margin_hi", lo: 0, hi: 1.5, read: (t) => t.brake_margin[1], write: (t, v) => (t.brake_margin[1] = v) },
  { name: "aggression_lo", lo: 0, hi: 0.6, read: (t) => t.aggression[LEVEL][0], write: (t, v) => (t.aggression[LEVEL][0] = v) },
  { name: "aggression_hi", lo: 0.6, hi: 1, read: (t) => t.aggression[LEVEL][1], write: (t, v) => (t.aggression[LEVEL][1] = v) },
  { name: "mistakes_lo", lo: 0, hi: 0.15, read: (t) => t.mistakes[LEVEL][0], write: (t, v) => (t.mistakes[LEVEL][0] = v) },
  { name: "mistakes_hi", lo: 0.15, hi: 0.45, read: (t) => t.mistakes[LEVEL][1], write: (t, v) => (t.mistakes[LEVEL][1] = v) },
];

export type Values = Record<string, number>;

export const defaults = (): Values => Object.fromEntries(PARAMS.map((p) => [p.name, p.read(AI_TUNING)]));

/** Writes `values` over the tuning object; a name not in PARAMS is an error, so a stale run file cannot pass silently. */
export function apply(values: Values) {
  for (const [name, v] of Object.entries(values)) {
    const p = PARAMS.find((q) => q.name === name);
    if (!p) throw new Error(`unknown tuning parameter ${name}`);
    p.write(AI_TUNING, v);
  }
}
