# Racetracks: seeded race circuits

Round 1, 2026-11-17, read at `origin/master` `77c828c` (v0.55.0). Plan only. Nothing was run: no build, golden, proof or races. Every `file:line` is from reading the code at that commit. Numbers marked (unverified) are estimates until a script measures them. Quest: `dcebc16`.

The owner wants proper race circuits of the kind single-seaters race on, generated from a seed like every other world. The two feel references are one circuit with a figure-eight crossover, esses and a hairpin, and one that runs anticlockwise over hilly ground. They are references for feel only: no real track or series name goes in player text, and no layout is copied.

Local `master` holds unreleased work that removes the wall-ride kind and rewrites every golden. Whoever builds this starts after that lands.

## TL;DR

- **The corner vocabulary already exists.** `worldgen/sky.ts` plans a closed lap from straight and arc pieces with eased entries: sweepers, hairpins, S-bends, esses, chicanes, a figure-eight, crossovers with clearance, and an exact closure solve. It only ever builds a floating deck.
- **A deck kind cannot be the answer.** An AI field never races a kind with `rails: true` (`modes/field-route.ts:11`), and a deck has no run-off, no ground and no scenery.
- **Recommended: a new land kind, `raceway`, through `land_kind`,** with the ring planner swapped for a piece planner by one recipe field. The volcano already proves a land kind with no towns and only its loop (`recipe.ts:542-543`). Terrain, cut and fill, kerbs, gates, the `circuit` and `circuit-rev` routes, par, the speed trap, the minimap and AI races then come from existing code.
- **Elevation is free on land.** The road takes its heights from the terrain under a closed path, so it closes in height by construction. The sky's profile solve is not needed.
- **The bridge is the only hard part, and it is not in the first slice.** A heightfield cannot hold a road over a road. The physics already takes `max(terrain, deck)` with a from-above test (`world/world.ts:408-414`), so a bridge is a deck span over ground. The ground mesh path does not draw decks today (`worldgen/chunks.ts:324`).
- **Width stays 12 m.** `ROAD_HALF` 6 is read by the AI line, hazards, kerbs, gates, trackside and the minimap. A wider track is a refactor of its own and buys nothing a player would name.
- **First slice (M, about 3 days, unverified):** `?world=raceway`, unlisted. A non-crossing lap of 2.8-4.2 km with a hairpin, esses, a chicane and sweepers on gentle hills, kerbs, grass run-off, lap and reversed lap, speed trap, and an AI field race.

## 1. How a circuit fits

### What consumes a closed loop today

| Consumer | Where | What it needs from the world |
|---|---|---|
| World data | `worldgen/types.ts:302-327` | `road: RoadPoint[]` (closed centreline, 2 m steps), `circuit: number[]` (edge ids in driving order), `checkpoints` (index 0 is the start line), `routes` |
| Circuit route | `worldgen/routes.ts:113` `circuit_route` | `road` + `checkpoints`. Gives id `circuit`, `closed: true`, `gate_hw: ROAD_HALF`, lap length, `par_ms` |
| Par | `routes.ts:82` `drive_time`, `:106` `par` | A point-mass bot (`BOT` grip 6, accel 6, top 36 m/s, brake 6; `:38`): corner cap `sqrt(grip × radius)`, one accelerate and one brake pass, times `PAR_SHARE` 1.15 or the recipe's `lap_par`, rounded up to 0.5 s |
| Reversed lap | `routes.ts:120` `reverse_circuit` | The circuit route; null when a road kicker sits on the loop |
| Race levels | `modes/races.ts:33-53` | Route ids. `circuit`, `circuit-rev` and the speed trap (`trap`, compact worlds only) list themselves when the route exists |
| Race run | `modes/races.ts:93` `race_course`, `:110` `RaceRun` | `route.points` + first point again; gates by nearest index; `RouteTracker` searches a 30-point window (`modes/route.ts:78-106`), so a road that passes near itself never steals the match |
| Speed traps | `modes/races.ts:198` `trap_points` | `straights()` of the line: bends tighter than about 70 m radius end a straight (`modes/route.ts:48`) |
| AI field gate | `modes/field-route.ts:11` `field_races` | `route.closed`, the kind's `rails` false, and on a streamed world a compact loop |
| AI racing line | `ai/line.ts:40-66` `RaceLine` | Route points, `ROAD_HALF` for the room either side (`:187`, `:205`), ramps on the road, ground heights for hazards (`ai/hazards.ts:68`, passes `y`) |
| Grid | `ai/field.ts:82` `grid_spot` | Slot `k` stands `3 + 4k` points behind the line, 2.4 m either side. Seven cars reach 31 points, 62 m back |
| Race length | `modes/race-laps.ts` | `round(240 s / par)`, 1 to 15 laps |
| Kerbs | `world/kerbs.ts:25` `kerb_marks` | `data.road` only: a kerb on the inside of every bend turning over 0.09 rad across 12 samples, drawn and felt from the same marks |
| Proof drives | `scripts/races.ts` | Every route of each seed, every car's autopilot: finish, on the road, inside par |
| Career | `career/series.test.ts:51-57` | An event's route is closed, passes `field_races`, par at most 450 s |

