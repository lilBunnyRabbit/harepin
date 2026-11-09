export type Drive = "rwd" | "fwd" | "awd";
export type BodyStyle = "hatch" | "coupe" | "muscle" | "rally" | "kaze";
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
  arb_front: number;
  arb_rear: number;
  mu: number;
  rear_grip: number;
  peak_slip: number;
  peak_angle: number;
  idle: number;
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
  /** Scale on the steer assist's slide-growing yaw damper: 1 stock, lower lets a slide rotate further before it bites. */
  assist_yaw: number;
  handbrake: number;
  hold: number;
  drag: number;
  downforce: number;
  roll_resist: number;
  /** Share of the off-road grip loss and rolling drag the tyres shrug off: 0 road tyres, 1 none at all, below 0 slicks that lose more. */
  offroad: number;
  /** Pitch and roll rate damping with no wheel or corner touching, 1/s; it also levels the body so a crest launch lands on its wheels. 0 flies ballistic. */
  air_settle: number;
  /** Collision circle offsets along the heading (nose, tail), metres. */
  circles: [number, number];
  radius: number;
  corners: Triple[];
  body: { length: number; width: number; height: number; style: BodyStyle };
  sound: EngineSound;
  /** Boost seconds a full nitro tank holds; absent or 0 without one. */
  nitro?: number;
}

export type CarId = BodyStyle;

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
  arb_front: 16000,
  arb_rear: 9000,
  mu: 1.12,
  rear_grip: 1.08,
  peak_slip: 0.11,
  peak_angle: 0.1,
  idle: 900,
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
  roll_resist: 1.6,
  offroad: 0,
  air_settle: 0,
  circles: [1.25, -1.25],
  radius: 1.05,
  corners: corners(0.95, -0.3, 0.72, 2.25),
  body: { length: 4.66, width: 1.9, height: 1.2, style: "coupe" },
  sound: { cylinders: 6, pulses: [1, 0.97, 1, 0.98, 1, 0.96], jitter: 0.05, pulse_ms: 1.1, formants: [170, 540, 1500], shift: 0.3, muffler: [900, 3400], drive: 1.8, rasp: 0.35, intake: 0.6, crackle: 0.25, turbo: 0 },
};

export const HATCH: CarSpec = {
  ...COUPE,
  id: "hatch",
  name: "Hatch",
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

export const CARS: Record<CarId, CarSpec> = { hatch: HATCH, coupe: COUPE, muscle: MUSCLE, rally: RALLY, kaze: KAZE };

export function is_car(id: string): id is CarId {
  return Object.hasOwn(CARS, id);
}

export function car_spec(id: string): CarSpec {
  if (!is_car(id)) throw new Error(`unknown car "${id}", expected one of ${Object.keys(CARS).join(", ")}`);
  return CARS[id];
}
