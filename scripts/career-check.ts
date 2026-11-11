import "./fake-dom";

const { EVENTS, spot_of } = await import("../src/career/career");
const { find_site } = await import("../src/modes/gymkhana");
const { MODES } = await import("../src/modes/modes");
const { park_footprint } = await import("../src/modes/parking");
const { World } = await import("../src/world/world");
const { KINDS, build_world, world_key } = await import("../src/worldgen/kinds/kinds");
const { map_code, parse_map_code } = await import("../src/worldgen/kinds/map-code");
const { SPAWN_INDEX } = await import("../src/worldgen/types");
type MapSpec = import("../src/worldgen/kinds/kinds").MapSpec;
type World = import("../src/world/world").World;

// Generates each career event's map and checks its mode level runs there: the route exists, the kind has open ground
// for modes that need it, gymkhana and parking find a site near the start, the world is not streamed. Prints each
// event's `tuned` key. `--suggest N` tries the next N seeds of the same preset and options for every failing event.
const at = process.argv.indexOf("--suggest");
const SUGGEST = at >= 0 ? Number(process.argv[at + 1] ?? 20) : 0;
const ONLY = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--suggest");

const worlds = new Map<string, World>();
function world_of(map: MapSpec): World {
  const code = map_code(map);
  let world = worlds.get(code);
  if (!world) {
    world = new World(map.seed, build_world(map.seed, map.kind, map.levels).data, undefined, map.levels);
    worlds.set(code, world);
  }
  return world;
}

const PARK_AREA = park_footprint();

function problem(map: MapSpec, mode_id: string, level: string): string | null {
  const def = MODES.find((m) => m.id === mode_id);
  if (!def) return `no mode ${mode_id}`;
  if (def.needs_ground && !KINDS[map.kind].open_ground) return `${map.kind} has no open ground`;
  const world = world_of(map);
  if (world.tiles.streamed) return "streamed world: modes refuse it";
  if (!def.levels(world).some((l) => l.id === level)) return `no level ${level} (has ${def.levels(world).map((l) => l.id).join(" ")})`;
  if (mode_id === "gymkhana" && !find_site(world, SPAWN_INDEX)) return "no gymkhana site";
  if (mode_id === "parking" && !find_site(world, SPAWN_INDEX, PARK_AREA)) return "no parking site";
  return null;
}

let failed = 0;
for (const event of EVENTS) {
  if (ONLY.length && !ONLY.includes(event.id)) continue;
  const spot = spot_of(event);
  const read = parse_map_code(spot.map);
  if (!read.ok) {
    failed++;
    console.log(`${event.id} ${spot.map}: map code ${read.why}`);
    continue;
  }
  const map = read.map;
  const why = problem(map, event.mode, spot.level);
  const key = world_key(map.seed, map.kind, map.levels);
  const stale = event.tuned === key ? "" : ` tuned "${event.tuned}" != "${key}"`;
  console.log(`${event.id} ${event.mode} ${spot.level} on ${spot.map}${event.stand_in ? " (stand-in)" : ""}: ${why ?? "ok"} | tuned "${key}"${stale ? " STALE" : ""}`);
  if (why || stale) failed++;
  if (!why || !SUGGEST) continue;
  for (let seed = map.seed + 1; seed <= map.seed + SUGGEST; seed++) {
    const other = { ...map, seed };
    if (problem(other, event.mode, spot.level)) continue;
    console.log(`  try ${map_code(other)} (tuned "${world_key(seed, map.kind, map.levels)}")`);
    break;
  }
}
console.log(failed ? `${failed} events need a fix` : "every event runs on its map");
if (failed) process.exitCode = 1;