Nothing in that list cares how the loop was planned. A generator that hands over `road`, `checkpoints` and `circuit_route(road, checkpoints)` gets races, par, AI and proof.

### Where the loop is planned today

| Planner | Where | Shape | Fit for a race circuit |
|---|---|---|---|
| Land ring | `worldgen/path.ts:188` `loop_controls`, `:358` `loop_path` | 24 controls on a circle, radius moved by two noise octaves, pulled to the shore and the summit, relaxed to a 32 m minimum radius, 16 attempts | A wobbly ring round the map centre. It cannot say "hairpin after the long straight", has no esses or chicane, and rejects anything that comes within 40 m of itself (`crowded`, `:269`) |
| Sky deck | `worldgen/sky.ts:261` `macro`, `:285` `skeleton`, `:311` `draw_layout`, `:897` `sky_layout` | Straight and arc pieces with eased curvature. Turns sum to exactly 2π (0 for a figure-eight). Closed by coordinate descent over every stretchy straight, then one exact 2×2 solve on a pair (`:352-396`). Up to 400 seeded attempts, then the fallback seed | The right vocabulary. Bound to a deck: banks, bowls, gaps, helices, rails |
| Lab | `worldgen/lab.ts:254` `generate_lab` | Hand-laid lines stamped on flat ground with `Stamp.edge` and `Stamp.paint` | Shows that any polyline becomes a drivable road with painted surfaces on ground. Not seeded |
| Town loop | `worldgen/town-circuit.ts` | A ladder of existing streets | Square corners only |

### Kind or recipe

A recipe on an existing kind is out: a kind's recipe is part of its version (AGENTS.md, "World kind"), so a circuit on the island would reset the island's records, and no existing land kind wants its ring replaced.

It is a **new kind**. The open question is which generator it calls: that is the options in §4. The kind's facts either way:

| Field | Value | Why |
|---|---|---|
| `kind` | `WorldKind.RACEWAY = "raceway"` | `circuit` is already a route id and a `RouteKind`; a kind of the same name would read wrong everywhere |
| `base`, `tag` | 13000, `rw` | 12000 is the wall-ride's (`kinds/wall-ride.ts:22`), which stays reserved after its removal |
| Map code char | `G` | Free in `PRESETS` (`kinds/map-code.ts:16-30`), append-only |
| `size` | `SIZE` (2048) | Not streamed, so `field_races` passes and the speed trap lists |
| `rails` | false | AI field needs it; walls bounce, as on every land kind |
| `ground`, `open_ground` | true, true | Terrain mesh; gymkhana and hunts can use the infield |
| `fall_reset` | false | A car off the bridge lands on the ground |
| `grip` | `LAND_GRIP` | Grass 0.72 with roll 12 is already the right penalty for leaving the track |
| Player name | "Raceway" (working) | Our own word; the owner picks |

## 2. The generator

### Corner vocabulary

All of these are runs of `arc` and `straight` pieces (`sky.ts:213-222`). The radii below are retuned for flat ground: no banking carries the car, so corner speed is `sqrt(grip × radius)`. Speeds are for the par bot (grip 6 m/s²): 30 m gives 13 m/s, 120 m gives 27 m/s, and its top is 36 m/s.

