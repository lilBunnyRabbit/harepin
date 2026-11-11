/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DEFAULT_BUILD, DEFAULT_PARTS, SLOTS, build_spec } from "./build";
import { CARS, type CarId } from "./cars";
import { Car, drop_height, surface_grip, type Controls, type Ground } from "./car";
import { LAND_GRIP, SAND_GRIP, type Footing } from "../worldgen/kinds/kind-def";
import { footing_ground } from "../../scripts/grounds";
import { SurfaceId } from "../worldgen/types";
import { FULL } from "../sweep";

const DT = 1 / 360;
// Brake-bound cars (the bus) stop the same on any ground, where a mud tyre's own rolling drag is worth up to 0.3%.
const TIE = 0.995;
const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
const LOOSE_ROWS = [...new Set<Footing>([LAND_GRIP, SAND_GRIP].flatMap((table) => [table.shoulder, table.wade, ...Object.values(table.surfaces)]))];

interface Runs {
  /** Seconds from rest to 50 km/h at full throttle, traction control on. */
  launch: number;
  /** Metres from 50 km/h to a stop on full brake, ABS on, then off. */
  abs: number;
  locked: number;
}

function runs(car: CarId, tyres: number, ground: Ground): Runs {
  const spec = build_spec({ ...DEFAULT_BUILD, car, parts: { ...DEFAULT_PARTS, tyres } });
  const sim = new Car(spec);
  const kmh = () => sim.forward_speed * 3.6;
  const drive = (controls: Controls, until: () => boolean) => {
    let t = 0;
    while (t < 30 && !until()) {
      sim.step(DT, controls, ground);
      t += DT;
    }
    return t;
  };
  sim.place(0, drop_height(spec, 0.6), 0, 0);
  for (let t = 0; t < 0.6; t += DT) sim.step(DT, idle, ground);
  const launch = drive({ ...idle, throttle: 1 }, () => kmh() >= 50);
  const stop = (abs: boolean) => {
    sim.abs = abs;
    drive({ ...idle, throttle: 1 }, () => kmh() >= 50);
    // Settled at 50 first: braking straight off the launch, the pitch and gear it left made the stops differ by 1%.
    for (let t = 0; t < 1.5; t += DT) sim.step(DT, { ...idle, throttle: Math.max(0, Math.min(1, (50 - kmh()) * 0.2 + 0.25)) }, ground);
    const from = sim.pos.z;
    drive({ ...idle, brake: 1 }, () => kmh() <= 0.5);
    return sim.pos.z - from;
  };
  return { launch, abs: stop(true), locked: stop(false) };
}

// Rolling drag left out (roll 1): soft rows drag on purpose, and sand or a ford stopping a car short is that drag, not the tyre.
const CHECKED: readonly CarId[] = FULL ? (Object.keys(CARS) as CarId[]) : ["coupe", "rally", "formula", "bus"];

for (const car of CHECKED)
  test(`off the road no tyre on the ${car} launches or stops better than its stock tyres on asphalt`, () => {
    const failed: string[] = [];
    const stock = runs(car, 0, footing_ground(LAND_GRIP.road));
    SLOTS.tyres.parts.forEach((part, tyres) => {
      for (const row of LOOSE_ROWS) {
        const r = runs(car, tyres, footing_ground({ ...row, roll: 1 }));
        const where = `${car} ${part.name} on grip ${row.grip} loose ${row.loose}`;
        if (r.launch < stock.launch * TIE) failed.push(`${where}: 0-50 ${r.launch.toFixed(2)} s < ${stock.launch.toFixed(2)} s`);
        // A tyre with no grip there never reaches 50, so its stops start at rest and measure nothing.
        if (r.launch >= 30) continue;
        if (r.abs < stock.abs * TIE) failed.push(`${where}: ABS stop ${r.abs.toFixed(1)} m < ${stock.abs.toFixed(1)} m`);
        if (r.locked < stock.locked * TIE) failed.push(`${where}: locked stop ${r.locked.toFixed(1)} m < ${stock.locked.toFixed(1)} m`);
      }
    });
    expect(failed).toEqual([]);
  }, 30_000);

// The best of a sweep of fixed ABS slips, against the default following the curve's peak. At asphalt's fixed 0.1 the
// stops ran up to 4% past the best; following the peak they sit within half a percent.
const ABS_SLIPS = [0.06, 0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2];
const ABS_IDEAL = 1.01;

function abs_stop(car: CarId, tyres: number, ground: Ground, abs_slip?: number): number {
  const spec = build_spec({ ...DEFAULT_BUILD, car, parts: { ...DEFAULT_PARTS, tyres } });
  const sim = new Car(spec);
  if (abs_slip !== undefined) sim.abs_slip = abs_slip;
  const kmh = () => sim.forward_speed * 3.6;
  sim.place(0, drop_height(spec, 0.6), 0, 0);
  for (let t = 0; t < 0.6; t += DT) sim.step(DT, idle, ground);
  for (let t = 0; t < 30 && kmh() < 100; t += DT) sim.step(DT, { ...idle, throttle: 1 }, ground);
  for (let t = 0; t < 1.5; t += DT) sim.step(DT, { ...idle, throttle: Math.max(0, Math.min(1, (100 - kmh()) * 0.2 + 0.3)) }, ground);
  const from = sim.pos.z;
  for (let t = 0; t < 30 && kmh() > 0.5; t += DT) sim.step(DT, { ...idle, brake: 1 }, ground);
  return sim.pos.z - from;
}

for (const car of ["coupe", "rally"] as const)
  test(`ABS on dirt stops the ${car} from 100 within 1% of the best fixed-slip stop on every tyre`, () => {
    const ground = footing_ground({ ...LAND_GRIP.surfaces[SurfaceId.DIRT], roll: 1 });
    const failed: string[] = [];
    SLOTS.tyres.parts.forEach((part, tyres) => {
      const stop = abs_stop(car, tyres, ground);
      const best = Math.min(...ABS_SLIPS.map((slip) => abs_stop(car, tyres, ground, slip)));
      if (stop > best * ABS_IDEAL) failed.push(`${part.name}: ${stop.toFixed(2)} m > best ${best.toFixed(2)} m`);
    });
    expect(failed).toEqual([]);
  }, 30_000);

test("no tyre grips with a negative share, so deep water never flips the asphalt cap into full grip", () => {
  for (const car of Object.keys(CARS) as CarId[])
    for (let tyres = 0; tyres < SLOTS.tyres.parts.length; tyres++) {
      const spec = build_spec({ ...DEFAULT_BUILD, car, parts: { ...DEFAULT_PARTS, tyres } });
      for (let surface = 0; surface <= 1; surface += 0.05)
        for (const dirt of [true, false]) expect(surface_grip(spec, surface, dirt)).toBeGreaterThanOrEqual(0);
    }
});
