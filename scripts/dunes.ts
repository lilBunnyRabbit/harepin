import { Vector3 } from "three";
import { Car, type Controls, type Ground } from "../src/car/car";
import { CARS, type CarSpec } from "../src/car/cars";
import { SAND_GRIP } from "../src/worldgen/kinds/kind-def";
import { smoothstep } from "../src/worldgen/noise";
import { SurfaceId } from "../src/worldgen/types";
import { footing_ground, slope } from "./grounds";

const DT = 1 / 360;
const CLIMB_SECONDS = 30;
const AIR = 0.1;
const SETTLE = 4;
const TAIL = 5;
const LEAD = 3;
const RIDE = 20;
const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };

export const SAND = footing_ground(SAND_GRIP.surfaces[SurfaceId.GRASS]);
export const PACKED = footing_ground(SAND_GRIP.surfaces[SurfaceId.DIRT]);

export const CLIMB_DEGREES = [12, 15, 20, 32];
export const grade_of = (degrees: number) => Math.tan((degrees * Math.PI) / 180);

// Measured as ground covered up the face over the last stretch, not forward speed: a car that slides back spins round and drives downhill.
/** km/h up `grade` on `ground` after `CLIMB_SECONDS` flat out from rest, aids on: the most speed the car holds up that face. */
export function climb_kmh(spec: CarSpec, grade: number, ground: Ground): number {
  const hill = slope(grade, ground);
  const car = new Car(spec);
  car.park(0, 0, 0, hill);
  let from = 0;
  for (let t = 0; t < CLIMB_SECONDS; t += DT) {
    if (t < CLIMB_SECONDS - TAIL) from = car.pos.z;
    car.step(DT, { ...idle, throttle: 1 }, hill);
  }
  return Math.max(0, ((car.pos.z - from) / TAIL) * Math.hypot(1, grade) * 3.6);
}

// Lee 0.29 of a 1 km wave puts the smoothstep face's steepest at 1.5 * 120 / 290 = 0.62, the 32 degree slip face.
export const DUNE = { height: 120, wave: 1000, lee: 0.29 };
const WINDWARD = 0.25;
const SLIP = grade_of(32);

export const Brink = { SMOOTH: "smooth", SHARP: "sharp" } as const;
export type Brink = (typeof Brink)[keyof typeof Brink];

/** One dune along +z, brink at z = 0: the terrain's smoothstep wave, or a windward ramp creased onto a planar slip face. */
function profile(brink: Brink): (z: number) => [number, number] {
  if (brink === Brink.SHARP) {
    const toe = DUNE.height / SLIP;
    return (z) => (z < 0 ? [DUNE.height + z * WINDWARD, WINDWARD] : z < toe ? [DUNE.height - z * SLIP, -SLIP] : [0, 0]);
  }
  const { height, wave, lee } = DUNE;
  const rise = 1 - lee;
  const at = (z: number) => {
    const u = z / wave + rise;
    const t = u - Math.floor(u);
    return height * (t < rise ? smoothstep(0, rise, t) : smoothstep(1, rise, t));
  };
  return (z) => [at(z), (at(z + 0.05) - at(z - 0.05)) / 0.1];
}

export function dune_ground(brink: Brink, footing: Ground = SAND): Ground {
  const shape = profile(brink);
  return { ...footing, height: (_x, z) => shape(z)[0], normal: (_x, z, out) => out.set(0, 1, -shape(z)[1]).normalize() };
}

export interface Crest {
  /** Longest stretch with every wheel off the ground, s. */
  air: number;
  /** Speed into the face along its normal at the first touchdown after air, m/s. */
  impact: number;
  /** Most tilt of the body off the ground normal from touchdown on, deg. */
  tilt: number;
  /** Within 30 degrees of the ground normal at the end, on all four wheels or not. */
  upright: boolean;
  /** Upright on all four wheels at the end. */
  wheels: boolean;
  /** Past 90 degrees off the ground normal at any point. */
  rolled: boolean;
}

const up = new Vector3();
const normal = new Vector3();
const tilt_of = (car: Car) => (Math.acos(Math.min(1, up.set(0, 1, 0).applyQuaternion(car.quat).dot(normal))) * 180) / Math.PI;

/** Coasting along `heading` at about `speed` m/s over the brink at (x, z) from just short of it, then `SETTLE` s from touchdown. */
export function coast(spec: CarSpec, ground: Ground, x: number, z: number, heading: number, speed: number): Crest {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const car = new Car(spec);
  car.park(x - fx * LEAD, z - fz * LEAD, heading, ground);
  car.vel.copy(new Vector3(0, 0, 1).applyQuaternion(car.quat).multiplyScalar(speed));
  for (const w of car.wheels) w.omega = speed / spec.wheel.radius;
  const out: Crest = { air: 0, impact: 0, tilt: 0, upright: false, wheels: false, rolled: false };
  let flying = 0;
  let down = -1;
  for (let t = 0; t < 15 && (down < 0 || t - down < SETTLE); t += DT) {
    car.step(DT, idle, ground);
    ground.normal(car.pos.x, car.pos.z, normal);
    if (tilt_of(car) > 90) out.rolled = true;
    if (car.wheels.every((w) => !w.contact)) {
      flying += DT;
      continue;
    }
    if (flying >= AIR && out.air === 0) out.impact = Math.max(0, -car.vel.dot(normal));
    out.air = Math.max(out.air, flying);
    flying = 0;
    const past = (car.pos.x - x) * fx + (car.pos.z - z) * fz;
    if (down < 0 && past > 0 && (out.air > 0 || past > RIDE)) down = t;
    if (down >= 0) out.tilt = Math.max(out.tilt, tilt_of(car));
  }
  out.upright = tilt_of(car) < 30;
  out.wheels = out.upright && car.wheels.every((w) => w.contact);
  return out;
}

export function crest(spec: CarSpec, brink: Brink, speed: number): Crest {
  return coast(spec, dune_ground(brink), 0, 0, 0, speed);
}

export const CREST_SPEEDS = [15, 20, 25];

if (import.meta.main) {
  const specs = Object.values(CARS);
  const row = (cells: string[]) => console.log(`| ${cells.join(" | ")} |`);
  for (const [label, ground] of [["loose sand", SAND], ["packed dirt", PACKED]] as const) {
    console.log(`\nMax climb, km/h, ${label} (${CLIMB_SECONDS} s flat out from rest)\n`);
    row(["Car", ...CLIMB_DEGREES.map((d) => `${d}°`)]);
    row(["---", ...CLIMB_DEGREES.map(() => "---")]);
    for (const spec of specs) row([spec.id, ...CLIMB_DEGREES.map((d) => climb_kmh(spec, grade_of(d), ground).toFixed(0))]);
  }
  for (const brink of Object.values(Brink)) {
    console.log(`\nCrest, ${brink} brink: air s / into the face m/s / most tilt deg / on its wheels\n`);
    row(["Car", ...CREST_SPEEDS.map((v) => `${v} m/s`)]);
    row(["---", ...CREST_SPEEDS.map(() => "---")]);
    for (const spec of specs)
      row([spec.id, ...CREST_SPEEDS.map((v) => {
        const c = crest(spec, brink, v);
        return `${c.air.toFixed(1)} / ${c.impact.toFixed(1)} / ${c.tilt.toFixed(0)} / ${c.wheels ? "yes" : "no"}`;
      })]);
  }
}