| Corner | Pieces | Angle | Radius | Sky macro it starts from | Placement rule |
|---|---|---|---|---|---|
| Hairpin | one arc | 150-200° | 24-36 m | `hairpin` (`sky.ts:252`), 26-40 m | At most 2 a lap, never back to back, at least one at the end of a long straight |
| Esses | 4-6 arcs alternating, no straight between | 30-55° each | 60-110 m | second `macro` branch (`:268-273`) | After a medium straight; net turn 0, so it does not count toward the 2π |
| Sweeper | one arc | 40-140° | 120-300 m | `skeleton` sweepers (`:298-305`), with bank set to 0 | The body of each lobe; one leads onto the pit straight |
| Fast kink | one arc | 15-35° | 250-400 m | new, same `arc` | On the back straight, flat out for a fast car |
| Double apex | arc, short straight, arc, same way | 70° + 100° | 90 m then 60 m | new, same pieces | One a lap at most |
| Chicane | arc, 10-20 m straight, arc back | 25-40° each | 20-35 m | third `macro` branch (`:274-278`), 50-70 m | Last corner before a straight, or to end the longest one |
| Crossover | straight over straight | crossing at 60-90° | none | `close_pairs` + `zones_of` (`:493`, `:530`) | Exactly one, on a figure-eight only (below) |

Rules that make a lap read as a circuit rather than a road:

- One clear heavy braking zone: the longest straight ends in a hairpin or a chicane.
- Pit straight 400-700 m, a second straight 500-900 m. The sky caps a stretched straight at 420 m (`STRETCH_MAX`, `:57`); the raceway has its own cap.
- Direction is drawn per seed: total turning +2π (anticlockwise, + is left in the planner) or −2π. The reversed-lap route gives the other way on every seed.
- `twisty()` (`sky.ts:624`) already fails a circle and a rounded rectangle; it stays on as the "not an oval" check.
- Lap 2.8-4.2 km. At the bot's pace that is a par of about 130-190 s (unverified), so a field race is 1-2 laps. A full-size 5.8 km lap would be a one-lap race every time.

### Width, run-off, kerbs

| Part | Plan | Existing code | New |
|---|---|---|---|
| Width | 12 m, `ROAD_HALF` 6, everywhere | Read as a constant by `ai/line.ts`, `ai/hazards.ts`, `ai/driver.ts`, `world/kerbs.ts`, `car/trackside.ts`, `hud/minimap.ts`, `routes.ts` gates | Nothing. A per-sample width exists only on a deck (`DECK_STRIDE` field 6) |
| Kerbs, inside | Automatic | `kerb_marks` reads `data.road` on every kind | Nothing |
| Kerbs, exit | Outside of a corner's exit | `KerbMarks.inside` holds one side per sample (`kerbs.ts:13`) | A second side per sample. Later slice |
| Run-off, grass | Default | The kind's own ground past the 3 m shoulder (`world.ts:596`) | Nothing |
| Run-off, gravel | Outside of each heavy braking corner, 15-30 m deep | `Stamp.paint(lines, half, surface)` (`stamp.ts:223`), as the lab lays it. `SurfaceId.SAND` (grip 0.7, roll 28) stops a car like a gravel trap; `HARDPACK` (0.86, roll 1) is a tarmac run-off | The offset lines: the corner's outside edge pushed out by `ROAD_HALF + 3 + half` |
| Barriers | Past the run-off | `ItemKind.BARRIER`, `HAY`; box solids | Placement rule. Later slice |
| Trees | Off the run-off and sight lines | Scatter rules | Whether scatter reads painted surfaces is (unverified) |

No new `SurfaceId` is needed. The ids are stored in the grid and never renumber (`types.ts:26-30`).

### Pit straight and grid

The planner's first and last pieces are the flat straights either side of the line (`START_AHEAD` 60, `START_BEHIND` 120, `sky.ts:53-55`). The raceway makes them one long straight with the line a third of the way along. The grid needs 62 m behind the line for seven cars; the land generator already keeps the grid clear 80 m behind and 15 m ahead (`index.ts:39-40`).

