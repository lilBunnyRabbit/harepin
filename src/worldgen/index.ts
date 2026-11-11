import { biome_cuts, item_kind, plant } from "./biomes";
import { sample, vertex } from "./field";
import { ITEMS, JumpPlanner } from "./jumps";
import { LandmarkPlanner } from "./landmarks";
import { length } from "./noise";
import { Lots } from "./lots";
import { plan_canyon } from "./canyon";
import { split_circuit, type Join } from "./graph";
import { link_towns, way_toward, ways } from "./links";
import { loop_heights, loop_path, road_points } from "./path";
import { circuit_route, offroad_routes, reverse_circuit, street_routes } from "./routes";
import { join_candidates, MIN_RADIUS, Router, SHAPE_GRADE, spur_need, spur_points, tightest, type Way } from "./route";
import type { Path } from "./path";
import { scatter } from "./scatter";
import { Stamp } from "./stamp";
import { road_junctions } from "./road-layers";
import { guard_rails, inside } from "./switchback";
import { pan_floor, terrain, with_passes } from "./terrain";
import { plan_trails } from "./trails";
import { place_towns, town_streets } from "./towns";
import { ISLAND, type Landmark, type Recipe } from "./recipe";
import { CELL, ORIGIN, ROAD_HALF, SPAWN_INDEX, SPUR_HALF, WorldKind, type Checkpoint, type RoadEdge, type RoadGraph, type RoadNode, type RoadPoint, type Solid, type Tree, type WorldData } from "./types";

const CHECKPOINTS = 12;
const STACK_GATE = 5;
/** Spurs try joins at least this far outside the switchback first; one on its legs only when nothing else fits the grade. */
const STACK_JOIN = 20;
/** A spur end further than this from its gate or junction height failed to fit the grade. */
const PIN = 0.01;
/** Circuit points a link keeps from a checkpoint, whose posts would stand in its mouth. */
const CHECKPOINT_CLEAR = 15;
/** Circuit points behind the start line, where the grid lines up, and past it, kept clear of crossings. */
const GRID_BEHIND = 80;
const GRID_AHEAD = 15;
const CANYON_CLEAR = 30;

const LANDMARKS: Record<Landmark, (marks: LandmarkPlanner, roads: RoadEdge[]) => void> = {
  mast: (marks) => marks.mast(),
  lighthouse: (marks) => marks.lighthouse(),
  turbines: (marks) => marks.turbines(),
  arch: (marks, roads) => marks.arch(roads),
};

