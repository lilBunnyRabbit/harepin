import { race_levels } from "../modes/races";
import type { MapRoute } from "../worldgen/map";
import { RunType, resolve, type_of, type RunPick } from "./runs";

const km = (m: number) => `${(m / 1000).toFixed(1)} km`;

/** A race pick's length option as it reads: the band in km, over the whole run. */
export function band_text(pick: RunPick): string | null {
  const choice = type_of(pick.type).choice?.options.find((option) => option.band && option.band === pick.band);
  if (!choice?.band) return null;
  const [low, high] = choice.band;
  const range = high === Infinity ? `over ${km(low)}` : low === 0 ? `under ${km(high)}` : `${km(low)} to ${km(high)}`;
  return `${choice.label}: ${range}${pick.laps > 1 ? " in all" : ""}`;
}

/** The route a race or speed trap pick will drive on its map, as the run resolves it on load; null for other types. */
export function route_text(pick: RunPick, routes: readonly MapRoute[]): string | null {
  if (pick.type !== RunType.RACE && pick.type !== RunType.TRAP) return null;
  const levels = race_levels(routes, "");
  const { level, fallback } = resolve(pick, {
    levels: (mode) => (mode === "race" ? levels.map((l) => l.id) : []),
    length: (id) => routes.find((route) => route.id === (levels.find((l) => l.id === id)?.trap ?? id))?.length ?? null,
  });
  const name = levels.find((l) => l.id === level)?.name ?? level;
  const route = routes.find((r) => r.id === (levels.find((l) => l.id === level)?.trap ?? level));
  if (!route) return null;
  const laps = route.closed && !fallback ? pick.laps : 1;
  return laps > 1 ? `${name} · ${km(route.length)} × ${laps} = ${km(route.length * laps)}` : `${name} · ${km(route.length)}`;
}