A pit lane, a pit building and grid slot paint are dressing. A real pit lane is a second road joining the loop at two junctions, which the AI would have to be told never to take: cut until someone asks for pit stops.

### Elevation

On land the road reads its heights off the terrain: `loop_heights` (`path.ts:449`) smooths the sampled heights, limits the grade to 12% (9% near a bend, `:40-42`), and eases crests to a 180 m vertical radius (400 m near a bend). `Stamp.edge` with a `Bank` (`recipe.ts`, `{ run, reach }`, as the alpine and volcano use) then cuts and fills the ground to the road. A closed path over a height field closes in height by construction.

- Terrain recipe: one low fbm layer, about 35 m of relief over 700 m, plus a lift, no sea and no mask. Slopes stay well under the 12% limit (unverified until measured).
- The uphill run to the line and the downhill first corners: the layout is planned blind to the terrain, then placed on it. Try the 16 headings and a few offsets, and keep the placement that scores highest on "climb over the last 400 m before the line, drop over the first 400 m after it". A cheap search over heights already built. Second slice.
- No banking. A road's cross-section on ground is level; `kinds/road-tilt.test.ts` holds roads under 6% across (`MAX_TILT`); which kinds it sweeps is (unverified).

### Closure

Reuse the sky's, unchanged in method:

1. **Heading** closes by construction: the skeleton's turns share exactly ±2π, and every macro nets zero (`sky.ts:285-308`).
2. **Position**: every stretchy straight takes a share of the miss inside its length limits (300 sweeps of coordinate descent), then one pair of non-parallel straights closes the last centimetres exactly (`:352-396`). A draw that cannot close returns null and the next attempt runs.
3. **Height**: free on land (above).

### A valid loop that never crosses itself, except the bridge

This is rejection sampling with a proof per seed, as the sky does it:

- `close_pairs` (`sky.ts:493`) lists every pair of samples on sections that are not neighbours along the lap (over 120 m apart along it) and closer than 44 m in plan. 44 m is also twice the road's half-width plus the stamp's 16 m shoulder (`SHOULDER`, `types.ts:14`), so two roads that pass the check never blend into each other's cut.
- **A plain lap accepts only an attempt with no pairs at all.** That is the whole guarantee: no pair, no crossing, no shared shoulder. Hairpin legs are neighbours along the lap, so they pass.
- **A figure-eight accepts only an attempt with exactly one zone** (`zones_of`, `:530`), where both passes are straight pieces, they cross at 60° or more, and each has at least 150 m of low-curvature road either side to climb or dip.
- Every attempt draws from `sub(seed, "raceway:<attempt>")`, so a seed is the same lap on every peer. Past the last attempt the seed takes the fallback seed's lap, which a test proves draws on its own (`FALLBACK_SEED`, `:871`).
- The lap must also stay inside the map (`BOUND` 880 m), pass `twisty()`, and hold the length range.

How many attempts a seed needs under the tighter ground rules is (unverified). A `scripts/raceway-seeds.ts` in the shape of `scripts/sky-seeds.ts` measures it over 20 seeds before any tuning.

### The bridge

| Part | State today | Needed |
|---|---|---|
| Physics | `World.height` returns the deck when a query comes from above its underside, else the terrain (`world.ts:408-414`, `DECK_UNDER` 1.2 m in `deck.ts:5`). A world with both ground and a deck already resolves | Nothing |
| Deck data | `Deck.line` is one closed centreline; a sample with `solid` 0 has no surface and no mesh (`deck.ts:225`, `sky-mesh.ts:91`) | The whole lap as the deck line, `solid` 1 only on the span. `DeckIndex` is then unchanged |
| Mesh | A kind with `ground: true` never reaches `deck_layers` (`chunks.ts:324`) | The ground path also draws the deck span. New code, small |
| Ground under it | `Stamp.edge` lays one edge at one height | The loop as two open edges that stop at the abutments, so the upper pass never stamps over the lower. `circuit` already holds several edge ids on the island (`graph.ts` `split_circuit`) |
| Clearance | Sky uses 10 m (`CLEARANCE`) | 6 m is enough over a car: lower pass in a 3 m cut, upper on a 3 m fill, approaches at 8% over about 40 m each plus vertical curves |
| Rails | Box solids with `bottom` (`sky.ts:1075-1095`) | Same boxes on the span only |
| Car contact | Already tests height bands (`car/contact.ts:94`) | Nothing: a car on the bridge never hits one under it |
| AI hazards | `ground.height(x, z, y)` passes `y` (`ai/hazards.ts:68`) | Nothing expected (unverified on a real span) |
| Reset | `nearest_road` is a plan search (`world.ts:622`) | A reset at the crossing can pick the other level. Needs the last route index, as a race already has |
| Proof | `world-checks.ts:20` `crosses` flags roads that cross | Must allow the one bridge (unverified what it flags today) |