// World generation uses only + - * / sqrt floor and integer ops, which IEEE 754 makes bit-exact on every engine, so
// every discrete choice (towns, routes, lots, trees) comes out the same for every peer on the seed. Math.atan2 only
// feeds display angles.
export function generate(seed: number, recipe: Recipe = ISLAND, kind: WorldKind = WorldKind.ISLAND): WorldData {
  const timings: [string, number][] = [];
  let clock = performance.now();
  const lap = (stage: string) => {
    const now = performance.now();
    timings.push([stage, now - clock]);
    clock = now;
  };

  let land = terrain(seed, recipe.terrain);
  const planned = loop_path(seed, land.heights, recipe.road);
  // A range dips into a pass wherever the planned circuit crosses its crest, so the land is drawn again over the passes.
  const shape = with_passes(seed, recipe.terrain, planned.path);
  if (shape !== recipe.terrain) land = terrain(seed, shape);
  const { heights, road_dist } = land;
  lap("terrain");

  const { stack } = planned;
  const road = road_points(planned.path, loop_heights(planned, heights), true);
  const stamp = new Stamp(land);
  if (stack) stamp.face(road.filter((p) => inside(stack, p.x, p.z, 0)));
  const canyon = recipe.road.canyon ? plan_canyon(seed, heights, road, recipe.road.canyon.outlet) : null;
  if (canyon) stamp.carve(canyon);
  const nodes: RoadNode[] = [];
  const edges: RoadEdge[] = [];
  const graph: RoadGraph = { nodes, edges };
  const ring: RoadEdge = { id: 0, a: 0, b: 0, kind: "highway", half: ROAD_HALF, closed: true, points: road };
  nodes.push({ id: 0, x: road[0].x, z: road[0].z, y: road[0].y, kind: "junction" });
  edges.push(ring);
  stamp.edge(ring);
  lap("circuit");

  const towns = place_towns(seed, heights, road, recipe.towns);
  const gates = new Map<number, number>();
  for (const town of towns) {
    const streets = town_streets(seed, town, (x, z) => sample(heights, x, z), road, nodes.length, edges.length, recipe.towns);
    if (!streets) continue;
    nodes.push(...streets.nodes);
    edges.push(...streets.edges);
    gates.set(town.id, streets.gate);
    stamp.plateau(town);
  }
  lap("towns");

  const router = new Router((x, z) => sample(heights, x, z), (x, z) => sample(road_dist, x, z), towns);
  const on_stack = (j: number) => stack !== null && inside(stack, road[j].x, road[j].z, STACK_JOIN);
  const joins: Join[] = [];
  for (const town of towns) {
    const gate_id = gates.get(town.id);
    if (gate_id === undefined) continue;
    const gate = nodes[gate_id];
    const candidates = join_candidates(road, gate);
    const shaped = new Map<Path, RoadPoint[]>();
    const shape = (t: { path: Path; join: number }) => {
      let points = shaped.get(t.path);
      if (!points) shaped.set(t.path, (points = spur_points(t.path, (x, z) => sample(heights, x, z), gate.y, road[t.join].y)));
      return points;
    };
    const pinned = (t: { path: Path; join: number }) => {
      const points = shape(t);
      return Math.abs(points[0].y - gate.y) < PIN && Math.abs(points[points.length - 1].y - road[t.join].y) < PIN;
    };
    const fits = (t: { path: Path; join: number }) => pinned(t) && tightest(shape(t)) >= MIN_RADIUS;
    const pick = (leave: (join: number) => Way | null) => {
      const tried: { path: Path; join: number; need: number; stacked: boolean }[] = [];
      for (const join of [...candidates.filter((j) => !on_stack(j)), ...candidates.filter(on_stack)]) {
        const way = leave(join);
        const path = router.route(gate, road[join], town, way);
        if (!path) continue;
        const need = spur_need(path, gate.y, road[join].y);
        tried.push({ path, join, need, stacked: on_stack(join) });
        if (need <= SHAPE_GRADE) break;
      }
      tried.sort((a, b) => Number(a.stacked) - Number(b.stacked) || a.need - b.need);
      // The need estimate is conservative both ways near the limit, so the first spur whose ends stay pinned wins.
      return tried.find((t) => t.need <= SHAPE_GRADE) ?? tried.find(pinned) ?? tried.reduce<(typeof tried)[number] | null>((b, t) => (!b || t.need < b.need ? t : b), null);
    };
    // Leaving the gate square to its streets gets the gate a patch: the way toward each join first, then each free way.
    // A spur that cannot hold the grade any of those ways leaves as it did before, overlapping the streets.
    const leaving = [(join: number) => way_toward(graph, gate, town, road[join].x, road[join].z), ...ways(graph, gate, town).map((w) => () => w)];
    let best = null;
    for (const leave of leaving) {
      const found = pick(leave);
      best ??= found;
      if (found && fits(found)) {
        best = found;
        break;
      }
    }
    if (best && !fits(best)) best = pick(() => null) ?? best;
    if (!best) continue;
    router.claim(best.path);
    const target = road[best.join];
    const junction: RoadNode = { id: nodes.length, x: target.x, z: target.z, y: target.y, kind: "junction" };
    nodes.push(junction);
    joins.push({ node: junction.id, at: best.join });
    edges.push({ id: edges.length, a: gate.id, b: junction.id, kind: "highway", half: SPUR_HALF, closed: false, points: shape(best) });
  }
  lap("highways");

  const n = road.length;
  const checkpoint_at = Array.from({ length: CHECKPOINTS }, (_, i) => Math.floor((i / CHECKPOINTS) * n));
  const keep = (at: number) =>
    on_stack(at) || at < GRID_AHEAD || at >= n - GRID_BEHIND || checkpoint_at.some((c) => Math.min((at - c + n) % n, (c - at + n) % n) < CHECKPOINT_CLEAR);
  // Roads between towns stay out of the canyon, where the trail's gap jump needs a clear run-up.
  if (canyon) router.keep_off(canyon.points, canyon.floor + canyon.wall + CANYON_CLEAR);
  link_towns({ graph, ring, road, towns, heights, router, joins, keep });
  const circuit = split_circuit(graph, road, joins);
  lap("links");

  for (const edge of edges) if (!circuit.includes(edge.id)) stamp.edge(edge);
  const { patched } = road_junctions({ road, graph, circuit });
  for (const { patch } of patched) stamp.junction(patch.outline);
  stamp.blend();
  lap("stamp");

  const lots = new Lots(seed, land, stamp, recipe.towns);
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
    const p = road[checkpoint_at[i]];
    checkpoints.push({ x: p.x, y: p.y, z: p.z, heading: Math.atan2(p.tx, p.tz), index: i });
    for (const side of [-1, 1]) {
      const off = side * (ROAD_HALF + 1.7);
      const x = p.x - p.tz * off;
      const z = p.z + p.tx * off;
      solids.push({ kind: "circle", x, y: sample(heights, x, z), z, radius: 0.5, height: 7 });
    }
  }

  const marks = new LandmarkPlanner(seed, land, road, towns);
  const off_circuit = edges.filter((e) => !circuit.includes(e.id));
  for (const mark of recipe.landmarks) LANDMARKS[mark](marks, off_circuit);
  props.push(...marks.out.props);
  solids.push(...marks.out.solids);
  lap("landmarks");

  lap("checkpoints");

  const trails = plan_trails(seed, land, stamp, canyon, towns, solids);
  lap("trails");

  const planner = new JumpPlanner(seed, land, towns, lots.occupied, solids, recipe.road.kickers);
  if (trails.gap) planner.gap(trails.gap);
  planner.keep_off([...trails.trails.flatMap((t) => t.points), ...trails.ramp_out]);
  // Points of the switchback count as gates, so no kicker or chicane lands inside it.
  const climb = stack ? road.filter((p, i) => i % STACK_GATE === 0 && inside(stack, p.x, p.z, 0)) : [];
  planner.circuit(road, [...checkpoints, ...nodes.filter((n) => n.kind === "junction"), road[(SPAWN_INDEX + road.length) % road.length], ...climb], recipe.road.runup);
  planner.hills();
  planner.roadside(road);
  planner.open();
  planner.roadside_items(road);
  planner.lot_items(lot_list);
  const cuts = biome_cuts(seed, heights, recipe.biomes);
  planner.open_items((x, z) => item_kind(cuts, x, z, sample(heights, x, z)));
  const jumps = planner.out;
  solids.push(...jumps.solids);
  for (const rail of stack ? guard_rails(stack, heights, road_dist) : []) {
    jumps.items.push(rail);
    const solid = ITEMS.barrier.solid?.(rail.x, rail.y, rail.z, rail.fx, rail.fz, rail.scale);
    if (solid) solids.push(solid);
  }
  lap("jumps");

  const loop = circuit_route(road, checkpoints);
  const streets = street_routes(graph, circuit, towns, heights, patched, jumps.ramps);
  jumps.items.push(...streets.items);
  const reverse = reverse_circuit(loop, jumps.ramps);
  const offroad = offroad_routes(trails.trails);
  const routes = reverse ? [loop, ...streets.routes, ...offroad, reverse] : [loop, ...streets.routes, ...offroad];
  lap("routes");

  const free = (x: number, z: number) => !lots.occupied[vertex(Math.round((x - ORIGIN) / CELL), Math.round((z - ORIGIN) / CELL))] && !towns.some((t) => length(t.x - x, t.z - z) < t.radius) && !jumps.blocks(x, z, 2) && !marks.blocks(x, z, 2);
  const planted = plant(cuts, land, free);
  const trees: Tree[] = [...lots.out.trees, ...planted.trees];
  solids.push(...planted.solids);
  const strewn = scatter(cuts, land, recipe.scatter, free, [...trails.trails.flatMap((t) => t.points), ...trails.ramp_out]);
  props.push(...strewn.props);
  solids.push(...strewn.solids);
  stamp.harden(cuts, pan_floor(seed, shape));
  lap("props");

  return { kind, deck: null, terrain: land, ground: { base: { kind: "terrain", seed, shape }, ops: stamp.ops }, graph, towns, lots: lot_list, buildings, props, parking, trees, solids, ramps: jumps.ramps, items: jumps.items, challenges: jumps.challenges, checkpoints, circuit, road, routes, canyon, timings };
}
