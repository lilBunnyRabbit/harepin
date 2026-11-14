import { LAND_GRIP } from "../worldgen/kinds/kind-def";
import type { LabSurface, StationId } from "../worldgen/lab";
import { SurfaceId } from "../worldgen/types";
import type { Resolved } from "./pack";

/** A session past this many trials blurs its own ratings (docs/plan/feel-lab-v2.md 6.1). */
export const MAX_TRIALS = 10;
export const MAX_SECONDS = 20 * 60;
export const CARD_SECONDS = 45;
const FREE_SECONDS = 60;

/** One lap or one run of each station on asphalt, seconds; rough: skidpad, runway, hairpin and sweeper come from the plan (6.1), the rest are guesses until a session times them. */
const STATION_SECONDS: Record<StationId, number> = {
  hub: 30,
  skidpad: 12,
  runway: 20,
  grid: 30,
  oval: 90,
  brake: 20,
  slalom: 20,
  hairpin: 40,
  sweeper: 10,
  drift: 10,
  eight: 20,
  kicker: 15,
  lava: 10,
  hill: 20,
};

const GRIP: Record<LabSurface, number> = {
  asphalt: LAND_GRIP.road.grip,
  grass: LAND_GRIP.surfaces[SurfaceId.GRASS].grip,
  sand: LAND_GRIP.surfaces[SurfaceId.SAND].grip,
  dirt: LAND_GRIP.surfaces[SurfaceId.DIRT].grip,
  hardpack: LAND_GRIP.surfaces[SurfaceId.HARDPACK].grip,
  scree: LAND_GRIP.surfaces[SurfaceId.SCREE].grip,
  wet: LAND_GRIP.surfaces[SurfaceId.WET].grip,
  snow: LAND_GRIP.surfaces[SurfaceId.SNOW].grip,
  packed_snow: LAND_GRIP.surfaces[SurfaceId.PACKED_SNOW].grip,
  ice: LAND_GRIP.surfaces[SurfaceId.ICE].grip,
  slush: LAND_GRIP.surfaces[SurfaceId.SLUSH].grip,
};

/** Driving time of one trial, seconds. A lap at the grip limit takes `sqrt(1 / grip)` longer than on asphalt. */
export function drive_seconds(r: Resolved): number {
  const goal = r.trial.goal;
  const one = STATION_SECONDS[r.station.id];
  if (goal.kind === "laps") return goal.laps * one * Math.sqrt(GRIP.asphalt / GRIP[r.lane.surface]);
  if (goal.kind === "time") return goal.seconds;
  if (goal.kind === "free") return FREE_SECONDS;
  return one;
}

export interface Budget {
  trials: number;
  drive: number;
  cards: number;
  total: number;
}

export function budget(trials: readonly Resolved[]): Budget {
  const drive = trials.reduce((sum, r) => sum + drive_seconds(r), 0);
  const cards = trials.length * CARD_SECONDS;
  return { trials: trials.length, drive, cards, total: drive + cards };
}

export const over_budget = (b: Budget): boolean => b.trials > MAX_TRIALS || b.total > MAX_SECONDS;

export const minutes = (seconds: number): string => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
};
