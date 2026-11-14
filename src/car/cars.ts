export type Drive = "rwd" | "fwd" | "awd";
export type BodyStyle = "hatch" | "coupe" | "muscle" | "rally" | "kaze" | "formula" | "fujin" | "sturm" | "raijin" | "bus" | "tsumuji" | "sajin";
export type Triple = [number, number, number];

/** Engine voice; the limiter cuts in just under `redline`. */
export interface EngineSound {
  cylinders: number;
  /** Pulse level per cylinder in firing order; uneven levels make the lope (a crossplane V8's burble). */
  pulses: number[];
  /** Random per-firing level spread, 0..1; strongest near idle. */
  jitter: number;
  /** Combustion pulse decay; shorter is brighter and harder. */
  pulse_ms: number;
  /** Exhaust resonances, Hz; they rise with rpm and load by `shift`. */
  formants: [number, number, number];
  shift: number;
  /** Muffler low-pass cutoff closed and wide open, Hz. */
  muffler: [number, number];
  drive: number;
  rasp: number;
  intake: number;
  /** Overrun pops and burble, 0..1. */
  crackle: number;
  turbo: number;
}

/** Body-local axes: +x left, +y up, +z forward, metres from the centre of mass. */
export interface CarSpec {
  id: string;
  name: string;
  mass: number;
  inertia: Triple;
  drive: Drive;
  /** Share of drive torque sent to the front axle, 0..1, default 0.5; only read for `awd`. */
  awd_split?: number;
  /** `mounts` order: front left, front right, rear left, rear right. */
  wheel: { radius: number; rest: number; mounts: Triple[] };
  wheelbase: number;
  lock: number;
  spring: number;
  damper: number;
  bump: number;
  /** Most force one strut pushes with, N. */
  strut_max: number;
  arb_front: number;
  arb_rear: number;
  mu: number;
  rear_grip: number;
  /** Wheel load (N) at which tyre grip would fall back to zero; it tops out at half of it and stays flat past that. */
  load_fade: number;
  peak_slip: number;
  peak_angle: number;
  idle: number;
  /** Revs over idle that full throttle holds the engine at while the wheels turn slower: the clutch or converter launch. */
  launch_rpm: number;
  redline: number;
  upshift: number;
  downshift: number;
  gears: number[];
  reverse: number;
  final: number;
  driveline: number;
  engine_inertia: number;
  shift_time: number;
  torque: [number, number][];
  brake_front: number;
  brake_rear: number;
  /** Longitudinal tyre grip multiplier while the brake pedal is down: arcade stopping power that leaves cornering alone. */
  brake_grip: number;
  /** Scale on the stability assist's slide-growing yaw damper: 1 stock, lower lets a slide rotate further before it bites. */
  assist_yaw: number;
  handbrake: number;
  hold: number;
  drag: number;
  downforce: number;
  /** Where downforce acts ahead of the centre of mass, as a share of the wheelbase: 0 presses each axle by its weight share, above 0 loads the front tyres more at speed. */
  aero_front: number;
  /** Share of `downforce` the floor makes, lost with every wheel off the ground, 0..1: jump lines are planned ballistic. */
  ground_effect: number;
  roll_resist: number;
  /** Share of the off-road grip loss and rolling drag the tyres shrug off: 0 road tyres, 1 none at all, below 0 slicks that lose more. */
  offroad: number;
  /** Pitch and roll rate damping with no wheel or corner touching, 1/s; it also levels the body so a crest launch lands on its wheels. 0 flies ballistic. */
  air_settle: number;
  /** How far the body reaches below and above the centre of mass, metres: what a bar or a raised solid has to clear. */
  band: [number, number];
  /** Collision circle offsets along the heading, nose to tail, metres. */
  circles: number[];
  radius: number;
  corners: Triple[];
  /** Spring (N/m) and damper (N·s/m) pushing a body corner back out of the ground. */
  hull: [number, number];
  body: { length: number; width: number; height: number; style: BodyStyle };
  sound: EngineSound;
  /** Boost seconds a full nitro tank holds; absent or 0 without one. */
  nitro?: number;
  /** Tyre grip multipliers on a dirt trail and on any other ground off asphalt, on top of `offroad`; absent is 1. */
  grip_dirt?: number;
  grip_grass?: number;
  /** The car's `mu` on its stock tyres, when a tyre part changed it: loose ground never slides better than stock tyres on asphalt. */
  stock_mu?: number;
}

