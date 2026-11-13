import { expect, test } from "bun:test";
import { LAB_STATIONS } from "./lab";

const off_path = (points: readonly (readonly [number, number])[], half: number, x: number, z: number) => {
  for (let s = 0; s < points.length - 1; s++) {
    const [ax, az] = points[s];
    const [bx, bz] = points[s + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - ax - dx * k, z - az - dz * k) <= half) return false;
  }
  return true;
};

test("a lane's spawn and gates sit on its lane", () => {
  for (const station of LAB_STATIONS)
    for (const lane of station.lanes) {
      const { path } = lane;
      if (!path) continue;
      for (const at of [lane.spawn, lane.start, lane.finish]) if (at) expect(off_path(path.points, path.half, at.x, at.z)).toBe(false);
    }
});

test("every lane's gates face the way its spawn drives", () => {
  for (const station of LAB_STATIONS)
    for (const lane of station.lanes) {
      const { start } = lane;
      if (!start) continue;
      const along = (start.x - lane.spawn.x) * start.fx + (start.z - lane.spawn.z) * start.fz;
      expect(along).toBeGreaterThan(0);
    }
});
