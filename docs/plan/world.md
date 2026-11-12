# World generation: from blob loop to an island worth driving

> **Status 2026-11-12 (v0.29.0):** Shipped: 1-6 (the circuit with character, landmarks, biomes, the island shape, offroad routes with the canyon and gap jump, street routes), and records keyed by world version. Open: 7 (points of interest at trail ends; no quarry or lookout). Dropped: the cuts in 8, except the debug counters: `JumpPlanner.open()`, `open_items()`, the cone chicanes and up to 4 road kickers all stay (`worldgen/jumps.ts`, `recipe.ts`). Rivers came later anyway, with `biomes.md` B4. The evidence images sit in a local scratchpad, not in the repo.

Round 1, 2026-11-09. This is an audit plus a plan, and nothing is built yet. It covers seeds 0, 1, 2, 3 and 7 on v0.5.1 (worktree state on the same day, with `jumps.ts` mid-edit by another coder).

Evidence lives in a local scratchpad:

- `map-seed{0,1,2,7}.png`: top-down renders drawn straight from `generate(seed)` with `map.ts` in the same folder. Yellow is the circuit, orange the spurs, grey the streets, red the buildings, magenta the road kickers, cyan the big hill ramps and white the checkpoints.
- `s{0,2,7}-*.png`: in-game shots at driving height, with the camera orbited and zoomed out.
- `stats.ts` and `gap.ts`: the numbers quoted below.

## Audit: why it is boring

| # | What you see | Measured | Why the code does it |
|---|---|---|---|
| 1 | **Every seed has the same lap**: a rounded blob around the middle of the island. The minimap looks the same on every seed. | 61-69% of the lap has a turn radius over 400 m and 5-11% has one under 150 m. Radii under 60 m make up 0-1% of the lap, so a game called Harepin has no hairpins. The circuit stays 490-740 m from the centre on every seed. | `path.ts` `loop_controls`: 16 control points on a circle of r = 600 ± 210 from one low-frequency `fbm`, then Catmull-Rom. That gives one wobble per control and no corner types. |
| 2 | **Flat and level**: hills run *beside* the road, never under it. | The road sits at 21-78 m while the terrain reaches 186-216 m. Total climb per 4 km lap is 92-131 m. | `loop_road` smooths heights with window 24 × 4 passes, a low-pass about 200 m long that irons out every crest and dip. The loop radius keeps it off the peak. |
| 3 | **The best features are never on the route**: the peak, the coast and the towns are all things you drive *past*. | The peak is 354-475 m from the road. 14-21% of the land is within 60 m of any road. Towns sit 30-260 m off the ring at the end of a dead-end spur. | `place_towns` asks for `RING_CLEAR` ≥ 30 m and the street grid keeps `STREET_RING_CLEAR` away from the ring. Nothing pulls the loop toward the coast or the summit. |
| 4 | **No landmarks or vistas**: from the road you see the same green hills, cone trees and a few gable roofs everywhere (`s0-2-left`, `s2-1-drive`). | 0 unique objects. Trees are 3.5-5.5k evenly scattered dots, and props are 1 kind (`street_light`). | Trees come from one `fbm(/180)` threshold, which gives a uniform speckle with no forests or clearings. `PropKind` has a single member and nothing marks the summit, the coast or a ridge. |
| 5 | **One biome**: the same grass, slope and tree mix from shore to summit. | 5 terrain bases (grass, alt grass, sand, rock, snow), all chosen by height or slope. | `chunks.ts` `terrain_colors` has no regional field. The island mask is radial (`r/960` + 0.3 noise), so the coast is always a round blob with no bays, headlands or beach run. |
| 6 | **Towns are stamps**: 3-6 square 2×2 or 3×3 grids that look alike, and none are on a race route. | Town radius 90-140 m, block 45-70 m, 36-156 street edges. | `town_streets` builds one rotated grid with no main street, square or variation in block size. |
| 7 | **Off-road has nothing to drive to**: 9-11 ramps per island, mostly in places you can't see from the road. 160 random rocks, logs and hay are scattered with no purpose. | 3 big ramps (on hilltops), at most 12 kickers, about 220 items. | `JumpPlanner.open()` and `open_items()` throw darts at the whole island. `hills()` is the only placement that has a reason behind it. |