export type CarId = BodyStyle;

// Floor and roll hoop of the formula car against its centre of mass: its collision corners and its bar band.
const FORMULA_FLOOR = 0.34;
const FORMULA_TOP = 0.55;
const FUJIN_FLOOR = 0.25;

function corners(half_width: number, low: number, high: number, half_length: number): Triple[] {
  return [-half_width, half_width].flatMap((x) => [low, high].flatMap((y) => [-half_length, half_length].map((z): Triple => [x, y, z])));
}

function mounts(half_track: number, y: number, front: number, rear: number): Triple[] {
  return [
    [half_track, y, front],
    [-half_track, y, front],
    [half_track, y, -rear],
    [-half_track, y, -rear],
  ];
}

export const COUPE: CarSpec = {
  id: "coupe",
  name: "Coupe",
  mass: 1350,
  inertia: [2368, 2563, 575],
  drive: "rwd",
  wheel: {
    radius: 0.34,
    rest: 0.35,
    mounts: [
      [0.84, 0.1, 1.3],
      [-0.84, 0.1, 1.3],
      [0.84, 0.1, -1.3],
      [-0.84, 0.1, -1.3],
    ],
  },
  wheelbase: 2.6,
  lock: 0.62,
  spring: 34000,
  damper: 2700,
  bump: 160000,
  strut_max: 40000,
  arb_front: 16000,
  arb_rear: 9000,
  mu: 1.12,
  rear_grip: 1.08,
  load_fade: 32000,
  peak_slip: 0.11,
  peak_angle: 0.1,
  idle: 900,
  launch_rpm: 2600,
  redline: 7300,
  upshift: 6900,
  downshift: 3000,
  gears: [3.3, 2.1, 1.52, 1.17, 0.94, 0.77],
  reverse: 3.2,
  final: 3.7,
  driveline: 0.9,
  engine_inertia: 0.14,
  shift_time: 0.18,
  torque: [
    [0, 180],
    [1000, 210],
    [2500, 330],
    [4500, 420],
    [6000, 405],
    [7000, 345],
    [8000, 280],
  ],
  brake_front: 2300,
  brake_rear: 1200,
  brake_grip: 1.25,
  assist_yaw: 1,
  handbrake: 2000,
  hold: 1500,
  drag: 0.42,
  downforce: 0.9,
  aero_front: 0,
  ground_effect: 0,
  roll_resist: 1.6,
  offroad: 0,
  air_settle: 1.5,
  band: [0.25, 0.9],
  circles: [1.25, -1.25],
  radius: 1.05,
  corners: corners(0.95, -0.3, 0.72, 2.25),
  hull: [140000, 7000],
  body: { length: 4.66, width: 1.9, height: 1.2, style: "coupe" },
  sound: { cylinders: 6, pulses: [1, 0.97, 1, 0.98, 1, 0.96], jitter: 0.05, pulse_ms: 1.1, formants: [170, 540, 1500], shift: 0.3, muffler: [900, 3400], drive: 1.8, rasp: 0.35, intake: 0.6, crackle: 0.25, turbo: 0 },
};

