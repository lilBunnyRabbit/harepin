import { expect, test } from "bun:test";
import { CHUNKS } from "./chunk-grid";
import { build_tile } from "./ground";
import { build_world, generate_world, KINDS, snow_of, world_key } from "./kinds/kinds";
import { WINTER_GRIP } from "./kinds/kind-def";
import { map_code, parse_map_code } from "./kinds/map-code";
import { SNOW_KIT } from "./snow";
import { slice_tile } from "./tiles";
import { on_ice } from "./ice";
import { generate } from "./index";
import { ISLAND, type Recipe } from "./recipe";
import { ROAD_HALF, SurfaceId, WorldKind } from "./types";

const KIT_SURFACES: number[] = [SurfaceId.SNOW, SurfaceId.PACKED_SNOW, SurfaceId.ICE, SurfaceId.SLUSH];

const winter = (kind: WorldKind) => KINDS[kind].options.map((o) => (o.field === "W" ? 1 : o.normal));

test("winter is a lettered field: its own records key and code, never a K2 digit", () => {
  const levels = winter(WorldKind.ISLAND);
  expect(world_key(42, WorldKind.ISLAND, levels)).toBe("42:w8:W1");
  const code = map_code({ kind: WorldKind.ISLAND, seed: 42, levels });
  expect(code.endsWith("-W1")).toBe(true);
  const read = parse_map_code(code);
  expect(read.ok && read.map.levels).toEqual(levels);
  const k2 = parse_map_code("42-121111", WorldKind.ISLAND);
  expect(k2.ok && snow_of(k2.map)).toBeNull();
  expect(world_key(42, WorldKind.ISLAND, KINDS.island.options.map((o, i) => (i === 1 ? 2 : o.normal)))).toBe("42:w8:121111");
});

test("only a winter map lays the snow kit and drives on its grip", () => {
  expect(snow_of({ kind: WorldKind.ISLAND, levels: [] })).toBeNull();
  for (const kind of [WorldKind.ISLAND, WorldKind.DESERT, WorldKind.ALPINE]) expect(snow_of({ kind, levels: winter(kind) })).toBe(SNOW_KIT);
  expect(SNOW_KIT.grip).toBe(WINTER_GRIP);
  expect([WINTER_GRIP.surfaces[SurfaceId.SNOW].grip, WINTER_GRIP.surfaces[SurfaceId.ICE].grip, WINTER_GRIP.road.grip]).toEqual([0.55, 0.35, 0.8]);
});

for (const kind of [WorldKind.ISLAND, WorldKind.DESERT, WorldKind.ALPINE])
  test(`a winter ${kind} keeps the summer roads, towns and trees under a cover of snow`, () => {
    const summer = generate_world(1, kind);
    const built = build_world(1, kind, winter(kind));
    expect(built.retries).toBe(0);
    const snowy = built.data;
    for (const part of ["road", "graph", "towns", "lots", "buildings", "routes", "checkpoints", "ramps"] as const) expect(snowy[part]).toEqual(summer[part]);
    const spots = (things: readonly { x: number; z: number }[]) => things.map(({ x, z }) => [x, z]);
    expect(spots(snowy.trees)).toEqual(spots(summer.trees));
    expect(spots(snowy.items)).toEqual(spots(summer.items));
    expect(snowy.terrain.road_dist).toEqual(summer.terrain.road_dist);
    const { heights, road_dist } = snowy.terrain;
    let banked = 0;
    for (let k = 0; k < heights.length; k++) {
      const rise = heights[k] - summer.terrain.heights[k];
      if (road_dist[k] <= SNOW_KIT.bank.from || road_dist[k] >= SNOW_KIT.bank.to) expect(rise).toBe(0);
      else if (rise > 0) banked++;
      expect(rise).toBeLessThanOrEqual(SNOW_KIT.bank.height + 1e-4);
    }
    expect(banked).toBeGreaterThan(1000);
    expect([...snowy.terrain.surface].every((s) => KIT_SURFACES.includes(s))).toBe(true);
    let bad = 0;
    for (let index = 0; index < CHUNKS * CHUNKS; index++) {
      const a = build_tile(snowy.ground, index);
      const b = slice_tile(snowy.terrain, index);
      if (!Bun.deepEquals(a.heights, b.heights) || !Bun.deepEquals(a.surface, b.surface)) bad++;
    }
    expect(bad).toBe(0);
  }, 60_000);

test("frozen lakes lie flat under ice, clear of roads, towns and trees, and replay tile by tile", () => {
  const recipe: Recipe = { ...ISLAND, snow: SNOW_KIT, ice: { count: 4, radius: [50, 110], reach: 760 } };
  const data = generate(2, recipe);
  const op = data.ground.ops.find((o) => o.kind === "ice");
  const lakes = op?.kind === "ice" ? op.lakes : [];
  expect(lakes.length).toBeGreaterThan(0);
  const { heights, surface, road_dist } = data.terrain;
  let ice = 0;
  for (let k = 0; k < surface.length; k++) {
    if (surface[k] !== SurfaceId.ICE) continue;
    ice++;
    expect(road_dist[k]).toBeGreaterThan(ROAD_HALF + 20);
    expect(lakes.some((l) => Math.abs(heights[k] - l.level) < 1e-3)).toBe(true);
  }
  expect(ice).toBeGreaterThan(500);
  for (const thing of [...data.trees, ...data.items, ...data.ramps]) expect(on_ice(lakes, thing.x, thing.z)).toBe(false);
  for (const town of data.towns) for (const l of lakes) expect(Math.hypot(town.x - l.x, town.z - l.z)).toBeGreaterThan(town.radius + l.radius);
  let bad = 0;
  for (let index = 0; index < CHUNKS * CHUNKS; index++) {
    const a = build_tile(data.ground, index);
    const b = slice_tile(data.terrain, index);
    if (!Bun.deepEquals(a.heights, b.heights) || !Bun.deepEquals(a.surface, b.surface)) bad++;
  }
  expect(bad).toBe(0);
}, 60_000);