Not the problem: the road, lighting and car read well at driving height. The road-height stamping, spur routing, determinism discipline and jump maths are solid foundations to reuse.

## Plan, ranked by fun gained per effort

Sizes: S ≈ a day, M ≈ 2-4 days, L ≈ a week, for one coder.

| Rank | Change | Fun | Size | Code it touches |
|---|---|---|---|---|
| 1 | **Circuit with character**: corner types, real elevation, routes past the summit flank and the coast | high | S | `path.ts` (`loop_controls`, `loop_road`), reuses `route.ts` `limit_grade`; `scripts/seeds.ts`, `scripts/gen.ts` metrics |
| 2 | **Landmarks and vistas**: summit mast, lighthouse on a headland, ridge wind turbines, a rock arch | high | S-M | new `worldgen/landmarks.ts`, `types.ts` `PropKind`, render in `buildings.ts`/`models.ts` (merged into chunk meshes) |
| 3 | **Forests, clearings, biomes**: a low-frequency biome field that drives tree density, tree kind and ground tone | med-high | S | `index.ts` tree scan, `chunks.ts` `terrain_colors`, `palette.ts` (token mixes only) |
| 4 | **Island shape**: domain-warped coast with 1-2 bays and a headland, a second ridge, a flat beach band | med | S | `terrain.ts` `raw_height` |
| 5 | **Offroad race type**: dirt trail plus canyon plus gap jump, point-to-point across the interior | highest | L | new `worldgen/trails.ts`, `worldgen/canyon.ts`; `stamp.ts` (carve and trail pass); `jumps.ts` (gap placement, landing deck); `world.ts` `grip`; `chunks.ts` dirt tone; new `modes/races.ts` |
| 6 | **Street race type**: one bigger town with a main street; route through two towns over spurs and part of the circuit | high | M | `towns.ts` (main street, one "city"), new graph route search in `worldgen/routes.ts`, barriers via `jumps.ts` items; `modes/races.ts` |
| 7 | **Points of interest at trail ends**: quarry bowl (gymkhana site), lookout pull-off, beach run | med | M | `jumps.ts` (replaces `open()`), `modes/gymkhana.ts` `find_site` can prefer the quarry |
| 8 | **Cuts** (below) | clarity | S | `jumps.ts`, `index.ts` |

Do 1-4 first. They are all S, touch no schema, and change what every mode feels like. Then 6, because the graph already exists. Then 5, the big one.

### 1. Circuit with character (`path.ts`)

- Use 20-24 controls instead of 16, with a radius span of 380-860 m from two noise frequencies (`fbm(c*3)` plus `fbm(c*9)` at half weight). That gives both long sweepers and tight pinches.
- Three **attractors** move single controls before the spline. All three are deterministic and use only `+ - * / sqrt`.
  - Summit flank: the control nearest the peak moves in until the terrain under it is ≥ 90 m.
  - Coast: the control nearest the shore moves out to where the height is 6-12 m, which makes a sea-view section.
  - Town: one control moves to within `RING_CLEAR` of the largest town. This one is optional, and the street race needs it less.
- **Hairpins**: one control pair at the summit attractor is pinched into a switchback. The existing `min_radius` retry loop with `ROAD_MIN_RADIUS` 45 m is the guard. Lower it to about 30 m only if `scripts/seeds.ts` stays 20/20 clean.
- **Elevation**: smooth with window 8 × 3 instead of 24 × 4, then `limit_grade(ys, run, 0.12)` from `route.ts` (export it). Crests then need a vertical curvature check: at 45 m/s a crest radius under v²/g ≈ 200 m lifts the wheels. A few crests that lift *slightly* are fun. Cap the lift with one more smoothing pass where the crest radius falls under 120 m.
- Acceptance, added to `scripts/gen.ts`:
  - ≥ 25% of the lap under 150 m radius;
  - ≥ 1 point under 60 m;
  - climb per lap ≥ 250 m;
  - max grade ≤ 12%;
  - `scripts/seeds.ts` 20/20 clean on every car.

### 2. Landmarks (`worldgen/landmarks.ts`)