export const HATCH: CarSpec = {
  ...COUPE,
  id: "hatch",
  name: "Hatch",
  air_settle: 2,
  mass: 1050,
  inertia: [1550, 1600, 430],
  drive: "fwd",
  wheel: { radius: 0.31, rest: 0.33, mounts: mounts(0.78, 0.12, 1.15, 1.3) },
  wheelbase: 2.45,
  lock: 0.66,
  spring: 27000,
  damper: 2100,
  arb_front: 8000,
  arb_rear: 15000,
  mu: 1.12,
  rear_grip: 1.03,
  peak_angle: 0.08,
  idle: 850,
  redline: 6900,
  upshift: 6500,
  downshift: 2900,
  gears: [3.5, 2.2, 1.55, 1.18, 0.95, 0.8],
  final: 4.1,
  engine_inertia: 0.1,
  torque: [
    [0, 80],
    [1000, 100],
    [2500, 130],
    [4000, 150],
    [5500, 145],
    [6500, 125],
    [7500, 100],
  ],
  brake_front: 1900,
  brake_rear: 650,
  brake_grip: 1.13,
  handbrake: 1600,
  hold: 1200,
  drag: 0.38,
  downforce: 0.6,
  circles: [1.05, -1.05],
  radius: 0.95,
  corners: corners(0.85, -0.3, 0.75, 1.95),
  body: { length: 3.9, width: 1.72, height: 1.3, style: "hatch" },
  sound: { cylinders: 4, pulses: [1, 0.96, 1, 0.97], jitter: 0.06, pulse_ms: 0.75, formants: [230, 680, 2000], shift: 0.4, muffler: [1100, 5000], drive: 2.4, rasp: 0.55, intake: 0.85, crackle: 0.2, turbo: 0 },
};

export const MUSCLE: CarSpec = {
  ...COUPE,
  id: "muscle",
  name: "Muscle",
  mass: 1650,
  // Pitch is low for the mass on purpose: at ~3300 the car lands rocking when dropped on a 20% slope and rolls away,
  // because the parking hold is divided by the tyre solve's stiffness. Revisit when the P2 parking task fixes that.
  inertia: [2600, 3500, 720],
  wheel: { radius: 0.36, rest: 0.37, mounts: mounts(0.88, 0.1, 1.4, 1.4) },
  wheelbase: 2.8,
  lock: 0.6,
  spring: 24000,
  damper: 2000,
  arb_front: 8000,
  arb_rear: 2000,
  mu: 1.14,
  rear_grip: 1.08,
  peak_angle: 0.13,
  idle: 750,
  redline: 6300,
  upshift: 5900,
  downshift: 2500,
  gears: [2.95, 1.95, 1.42, 1.1, 0.88, 0.72],
  final: 3.2,
  engine_inertia: 0.2,
  torque: [
    [0, 300],
    [1000, 400],
    [2500, 540],
    [3800, 600],
    [5000, 575],
    [6000, 500],
    [7000, 420],
  ],
  brake_front: 2900,
  brake_rear: 1400,
  brake_grip: 1.25,
  handbrake: 2300,
  hold: 1900,
  drag: 0.44,
  downforce: 0.7,
  circles: [1.4, -1.4],
  radius: 1.1,
  corners: corners(1.0, -0.3, 0.7, 2.45),
  body: { length: 5.0, width: 2.0, height: 1.25, style: "muscle" },
  sound: { cylinders: 8, pulses: [1, 0.7, 1.15, 0.82, 0.68, 1.1, 0.78, 1.05], jitter: 0.3, pulse_ms: 2, formants: [90, 250, 700], shift: 0.2, muffler: [450, 1900], drive: 2.6, rasp: 0.4, intake: 0.35, crackle: 0.9, turbo: 0 },
};

export const RALLY: CarSpec = {
  ...COUPE,
  id: "rally",
  name: "Rally",
  mass: 1300,
  inertia: [2250, 2100, 560],
  drive: "awd",
  awd_split: 0.3,
  wheel: { radius: 0.34, rest: COUPE.wheel.rest + 0.04, mounts: mounts(0.82, 0.1, 1.27, 1.27) },
  wheelbase: 2.54,
  lock: 0.64,
  spring: 25000,
  damper: 2300,
  arb_front: 9000,
  arb_rear: 10000,
  mu: 1.08,
  rear_grip: 1.06,
  peak_angle: 0.12,
  redline: 7500,
  upshift: 7100,
  gears: [3.4, 2.3, 1.7, 1.33, 1.08, 0.9],
  final: 4.5,
  torque: [
    [0, 170],
    [1000, 220],
    [2500, 340],
    [4000, 375],
    [5500, 370],
    [7000, 320],
    [8000, 280],
  ],
  brake_front: 2200,
  brake_rear: 1000,
  brake_grip: 1.23,
  handbrake: 2400,
  drag: 0.5,
  downforce: 0.8,
  offroad: 0.8,
  air_settle: 5,
  corners: corners(0.93, -0.34, 0.8, 2.15),
  body: { length: 4.4, width: 1.86, height: 1.38, style: "rally" },
  sound: { cylinders: 4, pulses: [1, 0.9, 1.02, 0.88], jitter: 0.14, pulse_ms: 0.9, formants: [150, 470, 1700], shift: 0.3, muffler: [800, 3800], drive: 3, rasp: 0.9, intake: 0.65, crackle: 0.75, turbo: 1 },
};