## 3. What AI and races need, and what covers it

### Needs

| Need | Source | Raceway |
|---|---|---|
| Route points | `data.road`, 2 m steps, tangents | The planner's samples; the land path already resamples at 2 m |
| Start line and gates | 12 checkpoints evenly spaced (`index.ts:30`, `:80`) | Same. None on the bridge span or its approaches |
| Par | `circuit_route(road, checkpoints, recipe.road.lap_par)` | Start at 1.15; fit `lap_par` with `scripts/races.ts --world raceway` so the slowest car's autopilot finishes inside it |
| Grid | `grid_spot`: 62 m of straight, level road behind the line | Guaranteed by the pit straight's minimum length |
| Field race | `field_races`: closed, no rails, not streamed | True by the kind's fields |
| Racing line | `RaceLine` over the route, room `ROAD_HALF − half width − 1.2 m` | Unchanged. Eased arc entries give it clean curvature to relax over |
| Laps | `race_laps(par)` | 1-2 at 2.8-4.2 km (unverified) |
| Speed trap | `straights()` over the line | Two long straights give two traps; the third fills from the gentlest stretch (`races.ts:209-216`) |
| Reversed lap | `reverse_circuit` | Listed on every seed, since the loop carries no road kicker |
| Career | A season names `world`, `seed`, `route` | A raceway season is its own decision, after the kind is listed |

### Existing tests and goldens

| Check | Covers | Raceway work |
|---|---|---|
| `src/worldgen/kinds/kinds.test.ts` | Every kind in `KINDS`: own id and key, plain map keeps both | Picks the kind up by itself |
| `src/worldgen/kinds/options.test.ts`, map code tests | Options and `PRESETS` chars | Picks up `G` |
| `scripts/proof/golden-file.ts:9` `GOLDEN_SEEDS` | A `Record<WorldKind, number[]>`: the compiler demands a row | `raceway: seeds(10)`, new `scripts/golden/raceway.txt` |
| `bun scripts/golden.ts --check` | Sky, rooftops and velodrome stay byte-identical when the piece planner moves to a shared module | The proof of the refactor commit. No version bump |
| `src/worldgen/sky.test.ts` | Closure, separation, grade, same track every time | Stays green through the refactor; the model for the new test file |
| `scripts/proof.ts` (`world-checks.ts`) | Road mesh, ground under roads, jumps | Runs on the new kind; the bridge needs an allowance |
| `scripts/races.ts --world raceway` | Every car finishes every route on the road inside par | `--baseline --world raceway` writes its lines |
| `src/worldgen/routes.test.ts`, `src/modes/races.test.ts`, `src/modes/field-route.test.ts` | Route building, gates, traps, field gate | Unchanged |
| `src/ai/line.test.ts`, `scripts/ai-race.ts` | Racing line and a field race | Unchanged; one `ai-race` run on a raceway seed as a sanity check |
| `src/worldgen/kinds/road-tilt.test.ts` | Cross-fall under 6% across a road | Add the kind to its sweep if it lists kinds (unverified); guards the cut and fill |
| `src/career/series.test.ts` | Event routes closed, field-raceable, par ≤ 450 s | Only when a season uses it |

New: `src/worldgen/raceway.test.ts`, after `sky.test.ts`: the lap closes in position and heading; no two sections that are not neighbours come within 44 m (one crossing zone on a figure-eight, with clearance); minimum radius; grade within 12%; the pit straight is long, straight and near level; every seed has a hairpin and esses; a seed makes the same lap every time; the fallback seed draws on its own.

