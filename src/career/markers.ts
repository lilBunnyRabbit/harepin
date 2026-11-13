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

export const MARKER_REACH = 4;
// Beside the road on open ground, so a lap past the start line never runs into the flag; a track in the air has no
// side, so there it stands just inside the edge.
const ASIDE = ROAD_HALF + 2.5;
const INSIDE = ROAD_HALF - 1.5;
// A hunt starts at the spawn and the gymkhana and parking sites sit near it: flags on one spot step apart along the road.
const APART = 9;
const STEP = 10;

interface Pose {
  x: number;
  z: number;
  heading: number;
}

type StartAt = (world: World, start_index: number, level: string) => Pose | null;

const along = (p: { x: number; z: number; tx: number; tz: number } | undefined): Pose | null => (p ? { x: p.x, z: p.z, heading: Math.atan2(p.tx, p.tz) } : null);

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
    placed.push({ event, tier, ...clear_of(placed, beside(start, aside)) });
  }
  return placed;
}

function beside(start: Pose, aside: boolean): Pose {
  const off = aside ? ASIDE : INSIDE;
  return { x: start.x - Math.cos(start.heading) * off, z: start.z + Math.sin(start.heading) * off, heading: start.heading };
}

function clear_of(placed: readonly Marker[], pose: Pose): Pose {
  let { x, z } = pose;
  const fx = Math.sin(pose.heading);
  const fz = Math.cos(pose.heading);
  for (let k = 0; k < placed.length && placed.some((m) => Math.hypot(m.x - x, m.z - z) < APART); k++) {
    x += fx * STEP;
    z += fz * STEP;
  }
  return { x, z, heading: pose.heading };
}

export function marker_at(markers: readonly Marker[], x: number, z: number): Marker | null {
  let best: Marker | null = null;
  let best_d = MARKER_REACH;
  for (const m of markers) {
    const d = Math.hypot(m.x - x, m.z - z);
    if (d < best_d) {
      best = m;
      best_d = d;
    }
  }
  return best;
}

/** `tune` opens every tier, as on the career page. */
export const marker_open = (marker: Marker, stars: Stars, tune: boolean) => tune || tier_open(stars, tier_of(marker.event));