// Front-mid V6 sports coupe: short wheelbase, 53/47 split, low CoG and a softer rear tyre, so the throttle holds an angle.
export const KAZE: CarSpec = {
  ...COUPE,
  id: "kaze",
  name: "Kaze",
  air_settle: 2,
  mass: 1450,
  inertia: [2450, 2500, 600],
  wheel: { radius: 0.35, rest: 0.33, mounts: mounts(0.87, 0.1, 1.245, 1.405) },
  wheelbase: 2.65,
  lock: 0.64,
  spring: 39000,
  damper: 3000,
  arb_front: 19000,
  arb_rear: 9500,
  mu: 1.12,
  rear_grip: 1.05,
  idle: 800,
  redline: 7000,
  upshift: 6700,
  downshift: 2900,
  gears: [3.79, 2.32, 1.62, 1.27, 1.0, 0.79],
  reverse: 3.8,
  final: 3.54,
  engine_inertia: 0.15,
  torque: [
    [0, 250],
    [1000, 310],
    [2500, 365],
    [3500, 380],
    [4800, 380],
    [6000, 360],
    [7000, 320],
    [8000, 255],
  ],
  brake_front: 2500,
  brake_rear: 1330,
  brake_grip: 1.28,
  handbrake: 2200,
  hold: 1650,
  drag: 0.42,
  downforce: 0.85,
  circles: [1.15, -1.15],
  radius: 1.05,
  corners: corners(0.97, -0.3, 0.72, 2.12),
  body: { length: 4.26, width: 1.94, height: 1.26, style: "kaze" },
  sound: { cylinders: 6, pulses: [1, 0.93, 1, 0.95, 1, 0.92], jitter: 0.04, pulse_ms: 0.65, formants: [260, 760, 2300], shift: 0.5, muffler: [1300, 6000], drive: 1.4, rasp: 0.2, intake: 0.75, crackle: 0.15, turbo: 0 },
};

// Open-wheel formula car: light, stiff and short-geared, with wings whose grip grows with speed and slicks that hate grass.
export const FORMULA: CarSpec = {
  ...COUPE,
  id: "formula",
  name: "Formula",
  mass: 750,
  inertia: [1250, 1450, 300],
  // The origin rides near the other cars' height because jump lines are planned for it; the floor hangs low below it.
  wheel: { radius: 0.33, rest: 0.18, mounts: mounts(0.8, 0.05, 1.6, 1.45) },
  wheelbase: 3.05,
  lock: 0.55,
  // Springs stiff enough to keep the floor off the road under full downforce; soft bump stops and heavy damping soak up
  // a landing on the short travel instead of bouncing the car back into the air.
  spring: 150000,
  damper: 12000,
  bump: 60000,
  arb_front: 22000,
  arb_rear: 15000,
  mu: 1.2,
  rear_grip: 1.15,
  // Above traction control's 0.14 cut-in: on grass this much power always finds the limit, and rears spun past their
  // peak wandered off line.
  peak_slip: 0.16,
  peak_angle: 0.09,
  idle: 2400,
  redline: 12500,
  upshift: 12000,
  downshift: 7600,
  gears: [2.5, 2.15, 1.9, 1.7, 1.54, 1.43, 1.34],
  reverse: 3.2,
  final: 3.8,
  driveline: 0.92,
  engine_inertia: 0.05,
  shift_time: 0.06,
  torque: [
    [0, 110],
    [2500, 150],
    [5000, 215],
    [8000, 270],
    [10500, 300],
    [12000, 285],
    [13000, 250],
  ],
  brake_front: 1900,
  brake_rear: 1100,
  brake_grip: 1.35,
  handbrake: 1300,
  hold: 1000,
  drag: 0.38,
  downforce: 2.4,
  ground_effect: 1,
  offroad: -0.5,
  air_settle: 4,
  circles: [1.3, -1.3],
  radius: 1.0,
  band: [FORMULA_FLOOR, FORMULA_TOP],
  corners: corners(0.75, -FORMULA_FLOOR, FORMULA_TOP, 2.3),
  body: { length: 4.8, width: 1.95, height: 1.0, style: "formula" },
  sound: { cylinders: 10, pulses: [1, 0.97, 1, 0.96, 1, 0.98, 1, 0.97, 1, 0.96], jitter: 0.03, pulse_ms: 0.4, formants: [380, 1100, 3000], shift: 0.6, muffler: [2200, 9000], drive: 1.6, rasp: 0.3, intake: 0.9, crackle: 0.1, turbo: 0 },
};

