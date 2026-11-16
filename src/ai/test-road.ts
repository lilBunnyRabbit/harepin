import type { RoadPoint } from "../worldgen/types";

/** A closed ring road, points 2 m apart, driven anticlockwise: wide enough and every stretch is a straight with the line on the centre. */
export function ring(radius: number): RoadPoint[] {
  const points: RoadPoint[] = [];
  for (let a = 0; a < 2 * Math.PI; a += 2 / radius) points.push({ x: Math.cos(a) * radius, y: 0, z: Math.sin(a) * radius, tx: -Math.sin(a), tz: Math.cos(a) });
  return points;
}
