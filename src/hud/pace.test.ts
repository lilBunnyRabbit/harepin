import { describe, expect, test } from "bun:test";
import { corners_ahead, nearest_point, read_route, reverse_route, Side, type Ahead, type PacePoint } from "./pace";

const STEP = 2;

/** Legs of [metres, radius]; a positive radius turns right. */
function drive(legs: [number, number][]): PacePoint[] {
  const points: PacePoint[] = [];
  let x = 0;
  let z = 0;
  let heading = 0;
  for (const [metres, radius] of legs)
    for (let s = 0; s < metres; s += STEP) {
      points.push({ x, z, tx: Math.sin(heading), tz: Math.cos(heading) });
      if (radius) heading -= STEP / radius;
      x += Math.sin(heading) * STEP;
      z += Math.cos(heading) * STEP;
    }
  return points;
}

const quarter = (radius: number) => (Math.PI / 2) * radius;
const ahead = (): Ahead => ({ next: -1, distance: 0, then: -1, into: false });

describe("read_route", () => {
  test("a 90° right of radius 30 after 100 m is one grade 2 right", () => {
    const { corners } = read_route(drive([[100, 0], [quarter(30), 30], [100, 0]]), false);
    expect(corners).toHaveLength(1);
    expect(corners[0]).toMatchObject({ side: Side.RIGHT, grade: 2, hairpin: false });
    expect(corners[0].start).toBeGreaterThan(85);
    expect(corners[0].start).toBeLessThan(100);
    expect(corners[0].radius).toBeCloseTo(30, -1);
  });

  test("the grade follows the radius, and a wide sweep is no corner at all", () => {
    const grade = (radius: number) => read_route(drive([[60, 0], [quarter(radius), -radius], [60, 0]]), false).corners[0]?.grade;
    expect(grade(15)).toBe(1);
    expect(grade(50)).toBe(3);
    expect(grade(80)).toBe(4);
    expect(grade(130)).toBe(5);
    expect(grade(200)).toBe(6);
    expect(read_route(drive([[60, 0], [300, 400], [60, 0]]), false).corners).toHaveLength(0);
  });

  test("a tight 180° is a hairpin", () => {
    const [corner] = read_route(drive([[60, 0], [Math.PI * 14, -14], [60, 0]]), false).corners;
    expect(corner).toMatchObject({ side: Side.LEFT, grade: 1, hairpin: true });
  });

  test("driven the other way, sides swap and order reverses", () => {
    const route = read_route(drive([[80, 0], [quarter(30), 30], [30, 0], [quarter(60), -60], [80, 0]]), false);
    expect(route.corners.map((c) => c.side)).toEqual([Side.RIGHT, Side.LEFT]);
    const back = reverse_route(route);
    expect(back.corners.map((c) => [c.side, c.grade])).toEqual([
      [Side.RIGHT, 3],
      [Side.LEFT, 2],
    ]);
    expect(back.corners[0].start).toBeCloseTo(route.length - route.corners[1].end);
  });
});

describe("corners_ahead", () => {
  const route = read_route(drive([[80, 0], [quarter(30), 30], [20, 0], [quarter(60), -60], [200, 0]]), false);

  test("gives the distance to the next corner and calls the close one after it into", () => {
    const out = corners_ahead(route, 10, ahead());
    expect(out.next).toBe(0);
    expect(out.distance).toBeCloseTo(route.corners[0].start - 10);
    expect(out.then).toBe(1);
    expect(out.into).toBe(true);
  });

  test("inside a corner before its apex the distance is 0; past the last one there is nothing", () => {
    expect(corners_ahead(route, route.corners[0].start + 1, ahead()).distance).toBe(0);
    expect(corners_ahead(route, route.corners[1].apex + 1, ahead()).next).toBe(-1);
  });

  test("a closed route wraps round to its first corner", () => {
    const r = 40;
    const loop = read_route(drive([[100, 0], [quarter(r), r], [100, 0], [quarter(r), r], [100, 0], [quarter(r), r], [100, 0], [quarter(r), r]]), true);
    expect(loop.corners).toHaveLength(4);
    expect(loop.corners.every((c) => c.side === Side.RIGHT && c.grade === 3)).toBe(true);
    const last = loop.corners[3];
    const out = corners_ahead(loop, last.apex + 1, ahead());
    expect(out.next).toBe(0);
    expect(out.distance).toBeCloseTo(loop.length - last.apex - 1 + loop.corners[0].start);
  });
});

describe("nearest_point", () => {
  const points = drive([[200, 0]]);

  test("finds the point near the hint, and the whole route when the hint is far off", () => {
    expect(nearest_point(points, false, 3, 50, 20, 10, 20)).toBe(25);
    expect(nearest_point(points, false, 0, 180, 5, 10, 20)).toBe(90);
  });
});