// Closed-wheel hybrid prototype, the Legend reward: the formula's grip and more top speed in a heavier, calmer car.
// A front motor takes 40% of the drive, so it launches and exits corners planted where the formula spins its rears.
export const FUJIN: CarSpec = {
  ...FORMULA,
  id: "fujin",
  name: "Fujin",
  mass: 930,
  inertia: [1500, 1750, 380],
  drive: "awd",
  awd_split: 0.4,
  // The origin sits FUJIN_FLOOR over the floor, so the default bar band holds for it.
  wheel: { radius: 0.34, rest: 0.17, mounts: mounts(0.86, 0.08, 1.45, 1.35) },
  wheelbase: 2.8,
  lock: 0.5,
  spring: 120000,
  damper: 10500,
  arb_front: 20000,
  arb_rear: 15000,
  mu: 1.38,
  rear_grip: 1.06,
  peak_slip: 0.16,
  idle: 1500,
  redline: 9000,
  upshift: 8700,
  downshift: 5200,
  gears: [2.9, 2.2, 1.75, 1.45, 1.22, 1.05, 0.92],
  final: 3.85,
  driveline: 0.9,
  engine_inertia: 0.08,
  shift_time: 0.07,
  torque: [
    [0, 280],
    [2000, 410],
    [4000, 560],
    [6000, 650],
    [7500, 630],
    [8700, 535],
    [9500, 450],
  ],
  brake_front: 2700,
  brake_rear: 1700,
  handbrake: 1500,
  hold: 1300,
  drag: 0.36,
  downforce: 3.7,
  ground_effect: 0.8,
  roll_resist: 2.6,
  offroad: -0.6,
  band: COUPE.band,
  circles: [1.3, -1.3],
  radius: 1.05,
  corners: corners(0.98, -FUJIN_FLOOR, 0.62, 2.33),
  body: { length: 4.8, width: 2.0, height: 1.16, style: "fujin" },
  sound: { cylinders: 6, pulses: [1, 0.94, 1, 0.96, 1, 0.93], jitter: 0.04, pulse_ms: 0.5, formants: [300, 900, 2600], shift: 0.55, muffler: [1800, 8000], drive: 1.8, rasp: 0.4, intake: 0.9, crackle: 0.15, turbo: 1 },
};

function shifted(list: Triple[], dz: number): Triple[] {
  return list.map(([x, y, z]): Triple => [x, y, z + dz]);
}

