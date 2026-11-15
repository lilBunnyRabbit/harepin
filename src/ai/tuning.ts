/**
 * The AI's tuning numbers, in one object so `scripts/ai-tune.ts` can race other values headless by writing over it in
 * its workers. The game only reads it: these defaults are what ships.
 */
export interface AiTuning {
  /**
   * Cornering grip and braking (m/s²) the line plans on, for the stock coupe at pace 1 (`grip_pace` scales other cars).
   * `line_grip` holds in a hairpin (HAIRPIN_RADIUS m and tighter), where the driver is already at full lock; it eases up to
   * `fast_grip` in a bend of FAST_RADIUS m or wider. The coupe holds 0.94 g on the skidpad: the steering is the limit, and
   * at 6.5 in hairpins, 7.5 in fast bends or braking at 3, cars run wide.
   */
  line_grip: number;
  fast_grip: number;
  line_brake: number;
  /** Braking (m/s²) a driver diving down the inside plans on: it brakes later and harder than the line, into the apex. */
  late_brake: number;
  /** Most load (share of g) a crest takes off the plan: past it the car is near its take-off speed, which on a straight costs nothing. */
  crest_light: number;
  /** Share over the line's grip a passing driver plans its path on: off the line every bend is tighter, and a pass at the line's grip never gets by. */
  pass_grip: number;
  /** Most grip (m/s²) a pass plans on, whatever the line's: the coupe's skidpad is 9.2, and past this a pass runs wide. */
  pass_max: number;
  /** Road points of aim past the car, plus one per `aim_per` m/s: pure pursuit, as the autopilot steers. */
  aim_base: number;
  aim_per: number;
  /** Wheel per rad of aim error: at 3 a car sat up to 3 m wide of the line through a 200 m bend at 38 m/s and ran off. */
  steer_gain: number;
  /** Wheel per rad/s the aim error swings at: without it a fast car fishtails, each catch overshooting the last. */
  steer_damp: number;
  /** Metres of the in-lane width a fully aggressive driver lets a car alongside into before it steers off: doors rub, nobody wrecks. */
  rub: number;
  /** Personality ranges a field draws from: pace share and m/s of brake margin, then aggression and mistakes per owner level 1-5 (H5, H6). */
  pace: [number, number];
  brake_margin: [number, number];
  aggression: [number, number][];
  mistakes: [number, number][];
}

export const AI_TUNING: AiTuning = {
  line_grip: 6,
  fast_grip: 7,
  line_brake: 2.5,
  late_brake: 4,
  crest_light: 0.5,
  pass_grip: 1.4,
  pass_max: 8.4,
  aim_base: 7,
  aim_per: 3,
  steer_gain: 4.5,
  steer_damp: 1,
  rub: 0.8,
  pace: [0.96, 1.02],
  brake_margin: [0, 0.8],
  aggression: [[0, 0.6], [0.1, 0.8], [0.2, 1], [0.4, 1], [0.6, 1]],
  mistakes: [[0, 0.1], [0.02, 0.2], [0.05, 0.3], [0.1, 0.4], [0.2, 0.5]],
};

/** Bank (rad) from which the line plans on the deck's tilt: under it the tyres hold a stopped car, and the flat plan stands (Sky and Rooftops banks). */
export const BANK_STEEP = (40 * Math.PI) / 180;
/** Most a steep bank is taken over its neutral speed: the coupe bottoms out at 1.15 times it on a 65° bank (docs/plan/wall-ride.md). */
export const BANK_OVER = 1.1;