- One of each kind per island, each placed where it is *seen*. Score candidate spots by height and by how much circuit is in line of sight; the sight check samples 32 road points and marches the heightfield.
  - **summit mast**: highest vertex, with a blinking light (an emissive token, so the bloom tier picks it up at dusk).
  - **lighthouse**: the coast vertex with the most open sea in front of it, on a headland from item 4.
  - **wind turbines**: 3-5 along the longest ridge line above 70 m. Rotors are the only animation and use one shared rotation uniform.
  - **rock arch**: over the offroad trail, or over a spur when there is no trail.
- Each landmark is a low-poly mesh of ≤ 400 tris, merged into the chunk building mesh, so it adds 0 draws. The turbine rotors are 1 instanced draw.
- Colours: token mixes in `palette.ts` only. The mast and lighthouse lights use `cottontail`, which matches the art direction's "cottontail only on markers".

### 3. Forests and biomes

- Biome field `b = fbm(x/700, z/700, seed + 61)` splits the island into three regions:
  - **meadow**: few trees, light grass;
  - **pine forest**: dense clumps with clearings, darker ground, kind 0 trees;
  - **dry upland**: scrub, rocks, ochre ground, sparse kind 1 trees.
- Tree density changes from a soft threshold to a hard one: `(density - t) * 6` instead of `* 2.6`. That gives forest edges and open clearings rather than speckle, at the same tree count, so the cost stays the same.
- `terrain_colors` gets a biome-tinted base per region: 2 extra LUT rows built from token mixes, with no new colours.

### 4. Island shape (`terrain.ts`)

- Warp the radial mask with `fbm(x/900)` and cut 1-2 bays with seeded half-plane dents. That gives headlands for the lighthouse and a coast the circuit can run along.
- Add a beach band: flatten heights 1-5 m into a 40-80 m wide strip on one stretch of coast. It doubles as the offroad finale.
- Risk: the circuit may cross a bay. `gen.ts` already reports `over water`. Make it a hard reject in the `loop_path` retry loop.

## Race types: one island, three kinds of route

### Shared shape

New `WorldData.routes: Route[]` (**schema change**, worker output):

```ts
export const RouteKind = { CIRCUIT: "circuit", STREET: "street", OFFROAD: "offroad" } as const;
export type RouteKind = (typeof RouteKind)[keyof typeof RouteKind];

export interface Route {
  id: string;            // "circuit", "street-1", "offroad-1", …
  kind: RouteKind;
  closed: boolean;       // circuit laps; street and offroad are point to point
  points: RoadPoint[];   // centreline, 2 m apart
  checkpoints: Checkpoint[];
  /** Gate half-width per checkpoint: the road edge for circuit and street, a wide flag pair off-road. */
  gate_hw: number;
  length: number;
  par_ms: number;
}
```

- `world.road` and `world.checkpoints` stay as they are, as the circuit route, so `race.ts`, `ghost.ts`, drift and duel keep working untouched.
- `RouteTracker` from `modes/route.ts` already follows any point list, and hunt already checks a gate by radius. A new `modes/races.ts` runs one route: countdown, gates in order, finish, stars. Most of it comes from duel and hunt.

### Progression (existing `Track`)

- One `new Track("race", seed, RACE_IDS, local_store())`.
- `RACE_IDS` = `["circuit", "street-1", "offroad-1", "street-2", "offroad-2", "circuit-rev"]`. Only the ids the seed actually produced are listed, so a seed with no canyon skips its offroad ids.
- `unlocked()` already means that a finish opens the next one.
- Par: `length / pace + turns * TURN_MS`, with pace 31 m/s circuit, 17 m/s street and 19 m/s offroad. `stars_for(ms, par)` as in the other modes.
- Calibrate the three paces once with an autolap run per kind (extend `scripts/autolap.ts` to take any `Route`), not by eye.

### Street route

- **Generation**, in `worldgen/routes.ts` after lots:
  - The graph already joins every town to the ring through its spur.
  - Dijkstra over `graph.edges` from the centre node of town A to the centre of town B. Edge cost is length × (street 0.6, spur 1, ring 1.4), so the route prefers streets, and each 90° street turn costs −20 m, so it seeks corners.
  - Keep the route if it has ≥ 6 street turns and 1.2-2.5 km total. Otherwise try the next town pair.
  - `street-2` reverses the pair or uses the next-best pair.
  - Turns at junctions are 90° on a 4 m half street, which is fine at street pace. The spur-to-ring T is the existing clean T.