// Rear-engine widebody coupe: 40/60 on a short 2.27 m wheelbase, wide rear tyres for grip, a stiff front bar so lifting
// mid-corner swings the heavy tail out. Torque stays soft below 3000 rpm and the boost lands hard above it.
export const STURM: CarSpec = {
  ...COUPE,
  id: "sturm",
  name: "Sturm",
  mass: 1450,
  inertia: [2300, 2900, 560],
  wheel: {
    radius: 0.34,
    rest: 0.29,
    mounts: [
      [0.85, 0.1, 1.362],
      [-0.85, 0.1, 1.362],
      [0.82, 0.1, -0.908],
      [-0.82, 0.1, -0.908],
    ],
  },
  wheelbase: 2.27,
  lock: 0.63,
  spring: 36000,
  damper: 3400,
  arb_front: 18000,
  arb_rear: 8500,
  mu: 1.15,
  rear_grip: 1.2,
  peak_angle: 0.1,
  idle: 950,
  redline: 6800,
  upshift: 6500,
  downshift: 3400,
  gears: [3.15, 1.79, 1.27, 0.97, 0.76],
  reverse: 3.0,
  final: 3.44,
  engine_inertia: 0.16,
  shift_time: 0.2,
  torque: [
    [0, 150],
    [1000, 180],
    [2500, 230],
    [3100, 290],
    [3800, 490],
    [5000, 500],
    [6000, 465],
    [6800, 410],
    [7500, 330],
  ],
  brake_front: 2400,
  brake_rear: 1600,
  brake_grip: 1.28,
  handbrake: 2100,
  hold: 1650,
  drag: 0.42,
  downforce: 0.95,
  air_settle: 3,
  circles: [1.3, -0.98],
  radius: 1.0,
  corners: shifted(corners(1.03, -0.26, 0.8, 2.14), 0.16),
  body: { length: 4.24, width: 2.1, height: 1.3, style: "sturm" },
  sound: { cylinders: 6, pulses: [1, 0.88, 0.97, 0.9, 1, 0.86], jitter: 0.1, pulse_ms: 1.0, formants: [140, 430, 1250], shift: 0.32, muffler: [800, 3600], drive: 2.2, rasp: 0.7, intake: 0.7, crackle: 0.45, turbo: 1 },
};

// Rally-bred turbo AWD sedan: 58/42 nose-heavy, a 40/60 split and a stiffer rear bar for turn-in, part-gravel tyres.
export const RAIJIN: CarSpec = {
  ...COUPE,
  id: "raijin",
  name: "Raijin",
  mass: 1550,
  inertia: [2700, 2800, 650],
  drive: "awd",
  awd_split: 0.4,
  wheel: { radius: 0.345, rest: 0.31, mounts: mounts(0.82, 0.1, 1.113, 1.537) },
  wheelbase: 2.65,
  lock: 0.64,
  spring: 30000,
  damper: 3100,
  arb_front: 11000,
  arb_rear: 12500,
  mu: 1.13,
  rear_grip: 1.06,
  peak_angle: 0.11,
  idle: 850,
  redline: 7200,
  upshift: 6900,
  downshift: 3200,
  gears: [3.6, 2.37, 1.75, 1.32, 1.01, 0.78],
  reverse: 3.4,
  final: 4.06,
  engine_inertia: 0.13,
  shift_time: 0.15,
  torque: [
    [0, 170],
    [1000, 200],
    [2500, 330],
    [3500, 440],
    [5000, 440],
    [6500, 385],
    [7500, 300],
  ],
  brake_front: 2600,
  brake_rear: 1250,
  brake_grip: 1.27,
  handbrake: 2400,
  hold: 1800,
  drag: 0.46,
  downforce: 0.85,
  offroad: 0.3,
  air_settle: 3,
  circles: [1.0, -1.32],
  radius: 1.08,
  corners: shifted(corners(0.97, -0.3, 0.85, 2.27), -0.155),
  body: { length: 4.57, width: 1.98, height: 1.48, style: "raijin" },
  sound: { cylinders: 4, pulses: [1, 0.95, 1.02, 0.94], jitter: 0.08, pulse_ms: 0.8, formants: [180, 560, 1800], shift: 0.35, muffler: [950, 4400], drive: 2.6, rasp: 0.6, intake: 0.8, crackle: 0.55, turbo: 1 },
};

// City bus: 11.5 t on two axles 5.9 m apart, centre of mass 1.1 m up. Soft springs and thin bars let it lean hard; the
// grip runs out before the roll does, so a steady corner slides it, and a sideways landing or a rail hit can still tip it.
// The tyre and strut limits sit far above a car's because each wheel carries 20-30 kN at rest.
const BUS_FLOOR = 0.8;
const BUS_ROOF = 1.95;

