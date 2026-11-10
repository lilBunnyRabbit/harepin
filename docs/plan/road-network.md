# Road network and a streamed world

Round 1, 2026-11-10, v0.13.0 (`211faec`). This is a plan only: no code has been written. It covers two steps. First, today's ~2 km island gets a real road graph with junctions. Second, the game moves to a streamed world of about 6×6 km, and later perhaps about 10×10 km.

Numbers come from `bun scripts/gen.ts` (seeds 0-9) and from a scratch memory probe, `scratchpad/rn/mem.ts`, run on seeds 0, 2 and 7. Both ran headless on the dev desktop, on the same day, while other agents shared the machine. Treat the times as upper bounds. The bench figures quoted in the brief (290 ms gen, 162 ms mesh) come from a quieter run. Every other number is either measured or marked *est.*

## TL;DR

- **The graph is half there already.** `WorldData.graph` has nodes and edges (`types.ts:63-87`), and `routes.ts` runs Dijkstra over it (`Atlas`, `routes.ts:111-223`). The circuit, however, is one closed edge with `a = b = 0` (`index.ts:47`). Spurs end on "junction" nodes that no edge shares, so `Atlas` splits the ring virtually (`routes.ts:143-160`). Make the topology real before adding roads.
- **Junctions today are overlapping ribbons.** They differ only in lift (`chunks.ts:27-29`), with marks cleared near mouths (`chunks.ts:345-347`). That works for the 90° Ts that `Router` forces (`APPROACH`, `route.ts:19-20`) and for street grids, but not for acute angles, crossroads between roads of different widths, or roundabouts. The plan adds a **junction patch**: trim each arm, fillet the corners, triangulate, and drape it through the existing `Roads.draped` cutter.
- **Recommended network:** towns, then a relative-neighbourhood graph (RNG, brute force, no dependency), then routing with the existing `Router` A* plus a discount for reusing roads already built, so roads merge into trunks and Ts form naturally. Dirt tracks stay `trails.ts`. Town interiors stay grids. L-systems and tensor fields are out for now.
- **Streaming fits the current renderer.** `WorldView` already splits the world into 64 chunks of 256 m, with distance culling and a half-res LOD (`scene.ts:100-170`). With today's fog (1300 m desktop, 700 m mobile; `quality.ts:12-24`), the resident set of a streamed world is about **116 chunks on desktop and 44 on mobile**. Today's island loads 64. The per-frame budget barely moves; what has to change is generation and runtime data.
- **Main blocker for streaming:** module-level `SIZE`/`N`/`ORIGIN` (`types.ts:1-4`) baked into about 20 files, and a whole-island `Float32Array` behind every physics query (`world.ts:248-299` → `field.ts:3-9`). Fix: physics reads 65×65 tiles, and generation splits into `plan(seed)` (global) plus `tile(plan, ci, cj)` (local).
- **Net is fine at 6×6.** `WORLD_LIMIT` is 5000 (`car-packet.ts:4,93`), and a world centred on 0 spans ±3 km. Even at 10×10 km, no `PROTOCOL` bump is needed if the big world is a **new world kind**: old peers already treat another world id as a foreign map (`net.ts:461`).
- **Recommendation: build the big world as a new kind (`mainland`).** Keep the island as the fast, phone-friendly lobby map. Island records reset only once, in phase 1c, when inter-town roads change the island (`WORLD_VERSION` 3 → 4).

## 1. Inventory: what assumes one island, routes rather than a graph, or a fixed size

### Measured today

| Metric | Seeds 0-9 (gen.ts) | Seed 0 detail (mem.ts) |
|---|---|---|
| `generate` | 307-905 ms (seed 0 is the cold JIT run; 7 of 10 seeds under 500) | terrain 183, circuit 98, trails 273, jumps 136, the rest under 50 each |
| `build_chunks` | 200-458 ms (mem.ts re-run: 269-330) | |
| Triangles | 718-799k | terrain 557k (64 chunks × 64² × 2, plus skirts), road 188k, buildings 2k |
| Mesh bytes | | terrain 11.1 MB, **road 13.5 MB**, buildings 0.2 MB = **24.8 MB** |
| Field grids | | heights + road_dist + surface over 513² vertices = 2.37 MB |
| Graph | 3-6 towns, 36-104 street edges | 41 nodes, 53 edges, ~13.7k road and route points |

The road mesh already costs more bytes than the terrain. The draping cutter (`chunks.ts:221-262`) splits every road triangle along each cell line and diagonal. That works out to roughly 20k tris per km of road *est.* (188k tris over about 9 km of circuit, spurs and streets). A network with ten times the road length therefore needs road LOD; it can't just reuse today's mesh path.

### World size and one island

