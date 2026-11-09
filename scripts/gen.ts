import { seed_of } from "../src/rng";

// palette.ts reads theme tokens from the DOM on import; each token here hashes its name into a stable fake colour.
const style = { setProperty() {} };
Object.assign(globalThis, {
  location: { search: "" },
  localStorage: { getItem: () => null, setItem() {} },
  getComputedStyle: (el: { style: { color: string } }) => ({ color: el.style.color }),
  document: {
    documentElement: { style },
    body: { append() {} },
    createElement: () => {
      let fill = "";
      return {
        style: { color: "" },
        remove() {},
        getContext: () => ({
          set fillStyle(v: string) {
            fill = v;
          },
          clearRect() {},
          fillRect() {},
          getImageData: () => {
            const h = seed_of(fill);
            return { data: [h & 255, (h >>> 8) & 255, (h >>> 16) & 255, 255] };
          },
        }),
      };
    },
  },
});

const { mesh_tones } = await import("../src/scene");
const { build_chunks, terrain_colors } = await import("../src/worldgen/chunks");
const { checksum, world_checksum } = await import("../src/worldgen/checksum");
const { sample } = await import("../src/worldgen/field");
const { generate } = await import("../src/worldgen/index");
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

const tones = mesh_tones();
for (const seed of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const t0 = performance.now();
  const world = generate(seed);
  const t1 = performance.now();
  const chunks = build_chunks(world, tones);
  const t2 = performance.now();
  const triangles = chunks.reduce((sum, c) => sum + (c.terrain?.full ?? 0) / 3 + [c.road, c.buildings, c.parking].reduce((n, part) => n + (part ? part.positions.length / 9 : 0), 0), 0);
  console.log(
    `seed ${seed}: world ${(t1 - t0).toFixed(0)} ms, chunks ${(t2 - t1).toFixed(0)} ms (${(triangles / 1000).toFixed(0)}k tris), trees ${world.trees.length}, ${road_report(world).text}, world ${world_checksum(world)}, colours ${checksum([terrain_colors(world, tones.terrain)])}`,
  );
  const stages = world.timings.map(([stage, ms]) => `${stage} ${ms.toFixed(0)}`).join(", ");
  const streets = world.graph.edges.filter((e) => e.kind === "street").length;
  const spurs = world.graph.edges.length - streets - 1;
  console.log(
    `  stages ms: ${stages} | towns ${world.towns.length}, streets ${streets}, spurs ${spurs}, lots ${world.lots.length}, buildings ${world.buildings.length}, parking ${world.parking.length}, lights ${world.props.length}, solids ${world.solids.length}`,
  );
}
