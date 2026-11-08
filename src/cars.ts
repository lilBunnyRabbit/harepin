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
  /** Collision circle offsets along the heading (nose, tail), metres. */
  circles: [number, number];
  radius: number;
  corners: Triple[];
  body: { length: number; width: number; height: number; style: BodyStyle };
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
  circles: [1.25, -1.25],
  radius: 1.05,
  corners: [-0.95, 0.95].flatMap((x) => [-0.3, 0.72].flatMap((y) => [-2.25, 2.25].map((z): Triple => [x, y, z]))),
  body: { length: 4.66, width: 1.9, height: 1.2, style: "coupe" },
};