| Where | What it assumes | Change for streaming |
|---|---|---|
| `worldgen/types.ts:1-4` | `SIZE 2048`, `CELL 4`, `N 512`, `ORIGIN -1024` as module constants, imported by about 20 files | `CELL` stays global. `SIZE`/`N`/`ORIGIN` move onto the plan (per kind). Tiles carry their own origin. |
| `worldgen/field.ts:3-9, 11-20, 24-29, 33-37, 45-50` | `sample`, `slope_normal`, `vertex_up` and `cell_range` index one (N+1)² grid and clamp at the island edge | Same maths over a 65² tile with a 1-vertex apron. The `World` side picks the tile. |
| `worldgen/terrain.ts:27-38` | Radial island mask `r / 960`; one peak within `PEAK_REACH` 220 m of the centre | `raw_height` is a pure function of (x, z, seed). Keep it; add a mask and peaks per region. |
| `worldgen/terrain.ts:40-46` | Fills the whole grid up front | Per tile |
| `worldgen/path.ts:11-14` | Circuit on a circle of r 380-860 m around (0, 0) | Island only. The mainland gets circuits from graph cycles (§2). |
| `worldgen/towns.ts:9-12, 37-68` | `TOWN_SPREAD` 820 m disc; towns must sit within `RING_CLEAR`..`RING_REACH` of the ring | Placement by suitability over the plan's coarse grid, with no tie to the ring |
| `worldgen/towns.ts:118-218` | Streets keep `STREET_RING_CLEAR` from the ring; the gate is the node nearest the ring | Gate = the node nearest each incoming road |
| `worldgen/route.ts:6-7, 89-111` | `Router` grid is `SIZE / 16` square; every cell within `RING_BAND` of a road is blocked | Grid from the plan; the reuse discount replaces the block (§2) |
| `worldgen/route.ts:113-178, 193-203` | A* only gate → *ring point*, arriving along the ring normal; `join_candidates` searches the ring only | Generalise to node → any edge point (the junction search) |
| `worldgen/trails.ts:11-12, 121-123, 180, 414` | 16 m grid of `SIZE`; edge blocking at `SIZE / 2`; radial scan to `SIZE / 2` | Plan grid |
| `worldgen/canyon.ts:29, 47, 111` | `SIZE / CELL + 1` stride, edge guard, flank walk to `SIZE / 2` | Plan grid; carving is analytic per polyline, so it can run per tile |
| `worldgen/biomes.ts:68-84` | `biome_cuts` takes **quantiles over the whole island**: a global statistic | Compute it on the plan's coarse grid. That is a version change, not a problem for a new kind. |
| `worldgen/biomes.ts:115-121` | Tree lattice over the whole island | Already a per-lattice hash (`hash(x, z, seed + 91 + k*16)`), so it is per-tile safe. The `free()` checks need the global blockers. |
| `worldgen/jumps.ts:357, 562-563, 573-574, 665-666` | `open()`, `hills()` and `open_items()` throw darts across `SIZE - 200` from one RNG stream | Per-tile streams `sub(seed, "jumps:ci:cj")`. Road kickers stay global, because they belong to roads. |
| `worldgen/landmarks.ts:116-143` | One mast, one lighthouse, turbines; whole-grid scan; line of sight to *the* circuit | Global, in the plan, one set per region |
| `worldgen/index.ts:29-173` | One linear pipeline. Each stage reads heights the earlier stages already modified (carve → plateau → stamp → trails → pads → lots). | Split into `plan` and `tile` (§3) |
| `worldgen/chunks.ts:11-13, 94-98` | `CHUNKS = SIZE / CHUNK` (8); `chunk_of` clamps to the island | Chunk coords from the plan; no clamp |
| `worldgen/chunks.ts:112-134` | `terrain_colors` over the whole grid, then sliced | Per tile, with `biome_cuts` taken from the plan |
| `worldgen/chunks.ts:136-185` | Terrain chunk with full- and half-res index in one buffer (Uint16, 4485 verts) | Keep. Far tiles may ship half-res only. |
| `worldgen/chunks.ts:485-511` | `build_chunks` meshes every chunk in one call | `build_chunk(plan, tile)` |
| `worldgen/worker.ts:19-27` | One request, one reply, everything transferred | Persistent worker, chunk requests (§3) |
| `worldgen/map.ts:5, 113-132` | Map raster `MAP_SIDE = N + 1` from full heights, `size: SIZE` | From the plan's coarse grid. At 6 km, 513² stays a fine raster. |
| `worldgen/map-worker.ts:11-14` | The world page **generates the whole world** for a preview | Plan only |
| `worldgen/sky.ts:950-955` | The sky kind still allocates a full (N+1)² terrain filled with `ABYSS` | Tiles let the sky return an empty plan. Separate kind, untouched otherwise. |
| `render/scene.ts:70-85` | `load_world` runs the worker once, waits for everything, then `terminate()`s it | Persistent; spawn when the ring of tiles around the spawn point is ready |
| `render/scene.ts:100-170` | `WorldView` builds one `ChunkView` per chunk at construction and never adds or removes any | `add(chunk)` / `drop(index)` with geometry dispose |
| `render/scene.ts:19-21` | `FAR 600`, `MOBILE_FAR 300`, `MOBILE_TREES 300` | Keep as LOD radii |
| `render/scene.ts:256-262` | Water plane `SIZE * 4` | Plane per kind size, or one that follows the camera |
| `render/quality.ts:12-24`, `render/lighting.ts:71` | `fog_far` 1300 desktop, 700 mobile | This sets the streaming radius (§3) |
| `world/buildings.ts:114-133` | `by_chunk` and `town_chunks` over all lots and props | Per arriving chunk |
| `world/jumps.ts:130` | Ramps and items bucketed by `chunk_of` | Per arriving chunk |
| `car/trackside.ts:47-60, 62-110` | Curbs and posts along `world.road` as one global object; spur mouths found by scanning graph nodes | Per route, or per chunk later. Mouths come from junction patches. |
| `hud/minimap.ts:34, 49-52` | A closed route's full view = the whole island (`SIZE`) | Fit the route bbox for every route. Free roam draws graph edges in a window. |
| `menu/world-map.ts:115-116` | Raster scale from `map.size` | Unchanged if `MapData.size` comes from the plan |
| `modes/hunt.ts:12, 70` | Gates kept `EDGE` inside `SIZE / 2` | World bounds from `World` |
| `net/car-packet.ts:4, 93` | `WORLD_LIMIT 5000`: a packet with any coordinate past ±5 km is dropped | 6×6 fits. 10×10 needs about 6000 (see §4). |