export const BUS: CarSpec = {
  ...COUPE,
  id: "bus",
  name: "Bus",
  mass: 11500,
  inertia: [140000, 145000, 15000],
  wheel: { radius: 0.5, rest: 0.32, mounts: mounts(1.05, -0.49, 3.24, 2.66) },
  wheelbase: 5.9,
  lock: 0.5,
  spring: 137000,
  damper: 26000,
  bump: 900000,
  strut_max: 160000,
  arb_front: 45000,
  arb_rear: 30000,
  mu: 0.9,
  rear_grip: 1.08,
  load_fade: 220000,
  peak_slip: 0.12,
  peak_angle: 0.12,
  idle: 600,
  launch_rpm: 700,
  redline: 2600,
  upshift: 2350,
  downshift: 1150,
  gears: [3.4, 2.0, 1.4, 1.0, 0.8, 0.68],
  reverse: 4.0,
  final: 7.4,
  driveline: 0.88,
  engine_inertia: 0.6,
  shift_time: 0.35,
  torque: [
    [0, 700],
    [600, 900],
    [1000, 1400],
    [1300, 1650],
    [1800, 1650],
    [2200, 1450],
    [2600, 1150],
    [3200, 800],
  ],
  brake_front: 9500,
  brake_rear: 8000,
  brake_grip: 1.15,
  assist_yaw: 1.2,
  handbrake: 9000,
  hold: 12000,
  drag: 3.2,
  downforce: 0.3,
  roll_resist: 14,
  offroad: 0.2,
  air_settle: 4,
  band: [BUS_FLOOR, BUS_ROOF],
  circles: [4.6, 2.3, 0, -2.3, -4.86],
  radius: 1.3,
  corners: shifted(corners(1.25, -BUS_FLOOR, BUS_ROOF, 6.0), -0.16),
  hull: [1200000, 60000],
  body: { length: 12, width: 2.5, height: 3.05, style: "bus" },
  sound: { cylinders: 6, pulses: [1, 0.92, 1, 0.94, 1, 0.9], jitter: 0.12, pulse_ms: 2.6, formants: [70, 210, 560], shift: 0.12, muffler: [300, 1300], drive: 2.4, rasp: 0.45, intake: 0.3, crackle: 0.05, turbo: 1 },
};

// A light hardtop that slides on momentum: even weight, a short wheelbase, lots of lock and little power. A lift mid
// corner swings the tail in on engine braking; the early upshift keeps a 90 km/h lift in 3rd, where that rotation stays
// catchable. The drag keeps it the slowest car in a straight line.
export const TSUMUJI: CarSpec = {
  ...HATCH,
  id: "tsumuji",
  name: "Tsumuji",
  mass: 980,
  inertia: [1300, 1350, 360],
  drive: "rwd",
  wheel: { radius: 0.3, rest: 0.32, mounts: mounts(0.74, 0.12, 1.15, 1.12) },
  wheelbase: 2.27,
  lock: 0.72,
  spring: 25000,
  damper: 2000,
  arb_front: 13000,
  arb_rear: 6500,
  mu: 1.1,
  rear_grip: 1.03,
  peak_angle: 0.1,
  idle: 900,
  redline: 7200,
  upshift: 6300,
  downshift: 3200,
  gears: [3.14, 1.89, 1.33, 1.0, 0.81],
  reverse: 3.76,
  final: 4.3,
  engine_inertia: 0.09,
  torque: [
    [0, 70],
    [1000, 95],
    [2500, 125],
    [4000, 138],
    [5500, 140],
    [6500, 131],
    [7200, 115],
    [8000, 90],
  ],
  brake_front: 1700,
  brake_rear: 800,
  handbrake: 1700,
  hold: 1100,
  drag: 0.42,
  downforce: 0.5,
  circles: [1.0, -1.0],
  radius: 0.92,
  corners: corners(0.84, -0.3, 0.7, 1.97),
  body: { length: 3.95, width: 1.68, height: 1.22, style: "tsumuji" },
  sound: { cylinders: 4, pulses: [1, 0.9, 0.98, 0.92], jitter: 0.06, pulse_ms: 1.3, formants: [190, 600, 1700], shift: 0.3, muffler: [900, 3600], drive: 1.6, rasp: 0.4, intake: 0.7, crackle: 0.2, turbo: 0 },
};

// Sand buggy: rear engine, rear-biased four-wheel drive, 0.5 m of soft travel and knobbly tyres that shrug off loose ground. On tarmac the
// tall, soft body rolls and the tread squirms, so it gives up grip to every road car there. Engine and seats sit on the
// floor pan, so the centre of mass rides 0.46 m up: low enough that a bump at full throttle leans the body without tipping it.
const SAJIN_FLOOR = 0.04;
const SAJIN_TOP = 1.14;
const SAJIN_MOUNT = 0.35;

