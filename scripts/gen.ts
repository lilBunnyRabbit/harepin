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

function road_report(world: WorldData): string {
  const ys = world.road.map((p) => p.y);
  const n = world.road.length;
  const height = (x: number, z: number) => sample(world.terrain.heights, x, z);
  let grade = 0;
  let wet = 0;
  for (let i = 0; i < n; i++) {
    const p = world.road[i];
    grade = Math.max(grade, Math.abs(world.road[(i + 5) % n].y - p.y) / 10);
    if ([-1, 1].some((side) => height(p.x - p.tz * side * WET_PROBE, p.z + p.tx * side * WET_PROBE) < 0)) wet++;
  }
  return `road ${((n * 2) / 1000).toFixed(2)} km, ${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)} m, max grade ${(grade * 100).toFixed(0)}%, over water ${wet}`;
}

const tones = mesh_tones();
for (const seed of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const t0 = performance.now();
  const world = generate(seed);
  const t1 = performance.now();
  const chunks = build_chunks(world, tones);
  const t2 = performance.now();
  const triangles = chunks.reduce((sum, c) => sum + c.terrain.full / 3 + [c.road, c.buildings, c.parking].reduce((n, part) => n + (part ? part.positions.length / 9 : 0), 0), 0);
  console.log(
    `seed ${seed}: world ${(t1 - t0).toFixed(0)} ms, chunks ${(t2 - t1).toFixed(0)} ms (${(triangles / 1000).toFixed(0)}k tris), trees ${world.trees.length}, ${road_report(world)}, world ${world_checksum(world)}, colours ${checksum([terrain_colors(world, tones.terrain)])}`,
  );
  const stages = world.timings.map(([stage, ms]) => `${stage} ${ms.toFixed(0)}`).join(", ");
  const streets = world.graph.edges.filter((e) => e.kind === "street").length;
  const spurs = world.graph.edges.length - streets - 1;
  console.log(
    `  stages ms: ${stages} | towns ${world.towns.length}, streets ${streets}, spurs ${spurs}, lots ${world.lots.length}, buildings ${world.buildings.length}, parking ${world.parking.length}, lights ${world.props.length}, solids ${world.solids.length}`,
  );
}
