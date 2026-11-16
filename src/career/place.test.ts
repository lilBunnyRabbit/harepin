import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { plain_map } from "../worldgen/kinds/kinds";
import { parse_map_code } from "../worldgen/kinds/map-code";
import { WorldKind } from "../worldgen/types";
import { MAINLAND_SEED, NEW_PLAYER_KIND } from "../world/world-pick";
import { MAP_NAMES, short_name_of } from "../worlds/map-name";
import { event_of, type CareerEvent } from "./career";
import { event_map } from "./career-store";
import { by_map, place_of } from "./place";

const at = (id: string): CareerEvent => event_of(id)!;

test("an event on the loaded map is here; another map's carries its name and kind", () => {
  const island = event_map(at("r1"));
  expect(place_of(island, island)).toEqual({ here: true });
  expect(place_of(event_map(at("r6")), island)).toEqual({ here: false, name: "Sky · Burrver", kind: WorldKind.SKY });
});

test("the same seed with other map options is another map", () => {
  const read = parse_map_code("1C0000006-W1");
  if (!read.ok) throw new Error("map code does not read");
  expect(place_of(read.map, plain_map(WorldKind.ISLAND, 6)).here).toBe(false);
});

test("events group by map, the loaded map's first, then in list order", () => {
  const events = ["r1", "r4", "r6", "r2", "r5", "r7"].map(at);
  const groups = by_map(events, event_map(at("r6")));
  expect(groups.map((g) => [g.code, g.place.here, g.events.map((e) => e.id)])).toEqual([
    ["1S0000002", true, ["r6", "r7"]],
    ["1C0000003", false, ["r1", "r2"]],
    ["1D0000005", false, ["r4", "r5"]],
  ]);
  expect(groups[1].place).toEqual({ here: false, name: "Island · Harwar", kind: WorldKind.ISLAND });
});

test("a fresh profile boots on the mainland, so First lap is on another map, named apart from the mainland", () => {
  const boot = plain_map(NEW_PLAYER_KIND, MAINLAND_SEED);
  const place = place_of(event_map(at("r1")), boot);
  expect(place).toEqual({ here: false, name: "Island · Harwar", kind: WorldKind.ISLAND });
  expect(short_name_of(boot)).not.toBe(place.here ? "" : place.name);
});

test("no two named maps share a name", () => {
  const names = Object.values(MAP_NAMES);
  expect(new Set(names).size).toBe(names.length);
});
