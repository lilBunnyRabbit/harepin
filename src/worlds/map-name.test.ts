import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { EVENTS } from "../career/career";
import { event_map } from "../career/career-store";
import { series_map } from "../career/series-run";
import { SEASONS } from "../career/series-seasons";
import { MAINLAND_SEED } from "../world/world-pick";
import { generate_world, plain_map, type MapSpec } from "../worldgen/kinds/kinds";
import { map_code, parse_map_code } from "../worldgen/kinds/map-code";
import { WorldKind } from "../worldgen/types";
import { MAP_NAMES, map_name, name_of } from "./map-name";

const town = (name: string, radius: number) => ({ name, radius });

test("a map with towns is named after its biggest, the first on a tie", () => {
  const map = plain_map(WorldKind.ISLAND, 3);
  expect(map_name(map, [town("Fen", 90), town("Holbrook", 130), town("Ren", 130)])).toBe("Island · Holbrook");
});

test("a map without towns takes a word seeded by its code: the same map keeps it, another map gets its own", () => {
  const one = map_name(plain_map(WorldKind.SKY, 7), []);
  expect(one).toMatch(/^Sky · [A-Z][a-z]+$/);
  expect(map_name(plain_map(WorldKind.SKY, 7), [])).toBe(one);
  expect(map_name(plain_map(WorldKind.SKY, 8), [])).not.toBe(one);
});

function read(code: string): MapSpec {
  const map = parse_map_code(code);
  if (!map.ok) throw new Error(`${code} does not read`);
  return map.map;
}

test("a map off its kind's normal options names the ones that differ after its word, which it shares with the plain map", () => {
  const word = map_name(plain_map(WorldKind.SKY, 7), []).split(" · ")[1];
  expect(map_name(read("1S0000007-F2"), [])).toBe(`Sky · ${word} · Exposed`);
  expect(map_name(read("1S0000007-F2Q2"), [])).toBe(`Sky · ${word} · Wild, Exposed`);
  expect(map_name(read("1C0000006-W1"), [town("Fen", 90)])).toBe("Island · Fen · Winter");
});

test("a label another option shares takes its option's name", () => {
  expect(map_name(read("1S0000007-A0V2"), [])).toMatch(/ · Gaps none, Boost pads more$/);
});

test("off the table, a town map shows its kind until it loads; a map without towns needs no table", () => {
  const daily = plain_map(WorldKind.DESERT, 123_456);
  expect(MAP_NAMES[map_code(daily)]).toBeUndefined();
  expect(name_of(daily)).toBe("Dunes");
  const sky = plain_map(WorldKind.SKY, 123_456);
  expect(name_of(sky)).toBe(map_name(sky, []));
});

test("MAP_NAMES holds every career, series and mainland map, named as its generated world names it", () => {
  const maps = new Map<string, MapSpec>();
  for (const event of EVENTS) maps.set(map_code(event_map(event)), event_map(event));
  for (const season of SEASONS) for (const event of season.events) maps.set(map_code(series_map(season, event)), series_map(season, event));
  const mainland = plain_map(WorldKind.MAINLAND, MAINLAND_SEED);
  maps.set(map_code(mainland), mainland);
  const named: Record<string, string> = {};
  for (const [code, map] of maps) named[code] = map_name(map, generate_world(map.seed, map.kind, map.levels).towns);
  if (!Bun.deepEquals(named, MAP_NAMES)) console.log(`MAP_NAMES = ${JSON.stringify(named, null, 2)}`);
  expect(named).toEqual({ ...MAP_NAMES });
  expect(new Set(Object.values(named)).size).toBe(maps.size);
  for (const [code, map] of maps) expect([code, name_of(map)]).toEqual([code, named[code]]);
}, 120_000);
