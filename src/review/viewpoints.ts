import { SPAWN_INDEX, type World } from "../world/world";
import type { RoadPoint } from "../worldgen/types";
import { VIEWS, type ViewName } from "./catalog";

type V3 = [number, number, number];

export interface View {
  /** Circuit index the car stands on, so the world streams in around the shot. */
  at: number;
  from: V3;
  to: V3;
}

const CLEAR = 4;
/** An aerial stays this far inside the phone fog, so it frames land rather than haze. */
const AERIAL_REACH = 560;

type Plan = Pick<World, "road" | "towns" | "water_level" | "nearest_road" | "clear_spawn">;

interface Frame {
  centre: V3;
  span: number;
}

function frame_of(road: readonly RoadPoint[]): Frame {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of road) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  const centre: V3 = [x / road.length, y / road.length, z / road.length];
  const span = Math.max(...road.map((p) => Math.hypot(p.x - centre[0], p.z - centre[2])));
  return { centre, span };
}

function flat_dir(from: { x: number; z: number }, to: { x: number; z: number }): [number, number] {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz) || 1;
  return [dx / length, dz / length];
}

function along(world: Plan, start: number, share: number): View {
  const n = world.road.length;
  const at = (start + Math.round(n * share)) % n;
  const p = world.road[at];
  return { at, from: [p.x - p.tz * 28 - p.tx * 10, p.y + 10, p.z + p.tx * 28 - p.tz * 10], to: [p.x + p.tx * 6, p.y + 1, p.z + p.tz * 6] };
}

const index_of = (world: Plan, x: number, z: number) => world.road.indexOf(world.nearest_road(x, z));

// Heights here are over the road; `view_of` lifts the camera clear of the ground once that has streamed in.
export function plan_views(world: Plan): Partial<Record<ViewName, View>> {
  const { road } = world;
  const { centre, span } = frame_of(road);
  const middle = { x: centre[0], z: centre[2] };
  const spawn = world.clear_spawn(SPAWN_INDEX);
  const start = road[spawn];
  const views: Partial<Record<ViewName, View>> = {
    start: { at: spawn, from: [start.x - start.tx * 16, start.y + 6, start.z - start.tz * 16], to: [start.x + start.tx * 40, start.y + 1, start.z + start.tz * 40] },
    q1: along(world, spawn, 0.25),
    q2: along(world, spawn, 0.5),
    q3: along(world, spawn, 0.75),
  };

  const high = road.reduce((best, p) => (p.y > best.y ? p : best));
  // Away from the middle: the highest road tends to skirt the world's peak, so the view down the land is outward.
  const [ox, oz] = flat_dir(middle, high);
  views.overlook = { at: road.indexOf(high), from: [high.x - ox * 30, high.y + 30, high.z - oz * 30], to: [high.x + ox * 200, centre[1], high.z + oz * 200] };

  const coast = road.filter((p) => Number.isFinite(world.water_level(p.x, p.z)));
  if (coast.length) {
    const low = coast.reduce((best, p) => (p.y < best.y ? p : best));
    const [sx, sz] = flat_dir(middle, low);
    const sea = world.water_level(low.x, low.z);
    views.shore = { at: road.indexOf(low), from: [low.x - sx * 20, low.y + 8, low.z - sz * 20], to: [low.x + sx * 120, sea, low.z + sz * 120] };
  }

  const town = world.towns.reduce<Plan["towns"][number] | null>((best, t) => (!best || t.radius > best.radius ? t : best), null);
  if (town) {
    const reach = town.radius * 1.2;
    const near = world.nearest_road(town.x, town.z);
    views.town = { at: index_of(world, town.x, town.z), from: [town.x + town.ux * reach, near.y + 14, town.z + town.uz * reach], to: [town.x, near.y, town.z] };
  }

  const reach = Math.min(span, AERIAL_REACH);
  views.aerial = { at: index_of(world, middle.x, middle.z), from: [middle.x, centre[1] + reach * 0.55, middle.z - reach * 0.8], to: [middle.x, centre[1], middle.z] };
  return views;
}

export async function view_of(world: World, name: string): Promise<View | null> {
  const known = VIEWS.find((view) => view === name);
  const view = known && plan_views(world)[known];
  if (!view) return null;
  const [x, y, z] = view.from;
  await world.tiles.ensure(x, z);
  return { ...view, from: [x, Math.max(y, world.height(x, z) + CLEAR), z] };
}
