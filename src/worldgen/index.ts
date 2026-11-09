import { sample, up, vertex } from "./field";
import { ITEMS, JumpPlanner } from "./jumps";
import { fbm, hash, length } from "./noise";
import { Lots } from "./lots";
import { loop_road } from "./path";
import { join_candidates, Router, SHAPE_GRADE, spur_need, spur_points } from "./route";
import type { Path } from "./path";
import { Stamp } from "./stamp";
import { guard_rails, inside } from "./switchback";
import { terrain } from "./terrain";
import { place_towns, town_streets } from "./towns";
import { CELL, ORIGIN, ROAD_HALF, SPAWN_INDEX, SPUR_HALF, type Checkpoint, type RoadEdge, type RoadNode, type Solid, type Tree, type WorldData } from "./types";

const CHECKPOINTS = 12;
const TREE_SPACING = 13;
const STACK_GATE = 5;
/** Spurs try joins at least this far outside the switchback first; one on its legs only when nothing else fits the grade. */
const STACK_JOIN = 20;
/** A spur end further than this from its gate or junction height failed to fit the grade. */
const PIN = 0.01;

// World generation uses only + - * / sqrt floor and integer ops, which IEEE 754 makes bit-exact on every engine, so
// every discrete choice (towns, routes, lots, trees) comes out the same for every peer on the seed. Math.atan2 only
// feeds display angles.
export function generate(seed: number): WorldData {
  const timings: [string, number][] = [];
  let clock = performance.now();
  const lap = (stage: string) => {
    const now = performance.now();
    timings.push([stage, now - clock]);
    clock = now;
  };

  const land = terrain(seed);
  const { heights, road_dist } = land;
  lap("terrain");

  const { road, stack } = loop_road(seed, heights);
  const nodes: RoadNode[] = [];
  const edges: RoadEdge[] = [];
  const ring: RoadEdge = { id: 0, a: 0, b: 0, kind: "highway", half: ROAD_HALF, closed: true, points: road };
  nodes.push({ id: 0, x: road[0].x, z: road[0].z, y: road[0].y, kind: "junction" });
  edges.push(ring);
  const stamp = new Stamp(land);
  stamp.edge(ring);
  lap("circuit");

  const towns = place_towns(seed, heights, road);
  const gates = new Map<number, number>();
  for (const town of towns) {
    const streets = town_streets(seed, town, heights, road, nodes.length, edges.length);
    if (!streets) continue;
    nodes.push(...streets.nodes);
    edges.push(...streets.edges);
    gates.set(town.id, streets.gate);
    stamp.plateau(town);
  }
  lap("towns");

  const router = new Router(heights, road_dist, towns);
  for (const town of towns) {
    const gate_id = gates.get(town.id);
    if (gate_id === undefined) continue;
    const gate = nodes[gate_id];
    const on_stack = (j: number) => stack !== null && inside(stack, road[j].x, road[j].z, STACK_JOIN);
    const tried: { path: Path; join: number; need: number; stacked: boolean }[] = [];
    const candidates = join_candidates(road, gate);
    for (const join of [...candidates.filter((j) => !on_stack(j)), ...candidates.filter(on_stack)]) {
      const path = router.route(gate, road[join], town);
      if (!path) continue;
      const need = spur_need(path, gate.y, road[join].y);
      tried.push({ path, join, need, stacked: on_stack(join) });
      if (need <= SHAPE_GRADE) break;
    }
    tried.sort((a, b) => Number(a.stacked) - Number(b.stacked) || a.need - b.need);
    // The need estimate is conservative both ways near the limit, so the first spur whose ends stay pinned wins.
    const pinned = (t: (typeof tried)[number]) => {
      const points = spur_points(t.path, heights, gate.y, road[t.join].y);
      return Math.abs(points[0].y - gate.y) < PIN && Math.abs(points[points.length - 1].y - road[t.join].y) < PIN;
    };
    const best = tried.find((t) => t.need <= SHAPE_GRADE) ?? tried.find(pinned) ?? tried.reduce<(typeof tried)[number] | null>((b, t) => (!b || t.need < b.need ? t : b), null);
    if (!best) continue;
    router.claim(best.path);
    const target = road[best.join];
    const junction: RoadNode = { id: nodes.length, x: target.x, z: target.z, y: target.y, kind: "junction" };
    nodes.push(junction);
    edges.push({ id: edges.length, a: gate.id, b: junction.id, kind: "highway", half: SPUR_HALF, closed: false, points: spur_points(best.path, heights, gate.y, target.y) });
  }
  lap("highways");

  for (const edge of edges) if (edge !== ring) stamp.edge(edge);
  stamp.blend();
  lap("stamp");

  const lots = new Lots(seed, land, stamp);
  for (const edge of edges) {
    if (edge.kind !== "street") continue;
    const town = towns.find((t) => length(t.x - edge.points[0].x, t.z - edge.points[0].z) <= t.radius + 1);
    if (town) lots.street(edge, town);
  }
  const { lots: lot_list, buildings, parking, props } = lots.out;
  const solids: Solid[] = [...lots.out.solids];
  lap("lots");

  const checkpoints: Checkpoint[] = [];
  for (let i = 0; i < CHECKPOINTS; i++) {
    const p = road[Math.floor((i / CHECKPOINTS) * road.length)];
    checkpoints.push({ x: p.x, y: p.y, z: p.z, heading: Math.atan2(p.tx, p.tz), index: i });
    for (const side of [-1, 1]) {
      const off = side * (ROAD_HALF + 1.7);
      const x = p.x - p.tz * off;
      const z = p.z + p.tx * off;
      solids.push({ kind: "circle", x, y: sample(heights, x, z), z, radius: 0.5, height: 7 });
    }
  }

  lap("checkpoints");

  const planner = new JumpPlanner(seed, land, towns, lots.occupied, solids);
  // Points of the switchback count as gates, so no kicker or chicane lands inside it.
  const climb = stack ? road.filter((p, i) => i % STACK_GATE === 0 && inside(stack, p.x, p.z, 0)) : [];
  planner.circuit(road, [...checkpoints, ...nodes.filter((n) => n.kind === "junction"), road[(SPAWN_INDEX + road.length) % road.length], ...climb]);
  planner.hills();
  planner.roadside(road);
  planner.open();
  planner.roadside_items(road);
  planner.lot_items(lot_list);
  planner.open_items();
  const jumps = planner.out;
  solids.push(...jumps.solids);
  for (const rail of stack ? guard_rails(stack, heights, road_dist) : []) {
    jumps.items.push(rail);
    const solid = ITEMS.barrier.solid?.(rail.x, rail.y, rail.z, rail.fx, rail.fz, rail.scale);
    if (solid) solids.push(solid);
  }
  lap("jumps");

  const trees: Tree[] = [...lots.out.trees];
  const limit = -ORIGIN - TREE_SPACING;
  for (let z = ORIGIN + TREE_SPACING; z < limit; z += TREE_SPACING)
    for (let x = ORIGIN + TREE_SPACING; x < limit; x += TREE_SPACING) {
      const px = x + (hash(x, z, seed + 91) - 0.5) * TREE_SPACING;
      const pz = z + (hash(x, z, seed + 92) - 0.5) * TREE_SPACING;
      const density = fbm(px / 180, pz / 180, seed + 55, 3);
      if (hash(x, z, seed + 93) > (density - 0.38) * 2.6) continue;
      const y = sample(heights, px, pz);
      if (y < 3 || y > 125) continue;
      if (sample(road_dist, px, pz) < ROAD_HALF + 7) continue;
      if (lots.occupied[vertex(Math.round((px - ORIGIN) / CELL), Math.round((pz - ORIGIN) / CELL))]) continue;
      if (towns.some((t) => length(t.x - px, t.z - pz) < t.radius)) continue;
      if (up(heights, px, pz) < 0.82) continue;
      if (jumps.blocks(px, pz, 2)) continue;
      const scale = 0.75 + hash(x, z, seed + 94) * 0.9;
      trees.push({ x: px, y, z: pz, scale, kind: hash(x, z, seed + 95) < 0.7 ? 0 : 1 });
      solids.push({ kind: "circle", x: px, y, z: pz, radius: 0.35 * scale, height: 6 * scale });
    }
  lap("props");

  return { kind: "island", deck: null, terrain: land, graph: { nodes, edges }, towns, lots: lot_list, buildings, props, parking, trees, solids, ramps: jumps.ramps, items: jumps.items, challenges: jumps.challenges, checkpoints, circuit: [ring.id], road, timings };
}
