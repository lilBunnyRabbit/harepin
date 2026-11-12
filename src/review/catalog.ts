import { EVENTS, ghost_path } from "../career/career";
import { KINDS, plain_map } from "../worldgen/kinds/kinds";
import { map_code, parse_map_code } from "../worldgen/kinds/map-code";
import type { WorldKind } from "../worldgen/types";

export const SHEETS = ["cars", "lineup", "paints", "decals", "biomes", "track"] as const;
export type Sheet = (typeof SHEETS)[number];

export const VIEWS = ["start", "q1", "q2", "q3", "overlook", "shore", "town", "aerial"] as const;
export type ViewName = (typeof VIEWS)[number];

const PLAIN_SEED = 1;

/** Every career map, then the plain map of each land kind no event runs on: what `scripts/shots.ts` reviews. */
export function review_maps(): string[] {
  const maps = [...new Set(EVENTS.map((event) => event.map))];
  const covered = new Set(maps.map((code) => kind_of(code)));
  for (const def of Object.values(KINDS)) if (def.recipe && !covered.has(def.kind)) maps.push(map_code(plain_map(def.kind, PLAIN_SEED)));
  return maps;
}

function kind_of(code: string): WorldKind | null {
  const read = parse_map_code(code);
  return read.ok ? read.map.kind : null;
}

export interface Replay {
  id: string;
  ghost: string;
}

export const review_replays = (): Replay[] => EVENTS.filter((event) => event.ghost).map((event) => ({ id: event.id, ghost: ghost_path(event) }));

export const catalog = () => ({ sheets: SHEETS, views: VIEWS, maps: review_maps(), replays: review_replays() });