### Routes rather than a graph

| Where | What it assumes |
|---|---|
| `worldgen/index.ts:45-50` | The ring is edge 0 with `a = b = 0`, closed. Junction nodes are pushed for spur ends (`index.ts:91-93`), but the ring edge is never split at them. |
| `worldgen/index.ts:97, stamp.ts:56-57` | Stamp priority is circuit first, then the rest in edge order. Spurs merge into the ring's flat band. |
| `worldgen/index.ts:111-121` | 12 checkpoints and their gate posts (solids) are baked onto the circuit |
| `worldgen/index.ts:141-142` | Road kickers and chicanes only on `road` (the circuit) |
| `worldgen/routes.ts:111-160` | `Atlas` rebuilds the topology: it finds the nearest ring point to each spur end and cuts ring legs between junctions. It reads three kinds only: `street`, `spur` and `ring`. |
| `worldgen/routes.ts:279-341` | Street routes: town A's far node → spur → ring → spur → town B. Side-street cone rows are **baked into `world.items`** (`index.ts:161`). |
| `worldgen/chunks.ts:341-395` | `road_layers` has three hard-coded cases: ring (`data.road`, closed), `highway` spur, and `street` with `extended()` crossing squares. Mouth handling only covers spur-on-ring and spur-at-gate. |
| `world/world.ts:144, 160, 204, 207-212, 303-313` | `road`, `road_grid`, `no_spawn`, `nearest_road` and `clear_spawn` are all circuit-only |
| `world/world.ts:316-333` | `spawn_near` uses every edge and trail. `nearest` stops after 64 rings × 32 m = **2 km** (`world.ts:117`), then falls back to `road[0]`. |
| `car/driver.ts:87, 94, 107` | Reset and race placement go by circuit index |
| `modes/drift-mode.ts:77`, `modes/duel-mode.ts:100`, `modes/gymkhana.ts:145-153`, `modes/hunt-mode.ts:77` | Drift zones, duel runs, the gymkhana site search and the hunt start all slice or walk `world.road`, the circuit |
| `modes/route.ts:9-45` | `slice` and `bendiest` wrap modulo length (they assume a closed polyline) |
| `hud/pace.ts`, `hud/pace-card.ts:96`, `hud/minimap.ts:117` | Take a `Route` polyline. **This already works for any route.** |
| `scripts/autolap.ts:63-66`, `scripts/races.ts:13-26` | Autopilot takes any polyline, open or closed. **Already graph-ready** once a route is a polyline. |

### Keys, versions and peers

| Where | Today | Effect |
|---|---|---|
| `worldgen/types.ts:18`, `kinds/island.ts:7-8` | `WORLD_VERSION 3`; island id 3; key `${seed}:w3` | A bump resets every island record (`track.ts:116`, `race.ts:65-66`, `ghost.ts:54`, `duel-mode.ts:18`) |
| `kinds/sky.ts:8` | Sky id `1000 + SKY_VERSION` | Precedent for a new kind with its own id range |
| `kinds/kinds.ts:44-47` | Unknown world id → island | An old build lists a `mainland` room as island (same as sky today) |
| `net/net.ts:199, 261, 461` | Hello carries `world`; a car on another `seed` or `w` is foreign | A new kind never mixes with old peers |
| `net/directory.ts:122` | Room key includes `world` | Fine |
| `main.ts:82, 119` | `Net(…, world_id(kind))`, `Lobby(…, lobby_routes(world.routes), …)` | Lobby route ids must stay stable per seed |

### Precision and memory

