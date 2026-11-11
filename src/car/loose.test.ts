/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DEFAULT_BUILD, DEFAULT_PARTS, SLOTS, build_spec } from "./build";
import { CARS, type CarId } from "./cars";
import { Car, drop_height, type Controls, type Ground } from "./car";
import { LAND_GRIP, SAND_GRIP, type Footing } from "../worldgen/kinds/kind-def";
import { footing_ground } from "../../scripts/grounds";
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
        if (r.abs < stock.abs * TIE) failed.push(`${where}: ABS stop ${r.abs.toFixed(1)} m < ${stock.abs.toFixed(1)} m`);
        if (r.locked < stock.locked * TIE) failed.push(`${where}: locked stop ${r.locked.toFixed(1)} m < ${stock.locked.toFixed(1)} m`);
      }
    });
    expect(failed).toEqual([]);
  });
