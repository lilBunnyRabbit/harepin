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

const { World } = await import("../src/world");
const { terrain_mesh } = await import("../src/scene");

const WET_PROBE = 30;

export function checksum(arrays: ArrayLike<number>[]): string {
  let h = 0x811c9dc5;
  for (const values of arrays) {
    const bytes = new Uint8Array(Float64Array.from(values).buffer);
    for (const byte of bytes) h = Math.imul(h ^ byte, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function world_checksum(world: InstanceType<typeof World>): string {
  return checksum([
    world.heights,
    world.road_dist,
    world.road.flatMap((p) => [p.x, p.y, p.z, p.tx, p.tz]),
    world.trees.flatMap((t) => [t.x, t.y, t.z, t.scale, t.kind]),
    world.solids.flatMap((s) => [s.x, s.y, s.z, s.radius, s.height]),
  ]);
}

function road_report(world: InstanceType<typeof World>): string {
  const ys = world.road.map((p) => p.y);
  const n = world.road.length;
  let grade = 0;
  let wet = 0;
  for (let i = 0; i < n; i++) {
    const p = world.road[i];
    grade = Math.max(grade, Math.abs(world.road[(i + 5) % n].y - p.y) / 10);
    if ([-1, 1].some((side) => world.height(p.x - p.tz * side * WET_PROBE, p.z + p.tx * side * WET_PROBE) < 0)) wet++;
  }
  return `road ${((n * 2) / 1000).toFixed(2)} km, ${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)} m, max grade ${(grade * 100).toFixed(0)}%, over water ${wet}`;
}

for (const seed of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const t0 = performance.now();
  const world = new World(seed);
  const t1 = performance.now();
  const mesh = terrain_mesh(world);
  const t2 = performance.now();
  const colors = mesh.geometry.getAttribute("color").array;
  console.log(
    `seed ${seed}: world ${(t1 - t0).toFixed(0)} ms, terrain_mesh ${(t2 - t1).toFixed(0)} ms, trees ${world.trees.length}, ${road_report(world)}, world ${world_checksum(world)}, colours ${checksum([colors])}`,
  );
}