- **Towns**: give the biggest town a **main street**, one through-axis twice as long as the grid, with shop lots and a square (an `empty` lot cluster in the middle). Radius 160-200 m, one per island. This is the only town-size change: building count goes up by about 60. Lots, buildings and parking logic stay as they are.
- **Course definition**: put light `barrier` items across every side street the route passes. The item kind exists, and barriers are light, so a crash costs time, not the run. Add `cone` pairs on the apex of each turn.
- **Surfaces**: asphalt everywhere, so no new grip. Sidewalks and building OBBs are the walls.
- **Checkpoints**: one per route turn, plus one every 150 m on spur and ring stretches. `gate_hw` = street half + sidewalk.

### Offroad route

- **Generation**, in `worldgen/trails.ts` after jumps:
  - Waypoints: start at a town edge or on the beach. Then the canyon crossing (below), the summit shoulder (a 70-110 m contour, never the top, so it stays drivable), a forest clearing from the biome field, and the beach band as the finish.
  - Route between the waypoints with the existing `Router` A* on the 16 m grid, with costs flipped toward dirt:
    - the slope penalty is halved;
    - `MAX_GRADE` is 0.28;
    - crossing a road costs a flat +200 m, so trails cross roads rarely and squarely;
    - towns are blocked.
  - Then `unkink` → `chaikin` → `resample` (all existing).
