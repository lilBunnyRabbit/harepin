/**
 * The AI's tuning numbers, in one object so `scripts/ai-tune.ts` can race other values headless by writing over it in
 * its workers. The game only reads it: these defaults are what ships.
 */
export interface AiTuning {
  /**
   * Cornering grip and braking (m/s²) the line plans on, for the stock coupe at pace 1 (`grip_pace` scales other cars).
   * `line_grip` holds in a hairpin (`hairpin_radius` m and tighter), where the driver is already at full lock; it eases up to
   * `fast_grip` in a bend of `fast_radius` m or wider. The coupe holds 0.94 g on the skidpad and stops at 12.9 m/s²; the
   * owner's laps corner at 8 to 8.8 and brake at 8 to 10. Half a metre off the line at most is what these leave for: at
   * 8.2 in hairpins, 9 in fast bends and braking at 8.3, one solo lap in fifteen left the road.
   */
  line_grip: number;
  fast_grip: number;
  line_brake: number;
  /** Braking (m/s²) a driver diving down the inside plans on: it brakes later and harder than the line, into the apex. At 9.1 a dive that touched its car spun. */
  late_brake: number;
  /**
   * Traction (m/s²) and power (m²/s³: acceleration times speed) the line's forward pass lets a car pull out of a bend
   * with. The coupe pulls 5.5 to 30 m/s and 3.4 at 37; with margin, so no car on full throttle runs ahead of its plan.
   */
  line_drive: number;
  line_power: number;
  /** Most load (share of g) a crest takes off the plan: past it the car is near its take-off speed, which on a straight costs nothing. */
  crest_light: number;
  /** Share over the line's grip a passing driver plans its path on: off the line every bend is tighter, and a pass at the line's grip never gets by. */
  pass_grip: number;
  /** Share of the line's grip a driver off the line and not passing plans its path on: that path is the line shifted and clamped, not a relaxed one, and at the line's own grip a car inside a tightening bend at 36 m/s ran off the far side (seed 1). */
  aside_grip: number;
  /** Most grip (m/s²) a pass plans on, whatever the line's: the coupe's skidpad is 9.2, and past this a pass runs wide. */
  pass_max: number;
  /** Road points of aim past the car, plus one per `aim_per` m/s: pure pursuit, as the autopilot steers. */
  aim_base: number;
  aim_per: number;
  /** Wheel per rad the aim sits off where it would on the path, over the wheel the bend itself takes: at 3 a car sat up to 3 m wide of the line through a 200 m bend at 38 m/s and ran off. */
  steer_gain: number;
  /** Share of the wheel a bend takes that the driver holds: a little over, it sits a hand inside its line, where the road is. At 1 the coupe's fields held 4 to 5 spins and resets in 50 seeds, at 1.04 2 to 3. */
  steer_lead: number;
  /** Wheel per rad/s the aim error swings at: without it a fast car fishtails, each catch overshooting the last. */
  steer_damp: number;
  /** Pedal limits of the line driver: the most brake off the line, the most diving down the inside, m/s over the plan before the brake comes on, and m/s of overspeed per unit of pedal. */
  brake_max: number;
  late_pedal: number;
  brake_slack: number;
  brake_per: number;
  /** m/s² one unit of brake pedal slows the coupe by, over what it slows off both pedals: the feed-forward on the profile's slope. */
  brake_gain: number;
  /** Brake eases off by this much per rad of aim error, to 0.2 at most: braking hard with the wheel turned pushes the nose wide. */
  brake_turn: number;
  /** Slip angle (rad) at which the driver is fully off the brake. */
  slide_let_go: number;
  /** Under this target (m/s) a bend is a hairpin and the aim is `aim_hairpin` road points, or it cuts across the inside. */
  hairpin_pace: number;
  aim_hairpin: number;
  /** Bend radii (m) over which the line's grip eases from `line_grip` up to `fast_grip`. */
  hairpin_radius: number;
  fast_radius: number;
  /** Metres of the in-lane width a fully aggressive driver lets a car alongside into before it steers off: doors rub, nobody wrecks. */
  rub: number;
  /** Personality ranges a field draws from: pace share and m/s of brake margin, then aggression and mistakes per owner level 1-5 (H5, H6). */
  pace: [number, number];
  brake_margin: [number, number];
  aggression: [number, number][];
  mistakes: [number, number][];
}

export const AI_TUNING: AiTuning = {
  line_grip: 7.8,
  fast_grip: 8.6,
  line_brake: 6.75,
  late_brake: 7.5,
  line_drive: 6.5,
  line_power: 140,
  crest_light: 0.5,
  pass_grip: 1.4,
  aside_grip: 0.9,
  pass_max: 8.4,
  aim_base: 7,
  aim_per: 3,
  steer_gain: 6.5,
  steer_lead: 1.04,
  steer_damp: 1.25,
  brake_max: 0.95,
  late_pedal: 0.95,
  brake_slack: 0.45,
  brake_per: 2.3,
  brake_gain: 10,
  brake_turn: 1.1,
  slide_let_go: 0.1,
  hairpin_pace: 15,
  aim_hairpin: 5,
  hairpin_radius: 25,
  fast_radius: 80,
  rub: 0.8,
  pace: [0.96, 1.02],
  brake_margin: [0, 0.8],
  aggression: [[0, 0.6], [0.1, 0.8], [0.2, 1], [0.4, 1], [0.6, 1]],
  mistakes: [[0, 0.1], [0.02, 0.2], [0.05, 0.3], [0.1, 0.4], [0.2, 0.5]],
};
