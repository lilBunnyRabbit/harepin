import "./fake-dom";

const { mesh_tones } = await import("../src/render/scene");
const { build_chunks, terrain_colors } = await import("../src/worldgen/chunks");
const { checksum, world_checksum } = await import("../src/worldgen/checksum");
const { sample } = await import("../src/worldgen/field");
const { generate } = await import("../src/worldgen/index");
const { road_junctions } = await import("../src/worldgen/road-layers");
type WorldData = import("../src/worldgen/types").WorldData;

const WET_PROBE = 30;

// Acceptance for the circuit (docs/plan/world.md, step 1): TIGHT_SHARE of the lap under TIGHT m radius, a hairpin under
// HAIRPIN m, at least CLIMB m of climb per lap, grade never past MAX_GRADE.
const TIGHT = 150;
const TIGHT_SHARE = 0.25;
const HAIRPIN = 60;
const CLIMB = 180;
const MAX_GRADE = 0.12;
const ARM = 10;

function road_report(world: WorldData): { text: string; ok: boolean } {
  const road = world.road;
  const n = road.length;
  const height = (x: number, z: number) => sample(world.terrain.heights, x, z);
  let grade = 0;
  let wet = 0;
  let climb = 0;
  let tight = 0;
  let hairpin = Infinity;
  for (let i = 0; i < n; i++) {
    const p = road[i];
    const q = road[(i + 1) % n];
    const run = Math.hypot(q.x - p.x, q.z - p.z);
    if (run > 0) grade = Math.max(grade, Math.abs(q.y - p.y) / run);
    climb += Math.max(0, q.y - p.y);
    if ([-1, 1].some((side) => height(p.x - p.tz * side * WET_PROBE, p.z + p.tx * side * WET_PROBE) < 0)) wet++;
    const a = road[(i - ARM + n) % n];
    const c = road[(i + ARM) % n];
    const cross = Math.abs((p.x - a.x) * (c.z - a.z) - (p.z - a.z) * (c.x - a.x));
    const radius = cross > 0 ? (Math.hypot(p.x - a.x, p.z - a.z) * Math.hypot(c.x - p.x, c.z - p.z) * Math.hypot(c.x - a.x, c.z - a.z)) / (2 * cross) : Infinity;
    if (radius < TIGHT) tight++;
    hairpin = Math.min(hairpin, radius);
  }
  const ys = road.map((p) => p.y);
  const ok = tight / n >= TIGHT_SHARE && hairpin < HAIRPIN && climb >= CLIMB && grade <= MAX_GRADE + 1e-6;
  return {
    text: `road ${((n * 2) / 1000).toFixed(2)} km, ${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)} m, under ${TIGHT} m ${((tight / n) * 100).toFixed(0)}%, tightest ${hairpin.toFixed(0)} m, climb ${climb.toFixed(0)} m, max grade ${(grade * 100).toFixed(1)}%, over water ${wet}${ok ? "" : " (misses the circuit targets)"}`,
    ok,
  };
}

// Junctions by kind, road off the circuit, and the sharpest angle between neighbouring arms of any patched junction.
function network_report(world: WorldData): string {
  const { graph, circuit } = world;
  const off = graph.edges.filter((e) => !circuit.includes(e.id));
  const degree = (id: number) => off.filter((e) => e.a === id || e.b === id).length;
  const on_ring = new Set(circuit.flatMap((id) => [graph.edges[id].a, graph.edges[id].b]));
  const crossings = [...on_ring].filter((id) => degree(id) >= 2).length;
  const { patched, loose } = road_junctions(world);
  let sharpest = 180;
  for (const { arms } of patched) {
    const angles = arms.map((a) => Math.atan2(a.points[0].tz, a.points[0].tx)).sort((p, q) => p - q);
    angles.forEach((a, i) => (sharpest = Math.min(sharpest, (((i + 1 < angles.length ? angles[i + 1] : angles[0] + 2 * Math.PI) - a) * 180) / Math.PI)));
  }
  const km = (kind: string) => off.filter((e) => e.kind === kind).reduce((sum, e) => sum + e.points.slice(1).reduce((m, p, i) => m + Math.hypot(p.x - e.points[i].x, p.z - e.points[i].z), 0), 0) / 1000;
  return `junctions ${patched.length} patched, ${loose.length} loose, ${crossings} crossing the circuit, sharpest ${sharpest.toFixed(0)}°, km spur ${km("highway").toFixed(2)}, local ${km("local").toFixed(2)}, street ${km("street").toFixed(2)}`;
}

const tones = mesh_tones();
for (const seed of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const t0 = performance.now();
  const world = generate(seed);
  const t1 = performance.now();
  const chunks = build_chunks(world, tones);
  const t2 = performance.now();
  const road_tris = chunks.reduce((sum, c) => sum + (c.road ? c.road.positions.length / 9 : 0), 0);
  const road_mb = chunks.reduce((sum, c) => sum + (c.road ? c.road.positions.byteLength * 2 : 0), 0) / 1e6;
  const triangles = chunks.reduce((sum, c) => sum + (c.terrain?.full ?? 0) / 3 + [c.road, c.buildings, c.parking].reduce((n, part) => n + (part ? part.positions.length / 9 : 0), 0), 0);
  console.log(
    `seed ${seed}: world ${(t1 - t0).toFixed(0)} ms, chunks ${(t2 - t1).toFixed(0)} ms (${(triangles / 1000).toFixed(0)}k tris), trees ${world.trees.length}, ${road_report(world).text}, world ${world_checksum(world)}, colours ${checksum([terrain_colors(world, tones.terrain)])}`,
  );
  const stages = world.timings.map(([stage, ms]) => `${stage} ${ms.toFixed(0)}`).join(", ");
  const streets = world.graph.edges.filter((e) => e.kind === "street").length;
  const spurs = world.graph.edges.filter((e) => e.kind === "highway" && !world.circuit.includes(e.id)).length;
  console.log(
    `  stages ms: ${stages} | towns ${world.towns.length}, streets ${streets}, spurs ${spurs}, lots ${world.lots.length}, buildings ${world.buildings.length}, parking ${world.parking.length}, lights ${world.props.filter((p) => p.kind === "street_light").length}, landmarks ${world.props.filter((p) => p.kind !== "street_light").map((p) => p.kind).join(" ")}, solids ${world.solids.length}`,
  );
  console.log(`  ${network_report(world)} | road mesh ${(road_tris / 1000).toFixed(0)}k tris, ${road_mb.toFixed(1)} MB`);
}
