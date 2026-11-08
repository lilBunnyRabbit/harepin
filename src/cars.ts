export type Drive = "rwd" | "fwd" | "awd";
export type BodyStyle = "hatch" | "coupe" | "muscle" | "rally";
export type Triple = [number, number, number];

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
  handbrake: number;
  hold: number;
  drag: number;
  downforce: number;
  roll_resist: number;
  /** Share of the off-road grip loss and rolling drag the tyres shrug off: 0 road tyres, 1 none at all. */
  offroad: number;
  /** Collision circle offsets along the heading (nose, tail), metres. */
  circles: [number, number];
  radius: number;
  corners: Triple[];
  body: { length: number; width: number; height: number; style: BodyStyle };
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
  brake_rear: 850,
  handbrake: 2000,
  hold: 1500,
  drag: 0.42,
  downforce: 0.9,
  roll_resist: 1.6,
  offroad: 0,
  circles: [1.25, -1.25],
  radius: 1.05,
  corners: corners(0.95, -0.3, 0.72, 2.25),
  body: { length: 4.66, width: 1.9, height: 1.2, style: "coupe" },
};

export const HATCH: CarSpec = {
  ...COUPE,
  id: "hatch",
  name: "Hatch",
  mass: 1050,
  inertia: [1550, 1700, 430],
  drive: "fwd",
  wheel: { radius: 0.31, rest: 0.33, mounts: mounts(0.78, 0.12, 1.15, 1.3) },
  wheelbase: 2.45,
  lock: 0.66,
  spring: 27000,
  damper: 2100,
  arb_front: 11000,
  arb_rear: 9000,
  mu: 1.1,
  rear_grip: 1.14,
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
  handbrake: 1600,
  hold: 1200,
  drag: 0.38,
  downforce: 0.6,
  circles: [1.05, -1.05],
  radius: 0.95,
  corners: corners(0.85, -0.3, 0.75, 1.95),
  body: { length: 3.9, width: 1.72, height: 1.3, style: "hatch" },
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
  spring: 36000,
  damper: 2700,
  arb_front: 19000,
  arb_rear: 7500,
  mu: 1.12,
  rear_grip: 1.04,
  idle: 750,
  redline: 6300,
  upshift: 5900,
  downshift: 2500,
  gears: [2.95, 1.95, 1.42, 1.1, 0.88, 0.72],
  final: 3.45,
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
  brake_rear: 1050,
  handbrake: 2300,
  hold: 1900,
  drag: 0.5,
  downforce: 0.7,
  circles: [1.4, -1.4],
  radius: 1.1,
  corners: corners(1.0, -0.3, 0.7, 2.45),
  body: { length: 5.0, width: 2.0, height: 1.25, style: "muscle" },
};

export const RALLY: CarSpec = {
  ...COUPE,
  id: "rally",
  name: "Rally",
  mass: 1300,
  inertia: [2250, 2450, 560],
  drive: "awd",
  awd_split: 0.4,
  wheel: { radius: 0.34, rest: COUPE.wheel.rest + 0.04, mounts: mounts(0.82, 0.1, 1.27, 1.27) },
  wheelbase: 2.54,
  lock: 0.64,
  spring: 30000,
  damper: 2500,
  arb_front: 14000,
  arb_rear: 10000,
  mu: 1.08,
  rear_grip: 1.06,
  redline: 7500,
  upshift: 7100,
  gears: [3.4, 2.3, 1.7, 1.33, 1.08, 0.9],
  final: 3.9,
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
  handbrake: 2400,
  drag: 0.5,
  downforce: 0.8,
  offroad: 0.55,
  corners: corners(0.93, -0.34, 0.8, 2.15),
  body: { length: 4.4, width: 1.86, height: 1.38, style: "rally" },
};

export const CARS: Record<CarId, CarSpec> = { hatch: HATCH, coupe: COUPE, muscle: MUSCLE, rally: RALLY };

export function is_car(id: string): id is CarId {
  return Object.hasOwn(CARS, id);
}

export function car_spec(id: string): CarSpec {
  if (!is_car(id)) throw new Error(`unknown car "${id}", expected one of ${Object.keys(CARS).join(", ")}`);
  return CARS[id];
}
