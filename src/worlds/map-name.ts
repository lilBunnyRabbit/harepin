import { mulberry32, seed_of } from "../rng";
import { KINDS, plain_map, type MapSpec } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import type { OptionDef } from "../worldgen/kinds/options";
import { town_name } from "../worldgen/towns";
import type { Town } from "../worldgen/types";
import { WORLDS } from "./worlds";

const JOIN = " · ";
const SHORT_WORDS = 2;

// Career, series and mainland maps by code; a generator bump fails map-name.test.ts, which prints the new table.
export const MAP_NAMES: Readonly<Record<string, string>> = {
  "1C0000003": "Island · Harwar",
  "1D0000005": "Dune sea · Lowhol",
  "1S0000002": "Sky · Burrver",
  "1A0000004": "Alpine · Fencloren",
  "1T0000006": "Lakes · Harwarlow",
  "1C0000006-W1": "Island · Bundell · Winter",
  "1M0E5M3PK": "Mainland · Owbleren",
  "1V0000001": "Volcano · Dellmead",
  "1S0000007-F2": "Sky · Pinwar · Exposed",
  "1A0000009": "Alpine · Loppin",
  "1C0000008": "Island · Renmead",
  "1C0000009-W1": "Island · Harfenbun · Winter",
  "1F0000001": "Ice canyon · Burrmeadmead",
  "1V0000002": "Volcano · Owthimthim",
  "1C0000011": "Island · Lopbun",
  "1D0000007": "Dune sea · Warburr",
  "1F0000002": "Ice canyon · Clomead",
  "1S0000011": "Sky · Fenbun",
  "1T0000008": "Lakes · Blewar",
  "1B0000004": "Big dunes · Meadburrbun",
  "1S0000007-F2Q2": "Sky · Pinwar · Wild, Exposed",
  "1W0000004": "Velodrome · Burrwarwar",
  "1C000000D": "Island · Owbrook",
  "1C0000002": "Island · Thimbun",
  "1C0000009": "Island · Harfenbun",
  "1C0000004": "Island · Holren",
  "1C0000005": "Island · Verfen",
  "1C0000000": "Island · Blebunow",
  "1A0000006": "Alpine · Bundell",
  "1A000000M": "Alpine · Owow",
  "1A000000E": "Alpine · Hardell",
  "1A000000R": "Alpine · Owverpin",
  "1A000000V": "Alpine · Brookfenhar",
  "1A0000001": "Alpine · Owbunpin",
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

// Seeded by the plain map, so a map's variants share its word and differ only by their option words.
function seed_word({ kind, seed }: MapSpec): string {
  return town_name(mulberry32(seed_of(`${map_code(plain_map(kind, seed))}:name`)));
}

// Which options use each word label, across every kind: a label one option owns reads alone ("Winter"); one shared ("More") or a slider's ("110%") needs its option's name.
const OWNERS = new Map<string, Set<string>>();
for (const { options } of Object.values(KINDS))
  for (const option of options) if (!option.slider) for (const label of option.labels) OWNERS.set(label, (OWNERS.get(label) ?? new Set()).add(option.name));

function option_word(option: OptionDef, level: number): string {
  if (option.switch) return level ? option.name : `No ${option.name.toLowerCase()}`;
  const label = option.labels[level];
  return OWNERS.get(label)?.size === 1 ? label : `${option.name} ${label.toLowerCase()}`;
}

function option_words({ kind, levels }: MapSpec): string[] {
  const { options } = KINDS[kind];
  return options.flatMap((option, i) => {
    const level = levels[i] ?? option.normal;
    return level === option.normal ? [] : [option_word(option, level)];
  });
}

const head = (map: MapSpec, word: string) => `${WORLDS[map.kind].label}${JOIN}${word}`;

function town_word(map: MapSpec, towns: readonly Pick<Town, "name" | "radius">[]): string {
  const biggest = towns.reduce<Pick<Town, "name" | "radius"> | null>((best, town) => (best && best.radius >= town.radius ? best : town), null);
  return biggest?.name ?? seed_word(map);
}

function with_words(head: string, words: readonly string[]): string {
  return words.length ? `${head}${JOIN}${words.join(", ")}` : head;
}

/** The whole name, every option word: the map and the maps page. */
export function map_name(map: MapSpec, towns: readonly Pick<Town, "name" | "radius">[]): string {
  return with_words(head(map, town_word(map, towns)), option_words(map));
}

/** Chips and tickets: at most `SHORT_WORDS` option words, the rest as "+N". */
export function short_name(map: MapSpec, towns: readonly Pick<Town, "name" | "radius">[]): string {
  return short_of_words(head(map, town_word(map, towns)), option_words(map));
}

function short_of_words(head: string, words: readonly string[]): string {
  const kept = words.slice(0, SHORT_WORDS);
  if (words.length > SHORT_WORDS) kept.push(`+${words.length - SHORT_WORDS}`);
  return with_words(head, kept);
}

const has_towns = ({ kind, levels }: MapSpec) => ((KINDS[kind].tuned?.(levels) ?? KINDS[kind].recipe)?.towns.max ?? 0) > 0;

// A town map off the table (a daily or random run) shows only its kind until its world loads: no word sits where the town goes.
export function name_of(map: MapSpec): string {
  return MAP_NAMES[map_code(map)] ?? (has_towns(map) ? WORLDS[map.kind].label : map_name(map, []));
}

export function short_name_of(map: MapSpec): string {
  const named = MAP_NAMES[map_code(map)];
  if (named) return short_of_words(named.split(JOIN).slice(0, 2).join(JOIN), option_words(map));
  return has_towns(map) ? WORLDS[map.kind].label : short_name(map, []);
}
