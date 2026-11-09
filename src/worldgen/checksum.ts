import type { WorldData } from "./types";

export function checksum(arrays: ArrayLike<number>[]): string {
  let h = 0x811c9dc5;
  for (const values of arrays) {
    const bytes = new Uint8Array(Float64Array.from(values).buffer);
    for (const byte of bytes) h = Math.imul(h ^ byte, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function world_checksum(data: WorldData): string {
  return checksum([
    data.terrain.heights,
    data.terrain.road_dist,
    data.road.flatMap((p) => [p.x, p.y, p.z, p.tx, p.tz]),
    data.trees.flatMap((t) => [t.x, t.y, t.z, t.scale, t.kind]),
    data.solids.flatMap((s) => (s.kind === "circle" ? [s.x, s.y, s.z, s.radius, s.height] : [s.x, s.y, s.z, s.hw, s.hd, s.cos, s.sin, s.height, s.bottom ?? -1e9])),
    data.ramps.flatMap((r) => [r.x, r.y, r.z, r.fx, r.fz, r.hw, r.length, r.rise, r.grade]),
    data.challenges.flatMap((c) => [c.ramp, c.x, c.y, c.z, c.gap_hw, c.gap_bottom, c.gap_top]),
    data.items.flatMap((i) => [i.x, i.y, i.z, i.fx, i.fz, i.scale]),
  ]);
}
