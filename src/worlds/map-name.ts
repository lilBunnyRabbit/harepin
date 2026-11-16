import { mulberry32, seed_of } from "../rng";
import { KINDS, type MapSpec } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import { town_name } from "../worldgen/towns";
import type { Town } from "../worldgen/types";
import { WORLDS } from "./worlds";

const JOIN = " · ";

// Career, series and mainland maps by code; a generator bump fails map-name.test.ts, which prints the new table.
export const MAP_NAMES: Readonly<Record<string, string>> = {
  "1C0000003": "Island · Harwar",
  "1D0000005": "Dune sea · Lowhol",
  "1S0000002": "Sky Track · Burrver",
  "1A0000004": "Alpine pass · Fencloren",
  "1T0000006": "Frozen lakes · Harwarlow",
  "1C0000006-W1": "Island · Bundell",
  "1M0E5M3PK": "Mainland · Owbleren",
  "1V0000001": "Volcano · Dellmead",
  "1S0000007-F2": "Sky Track · Renclo",
  "1A0000009": "Alpine pass · Loppin",
  "1C0000008": "Island · Renmead",
  "1C0000009-W1": "Island · Harfenbun",
  "1F0000001": "Ice canyon · Burrmeadmead",
  "1V0000002": "Volcano · Owthimthim",
  "1C0000011": "Island · Lopbun",
  "1D0000007": "Dune sea · Warburr",
  "1F0000002": "Ice canyon · Clomead",
  "1S0000011": "Sky Track · Fenbun",
  "1T0000008": "Frozen lakes · Blewar",
  "1B0000004": "Big dunes · Meadburrbun",
  "1S0000007-F2Q2": "Sky Track · Blemead",
  "1W0000004": "Velodrome · Burrwarwar",
  "1C000000D": "Island · Owbrook",
  "1C0000002": "Island · Thimbun",
  "1C0000009": "Island · Harfenbun",
  "1C0000004": "Island · Holren",
  "1C0000005": "Island · Verfen",
  "1C0000000": "Island · Blebunow",
  "1A0000006": "Alpine pass · Bundell",
  "1A000000M": "Alpine pass · Owow",
  "1A000000E": "Alpine pass · Hardell",
  "1A000000R": "Alpine pass · Owverpin",
  "1A000000V": "Alpine pass · Brookfenhar",
  "1A0000001": "Alpine pass · Owbunpin",
  "1D000000E": "Dune sea · Meadrenlop",
  "1D0000009": "Dune sea · Cloow",
  "1D0000002": "Dune sea · Fenclo",
  "1D000000H": "Dune sea · Brookbun",
  "1D0000011": "Dune sea · Dellow",
  "1D0000000": "Dune sea · Burrwarow",
  "1M000000J": "Mainland · Renclo",
  "1M000001A": "Mainland · Warmeadow",
  "1M0000013": "Mainland · Warpinmead",
  "1M000001C": "Mainland · Verow",
  "1M000001K": "Mainland · Clowar",
  "1M000001B": "Mainland · Brooklopver",
};

function seed_word(map: MapSpec): string {
  return town_name(mulberry32(seed_of(`${map_code(map)}:name`)));
}

export function map_name(map: MapSpec, towns: readonly Pick<Town, "name" | "radius">[]): string {
  const biggest = towns.reduce<Pick<Town, "name" | "radius"> | null>((best, town) => (best && best.radius >= town.radius ? best : town), null);
  return `${WORLDS[map.kind].name}${JOIN}${biggest?.name ?? seed_word(map)}`;
}

const has_towns = ({ kind, levels }: MapSpec) => ((KINDS[kind].tuned?.(levels) ?? KINDS[kind].recipe)?.towns.max ?? 0) > 0;

// A town map off the table (a daily or random run) shows its kind's name until its world loads.
export function name_of(map: MapSpec): string {
  const named = MAP_NAMES[map_code(map)];
  if (named) return named;
  return has_towns(map) ? WORLDS[map.kind].name : map_name(map, []);
}
