import type { CarSpec } from "../../src/car/cars";
import { SteerMode } from "../../src/car/car";
import type { LabSurface, StationId } from "../../src/worldgen/lab";
import * as feel from "../bench/feel-cases";
import { brake_stop, telemetry } from "../bench/telemetry-cases";
import { catch_drift } from "../drift";
import { GROUNDS, type GroundName } from "../grounds";
import { turn_in } from "../handling";

/** The straight stations stop from the trial's own `stop` goal speed, else from this; the matrix always from this. */
export const STOP_FROM_KMH = 100;

export type SimValues = [key: string, value: number][];

export interface Sim {
  /** Which scenarios ran: trials that ran the same ones read against each other. */
  scenario: string;
  values: SimValues;
  /** The ground the scenarios drove on: the lane's, or asphalt where a scenario only runs there. */
  ground: GroundName;
  stop_from: number;
}

interface StationSim {
  scenario: string;
  run: (rig: feel.Rig, stop_from: number) => SimValues;
  /** The scenarios ignore the lane and drive flat asphalt (`scripts/drift.ts` takes its ground from the command line). */
  asphalt?: true;
}

const ring: StationSim = {
  scenario: "ring",
  run: (rig) => [
    ["latg", telemetry(rig.spec, rig.ground).best_g],
    ["slip", feel.lift_off(rig, true)],
  ],
};

const turns: StationSim = {
  scenario: "turns",
  run: (rig) => [
    ["slip", feel.power_on(rig, true).slip],
    ["lag", feel.step_steer(rig).t90],
  ],
};

// A stop that started under its speed (the car never got there in 20 s) is left out.
const straight: StationSim = {
  scenario: "straight",
  run: (rig, stop_from) => {
    const t = telemetry(rig.spec, rig.ground);
    const b = brake_stop(rig.spec, stop_from, rig.ground);
    const stop: SimValues = b.from >= stop_from ? [["stop", b.m]] : [];
    return [["0-100", t.launch[0].t100], ...stop, ["top", t.top.kmh]];
  },
};

// Balanced aids, Smooth keys, from 60 km/h aiming 30 degrees: the drift.ts --catch row a keyboard drifter starts from.
const slide: StationSim = {
  scenario: "slide",
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

const none: StationSim = { scenario: "none", run: () => [] };

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

export function trial_sim(spec: CarSpec, station: StationId, surface: LabSurface, mode: SteerMode = SteerMode.SMOOTH, stop_from = STOP_FROM_KMH): Sim {
  const sim = STATION_SIMS[station];
  const ground: GroundName = sim.asphalt ? "asphalt" : surface;
  const values = sim.run({ spec, mode, ground: GROUNDS[ground] }, stop_from);
  for (const [key, v] of values) if (Number.isNaN(v)) throw new Error(`NaN ${key} at ${station}/${surface}`);
  return { scenario: sim.scenario, values, ground, stop_from };
}

const KICK_KMH = 220;
// The cruise controller that brings the car up to the kick settles a couple of km/h short of its target.
const KICK_REACHED = 0.95;

export interface Traits {
  t100: number;
  top: number;
  stop: number;
  g: number;
  /** Seconds from full steer at 100 km/h to a 0.2 rad/s yaw rate (`bench.turn_in`). */
  turn: number;
  /** Peak body slip, degrees: lifting off mid corner (assists on), power on in 2nd (TCS off). */
  lift: number;
  pwr: number;
  /** Degrees turned by a 0.45 s handbrake flick at 70 km/h. */
  hb: number;
  /** Seconds a 0.3 rad/s yaw kick at 220 km/h takes to settle; -1 when it never does, NaN when the car never gets to 220. */
  kick: number;
}

export function traits(spec: CarSpec, ground: GroundName): Traits {
  const rig: feel.Rig = { spec, mode: SteerMode.SMOOTH, ground: GROUNDS[ground] };
  const t = telemetry(spec, rig.ground);
  const kick = feel.yaw_kick(rig);
  return {
    t100: t.launch[0].t100,
    top: t.top.kmh,
    stop: t.stop[0].from >= STOP_FROM_KMH ? t.stop[0].m : Number.NaN,
    g: t.best_g,
    turn: turn_in(spec, rig.ground).turn_in,
    lift: feel.lift_off(rig, true),
    pwr: feel.power_on(rig, false).slip,
    hb: feel.handbrake_flick(rig).turned,
    kick: kick.kmh >= KICK_KMH * KICK_REACHED ? kick.settle : Number.NaN,
  };
}
