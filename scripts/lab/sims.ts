import type { CarSpec } from "../../src/car/cars";
import { SteerMode } from "../../src/car/car";
import type { LabSurface, StationId } from "../../src/worldgen/lab";
import * as feel from "../bench/feel-cases";
import { telemetry } from "../bench/telemetry-cases";
import { catch_drift } from "../drift";
import { GROUNDS, type GroundName } from "../grounds";

/** The straight stations' stop is telemetry's 100-0 km/h, whatever speed the trial's own goal brakes from. */
export const STOP_FROM_KMH = 100;

export type SimValues = [key: string, value: number][];

export interface Sim {
  values: SimValues;
  /** The ground the scenarios drove on: the lane's, or asphalt where a scenario only runs there. */
  ground: GroundName;
}

interface StationSim {
  run: (rig: feel.Rig) => SimValues;
  /** The scenarios ignore the lane and drive flat asphalt (`scripts/drift.ts` takes its ground from the command line). */
  asphalt?: true;
}

const ring: StationSim = {
  run: (rig) => [
    ["latg", telemetry(rig.spec, rig.ground).best_g],
    ["slip", feel.lift_off(rig, true)],
  ],
};

const turns: StationSim = {
  run: (rig) => [
    ["slip", feel.power_on(rig, true).slip],
    ["lag", feel.step_steer(rig).t90],
  ],
};

const straight: StationSim = {
  run: (rig) => {
    const t = telemetry(rig.spec, rig.ground);
    return [
      ["0-100", t.launch[0].t100],
      ["stop", t.stop[0].m],
      ["top", t.top.kmh],
    ];
  },
};

// Balanced aids, Smooth keys, from 60 km/h aiming 30 degrees: the drift.ts --catch row a keyboard drifter starts from.
const slide: StationSim = {
  asphalt: true,
  run: (rig) => {
    const held = catch_drift(rig.spec, 60, 30);
    return [
      ["slip", held.peak],
      ["held", held.held],
      ["rec", catch_drift(rig.spec, 60, 30, 1.5).straight],
    ];
  },
};

const none: StationSim = { run: () => [] };

/** Kicker landings and grid seams need a bot on the lab world (plan P2b), the hill a sloped scenario: until then no sim. */
const STATION_SIMS: Record<StationId, StationSim> = {
  hub: none,
  skidpad: ring,
  sweeper: ring,
  lava: ring,
  slalom: turns,
  hairpin: turns,
  drift: slide,
  eight: slide,
  runway: straight,
  oval: straight,
  brake: straight,
  hill: none,
  grid: none,
  kicker: none,
};

export function trial_sim(spec: CarSpec, station: StationId, surface: LabSurface, mode: SteerMode = SteerMode.SMOOTH): Sim {
  const sim = STATION_SIMS[station];
  const ground: GroundName = sim.asphalt ? "asphalt" : surface;
  const values = sim.run({ spec, mode, ground: GROUNDS[ground] });
  for (const [key, v] of values) if (Number.isNaN(v)) throw new Error(`NaN ${key} at ${station}/${surface}`);
  return { values, ground };
}

export interface Traits {
  t100: number;
  top: number;
  stop: number;
  g: number;
  /** Seconds to 90% of the settled yaw rate on a step steer at 100 km/h. */
  turn: number;
  /** Peak body slip, degrees: lifting off mid corner (assists on), power on in 2nd (TCS off). */
  lift: number;
  pwr: number;
  /** Degrees turned by a 0.45 s handbrake flick at 70 km/h. */
  hb: number;
  /** Seconds a 0.3 rad/s yaw kick at 220 km/h takes to settle; -1 when it never does or the car never gets there. */
  kick: number;
}

export function traits(spec: CarSpec, ground: GroundName): Traits {
  const rig: feel.Rig = { spec, mode: SteerMode.SMOOTH, ground: GROUNDS[ground] };
  const t = telemetry(spec, rig.ground);
  return {
    t100: t.launch[0].t100,
    top: t.top.kmh,
    stop: t.stop[0].m,
    g: t.best_g,
    turn: feel.step_steer(rig).t90,
    lift: feel.lift_off(rig, true),
    pwr: feel.power_on(rig, false).slip,
    hb: feel.handbrake_flick(rig).turned,
    kick: feel.yaw_kick(rig).settle,
  };
}