export const SAJIN: CarSpec = {
  ...COUPE,
  id: "sajin",
  name: "Sajin",
  mass: 950,
  drive: "awd",
  awd_split: 0.25,
  inertia: [1500, 1500, 520],
  wheel: {
    radius: 0.43,
    rest: 0.51,
    mounts: [
      [0.85, SAJIN_MOUNT, 1.5],
      [-0.85, SAJIN_MOUNT, 1.5],
      [0.87, SAJIN_MOUNT, -1.3],
      [-0.87, SAJIN_MOUNT, -1.3],
    ],
  },
  wheelbase: 2.8,
  lock: 0.62,
  spring: 18000,
  damper: 1800,
  arb_front: 5000,
  arb_rear: 4000,
  mu: 1.0,
  rear_grip: 1.06,
  peak_slip: 0.13,
  peak_angle: 0.11,
  idle: 1000,
  launch_rpm: 3500,
  redline: 8000,
  upshift: 7700,
  downshift: 3800,
  gears: [2.8, 1.95, 1.48, 1.18, 0.98],
  reverse: 3.0,
  final: 6.6,
  engine_inertia: 0.1,
  shift_time: 0.14,
  torque: [
    [0, 140],
    [1000, 160],
    [2500, 205],
    [3500, 250],
    [5000, 265],
    [6500, 255],
    [7500, 228],
    [8500, 185],
  ],
  brake_front: 1900,
  brake_rear: 1300,
  brake_grip: 1.15,
  handbrake: 2000,
  hold: 1300,
  drag: 0.9,
  downforce: 0.3,
  roll_resist: 2.4,
  offroad: 0.85,
  air_settle: 4,
  band: [SAJIN_FLOOR, SAJIN_TOP],
  circles: [1.05, -0.88],
  radius: 1.07,
  corners: shifted(corners(1.07, -SAJIN_FLOOR, SAJIN_TOP, 2.03), 0.08),
  body: { length: 4.2, width: 2.14, height: 1.6, style: "sajin" },
  sound: { cylinders: 3, pulses: [1, 0.9, 0.96], jitter: 0.1, pulse_ms: 1.2, formants: [160, 480, 1500], shift: 0.35, muffler: [700, 3200], drive: 2.8, rasp: 0.8, intake: 0.8, crackle: 0.5, turbo: 1 },
};

export const CARS: Record<CarId, CarSpec> = { hatch: HATCH, coupe: COUPE, muscle: MUSCLE, rally: RALLY, kaze: KAZE, sturm: STURM, raijin: RAIJIN, formula: FORMULA, fujin: FUJIN, tsumuji: TSUMUJI, bus: BUS, sajin: SAJIN };

export interface Size {
  length: number;
  width: number;
  height: number;
}

/** The biggest car body, metres: cameras, shadows and spawn lifts were tuned to fit everything up to it. */
const CAR_ENVELOPE: Size = { length: 5, width: 2.1, height: 1.5 };

/** Per axis, how many times the body outgrows `CAR_ENVELOPE`, never under 1, so views tuned for a car leave every car as it was. */
export function oversize(spec: CarSpec): Size {
  const { length, width, height } = spec.body;
  return { length: Math.max(1, length / CAR_ENVELOPE.length), width: Math.max(1, width / CAR_ENVELOPE.width), height: Math.max(1, height / CAR_ENVELOPE.height) };
}

/** Fits inside `CAR_ENVELOPE`: everything planned around a car (jump lines, parking bays) holds for it. */
export function car_sized(spec: CarSpec): boolean {
  const { length, width, height } = oversize(spec);
  return length === 1 && width === 1 && height === 1;
}

export function is_car(id: string): id is CarId {
  return Object.hasOwn(CARS, id);
}

export function car_spec(id: string): CarSpec {
  if (!is_car(id)) throw new Error(`unknown car "${id}", expected one of ${Object.keys(CARS).join(", ")}`);
  return CARS[id];
}