| Item | Today | 6×6 km | 10×10 km |
|---|---|---|---|
| Float32 vertex ulp at the world edge | 0.06 mm at 1 km | 0.24 mm at 3 km | 0.49 mm at 5 km: no rebasing needed (three.js builds model-view in float64; only vertex rounding counts, and that stays visible-jitter-free until roughly ±16 km) |
| Car packet `p` (Float32, `car-packet.ts:17,92`) | | fine | fine |
| `grid_key` (`world.ts:69-71`) | cell index valid in [-1000, 3095] | fine (16 m cells → −16 km) | fine |
| `LANE_PACK 1 << 16` points per edge (`world.ts:46`) | | 131 km per edge, fine | fine |
| Monolithic fields at CELL 4 | 2.37 MB | 1501² verts: **20.3 MB** plus about 29 MB of transient `Stamp` grids (`stamp.ts:25-36`) *est.* | 2501²: 56 MB plus 81 MB *est.* |
| Monolithic terrain gen (183 ms / 263k verts ≈ 0.7 µs/vert) | 183 ms | about 1.6 s *est.* | about 4.4 s *est.* |
| Monolithic mesh (24.8 MB per 4.2 km²) | 24.8 MB | about 215 MB *est.* | about 600 MB *est.* |

Monolithic 6×6 is just possible on desktop (seconds of generation, about 215 MB of mesh) and impossible on phones. Streaming is required before the world grows.

## 2. Road network design

### Graph generation options

| Option | What it makes | Fit with this code | Cost | Verdict |
|---|---|---|---|---|
| **A. Towns → proximity graph (MST + RNG/Gabriel) → A* over terrain cost with road reuse** | Highways between towns that merge into trunks; Ts where they split; loops from the RNG edges | Reuses `place_towns`, `Router` (A*, `claim`), `unkink`, `spur_points` with `limit_grade`, and `Atlas` Dijkstra. RNG and Gabriel are O(n³) brute force; trivial for n ≤ 60, with no Delaunay dependency. | M | **Pick** |
| B. L-system growth (Parish & Müller 2001, CityEngine) | Dense organic city streets under global goals and local constraints | Nothing reused. Heavy tuning. Junction cleanup is its own project. | L | No: we have no cities big enough |
| C. Tensor-field streets (Chen et al. 2008) | Organic town interiors that follow terrain and coast | Would replace `town_streets` grids. Needs a streamline tracer and its own junction snapping. | L | Later, only if grid towns read as stamps after phase 1 |
| D. Agent or road-growth simulation | Plausible historic networks | Slow and hard to make deterministic | L | No |
| E. Pure noise or template skeletons | Cheap | Doesn't follow terrain; same-y across seeds | S | No |

Option A in detail:

1. **Settlements.** Tiers are city (1, radius 180-220 m), town (3-6 on the island; 6-10 on the mainland) and hamlet (mainland only, 10-20, a few lots and no grid). Placement reuses `place_towns` darts with a suitability score: flatness (`TOWN_RELIEF`), height band and coast distance. The ring condition is dropped. Each stage gets its own `sub(seed, …)` stream, as today.
2. **Abstract graph.** Nodes are settlements plus, on the island, 2-4 candidate join points on the circuit. Edges are the MST (always), plus RNG edges whose terrain cost / straight distance is below 1.6. That avoids long detours over ridges and gives 1-3 loops per region. Class: MST edges between city and town become `highway` (half 6); other edges become `local` (half 5); a hamlet joins the nearest edge point as `local`.
3. **Routing.** Use `Router` A* on the 16 m grid. The plan grid is 32 m for the mainland, refined in a corridor afterwards. Add one change: **cells already on a built road cost × 0.35.** Later edges then ride existing trunks and peel off, which is where Ts come from. Route the edges in order of decreasing class, then length, so trunks exist first. Today's `RING_BAND` block, which keeps everything off the ring, becomes the discount plus a rule that a path may only *leave* a claimed corridor at a junction.
4. **Junctions out of paths.** Walk each routed path against the claimed corridor. Where it enters or leaves a built edge, make a junction node and split that edge. Where it crosses one at a significant angle, make an **X node**. Reject the crossing and re-route with that cell blocked when:
   - the angle is under 50°;
   - another node is within 40 m;
   - the grade at the crossing is over 6%.
   Each arm runs straight for the last `APPROACH` 32 m (`route.ts:19-20` already does this for the ring).
5. **Heights.** A node takes the height of the higher-class road at that point. Arms are pinned with `HOLD` and `limit_grade` exactly as `spur_points` pins spur ends today (`route.ts:247-256`).
6. **Dirt tracks.** Keep `trails.ts`. A trail meeting a road becomes a junction node of class `dirt`, which only draws a patch (no marks).
7. **Bridges and overpasses: no.** The ground is a heightfield and there are no mesh colliders (`world.md` "What to cut"). Two highways cross at grade, as a crossroads or a roundabout.

### Junction geometry options

