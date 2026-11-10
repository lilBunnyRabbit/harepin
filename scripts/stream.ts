import "./fake-dom";

// `bun scripts/stream.ts [seeds…]`: mainland plan, then every chunk built nearest the spawn first, as the worker streams them.
const { mesh_tones } = await import("../src/render/scene");
const { extent } = await import("../src/worldgen/chunk-grid");
const { plan_mainland, MAINLAND_SIZE } = await import("../src/worldgen/mainland");
const { TileMesher } = await import("../src/worldgen/tile-mesher");
const { chunk_corner, CHUNK } = await import("../src/worldgen/chunk-grid");
const { SPAWN_INDEX } = await import("../src/worldgen/types");

const seeds = process.argv.slice(2).map(Number).filter(Number.isFinite);
const tones = mesh_tones();
const ext = extent(MAINLAND_SIZE);
const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

for (const seed of seeds.length ? seeds : [0, 1, 2]) {
  const t0 = performance.now();
  const { data } = plan_mainland(seed);
  const t1 = performance.now();
  const mesher = new TileMesher(data, ext, tones);
  const t2 = performance.now();
  const spawn = data.road.at(SPAWN_INDEX) ?? data.road[0];
  const order = Array.from({ length: ext.side * ext.side }, (_, i) => i).sort((a, b) => {
    const d = (i: number) => {
      const [x, z] = chunk_corner(i, ext);
      return (x + CHUNK / 2 - spawn.x) ** 2 + (z + CHUNK / 2 - spawn.z) ** 2;
    };
    return d(a) - d(b);
  });
  const times: number[] = [];
  let first9 = 0;
  let tris = 0;
  let bytes = 0;
  for (const index of order) {
    const s = performance.now();
    const { chunk } = mesher.build(index);
    times.push(performance.now() - s);
    if (times.length === 9) first9 = performance.now() - t2;
    tris += (chunk.terrain?.full ?? 0) / 3 + (chunk.road ? chunk.road.positions.length / 9 : 0);
    for (const part of [chunk.terrain, chunk.road]) if (part) bytes += part.positions.byteLength + part.colors.byteLength;
    if (chunk.terrain) bytes += chunk.terrain.index.byteLength;
  }
  const sorted = [...times].sort((a, b) => a - b);
  const mb = (bytes / 1e6 / order.length).toFixed(3);
  console.log(
    `seed ${seed}: plan ${(t1 - t0).toFixed(0)} ms, mesher setup ${(t2 - t1).toFixed(0)} ms, first 3x3 ${first9.toFixed(0)} ms, chunk p50 ${pct(sorted, 0.5).toFixed(1)} p95 ${pct(sorted, 0.95).toFixed(1)} max ${sorted[sorted.length - 1].toFixed(1)} ms, ${(tris / order.length / 1000).toFixed(1)}k tris and ${mb} MB per chunk`,
  );
}