## 4. Options

### A. A deck recipe (a `SkyRecipe`, as the velodrome is)

`kinds/velodrome.ts` is 37 lines over `generate_sky`. A "grand prix" recipe sets bowls, pipes, gaps and pads to none and the figure-eight odds to 1.

- **Size:** S, about a day.
- **Gets:** every corner in the vocabulary and the figure-eight crossover, today, proven by `sky.test.ts`.
- **Breaks:** no AI field (`rails: true` fails `field_races`); no run-off, the edge is a rail or a fall; no ground, trees or grandstands; it is a third sky track, not a racetrack. Elevation is a floating ribbon.
- **Verdict:** rejected as the answer. Useful only as a one-day look at what the planner draws with the toys off.

### B. A land kind through `land_kind`, with a piece-planned loop (recommended)

`generate` (`worldgen/index.ts:58`) plans its loop in one line: `loop_path(seed, land.heights, recipe.road)` (`:68`). A new optional `RoadRecipe.layout` names a circuit recipe; when present, the loop comes from the piece planner instead of the ring. Everything after that line is unchanged: heights from terrain, cut and fill, checkpoints, kerbs, routes, par, scatter.

- **Size:** M for the first slice, L with run-off, placement and the bridge.
- **New code:** the shared planner module (a `refactor:` commit moving `arc`, `straight`, `trace`, the closure solve, `sample_layout`, `close_pairs`, `zones_of`, `twistiness` out of the 1154-line `sky.ts`); `draw_raceway`, its own function with its own sequencing rules, not `draw_layout` bent with flags; a `RACEWAY` recipe; the kind file; the worlds file.
- **Reused:** `land_kind`, `generate`, `loop_heights`, `Stamp.edge` + `Bank`, `circuit_route`, `reverse_circuit`, kerbs, gates, minimap, AI line, every proof script.
- **Risks:**
  - `generate` carries stages a raceway does not want: trails are always planned (`index.ts:233`), kickers and landmarks come from the recipe. The volcano and the dune sea switch towns and kickers off by recipe values; whether trails switch off cleanly is (unverified).
  - The layout is planned blind to the terrain. On steep ground the grade limiter would flatten it into deep cuts. The terrain recipe must stay gentle.
  - Attempt yield under the stricter no-crossing rule is (unverified).
  - The bridge needs the mesh path, split edges and a reset fix (§2).
  - A new recipe field and a new shared module are the owner's call (AGENTS.md "Rules": architecture).

### C. Its own generator, as the lab has

`generate_raceway(seed)` builds `WorldData` directly: a terrain base, the planner's loop, `Stamp.edge`, `Stamp.paint`, `circuit_route`. No `generate`, no recipe hook.

- **Size:** M for a flat first slice, L-XL to reach what B gets free.
- **Gets:** full control. Nothing unwanted to switch off. The bridge's split edges are easy here.
- **Breaks:** it copies the land pipeline piece by piece as it grows: road heights, cut and fill, scatter, trees, lava-safe spawn checks, the drivability check. That is the "never copy a block" rule broken slowly. A bare flat first slice also shows nothing of the elevation half of the brief.

### Recommendation

**B.** It is the lightest option that meets the brief: existing code for everything except the planner's sequencing rules, which is the actual new idea. A is lighter but fails on AI and run-off, the two things that make it a racetrack. C is B without the reuse.

If the trails or another stage of `generate` will not switch off by recipe values, fall back to C for that stage only by giving it a recipe switch, not by forking the generator.

### Slices