| Option | How | Handles | Cost | Verdict |
|---|---|---|---|---|
| Overlapping ribbons, as today | Each edge drawn to the node; lift order decides who wins (`SPUR_LIFT` > `RING_LIFT` > `SURFACE_LIFT`); marks skipped near mouths | 90° Ts, equal-width grids | 0 | Keep for town streets only |
| **Junction patch** | Trim each arm by a setback `d_i`, the largest over its neighbours of `half_j / sin θ + half_i · cot θ`, plus curb radius r (8-15 m by class). Then fillet the corners between neighbouring arms, triangulate as a fan from the node, and **feed every triangle through `Roads.draped`**, so the patch lays on the terrain with the same crack-free cuts (AGENTS rule: "road draping keeps its crossing order"). Edge lines follow the fillets. Centre dashes stop at the setback. Minor arms get a give-way line. | T, Y, X, 5-way, any angle ≥ 50°, mixed widths | M: one new module, `worldgen/junction.ts` | **Pick** |
| Roundabout | A closed edge of r 16-24 m around the node, with each arm as a T-patch onto it. The central island is a grass disc stamped 0.3 m up with a low `circle` solid, so a car can mount it but not drive straight through. | Highway-highway crossings | S on top of the patch | One per island or region, as a feature |
| CSG of ribbon polygons (union, then triangulate) | Polygon clipping library | Anything | Dependency or about 400 lines of clipping | No |

Stamping matches the meshing. `Stamp` gets `junction(node)`, which flattens a disc of radius `max(d_i) + SHOULDER` onto the node's plane. The node's plane is the higher-class road's grade at that point, fitted like `fit_plane` in `towns.ts:78-109`. It runs at the highest priority, before any edge. The priority rule in `stamp.ts:56-57` generalises from "circuit first" to "highest class first, then edge id".

### How races, pace notes, minimap and autopilot use the graph

A route stays a polyline (`Route`, `types.ts:270-281`). Everything downstream already consumes polylines, so the graph only feeds route building.

| Consumer | Today | With the graph |
|---|---|---|
| Route search | `Atlas.search`: Dijkstra over legs with `TURN_BONUS` for street corners (`routes.ts:187-223`) | `Atlas` reads real edges; no virtual ring split. Weights per class. Turns at any junction count. |
| Circuits | The `path.ts` loop only, plus `circuit-rev` | Island: keep the tuned loop as the main circuit. It becomes ordinary edges, split at its junctions. Mainland: **graph cycles**. For each pair of adjacent junctions, take the two cheapest edge-disjoint paths and join them. Keep cycles of 3-7 km that pass `gen.ts` road targets (`gen.ts:43-48`). |
| Sprints | Street (two towns) and offroad routes | Add highway sprints (city → town, 3-6 km) and "touge" routes on hill-class roads. |
| Junction turn shape | `trace` concatenates leg points, so a street corner is a 90° kink (`routes.ts:225-256`) | Insert the patch's fillet arc points between legs. Pace notes (`pace.ts`) and autopilot (`autolap.ts:34-45`) then see the real radius. |
| Course closure | Cone rows baked into `world.items` for side streets of the street routes (`routes.ts:300-330`, `index.ts:161`) | Barrier and cone rows **placed at race start** through `World.place` (`world.ts:336-341`) and removed after. The world stays race-agnostic; any route can be raced. |
| Checkpoints | Circuit: 12 baked, with gate-post solids (`index.ts:111-121`). Routes: one per corner plus every 150 m. | Same `trace` rule. Gate posts become placed solids for non-circuit routes. |
| Pace notes | Corner grades from curvature (`pace.ts:41-55`) | Unchanged. Optional "T left" or "roundabout second exit" call from the leg metadata. |
| Minimap | Route only; a closed route shows the whole island | Route bbox for every route. Free roam draws graph edges within about 1.5 km from a cached `Path2D` per region. |
| Reset | `spawn_near`: nearest point of any edge or trail | Same, plus junction-aware facing. The search radius grows past 2 km (or uses the coarse road grid of the plan). |
| Lobby | Route id per seed (`lobby.ts:130, 183`) | Same ids. Graph routes get stable ids (`sprint-1`, `loop-2`) from sorted pair ids. |

## 3. Streaming design

### Shape

```
plan(seed)               worker, once, ~0.3-0.6 s est.   global, posted to main
tile(plan, ci, cj, lod)  worker, per 256 m chunk          local, posted on demand
World                    main: plan + tile store, sync queries; a miss is a bug in the browser and a sync generate in Bun
WorldView                main: add / drop chunk views
```

### Global versus per chunk

| Global, in `plan(seed)` | Why global | Size, 6×6 *est.* |
|---|---|---|
| Coarse height grid (16 m for the island, 32 m for the mainland) of `raw_height` plus carve | Routing, town and landmark placement, the world map, a physics fallback | 188² × 4 B = 0.14 MB at 32 m |
| `biome_cuts` | Global quantiles (`biomes.ts:68-84`) | 3 numbers |
| Settlements, town street graphs, lots | Routes and `Atlas` need town nodes; lots are few | under 1 MB |
| Road graph: nodes, edges with 2 m `RoadPoint`s, junction patches | Every chunk stamps the edges that cross it; routes and minimap need all of it | 60-120 km of road, 30-60k points, 2-5 MB as objects (pack to Float32 if it hurts) |
| Routes, checkpoints, canyon(s), trails, road kickers, landmarks | Placed against the whole network | small |
| Blocker index for per-tile darts (lots, ramps, landmarks, trails) | Local `free()` checks need it | small |

