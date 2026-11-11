/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { generate_world } from "./kinds/kinds";
import { HAIRPIN_RADIUS } from "./switchback";
import { RouteKind, SPUR_GRADE, WorldKind } from "./types";

const COAST = 6;
const GRADE_RUN = 5;

for (const seed of sweep(10))
  test(`volcano ${seed}: one road down off the rim to the sea, raced one way and held to a road's grade`, () => {
    const data = generate_world(seed, WorldKind.VOLCANO);
    const route = data.routes.find((r) => r.kind === RouteKind.SPRINT);
    expect(route?.id).toBe("descent");
    if (!route) return;
    const { points, checkpoints } = route;
    const start = points[0];
    const end = points[points.length - 1];
    expect(route.closed).toBe(false);
    expect(data.road.some((p) => p.x === start.x && p.z === start.z && p.y === start.y)).toBe(true);
    expect(end.y).toBeLessThan(COAST);
    expect(start.y - end.y).toBeGreaterThan(150);
    const last = checkpoints[checkpoints.length - 1];
    expect([last.x, last.z]).toEqual([end.x, end.z]);
    expect(data.graph.edges.some((e) => !e.closed && e.points === points)).toBe(true);
    let walked = 0;
    const along = [0];
    for (let i = 1; i < points.length; i++) along.push((walked += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)));
    for (let i = GRADE_RUN; i < points.length; i++) expect(Math.abs(points[i].y - points[i - GRADE_RUN].y) / (along[i] - along[i - GRADE_RUN])).toBeLessThanOrEqual(SPUR_GRADE);
    const hairpins = data.items.filter((item) => item.kind === "barrier").length;
    expect(hairpins).toBeGreaterThan(0);
    expect(route.length).toBeGreaterThan(HAIRPIN_RADIUS * 100);
  });