- **Stamping**: a new `Stamp.trail(points)` pass, half 4, `SHOULDER` 6. It only blends 50% toward a smoothed trail height, so the ground keeps its bumps and crests. It also writes a **surface grid**: `Uint8Array` (N+1)² with values 0 grass, 1 dirt, 2 asphalt (**schema change**, a 263 KB transferable).
- **Grip**: `world.grip` reads the surface grid first, with dirt at 0.88, between asphalt 1 and grass 0.72. `roll` treats dirt like a shoulder. One lookup per wheel, so no cost.
- **Look**: in `terrain_colors`, surface 1 gets a dirt tone (a `warning`/`background_darkest` token mix, as the dust puffs use). It adds no mesh and no draws.
- **Checkpoints**: flag pairs on posts, `gate_hw` 8 (hunt's `GATE_RADIUS`), every 120-180 m and at every feature. Missing a checkpoint means it still shows as next, the same as the circuit today.
- **Features along the trail**:
  - the canyon gap jump;
  - one big ramp from `hills()` that the router is pulled to;
  - log and rock rows as trail edges in place of `open_items()`;
  - the rock arch landmark.

### Lobby races

- `RaceEvent` `request` and `start` carry `route: string` (**net change**). `sanitize_event` accepts only ids present in this seed's `routes`.
- `laps` applies only to closed routes, and street and offroad force 1. `min_lap` plausibility per route uses `length / 90`.

## Canyon and gap jumps

### Carving (`worldgen/canyon.ts`, run between `terrain` and `loop_road`)

- **Path**: 0-1 canyon per seed. It is a polyline from a point on the summit flank down to the coast, following the steepest descent on the 16 m grid with a noise wobble, then `chaikin` 3 passes. Skip the seed if it ends up under 300 m long.
- **Profile**: at distance `d` from the line, `cut = depth * (1 - smoothstep(floor, floor + wall, d))`.
  - depth 7-12 m, floor half-width 6-10 m, wall 6-10 m. On 4 m cells that makes 45-60° faces, which turn rock-coloured through the existing `ny < 0.7` rule.
  - The floor stays ≥ 3.5 m above sea, so it is drivable and has no water flicker.
  - Near the trail crossing the wall width eases down to 3 m, which makes a "slot" so the gap is narrow while the canyon still reads wide elsewhere.
- **Circuit and spurs crossing it**: no bridges, because the ground is a heightfield plus ramps and there are no mesh colliders. Road stamping runs after carving and fills a **causeway**: the existing `edge()` stamp with shoulders. That reads fine in low-poly. Pick the canyon so that it crosses the circuit at most once and at a straight.
- **Cost**: one pass over the bounding box of each segment, about 10-20 ms desktop. Gen today is 250-660 ms, so the budget is +5%.

### Gap jump that lands at race pace

The numbers come from `flight()` in `jumps.ts` (`gap.ts`). They give the touchdown distance past the lip and the descent angle there, for the existing `ROAD_KICKER` (2 m over 8 m):

| landing below lip | 22 m/s | 26 | 30 | 35 | 40 m/s |
|---|---|---|---|---|---|
| 0 m (flat) | 20 m @13° | 28 m | 38 m | 52 m | 68 m @13° |
| 4 m | 31 m @27° | 40 m @24° | 51 m @21° | 66 m @19° | 83 m @18° |
| 8 m | 38 m @34° | 48 m @30° | 60 m @27° | 76 m @24° | 94 m @22° |

Touchdown distance grows with v², so one gap can't fit every speed. The design therefore fixes the **slow end** and makes the **landing long**.

1. **Take-off**: use the existing `ROAD_KICKER` shape unchanged (`road: true`, `ROAD_BACK`). Its `LAUNCH_KEEP` 0.91 is fitted, and `jumps.test.ts` already proves every car flies the predicted line off it. A new lip shape would need a refit. The toe sits on the near rim, behind a run-up of at least `ROAD_RUNUP` 30 m that turns no more than `RUN_TURN`. That is the same `fits_road` check, run against the trail points.
2. **Gap width**: `gap = d_touch(V_MIN = 22 m/s, drop) - 6 m`, which is about 14 m for a flat landing and about 25 m for a 4 m drop. Slower than 22 m/s is a walking-pace attempt, and it falls in.
3. **Landing deck**: a new analytic `RampKind.LANDING`, which is an internal type, not net. It is a planar downslope on top of the carved far rim:
   - slope 12-15°, roughly the mid-speed descent angle, so the normal impact speed stays small;
   - starts at the gap end and runs to `d_touch(V_MAX = 45 m/s) + 20 m` ≈ 110 m, then eases to the trail grade.
   - Today a landing on terrain hits 4 m facet edges whose normal jumps between triangles. That is the main source of the "touchy" landings: the `yaw` and `upright` failures in `jumps.test.ts` come from uneven contact. An analytic plane under all four wheels removes it. `ramp_surface` already takes the higher of terrain and ramp, so the deck simply sits over the carve.
   - `ramp_extent` divides by `rise`, so `LANDING` needs its own extent branch (rise 0, `grade` < 0) rather than a zero-rise kicker.
4. **Miss**: a car that comes up short drops onto the canyon floor, 7-12 m below. It must not be a dead end:
   - the trail router adds a **ramp-out**, a dirt track along the floor up to the trail 60-100 m downstream at ≤ 0.25 grade;
   - the next checkpoint sits *after* the ramp-out joins, so missing the jump costs about 6-10 s and nothing more;
   - `R` reset already puts the car on the nearest road, and offroad routes need `spawn_near` to include route points. That is one more lane in its grid.
5. **Spawn and reset safety**: `spawn_blocks` already excludes kicker run-ups and landings. Extend it to the gap and the deck.
6. **Proof before any visuals**, as a new block in `jumps.test.ts` with the same harness and a `ground_with(takeoff, gap, deck)`. For every car in `CARS`, at 22, 26, 30, 35, 40 and 45 m/s, with gas 0 and 1, and with slip 0 and 1.5 m/s:
   - lands on the deck (`landed` between gap end and deck end);
   - `upright` > 0.75 and `sink` < 0.05;
   - the post-landing `yaw` < 0.35 and the heading change < 0.15 rad, the same thresholds the road kicker has today.

   If a car fails at 45 m/s, lengthen the deck and leave the slope alone.
7. **Placement**: the trail router picks the crossing *first*: the narrowest straight-ish canyon section where both rims have 40 m of straight approach and run-out. Then it carves the slot there and routes the trail through it. Placement is deterministic and comes from the `sub(seed, "canyon")` stream.

A second, optional gap type on the same code is a **crest gap**: a dip cut into the trail between two crests, with no canyon. It reuses steps 1-6 with drop 0.

## What to cut

| Cut | Why | Where |
|---|---|---|
| `JumpPlanner.open()` random kickers (40 darts, up to 12) | Unseen, unreachable on purpose, and they eat the `RAMP_SPACING` budget that trails need | `jumps.ts` |
| `open_items()` 160 random rocks, logs and hay | Reads as debris, not design. The same items line trails and the quarry instead | `jumps.ts` |
| Circuit kickers from 4 to at most 1 | Once the circuit has real crests, kickers on the race line belong to offroad. Keep 1 so the lobby circuit stays spicy (`a112527`) | `jumps.ts` `MAX_ROAD_KICKERS` |
| Random cone/barrel chicanes on the circuit | Light items across the racing line read as clutter in a road race. Move them to the street route as apex cones | `jumps.ts` `chicanes` |
| `WHY` / `no()` debug counters | Debug code in a worldgen module (in-flight work by another coder; don't ship it) | `jumps.ts` top |
| Rivers, bridges, a bigger island (4096 m) | Bridges need mesh colliders (the Rapier switch). A bigger island is 4× terrain gen and mesh, which blows the mobile budget. The canyon plus causeway covers the look | not planned |

## Budget (mobile matters)

- **Gen time**: today 250-660 ms desktop in the worker, with terrain at 180-370 ms. The additions are carve (≤ 20 ms), routes (Dijkstra on about 500 edges, < 5 ms), trails (A* on 128², < 10 ms × waypoints) and landmarks (< 5 ms). Target: +10% at most. Check with `scripts/gen.ts`.
- **Triangles**: chunks are already 600-650k triangles at full res against the mobile budget of 300k in `architecture.md`. None of this adds terrain resolution, landmarks are ≤ 2k tris in total, and the dirt and biome looks are vertex colour only. Do not raise terrain density for the canyon walls: faceted cliffs are the house style.
- **Draws**: landmarks merge into the chunk building mesh, rotors are 1 instanced draw, flags and barriers use the existing item instancing, and the landing deck joins the ramp mesh. That is about +2 draws.
- **Physics**: `World.ramp_at` scans every ramp for each wheel query, so at 360 Hz the cost grows with the ramp count. Cuts plus gaps keep the count at or under today's ~12. Above about 40, bucket ramps in the solid grid.
- **Determinism**: everything above uses `+ - * / sqrt floor` and `sub(seed, "<stage>")` streams. New stages (`canyon`, `trails`, `landmarks`, `routes`) each get their own stream, so they don't shift towns or jumps.

## Flagged for the owner (ask before building)

- **Schema change (worker output)**: `WorldData` gains `routes`, `surface` (Uint8Array, transferable), `canyon` (polyline, for the minimap and the mesh), `landmarks`, and `RampKind.LANDING`. All of it is internal to one build, and nothing is persisted.
- **Net change**:
  - `RaceEvent` `request` and `start` gain `route`.
  - A peer on another build with the same seed now gets a different island. Add a `WORLD_VERSION` to the seed check, either as a new `CarState` field or by folding it into the room's seed handshake. Today `net.ts:281` compares only `seed`, so mismatched peers would race on different maps without a warning.
- **Persistence change**: `Track` keys `harepin:<mode>:<seed>` and ghosts `harepin:ghost:<seed>` would keep times set on the old island.
  - Recommended: suffix the keys with `WORLD_VERSION` (old saves go quiet; nothing breaks).
  - Alternative: accept stale bests.
  - Per `AGENTS.md` this needs a version bump. A room format old builds can't read makes it major.
- **Dependency**: none.
- **New modules**: `worldgen/canyon.ts`, `trails.ts`, `routes.ts`, `landmarks.ts` and `modes/races.ts`. All are pure, Bun-testable and built on existing patterns (`Router`, `Stamp`, `Track`, `RouteTracker`), so there is no new state layer.

## Order of work

1. Circuit (1) plus the metrics in `gen.ts`. Island shape (4) goes in the same pass, because both move the loop. Gate: `seeds.ts` 20/20.
2. Biomes (3) and landmarks (2). Gate: screenshots at driving height on 3 seeds; the owner looks.
3. Flags above decided, then `routes` schema, `modes/races.ts` and the street route (6).
4. Gap-jump test harness (canyon step 6) **before** any carving, then canyon, trail, surface grid and offroad route (5), then the POIs (7).
5. Cuts (8) land with the step that replaces each item.

## Not checked

- Real phone GPU and gen time on a phone.
- In-game laps on the new shapes (everything above is from `generate()` and stills).
- Whether 22 m/s is the right slow end for the heaviest car.
- How the owner ranks street against offroad.
- In-game top-down: a dev server reload (others editing `src`) interrupted the throttle part of the drive run, so the driving-height shots are from the spawn and the orbit camera.
