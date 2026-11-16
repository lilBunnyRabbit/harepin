import { DRIFT_LEVELS, build_zone } from "../modes/drift";
import { DUEL_LEVELS, build_route } from "../modes/duel";
import { gym_site } from "../modes/gymkhana-mode";
import { JUMP_LEVELS } from "../modes/jump";
import { jump_at } from "../modes/jump-mode";
import { PARK_LEVELS } from "../modes/parking";
import { level_route } from "../modes/races";
import { park_site, park_start } from "../modes/parking-mode";
import type { World } from "../world/world";
import { ROAD_HALF } from "../worldgen/types";
import { spot_of, tier_of, tier_open, TIERS, type CareerEvent, type Stars } from "./career";
import { atan2, cos, hypot, sin } from "../sim-math";

export const MARKER_REACH = 4;
// Beside the road on open ground, so a lap past the start line never runs into the flag; a track in the air has no
// side, so there it stands just inside the edge.
const ASIDE = ROAD_HALF + 2.5;
const INSIDE = ROAD_HALF - 1.5;
// A hunt starts at the spawn and the gymkhana and parking sites sit near it: flags on one spot step apart along the road.
const APART = 9;
const STEP = 10;
// Go stops the car on the road this far before its flag, in the lane on the flag's side: the chase camera then sees
// the pole and its banner ahead, never the pole filling the view.
const ARRIVE_BACK = 6;
const LANE = ROAD_HALF / 2;
// Kept between the car's middle and a flag standing on the road (a track in the air).
const POLE_CLEAR = 3;
// A road middle snapped further than this from the one before the start is another road, or the start's road ends first.
const SNAP = 2;

export interface Pose {
  x: number;
  z: number;
  heading: number;
}

interface RoadQuery {
  spawn_near(x: number, z: number, fx: number, fz: number): Pose;
  on_road(x: number, z: number): boolean;
}

type StartAt = (world: World, start_index: number, level: string) => Pose | null;

const along = (p: { x: number; z: number; tx: number; tz: number } | undefined): Pose | null => (p ? { x: p.x, z: p.z, heading: atan2(p.tx, p.tz) } : null);

// What each mode's `start` spawns the car on, worked out without starting a run.
const STARTS: Record<string, StartAt> = {
  race: (world, _, level) => {
    const route = level_route(world.routes, level);
    return along(world.routes.find((r) => r.id === route)?.points[0]);
  },
  gymkhana: (world, start_index) => gym_site(world, start_index),
  parking: (world, start_index, level) => {
    const site = park_site(world, start_index);
    const park = PARK_LEVELS.find((l) => l.id === level);
    return site && park ? park_start(site, park) : null;
  },
  drift: (world, _, level) => {
    const zone = DRIFT_LEVELS.find((l) => l.id === level);
    return zone ? along(build_zone(world.seed, world.road, zone).points[0]) : null;
  },
  hunt: (world, start_index) => along(world.road[((start_index % world.road.length) + world.road.length) % world.road.length]),
  duel: (world, _, level) => {
    const duel = DUEL_LEVELS.find((l) => l.id === level);
    return duel ? along(build_route(world.seed, world.road, duel, (index) => world.clear_spawn(index)).points[0]) : null;
  },
  jump: (world, start_index, level) => {
    const jump = JUMP_LEVELS.find((l) => l.id === level);
    return jump ? along(jump_at(world, start_index, jump)?.start) : null;
  },
};

export interface Marker {
  readonly event: CareerEvent;
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  /** Where Go puts the car: on the road before the flag, facing past it. Stopping here opens the card too. */
  readonly arrive: Pose;
  /** 0 Rookie, 1 Club, 2 Pro: the tier's metal. */
  readonly tier: number;
}

export interface MapMarker {
  label: string;
  x: number;
  z: number;
  ink: string;
}

/** `events` run on this exact map; call once the whole ground is in, as mode starts read terrain anywhere. */
export function event_markers(world: World, start_index: number, events: readonly CareerEvent[], aside: boolean): Marker[] {
  const placed: Marker[] = [];
  for (const event of events) {
    const start = STARTS[event.mode]?.(world, start_index, spot_of(event).level);
    if (!start) continue;
    const tier = TIERS.indexOf(tier_of(event));
    const off = aside ? ASIDE : INSIDE;
    const flag = clear_of(placed, beside(start, off));
    placed.push({ event, tier, ...flag, arrive: arrival(flag, off, world) });
  }
  return placed;
}

/** `off`: how far the flag stands to the right of its event's start, which is in the middle of the road. */
export function arrival(flag: Pose, off: number, road: RoadQuery): Pose {
  const { heading } = flag;
  const fx = sin(heading);
  const fz = cos(heading);
  const rx = cos(heading);
  const rz = -sin(heading);
  const lane = Math.min(LANE, off - POLE_CLEAR);
  const bx = flag.x + rx * off - fx * ARRIVE_BACK;
  const bz = flag.z + rz * off - fz * ARRIVE_BACK;
  const near = road.spawn_near(bx, bz, fx, fz);
  if (hypot(near.x - bx, near.z - bz) < SNAP) return { x: near.x - cos(near.heading) * lane, z: near.z + sin(near.heading) * lane, heading: near.heading };
  const x = flag.x + rx * (off - lane);
  const z = flag.z + rz * (off - lane);
  const back = road.on_road(x, z) ? road_back(road, x, z, fx, fz) : ARRIVE_BACK;
  return { x: x - fx * back, z: z - fz * back, heading };
}

// A route that starts where its road does has nothing before the line: back only as far as the road goes. A start off
// the road (a gymkhana or parking site) stands on open ground, which runs on behind it.
function road_back(road: RoadQuery, x: number, z: number, fx: number, fz: number): number {
  let back = 0;
  while (back < ARRIVE_BACK && road.on_road(x - fx * (back + 1), z - fz * (back + 1))) back++;
  return back;
}

function beside(start: Pose, off: number): Pose {
  return { x: start.x - cos(start.heading) * off, z: start.z + sin(start.heading) * off, heading: start.heading };
}

function clear_of(placed: readonly Marker[], pose: Pose): Pose {
  let { x, z } = pose;
  const fx = sin(pose.heading);
  const fz = cos(pose.heading);
  for (let k = 0; k < placed.length && placed.some((m) => hypot(m.x - x, m.z - z) < APART); k++) {
    x += fx * STEP;
    z += fz * STEP;
  }
  return { x, z, heading: pose.heading };
}

export function marker_at(markers: readonly Marker[], x: number, z: number): Marker | null {
  let best: Marker | null = null;
  let best_d = MARKER_REACH;
  for (const m of markers) {
    const d = Math.min(hypot(m.x - x, m.z - z), hypot(m.arrive.x - x, m.arrive.z - z));
    if (d < best_d) {
      best = m;
      best_d = d;
    }
  }
  return best;
}

/** `tune` opens every tier, as on the career page. */
export const marker_open = (marker: Marker, stars: Stars, tune: boolean) => tune || tier_open(stars, tier_of(marker.event));