| Per chunk, in `tile(plan, ci, cj)` | From |
|---|---|
| Fine heights (65² plus a 1-vertex apron) | `raw_height` → carve (analytic, per canyon polyline) → town plateaus touching the chunk → stamp of edges whose bbox plus `SHOULDER` touches it, **in global priority order** → trail blend → pads |
| `road_dist`, `surface` | Same pass |
| Terrain colours and mesh | `terrain_colors` and `terrain_chunk` on the tile |
| Road mesh | Edges and patches clipped to the chunk. `Roads.strip` already bins by segment start (`chunks.ts:195-205`). |
| Buildings, parking, street lights | Lots of towns touching the chunk |
| Trees, open ramps and items, rocks | Lattice hash, plus a per-chunk RNG stream `sub(seed, "jumps:ci:cj")` |
| Solids | From the above |

**Why per chunk is deterministic and seam-free.** Each fine vertex is a pure function of (x, z, plan): stamping keeps a per-vertex minimum over edges in fixed order (`stamp.ts:58-90`), and blending is per vertex (`stamp.ts:92-101`). A vertex on a chunk border therefore comes out bit-identical from both neighbours. The things that read neighbours (`vertex_up`, map shading, the trail `scarp` test) need a one-vertex apron. The one thing that breaks the island's output is **plan stages reading fine, already-stamped heights**: `plan_trails` routes on post-stamp terrain (`index.ts:134`), and towns and spurs read post-carve terrain. The mainland plan reads the coarse grid instead. The island can keep its full-grid plan (see phase 2).

### Chunk size, radius and LOD

| Choice | Value | Why |
|---|---|---|
| Chunk | 256 m (64 cells), unchanged | Uint16 index fits (4485 verts). `WorldView` LOD and culling already work per chunk. About 3-5 ms of generation per chunk. |
| Resident radius | `fog_far` + 256 m: desktop 1556 m, mobile 956 m | Fog hides everything past `fog_far` (`scene.ts:143-156`). One extra ring covers worker latency at 90 m/s. |
| Resident chunks | about 116 desktop, about 44 mobile (π r² / 65536, plus edge chunks) | Today: 64 |
| Evict | Past radius + 1 chunk (hysteresis); dispose geometries | |
| Terrain LOD | Full res within `FAR` 600 / `MOBILE_FAR` 300 (`scene.ts:19-20`); **half-res only** past that (¼ verts, no full index); nothing past fog | Saves about 70% of far-ring bytes |
| Road LOD | Draped surface and marks near. Past `FAR`: surface only, with every 4th point, still draped. | The road is 54% of today's mesh bytes |
| Trees | `MOBILE_TREES` 300 rule, unchanged | |
| Horizon | None. Fog far is opaque at 1300 m. | Revisit only if the owner wants vistas past the fog. |

### Worker pipeline

