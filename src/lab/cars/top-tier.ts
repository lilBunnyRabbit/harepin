import type { Part, Slot } from "../../car/build";
import { CARS, type CarId, type CarSpec } from "../../car/cars";
import type { LabCar } from "../pack";

// Each part replaces its slot's pick, so a trial drives it on a build with that slot at stock: never stacked on Race.

export const SUPERCHARGER: Part = {
  name: "Supercharger",
  blurb: "+50% torque from idle, revs higher, +35 kg",
  mod: { scale: { torque: 1.5 }, add: { redline: 600, upshift: 600, mass: 35 } },
};

export const TURBO: Part = {
  name: "Turbo",
  blurb: "Lag low down, then +70% torque, +40 kg",
  mod: { add: { redline: 700, upshift: 700, mass: 40 } },
};

export const TWIN_TURBO: Part = {
  name: "Twin turbo",
  blurb: "Intercooled, ECU tune: double torque once spooled, +55 kg",
  mod: { add: { redline: 800, upshift: 800, mass: 55 } },
};

export const SLICKS: Part = {
  name: "Slicks",
  blurb: "Wide racing slicks: most grip on tarmac, hopeless off it",
  mod: { scale: { mu: 1.24, grip_dirt: 0.8, grip_grass: 0.8 }, add: { offroad: -1 } },
  look: { tyre: { width: 1.45, rim: 1.16, band: "warning" } },
};

export const GT_KIT: Part = {
  name: "GT kit",
  blurb: "Splitter, diffuser, the biggest wing: most downforce and drag, +18 kg",
  mod: { scale: { downforce: 6 }, add: { drag: 0.26, rear_grip: 0.08, aero_front: 0.04, mass: 18 } },
  look: { aero: { wing: 3, front: "splitter", skirts: true, diffuser: true } },
};

export const CARBON_SHELL: Part = {
  name: "Carbon shell",
  blurb: "-24% mass: carbon panels, no interior, lowest",
  mod: { scale: { mass: 0.76, inertia: 0.76 }, add: { cog: 0.04 } },
};

export interface Boost {
  peak: number;
  lag: number;
  spool: number;
}

export const TURBO_BOOST: Boost = { peak: 1.7, lag: 2500, spool: 4500 };
export const TWIN_BOOST: Boost = { peak: 2, lag: 2000, spool: 3600 };
const STEP_RPM = 500;

function boost_at(boost: Boost, rpm: number): number {
  const t = Math.max(0, Math.min(1, (rpm - boost.lag) / (boost.spool - boost.lag)));
  return 1 + (boost.peak - 1) * t * t * (3 - 2 * t);
}

function stock_at(torque: readonly (readonly [number, number])[], rpm: number): number {
  for (let i = 1; i < torque.length; i++) {
    const [x1, y1] = torque[i];
    if (rpm <= x1) {
      const [x0, y0] = torque[i - 1];
      return y0 + ((y1 - y0) * (rpm - x0)) / (x1 - x0);
    }
  }
  return torque[torque.length - 1][1];
}

export function boosted(spec: CarSpec, boost: Boost): [number, number][] {
  const end = spec.torque[spec.torque.length - 1][0];
  const table: [number, number][] = [];
  for (let rpm = 0; rpm <= end; rpm += STEP_RPM) table.push([rpm, Math.round(stock_at(spec.torque, rpm) * boost_at(boost, rpm))]);
  if (table[table.length - 1][0] < end) table.push([end, Math.round(stock_at(spec.torque, end) * boost_at(boost, end))]);
  return table;
}

export function turbo_car(car: CarId, stage: string, boost: Boost): LabCar {
  const spec = CARS[car];
  const name = `${spec.name} ${stage}`;
  return { name, spec: { ...spec, name, torque: boosted(spec, boost) }, look: car };
}

/** The top-tier parts by the slot each replaces: a trial brief names a mod that is one of these. */
export const TOP_PARTS: Partial<Record<Slot, readonly Part[]>> = { engine: [SUPERCHARGER, TURBO, TWIN_TURBO], tyres: [SLICKS], aero: [GT_KIT], weight: [CARBON_SHELL] };