| # | Slice | The owner drives | Proof |
|---|---|---|---|
| 0 | `refactor:` piece planner out of `sky.ts` into a shared module | Nothing new | `bun scripts/golden.ts --check` identical, `sky.test.ts` green |
| 1 | `raceway` kind, unlisted: non-crossing lap, hairpin, esses, chicane, sweepers, gentle hills, automatic kerbs, grass run-off | `?world=raceway&seed=N`: lap, reversed lap, speed trap, an AI field race | `raceway.test.ts`, `scripts/raceway-seeds.ts` over 20 seeds, `scripts/races.ts --world raceway 0,1,2,3,4`, golden file added |
| 2 | Gravel traps at braking corners, placement on the terrain for the uphill finish and downhill first corners, `lap_par` fitted | The same seeds with run-off that stops a car and a lap that climbs | Goldens rewritten with a version bump, races baseline |
| 3 | Figure-eight with the bridge | A crossover seed | Clearance test, proof allowance, reset at the crossing |
| 4 | Listed: `worlds/raceway.ts`, name and copy, `public/menu/raceway.webp`, barriers, exit kerbs, start gantry dressing | It in Play | Menu shot, about 4 screenshots |
| 5 | A career season on it | Events | `series.test.ts` |

Slice 1 is the first thing to drive and the point to stop and ask whether the laps feel like circuits before anything else is built.

## Open questions for the owner

1. Lap length: 2.8-4.2 km gives 1-2 lap field races. Longer laps read more like the references but are one-lap races.
2. Is a figure-eight on some seeds (a draw, as on the sky) right, or on every seed?
3. Gravel that stops the car, or tarmac run-off that forgives?
4. Does the raceway list in Play as a mini world, or stay a career and Runs venue?

## Sources

- Repo at `origin/master` `77c828c` (v0.55.0, 2026-11-16): paths and lines as cited.
- `docs/plan/sky-track.md` (status 2026-11-12, v0.29.0): the piece planner's design and closure.
- `docs/plan/special-maps.md` (status 2026-11-12, v0.31.2): land kinds from a recipe; the volcano's ring with no towns.
- `docs/plan/ai-racers.md` (2026-11-14/15): AI line, field, decisions H1-I4.
- Wikipedia, "Suzuka International Racing Course", revision 1385953632, read 2026-11-17: 5.807 km, 18 turns, figure-eight with the back straight crossing the front section by an overpass, one fast corner rebuilt as an 85 m then 340 m radius. Feel reference only.
- Wikipedia, "Interlagos Circuit", revision 1384524916, read 2026-11-17: 4.309 km, 15 turns, counterclockwise, hilly ground, a 10% uphill run to the line. Feel reference only.

## Owner calls (2026-11-17)
- **Build: option C, its own generator.** The owner sees Sky as 3D-space tracks. A raceway is mostly 2D: small up/down hills, slightly banked turns, and later one or two Suzuka-style crossings over a bridge. Don't move Sky's planner. Borrow its ideas (eased arc + straight pieces, exact closure) and write the raceway's own planner. Reuse the shared bits that already exist (kerbs, routes `circuit_route`/`reverse_circuit`, AI line, gates, minimap) where they take a plain loop.
- Lap 2.8-4.2 km.
- Figure-8 / bridge: later (slice 3), on some seeds.
- Grass run-off. Listed in Play and in custom creation like the other maps.

## Venue: look C "National" (2026-11-17)

The owner picked look C. It is the raceway's normal build, `RACEWAY_VERSION` 4.

- `worldgen/raceway-layout.ts` works out where everything goes from the lap alone: bends by curvature (hairpin, slow, fast), the room beside the road, traps, walls, rail, tyres, the pit lane, terrace modules and garages. Worldgen and the scene both call it, so a drawn wall is always a solid one.
- `worldgen/raceway-venue.ts` turns the layout into data: box solids chained 4 m at a time for concrete, rail and tyres, one box per terrace module and garage, two posts for the gantry, the lines `Stamp.paint` lays gravel and the pit lane's hardpack along, and the discs trees keep out of.
- `worlds/raceway-stadium.ts` draws it: 10 draw calls, swept barriers in the same 4 m pieces as their solids.
- Gravel is `SurfaceId.GRAVEL` (grip 0.66, roll 60): a ground surface like sand, painted on the terrain as `Ground.GRAVEL`. No extra mesh.
- Tyre walls are box solids with `soft`: the hit takes the speed into the wall and a quarter of the rest, throws nothing back, and reports half the impact.
- Run-off Narrow carries its own terrace (4 modules, 3 tiers); a module with another stretch of the lap behind it is left out.
- Review views `grid`, `hairpin`, `pits`, `trap` (raceway only).