| Step | Detail |
|---|---|
| Boot | One persistent `world-worker` (today's worker terminates, `scene.ts:74`). It runs `plan(seed)` and posts the plan; the plan stays in the worker. |
| Second worker | Only if one can't keep up (see throughput below). It would run `plan` itself, which is deterministic, so there is no sync. |
| Request | `{ ci, cj, lod }`, priority = distance to the car, weighted by heading (chunks ahead first). Stale requests are cancelled when the car moves on. |
| Reply | Tile fields (3 × 65² ≈ 38 KB), mesh buffers, and the entity lists (solids, trees, items, buildings) as transferables |
| First frame | Spawn when the 3×3 chunks around the spawn point are resident. The rest stream in behind the fog. |
| Teleports | Mode start, reset and lobby grid become async: `await world.ensure(x, z)` before `place`. Today `driver.place` is sync (`driver.ts:87-107`), and so are `modes.ts:183`, `hunt-mode.ts:77` and `drift-mode.ts:77`. |

### Physics across chunks

| Query | Today | Streamed |
|---|---|---|
| `height`, `normal` (`world.ts:248-263`) | `sample(this.heights, …)` on one grid | Tile = `tiles[(cj - cj0) * W + (ci - ci0)]` (dense array of nullable tiles, 24² for 6 km). Then the same `sample` maths on 65². About 2 extra integer ops per wheel query at 360 Hz. **No allocation.** |
| Missing tile | n/a | Browser: coarse plan grid as a fallback (no road stamp) plus a dev warning; a car should never be there. Bun: generate the tile synchronously, so scripts and tests keep a sync `World`. |
| `distance_to_road`, `dirt`, `grip`, `roll` (`world.ts:282-300`) | Global grids | Per tile, same |
| Solids (`world.ts:160, 206, 232-245, 377-395`) | One grid and one `seen: Uint32Array(solids.length)` | Chunk arrival adds its solids to the grid; departure removes them. `seen` becomes a query stamp per solid (a number field, written in place). |
| Ramps (`world.ts:173, 265-275`) | Linear scan of all wedges | Bucket by chunk. `world.md` already flagged this at about 40 ramps. |
| Remotes | Contact shadow and camera floor read `height` (`contact-shadow.ts:70`, `camera.ts:227`) | Remotes outside the resident set skip the contact shadow |

### Budgets

| Item | Today (island) | Streamed 6×6, desktop *est.* | Streamed 6×6, mobile *est.* | How to measure |
|---|---|---|---|---|
| Plan | n/a (part of 307-905 ms) | ≤ 600 ms (coarse grid ~100 ms; routing about 40 edges on a 32 m grid ~300 ms) | ≤ 2 s | `gen.ts` timings per stage |
| Tile + mesh p95 | 200-458 ms / 64 chunks ≈ 3-7 ms average | ≤ 25 ms | ≤ 100 ms | New `scripts/stream.ts`: every chunk of seeds 0-9, p50 and p95 |
| Throughput | n/a | 90 m/s crosses 256 m in 2.8 s, with about 12 new chunks per crossing → about 120 ms of worker time per 2.8 s (4%) | about 6 per crossing | `stream.ts` drive replay |
| Time to drive | gen + mesh + upload, 0.5-1.4 s | plan + 9 chunks ≈ 0.7 s | ≈ 2.5 s | `performance.now()` from load to first frame |
| Resident triangles | 718-799k | about 25 full chunks × ~12k + about 91 half-res × ~3k ≈ 570k | about 9 full + 35 half-res ≈ 210k | `renderer.info` |
| Resident mesh bytes | 24.8 MB | about 20-25 MB | about 10 MB | sum of buffer byteLengths |
| Resident tile fields | 2.37 MB | 116 × 38 KB ≈ 4.4 MB | 1.7 MB | |
| Architecture targets | | 1 M tris, 250 draws main (`architecture.md:75`) | 300k tris, 120 draws | |

Draws per chunk today are about 4-6 (terrain, road, trees ×3, buildings). At 116 chunks that is at or past the desktop budget, so far chunks must merge their trees into the terrain draw or hide them. That is the rule `MOBILE_TREES` already applies on mobile.

## 4. Phased plan

Each phase ships on its own. The checks are the repo's own: `bun test`, `typecheck` and `build`; `car.test.ts` bit-exact; `telemetry`/`feel` byte-identical; `gen.ts` `world_checksum` and the colour checksum; `seeds.ts` and `races.ts` 20/20 clean.

| # | Step | Touches | Risk | Proof | Player impact |
|---|---|---|---|---|---|
| 1a | **Real topology.** Split the ring edge at junction nodes; `Atlas` reads edges directly; meshing still draws the circuit from `data.road` | `index.ts:45-95`, `routes.ts:111-160`, `chunks.ts:341-350`, `trackside.ts:47-60`, `world.ts:213-230, 323` (circuit test by edge set) | Low | `world_checksum` and the `build_chunks` hash identical over seeds 0-9; `routes.test.ts` route ids, lengths and checkpoints identical | None. No bump: same island. |
| 1b | **Junction patch** (`worldgen/junction.ts`) for spur-on-ring and spur-at-gate; street grids keep `extended()` | `chunks.ts` road layers, new module, `stamp.ts` `junction()` | Med: crack-free draping at fillets | `chunks.test.ts` plus `worldcheck.ts`; screenshots of 3 seeds at driving height. Heights change near mouths, so the checksum changes. | Mesh change. If the stamp disc changes heights, it changes the island, so it lands with 1c's bump. |
| 1c | **Inter-town roads** on the island: RNG over towns plus circuit joins, `Router` with the reuse discount, X and T nodes, local class | `towns.ts` (no ring tie), `route.ts` (node → edge-point search), `index.ts` pipeline, `types.ts` `EdgeKind` gains `local`, `map.ts` line kinds | Med: 2 km is tight; crossings with the circuit | `gen.ts` gains "junctions, X count, km of road, min junction angle"; `seeds.ts` 20/20; `races.ts` all clean; gen time +≤ 10% | **`WORLD_VERSION` 3 → 4**: island records, ghosts and duel ghosts reset; peers on old builds read as a foreign map |
| 1d | **Routes from the graph**: highway sprints, cycle circuits (alongside the loop), fillet points in routes, course closure via `World.place` instead of baked items | `routes.ts`, `modes/races.ts`, `race-mode.ts`, `world.ts` `place` users | Low-med: new route ids reach the lobby | `races.ts` every route × every car finishes inside par; `routes.test.ts` | New race ids; old lobby peers can't pick them, because `sanitize_event` checks known ids |
| 1e | One **roundabout** (optional) | `junction.ts`, `stamp.ts`, solids | Med: physics on the central kerb | Autopilot through it on every car; `crash.ts` | Folded into 1c's bump if it ships together, otherwise another bump |
| 2a | **Tile-ify the runtime.** `World` and `field.ts` read 65² tiles; `WorldView` add and drop; the worker still runs monolithic and slices its grids into tiles | `field.ts`, `world.ts`, `scene.ts`, `buildings.ts`, `world/jumps.ts`, `worker.ts` | Med: hot physics path | **Bit-exact**: `car.test.ts`, `telemetry`/`feel` byte-identical, `autolap.ts` identical, tile hashes equal the slices of `world_checksum` grids | None |
| 2b | **Persistent worker plus chunk requests** on the island: deliver nearest-first, spawn at 3×3 | `scene.ts`, `worker.ts`, `main.ts` load path, `driver.ts` async place | Med: async teleports in modes | Time to drive drops (measure); all modes pass a manual run; `scripts/*` still sync | Faster load. Nothing else. |
| 2c | **`plan` / `tile` split.** Island plan still on the full grid (identical output); `tile()` re-derives fine data from the plan | `index.ts` → `plan.ts` + `tile.ts`; stamp, trails, lots and jumps get per-chunk entry points | High: the island's stage order (carve → plateau → stamp → trails → pads → lots) must be reproduced exactly | `world_checksum` identical over seeds 0-9, with each chunk built alone vs. the monolithic result | None |
| 3a | **`mainland` kind, 6×6 km**: `KindDef` gains `size`; the coarse-grid plan; settlement tiers; the full network; graph circuits | `kinds/`, `worlds/mainland.ts`, `types.ts` (`SIZE`/`N`/`ORIGIN` off module scope), `terrain.ts` region mask, `menu.css` tile, `public/menu/mainland*.webp` | High: content tuning | New `scripts/stream.ts` budgets (table §3); `races.ts` on mainland; phone run at the 700 m fog | New Play tile. Island untouched. Own records keyspace (`world_key`). |
| 3b | Mainland modes: hunt bounds, drift and duel on any route near the player, gymkhana and parking at the nearest site; free-roam minimap layer; world-map from the plan | `hunt.ts:70`, `drift-mode.ts:77`, `duel-mode.ts:100`, `gymkhana.ts:145`, `minimap.ts:34`, `map.ts`, `map-worker.ts` | Med | `bun test src/modes`; manual pass | |
| 4 | **10×10 km**: `WORLD_LIMIT` to 8000; region masks (2-3 islands or one continent); `spawn_near` search past 2 km | `car-packet.ts:4`, `world.ts:117`, `terrain.ts` | Low for net (a foreign map for old peers), high for content and phone memory | `stream.ts`; phone time-to-drive ≤ 3 s | Old builds drop mainland packets past ±5 km, but they already see mainland peers as foreign (`net.ts:461`). **No `PROTOCOL` bump.** |

On the brief's assumption that `WORLD_LIMIT` forces a `PROTOCOL` bump: it doesn't. At 6×6 the world stays inside ±5000. At 10×10, only peers on a different world id (and so already foreign) are affected. A bump is needed only if the *island* ever grows past ±5 km.

## 5. Open questions for the owner

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Is the big world a new kind or the island grown? | (a) New `mainland` kind beside the island. (b) Replace the island. | **(a)**: the island stays the fast phone and lobby map; mainland records start clean; the registry supports this (`kinds.ts:31`). |
| 2 | Circuits: the tuned loop, graph cycles, or both? | Loop only / cycles only / both | **Both on the island** (the loop is tuned: switchback stack and kickers, `path.ts`); **cycles on the mainland**, gated by `gen.ts` targets |
| 3 | Accept an island record reset in 1c? | Bump `WORLD_VERSION` to 4 / ship the network only on the mainland | Bump. The island gets the first real junctions and the most play. |
| 4 | Junction realism | Geometry only / plus give-way markings / plus AI traffic | **Geometry plus markings, no traffic.** Traffic is a separate project (agents, net sync). |
| 5 | Roundabouts | None / one per region / at every highway crossing | **One per island or region**, as a feature with a pace call |
| 6 | Bridges and overpasses | At-grade only / mesh colliders (the Rapier switch, `world.md`) | **At-grade only** until there's a reason to add mesh colliders |
| 7 | Mainland size | 6×6 / straight to 10×10 | **6×6 first.** About 2.5 min across at 40 m/s; grow only if it's fun to cross. |
| 8 | Mainland border | Sea (today's mask) / mountain wall / invisible wall | **Sea.** Water plane and mask exist; it reads as an archipelago and fits the brand. |
| 9 | Fog distance | Keep 1300/700 / push desktop to 2000 for vistas | **Keep.** Resident chunks grow with r²: at 2000 m about 2.3× the chunks. |
| 10 | Town interiors | Grids (today) / tensor-field streets | **Grids plus one city with a main street** (`world.md` §6); tensor fields only if grids still read as stamps |
| 11 | Load UX on the mainland | Wait for everything / spawn at 3×3 and stream | **Spawn at 3×3.** Modes that teleport show a short "loading area" fade until `ensure` resolves. |
| 12 | Peers far apart | Each streams its own area / pull everyone to one area | **Each streams its own area.** Remotes off-tile skip the contact shadow; the minimap dot still works. |

## Not checked

- Real phone timings and memory. All numbers are from Bun on the desktop, and the brief's quieter 290/162 ms run suggests these are inflated by a busy machine.
- The A* cost of inter-town routing at 6 km was estimated from today's spur stage (21-78 ms for 3-6 spurs), not run.
- That `three` r187 needs no origin rebasing at ±5 km was reasoned from float32 ulp, not tested in a scene.
- Draw counts per chunk come from reading `scene.ts`, not from `renderer.info`.
- Whether 2 km has room for an RNG network plus the loop without crowding: run `map.ts` renders after 1c.
