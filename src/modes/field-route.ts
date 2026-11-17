import type { World } from "../world/world";
import { KINDS } from "../worldgen/kinds/kinds";
import type { Route } from "../worldgen/types";

/**
 * Metres from its first point every point of a route may lie and still race a field on a streamed world. Twice it stays
 * under the least streaming reach (a phone's 700 m fog plus 128 m pad, `render/quality.ts`), so the whole loop is in
 * while the player is anywhere on it: a town loop fits, a mainland ring does not.
 */
export const STREAMED_FIELD_REACH = 400;

/** Whether an AI field can race this route: a closed one, not on rails, and on a streamed world a compact one. */
export function field_races(route: Route, streamed: boolean, rails: boolean): boolean {
  if (!route.closed || rails) return false;
  if (!streamed) return true;
  const [first] = route.points;
  return route.points.every((p) => Math.hypot(p.x - first.x, p.z - first.z) <= STREAMED_FIELD_REACH);
}

export const field_routes = (world: Pick<World, "routes" | "tiles" | "kind">): Route[] => world.routes.filter((route) => field_races(route, world.tiles.streamed, KINDS[world.kind].rails));
