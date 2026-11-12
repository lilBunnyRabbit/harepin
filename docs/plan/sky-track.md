# Sky Track: a toy-style circuit floating in the sky

> **Status 2026-11-12 (v0.29.0):** Shipped as Sky Track: phases 1-3, then round 2 (twisty layouts, crossovers with clearance, rail glide; `SKY_VERSION` 3). `scripts/bank.ts` and `scripts/sky-gen.ts` were never added; `scripts/sky-seeds.ts` covers the seeds. Open from phase 4: point-to-point (the sky has only its circuit route, `worldgen/sky.ts`) and sky lobby-race tuning.

Round 1, 2026-11-09, on `f419707` (v0.7.0). Plan only. No code was changed, nothing was run, and every number below comes from reading the code or from simple maths. Numbers that still need a run are marked (unverified).

The owner asked for a world type in the spirit of Forza Horizon's Hot Wheels expansion: a toy-style track floating in the sky, with jumps, banked curves and drops, and probably no loops. It must be an **original** design: no Hot Wheels name, logo, orange track or flame livery anywhere.

- **Working name:** **Sky Track** in the UI. In code it is `WorldKind.SKY = "sky"`, next to `WorldKind.ISLAND = "island"`.
- **Look in one line:** a slate-blue deck with pale rails and dark clip joints, cottontail boost pads, floating over a cloud floor. All colours come from tokens (§3).

## TL;DR

- **Same `World` class, second generator.** `worldgen/sky.ts` `generate_sky(seed)` returns the same `WorldData`, plus a `deck` description. Towns, lots, parking and trees come back empty. The terrain grid is filled with an `ABYSS` height.
- **`World.height` / `normal` gain a third analytic surface.** Today they return the higher of terrain and ramps. The deck is added the same way, so `car.ts` physics does not change.
- **One interface change:** `Ground.height(x, z, y?)`. A deck only counts for a query from above its underside. Without it, a car falling beside the deck gets shot up through it. This hook is also what crossovers would need later.
- **Track = closed loop of pieces.** Heading closes by construction: the turn angles sum to exactly 2π. Position closes with an exact 2×2 solve on two straights. Elevation closes on a return-grade piece.
- **Phase 1 (M, about 4 days):** straights, flat curves, banked curves, rises and drops, rails, fall-and-respawn, deck mesh, cloud floor, laps, ghosts and records on `?world=sky`. Jumps and boost pads come in phase 2, after a test harness proves the landings.
- **Approvals:** 1 schema change (worker output), 1 net change (map identity), 1 storage change (record keys), 1 URL change (`world=` param), and the version bump. Details in §6.

## 1. How it fits the architecture

### Decision: second generator behind the same `World`, not a second `World`

`World` is a concrete class used by name everywhere: `main.ts`, `hud.ts`, `race.ts`, `modes/*`, `scene.ts`, `models.ts`, `effects.ts`, `camera.ts`, and `scripts/autolap.ts` (`autolap(world: World, …)`). The physics only sees `Ground` (`src/car.ts:5-10`): `height`, `normal`, `grip`, `roll`.

The options, lightest first:

| Option | What changes | What breaks or costs |
|---|---|---|
| A. Bake the deck into the terrain heightfield | Nothing structural | 4 m bilinear cells can't hold a 12 m deck with crisp edges or a clean bank. Every edge turns into a 4 m slope down into the abyss, which is a ramp off the side. The facet normals are the "touchy landing" cause `world.md` already found. **Rejected.** |
| **B. Same `World`, with the deck as one more analytic surface next to ramps** | `WorldData` + `deck`; `World.height/normal` consult it; `Ground.height` gets an optional `y` | About 60 lines in `world.ts`, plus the new generator. Every consumer keeps working, because the sky world still has `road`, `checkpoints`, `circuit`, `graph` (one ring edge) and `solids`. **Recommended.** |
| C. `interface WorldLike` with `IslandWorld` and `SkyWorld` classes | Every `World` type reference, about 15 files | That's a new abstraction for two implementations that share about 90% of their members (solid grid, spawn, collide, place). Speculative: nothing that B can't do needs it today. |

So: **B**. `World` already composes its ground as `max(terrain, ramps)` (`src/world.ts:211-231`), and the deck is a third term in that max.

### What changes, file by file

| Concern | Today | Sky Track | Change size |
|---|---|---|---|
| **Generation** | `generate(seed)` (`worldgen/index.ts`) is called from `worker.ts:11` and `map-worker.ts:11` | `generate_world(seed, kind)` dispatches to `generate` or to the new `generate_sky` (`worldgen/sky.ts`). Both workers take `kind` in the request. | S |
| **`WorldData`** (`worldgen/types.ts:195-213`) | island fields | + `kind: WorldKind`, + `deck: Deck \| null`. The sky world fills the island fields with empty arrays. `terrain.heights` is filled with `ABYSS` (-2000) and `road_dist` with 0, so `grip()`/`roll()` return 1 and need no branch. That is 2 × 1 MB of constant floats: wasteful, but the cost is zero code. Shrink it only if phone memory says so. **Schema change.** | S |
| **height / normal** (`world.ts:211-222`) | `max(sample(heights), ramp_at)` | `max(terrain, ramp, deck_at(x, z, y))`. `deck_at` finds the nearest centreline segment through a cached segment index: start from the last hit and walk ±k, falling back to the existing 32 m `road_grid` (`world.ts:180-185`). That keeps the lookup O(1) inside the bisection loop, which calls `height` 12+ times per wheel per step (`car.ts:391-405`). | M |
| **`Ground` interface** (`car.ts:6`) | `height(x, z)` | `height(x, z, y?)`. The wheel raycast passes the sample y (`car.ts:393`) and the body corners pass `p.y` (`car.ts:520`). The deck answers only when `y > deck_y - DECK_UNDER` (1.2 m). The island ignores `y`. This is an internal API change, not a schema change. | S |
| **Solids** | grid at 16 m (`world.ts:196-209`) | Rails are box solids **with `bottom`** (`types.ts:220-222`): 4 m segments per side, spanning `deck_y - 0.6` to `deck_y + 1.2`. The `bottom` form is already tested against the car's band (`world.ts:334-335`), so a car that has fallen below doesn't snag on a rail from underneath. About 2 × 1000 boxes on a 4 km lap; the island already indexes 4788 solids. | none (data only) |
| **Spawn** | `spawn_at(SPAWN_INDEX)` (`main.ts:204-208`) uses `world.road`; `clear_spawn` skips `no_spawn` (`world.ts:252-257`) | Unchanged. The generator guarantees that the first piece and the last piece before the line are flat, unbanked straights of at least 100 m, so `SPAWN_INDEX` -40 (80 m back) lands on one. `spawn_blocks` (`worldgen/jumps.ts:102`) also gets the gap and landing spans of deck kickers (§2). | S |
| **Reset / fall** | `reset()` (`main.ts:211-221`): nearest road; "drowned" check (`main.ts:504`): `height < -0.4 && y < 0.4` | Sky: `fallen = car.pos.y < deck_y_at_nearest - FALL_DEPTH (6 m)`, checked every frame, with **no 1.5 s wait**. Respawn on the **last checkpoint passed** (`race.next - 1`), not the nearest road. The nearest road can be a later section of track, which would turn a fall into a shortcut. | S |
| **Checkpoints** | 12 evenly spaced (`index.ts:391-401`); `Race` passes a gate by xz within `GATE_RADIUS` 15 m (`race.ts:76`) | One every 250-350 m (about 14 on 4 km), plus one before every jump. **Only on unbanked, near-flat deck**, so the gate stands straight. Track sections that aren't neighbours stay ≥ 40 m apart (§2), so the xz radius test never picks the wrong section. | S |
| **Gate posts** | `models.ts:22` puts posts at `ROAD_HALF + 1.7` and `index.ts:396` puts solids there, which would be mid-air on a sky deck | Sky gates stand on two outrigger tabs at `ROAD_HALF + 1.7`, built into the deck mesh at checkpoint slices. Gate code stays unchanged. | S |
| **Roadside posts / water** | `main.ts:68` always adds `roadside(world)` and `water_mesh()` | Skipped when `world.kind === "sky"`. A cloud floor goes in their place (§3). | S |
| **Minimap** | `hud.ts:100` strokes `world.road` closed, scaled by `SIZE` | Works unchanged if the generator keeps the track inside ±900 m (`SIZE` is 2048). | none |
| **World screen preview** | `settings.ts:687-752` seed field + `WorldMap.show(seed)` (`world-map.ts:50`); `map_data` (`worldgen/map.ts:93-107`) rasters terrain | Add an **Island / Sky Track** segmented toggle above the seed row. `show(seed, kind)` is cached on `(seed, kind)`. For sky, `map_pixels` returns a flat cloud tone with a soft radial falloff (no terrain). The lines are the circuit only, `jumps` marks come from deck kickers, and the legend gains "Boost". The status reads "Drawing track…". The drive action reloads with `{ room, seed, world }`. | M |
| **Seed + world type** | URL `?seed=` else `seed_of(room)` (`main.ts:40`); invite link `room` + `seed` (`settings.ts:341`) | `?world=sky` (default island). `seed_of(room)` stays the default seed for both kinds, and the invite link adds `world`. **URL change.** | S |
| **Net** | `send` stamps `w: WORLD_VERSION` (`net.ts:283`); receive drops a peer whose `seed` or `w` differs (`net.ts:350`); `foreign_seed` keeps only `w === WORLD_VERSION` (`net.ts:381`) | Map identity becomes `(seed, world id)`. The world id travels in `w`: island stays `WORLD_VERSION` (2), and sky is `SKY_WORLD = 1000 + SKY_VERSION`. **Old builds already treat any other `w` as a foreign map**, so they drop sky peers correctly with no protocol break. `foreign_seed` and the HUD "join map" button (`hud.ts:88-91`) carry the kind. **Net change.** | S |
| **Records, ghosts** | every key goes through `world_key(seed)` = `` `${seed}:w${WORLD_VERSION}` `` (`types.ts:19-21`), used by `race.ts:65-66`, `ghost.ts:51`, `modes/track.ts:114`, `lobby.ts:57`, `modes.ts:283` | `world_key(seed, kind)`: island output **unchanged** (`` `${seed}:w2` ``), sky `` `${seed}:sky${SKY_VERSION}` ``. One function, so one change point. **Storage change** (additive). | S |
| **Modes** | gymkhana, parking and hunt need flat open ground (`find_site`, `modes.ts:198,213`; `build_hunt`) | Hidden on sky. Drift (`build_zone` on `world.road`) and duel (`build_route` on `world.road`) keep working. The lobby race works unchanged. | S |
| **Rendering** | `WorldView` (`scene.ts:82-117`) takes `ChunkBuffers` with required `terrain` (`chunks.ts:65-77`) | Make `terrain` nullable. The sky worker returns chunks with `terrain: null` and `road` = the deck soup (surface first, then the `marks` group for stripes and joints). That reuses the two `polygonOffset` road materials and the 256 m chunk culling as they are. | S |

### What must be abstracted: the minimum

1. `Ground.height(x, z, y?)`.
2. `WorldKind` plus a `deck` term in `World.height/normal`.
3. `world_key(seed, kind)`.
4. `kind` in the two worker requests.

Everything else is a branch on `world.kind` at the 5-6 call sites listed above. No new manager, store or event system.

## 2. Track generation from a seed

New pure module `worldgen/sky.ts` (no DOM, Bun-testable), with its own streams `sub(seed, "sky:layout")`, `sub(seed, "sky:features")` and so on.

### Data

```ts
export const PieceKind = {
  STRAIGHT: "straight", ARC: "arc", KICKER: "kicker", GAP: "gap", LANDING: "landing", PAD: "pad",
} as const;
export type PieceKind = (typeof PieceKind)[keyof typeof PieceKind];

/** One run of deck between two joints; `s0` is its start along the centreline, in metres. */
export interface Piece {
  kind: PieceKind;
  s0: number;
  length: number;
  /** Signed curvature 1/R, + = left; 0 on straights. */
  curve: number;
  /** Bank at start and end, radians, + = left side up; linear in between. */
  bank: [number, number];
  /** Grade at start and end (rise per metre); a vertical curve in between. */
  grade: [number, number];
}

export interface Deck {
  half: number;
  pieces: Piece[];
  /** Centreline every 2 m with y, tangent and bank: what `deck_at` and the mesh read. */
  line: Float32Array<ArrayBuffer>;
  pads: { s0: number; s1: number }[];
}
```

Rise, drop and chicane are generator macros that emit `ARC` and `STRAIGHT` pieces with grade or curvature. They are not new kinds, so physics only ever sees the six kinds above.

### Pieces shipped

`v_d` is the design speed at that piece. It comes from a point-mass speed profile the generator runs over the layout, using COUPE power, `CORNER_GRIP` 4.5 m/s² and `CORNER_BRAKE` 2.5 m/s², the same planning numbers as `scripts/autolap.ts`.

| Piece | Shape | Rules |
|---|---|---|
| **Straight** | 40-300 m | Carries grade changes and bank transitions. Checkpoints sit only on straights. |
| **Flat curve** | arc R 45-200 m, 20-120° | `R ≥ v_d² / 4.5`. Bank 0. |
| **Banked curve** | arc R 60-180 m, 60-200°, bank 15-30° | `v_max = √(g·R·(μ + tanθ)/(1 − μ·tanθ))` with μ = 0.46. For R 100: flat 21 m/s, 20° 31 m/s, 30° 37 m/s. For R 150 at 30°: 46 m/s. The bank ramps in over the straight or ease before the arc. This is the signature piece. |
| **Rise** | grade 0 → ≤ +10% → 0 | Crest vertical radius ≥ `v_d²/g` (45 m/s → 206 m), so the wheels stay loaded. |
| **Drop** | grade 0 → −15..−25% → 0 | Sag radius ≥ `v_d² / (0.8 g)` (≤ 1.8 g at the bottom). A crest under `v_d²/g` is allowed **only** on a drop marked as a "hop", and must be followed by ≥ 60 m of straight. |
| **Chicane** | two or three arcs R 40-70 m, ±25-40°, flat | Net heading change 0, so it doesn't count toward the 2π. |
| **Gap jump** (phase 2) | run-up straight ≥ 30 m (`ROAD_RUNUP`), `KICKER` lip, `GAP`, `LANDING` deck | Sized from `flight()` (see "Gap jump" below). |
| **Boost pad** (phase 2) | 12 m painted span on a straight, 80 m of straight past it | At the foot of climbs first, then out of the tightest bends; at most 4, 300 m apart, and never within `PAD_GAP_CLEAR` 500 m before a gap's toe or on its jump. Off the throttle every car rolls from 48 back under 40 m/s inside 500 m, so a pad adds nothing at a toe; on the throttle every car tops 40 m/s anyway. |
| **Cheap split** (phase 3) | deck widens to `2·half + 2` over 30 m, a rail solid runs down the middle for 80-150 m, then merges back | Both lanes are equally long, so nobody gains a shortcut. One lane may carry a pad or a small hop. A real fork that splits the road graph is cut. |

### Continuity rules (checked in `sky.test.ts`)

- **Heading (G1):** each piece starts on the previous piece's end tangent. Arcs after straights get a 15 m linear-curvature ease (a clothoid, integrated at 2 m), so the steering input never steps.
- **Grade (C1):** grade is continuous, and every grade change runs through a parabolic vertical curve with the radii above. Steepest climb is 10%: at 30 m/s a 12% climb already needs about 47 kW on the COUPE before drag. Steepest descent is 25%.
- **Bank (C0, rate-limited):** bank is continuous, changes by at most 1.2° per metre (30° over 25 m), and is 0 at every joint with a straight that holds a checkpoint, a kicker or a pad.
- **Normal:** with grade C1 and bank C0, the surface normal is continuous across joints. The test samples the normal 0.1 m either side of every joint and asserts an angle < 0.5°. A normal that jumps is exactly what made the island's landings touchy (`world.md` §Gap jump step 3).
- **Radius at speed:** each arc obeys its radius formula at the profiled `v_d × 1.1`.
- **Separation:** centreline points more than 120 m apart along the track stay ≥ 40 m apart in xz. That leaves 2 × 6 m deck, rails, gate outriggers and `GATE_RADIUS` 15 m clear. **No overpasses in phases 1-3**, so `height` stays single-valued.
- **Bounds:** the whole track stays within ±900 m in x and z (minimap and map scale), and y within 120-420 m (net `WORLD_LIMIT` 5000 in `net.ts:75` is far away).

### Closed loop, not point-to-point

`race.ts` laps, `Ghost`, the lobby `min_lap_ms(world.checkpoints)`, the minimap's `closePath` and `clear_spawn`'s wrap all assume a closed circuit. Point-to-point would need the `Route` schema from `world.md` §Race types. That is a separate approval and is cut here.

**Construction**, which closes exactly and needs no search over geometry:

1. **Turns:** draw a turn list whose signed angles sum to exactly +2π (a left-hand lap). Most turns are left. Chicanes and S-pairs add ±θ pairs that cancel. The last left turn takes the remainder and must land in [20°, 200°], or the draw is redone.
2. **Straights:** draw a length for each straight between turns.
3. **Integrate.** The heading closes by construction, leaving a position error `(ex, ez)`.
4. **Close the position:** pick two straights whose directions `d1` and `d2` satisfy `|d1 × d2| > 0.5`, then solve `a·d1 + b·d2 = −e` (2×2, exact). Accept if both new lengths are ≥ their minimum; otherwise try the next pair, then redraw.
5. **Elevation:** lay out the grade features (rises, drops, landing decks) and sum the net climb Δy. Then spread −Δy over the remaining straights as gentle grades within ≤ 10% up and ≤ 25% down. Redraw if it doesn't fit.
6. **Check:** separation, bounds, the speed profile, then the radius-at-speed rule. Up to 32 attempts, each on `sub(seed, "sky:" + k)`. `scripts/sky-gen.ts` reports how many attempts each seed needs (the failure rate is unverified).

**Length:** 3.2-4.5 km, which is about 90-120 s a lap at the profiled pace. That matches the island circuit (`world.md`: 4 km).

**Determinism**, following the doctrine in `architecture.md` §1:

- Every discrete choice (piece kind, count, which straights close the loop) branches on `mulberry32` and integer `hash`.
- Positions use `Math.sin/cos`, which aren't bit-exact across engines. Every geometric accept or reject test (separation, closure lengths) therefore uses a margin of 4 m or more, so a last-bit difference can't flip it.
- Optional: rotate the tangent with the rational form `((1 − t²)/(1 + t²), 2t/(1 + t²))` to stay in `+ − * /`.

### Width, rails, falling off

- **Deck half-width:** `ROAD_HALF` (6 m). That reuses gates, `GATE_RADIUS`, the autolap offroad metric and drift zones as they are. It widens to 7.5 m on landing decks and to 7 m on banked arcs under 80 m radius.
- **Rails:** a 0.7 m visual lip on both edges. The collision box reaches 1.2 m above the deck, because the car's centre rides about 0.5 m up and a 0.7 m box would let a sliding car's centre pass over it (`world.ts:336`). The 0.5 m difference is invisible from the chase camera (unverified, check by eye). Rails are left out only across `GAP` spans.
- **Falling off:** this happens only through the air (a missed gap, or a hop taken into a bend), because the rails catch everything at deck level.
  - Detection: `car.pos.y < deck_y(nearest) − 6 m`. Respawn on the last checkpoint passed, at standstill, nitro kept.
  - **No explicit time penalty:** driving back from the checkpoint costs 6-12 s by itself. Checkpoints sit at most 350 m apart and one stands before every jump.
  - Lobby races keep their rules: the lap clock runs on, and nothing gets written to `RaceEvent`.

### Gap jump (phase 2): reuse the `jumps.ts` flight maths

- **Take-off:** the lip is part of the deck profile with exactly the `ROAD_KICKER` shape (`jumps.ts:37`: length 8, rise 2, back 0.3), so `LAUNCH_KEEP` 0.91 (`jumps.ts:13`) still holds; it was fitted on every car on that shape.
- **Flight maths:** the generator builds a transient `Ramp` for the lip and calls `launch()`/`flight()` (`jumps.ts:125-138`) to find the touchdown distance `d_touch(v, drop)`.
- **Not a physics ramp:** the lip is **not** handed to `World.ramp_at`. `ramp_extent` (`jumps.ts:73-76`) adds a `BURY` skirt and `SIDE` 1:1 flanks up to 5 m outside `hw`. Over the abyss that is a phantom ledge in physics and a hanging wedge in the mesh.
- **Still a listed ramp:** sky kickers go into `world.ramps` with a new `deck: true` flag. `ramp_at` and `JumpsView` skip such ramps, while `map.ts` marks, `spawn_blocks` and autolap's `RAMP_LOOK` still see them. **Schema change** (worker output).
- **Sizing,** with numbers from the `world.md` table (ROAD_KICKER, landing 4 m below the lip):
  - Gap = `d_touch(V_MIN = 22 m/s, 4 m) − 6 m` ≈ 25 m. Pads stay 500 m clear of every toe, so the gap is sized for 22 m/s with no pad help.
  - The landing deck runs at 12-15° (−21..−27% grade) out to `d_touch(45 m/s) + 20` ≈ 103 m past the lip, then a sag curve brings it back to the track grade.
  - The landing doubles as a drop: a gap jump on a sky track always ends in a plunge, which fits the brief.
- **Spacing:** no two gaps within 300 m of each other; a 50 m run-out straight after each landing; a checkpoint 20-40 m before each run-up.

## 3. Look

| Element | Build | Colour (tokens only, via `palette.ts`) |
|---|---|---|
| **Deck top** | one quad strip, 2 m slices; flat-shaded so banks read as facets | `info` mixed toward `background_darkest` 0.35, giving a slate blue. **Deliberately not orange**, and not `accent`/`warning`/`primary`, which sit at hue 50-70 in Brand Dark and Brand Light (`theme.ts:38-67`). That keeps it clear of the trade dress. |
| **Deck underside + edge** | 0.4 m thick box section | the deck tone mixed 0.3 toward `background_darkest` |
| **Rails** | inner face, top and outer face per side | `tones.post` (`background_lightest`) in dark themes; `mix(foreground, background_darkest, 0.35)` in light (the `rock` tone pattern) |
| **Joints** | a 0.6 m dark band across the deck at every piece joint, with two rounded clip tabs on the rail tops. This is the "toy" read, and it is our own shape. | `background_darkest`. Never touching `cottontail` (art direction #15: brand colours never touch). |
| **Centre and edge lines** | none; a toy track is unmarked. Kicker lips and gap edges get the existing checker (`check_dark`/`check_light`). | existing tones |
| **Boost pads** | 12 m inset panel of chevrons in the `marks` group; a gentle emissive pulse (one shared uniform), which the bloom tier picks up | `cottontail` ("cottontail only on markers", `art-direction.md` #3) |
| **Supports** | **None in phase 1-2:** the floating toy is the whole point and costs nothing. Phase 3 option: thin pylons every 60 m on sections within 80 m of the cloud floor, one `InstancedMesh`, fading into fog. | `background_light` |
| **Backdrop** | existing `sky()` dome (below the horizon it already paints `horizon`, `sky.ts` fragment shader) + `clouds(seed)` | as is |
| **Cloud floor** | `clouds()` grows a `{ y, r0, r1, count }` option: a second ring of about 120 instanced puffs 80-140 m below the lowest deck, spread across the track bounds. Fog fades it. One draw. | `sky_tones.cloud` / `cloud_lit` |
| **Start** | the existing gate on the outriggers, plus a deck checker band | existing |

Original-design checklist: no flame graphics, no orange-and-blue pairing, no blue-on-orange logo shape, no "Hot Wheels" or look-alike wording, and no 3-lane toy-car stripes. The name in UI copy is "Sky Track". Branding nods go to the hare instead: the clip tabs can be rounded "ear" pairs.

### Budget (phones)

| Item | Triangles | Draws |
|---|---|---|
| Deck top + underside + 2 rails, 4 km at 2 m slices (~20 tris/slice) | ~40k | 1 per visible 256 m chunk, about 6-10 visible |
| Joints, pads, checkers (`marks` group of the same mesh) | ~4k | 0 extra |
| Cloud floor | ~120 × 80 = 10k | 1 |
| Gates (existing, 14 instead of 12) | small | as today |

The island today is 600-650k triangles with 125+ main draws (`world.md` §Budget, `architecture.md` §Measured baseline). A sky world sits far under the mobile budget of 300k tris and ≤ 120 draws. There is no terrain, so the worker gen cost is about 10-30 ms (unverified) against 250-660 ms for the island. Fog far is already 700 on mobile (`quality.ts:21-23`). Shadows stay off on mobile; the contact blob works on the deck as it does on the road.

## 4. Physics risks

| Risk | Why | Mitigation | Proof |
|---|---|---|---|
| **Bank contact normal** | Load is `suspension · up·n` and the tyre axes are projected on `n` (`car.ts:447-458`), so physics follows `ground.normal`. If `normal()` returns the terrain or bisection normal instead of the bank, the car corners as on the flat while sitting tilted. | `deck_at` returns the analytic gradient: along the track `dy/ds = grade`, across it `dy/du = tan(bank)`, rotated by the tangent. It never uses finite differences. | `scripts/bank.ts`: a constant-radius banked arc ground, like `ground_with` in `jumps.test.ts`. Each car's steady max speed must come within 15% of the formula and run 10 s without the yaw oscillating. (unverified) |
| **Assists on a bank** | `grip_lock` and the countersteer and yaw assists (`car.ts:280-291`) assume a flat road. On a bank the car needs less lock, so the assist may under-steer it. | The `bank.ts` run with assist on and off. If the gap is > 10%, scale `grip_lock` by the bank factor. That is a `car.ts` change, so it runs `feel.ts` and `telemetry.ts` before and after per `AGENTS.md`. | as above |
| **Standing on a bank** | At 30° a stopped car may slide down: lateral force uses `max(|v_long|, 2)` (`car.ts:461`). | Spawn, checkpoints and respawn only on unbanked deck. The 1.2°/m bank rate keeps the slope gentle where a car might stop. | `sky.test.ts` asserts bank = 0 at every checkpoint and spawn index |
| **Edge / falling under the deck** | `height(x, z)` has no y. A falling car's wheel or corner beside the edge can sample deck height above itself and get `140000 · depth` (`car.ts:525`) shoved up through the deck. | `height(x, z, y)`: the deck counts only above `deck_y − 1.2`. Rails use `bottom` boxes. Fall detection triggers respawn at 6 m below. | Unit test: a car dropped beside the deck edge and drifting under it lands on nothing and triggers `fallen`, and its y never jumps up |
| **Jump landings** | The island's landings were touchy because of 4 m facet normals (`world.md` §Gap jump 3) | Analytic landing plane, full width plus 1.5 m flare, rails on, `LAUNCH_KEEP` shape kept | **Before any visuals**, extend `worldgen/jumps.test.ts` with `ground_gap(lip, gap, landing)`, using `jump()`'s existing harness. Every car in `CARS`, at 22/26/30/35/40/45 m/s, gas 0 and 1, slip 0 and 1.5: lands on the landing deck, `upright > 0.75`, `sink < 0.05`, post-landing `yaw < 0.35`, heading change < 0.15 rad (the thresholds the road kicker already passes) |
| **Boost pads + nitro** | Pushing through the wheels would trigger TCS and wheelspin | The pad is a force at the centre of mass: `vel += forward · PAD_ACCEL (8 m/s²) · dt` for 1.0 s from the step a grounded wheel first rolls onto a pad (a slow car gets the same kick as a fast one), capped at `PAD_MAX` 48 m/s. The timer rides in the rewind frame and clears on every respawn. It lives in a pure `sky-pads.ts` `PadTimer.step(dt, car, world)`, called from `main.ts` and `autolap.ts` right after `car.step`, the way `world.collide` already edits `vel`. It stacks with nitro; nitro has its own torque path (`car.ts:364-374`). It does nothing in the air. Optionally a pad also tops up the tank. `Nitro` has only `refill()`, so a partial top-up needs a small `charge(s)` (pure, in `nitro.ts`, covered by `nitro.test.ts`). | `bun test` on `PadTimer`, plus autolap speeds at each gap toe: `sky-seeds.ts` fails a seed whose toe speed leaves 22-40 m/s |
| **Collision cost** | `ramp_at` scans every ramp each query (`world.ts:224-231`); a naive deck scan would scan 2000+ slices | Cached segment index plus the walk; the grid as fallback | `scripts/sky-gen.ts` times 1M `height()` calls; target < 0.3 µs/call (unverified) |
| **autolap / seeds** | `corner_pace` uses flat `CORNER_GRIP` (`autolap.ts:20-34`); "offroad" means `grip < 1` | `corner_pace` reads the bank at the point and uses the banked `v_max`. Sky gaps come from `world.ramps` (`deck: true`), so `RAMP_LOOK`/`JUMP_PACE` already apply. Add a `fell` count and a pad step. | New `scripts/sky-seeds.ts`, mirroring `scripts/seeds.ts`: 20 seeds × every car. Clean means a full lap, 0 falls, and no rail impact over 8 m/s. Gate: 20/20 on COUPE, ≥ 19/20 on every other car. |

## 5. Phases

Sizes: S ≈ a day, M ≈ 2-4 days, L ≈ a week, for one coder.

| Phase | Scope | Size | Gate |
|---|---|---|---|
| **0. Approvals** | §6 decided by the owner | - | answers in hand |
| **1. Smallest playable** | `WorldKind`; `generate_sky` with straight, flat curve, banked curve, rise, drop and chicane; closed-loop solve; rails as `bottom` boxes; `Ground.height(x, z, y?)`; `World` deck term with cached lookup; fall-and-respawn at the last checkpoint; checkpoints and gate outriggers; deck mesh through nullable `terrain` chunks; cloud floor; skip water and roadside; `?world=sky` URL only; `w` world id; `world_key(seed, kind)`; hide gymkhana, parking and hunt | M (about 4 days) | `bun run typecheck`, `build`, `bun test` (`sky.test.ts`: closure < 1e-6 m, separation, bounds, grade and bank rates, normal continuity, determinism over 2 runs), `scripts/sky-seeds.ts` 20/20 COUPE, `scripts/bank.ts`, and the island's `seeds.ts`/`feel.ts` numbers unchanged (the island gen is untouched, so `world_key` output for island must be byte-identical) |
| **2. Jumps + pads + preview** | gap-jump harness **first**, then `KICKER`/`GAP`/`LANDING` pieces, `Ramp.deck`, `spawn_blocks` extension; boost pads + `PadTimer`; World screen toggle and sky `map_data`; legend | M | jump harness green on every car; `sky-seeds.ts` with pads and gaps 20/20 COUPE |
| **3. Look + variety** | joints and clip tabs, checker lips, pad pulse; optional pylons; cheap split; phone check at 844×390 for draws and frame time | S-M | screenshots on 3 seeds × light and dark themes; the owner looks |
| **4. Later, own approval** | crossovers (multi-deck under the `y` hint), point-to-point (`Route` schema from `world.md`), sky lobby-race tuning | L | - |

**Phase-1 cut line:** if phase 1 runs long, drop the chicane and drops first (keep rises), then the World screen stays URL-only. Banked curves stay, because they are the point of the mode.

### What to cut

| Cut | Why |
|---|---|
| **Vertical loops, corkscrews, wall rides** | Needs inverted or vertical contact. `Ground` is a heightfield (`height(x, z)`), so the car can only ever be pushed up the y axis. This would be the Rapier and mesh-collider switch `architecture.md` §2 names. |
| **Crossovers and overpasses** in phases 1-3 | `height` must stay single-valued until the `y` hint is used for multi-deck selection. Phase 1 adds the hook only. |
| **Point-to-point** | Needs the `Route` schema plus `modes/races.ts` (`world.md`). |
| **A real split/merge fork** | Graph branches, per-lane checkpoints and minimap lines. The "cheap split" (divider rail) gives the look for about 5% of the work. |
| **Gymkhana, parking, hunt on sky** | They need flat open ground. They are hidden, not adapted. |
| **Explicit fall time penalty** | Driving back from the checkpoint is the penalty. A penalty would touch lobby lap validation and records. |

## 6. Changes that need owner approval

| # | Kind | Change | Where | Note |
|---|---|---|---|---|
| 1 | **Schema (worker output)** | `WorldData.kind`, `WorldData.deck`, `Ramp.deck?: true`, `ChunkBuffers.terrain` nullable, `GenRequest.kind`, `MapRequest.kind`, `MapData.kind` | `worldgen/types.ts`, `chunks.ts`, `worker.ts`, `map-worker.ts`, `map.ts` | Internal to one build; nothing is persisted |
| 2 | **Internal API** | `Ground.height(x, z, y?)` | `car.ts:6`, `:393`, `:520`; `world.ts:211` | Not schema or net, but it is the physics contract, so the owner should see it. `feel.ts`/`telemetry.ts` must stay byte-identical on the island. |
| 3 | **Net** | Map identity `(seed, w)`, with `w = 1000 + SKY_VERSION` for sky; `foreign_seed` and the join-map button carry the kind | `net.ts:283`, `:350`, `:381`; `hud.ts:88-91` | Old builds drop sky peers as foreign (correct). Alternative: a new `k` field. **Rejected**, because old builds would ignore it and race sky peers as if they were on their island. |
| 4 | **Storage** | `world_key(seed, kind)`: island keys unchanged, sky `` `${seed}:sky${SKY_VERSION}` `` | `types.ts:19-21` (one function feeds race, ghost, track, lobby, duel ghost) | Additive; no migration |
| 5 | **URL / invite link** | `?world=sky`; `invite_link(room, seed, kind)` | `main.ts:40`, `settings.ts:341`, `settings.ts:707` | Old builds ignore the param and load the island, and then #3 marks the peers foreign |
| 6 | **Version** | `feat:` → minor (0.8.0), because old builds still read every packet and save. Major only if the owner treats the new `w` space as a room format change. | `package.json`, `changelog.ts` | per `AGENTS.md` §Versioning |
| 7 | **Dependency** | none | - | - |
| 8 | **New modules** | `worldgen/sky.ts`, `worldgen/sky-mesh.ts`, `sky-pads.ts`, `scripts/sky-seeds.ts`, `scripts/bank.ts`, `scripts/sky-gen.ts` | - | All pure and Bun-testable except the mesh. No new state layer. |

## Not checked

- Nothing was run. The closure failure rate, gen time, `height()` cost and banked-curve behaviour per car are all predictions until `sky-gen.ts`, `bank.ts` and `sky-seeds.ts` exist.
- Whether the slate-blue deck reads on every saved and generated theme. `random-theme.ts` can produce a theme where `info` sits close to the sky tones. Check by eye on 3 random themes and fall back to `tertiary` if needed.
- The rail height (0.7 m visual, 1.2 m collision) from the chase camera.
- Whether 22 m/s is the right slow end for the heaviest car on a sky gap (the same open question as `world.md`).

## Phase 3: twisty tracks and rail glide

Round 2, 2026-11-09, after phases 1-2 shipped. Owner feedback: "if i hit the wall i get stopped - this is not how hotwheels work you just slightly get slower but still glide with it", "the maps are plain and boring just one big circle - hotwheels maps have many turns and twists", "no real challenge". This round reworks how layouts are drawn and how a rail hit resolves. Medal lap times are a later round.

### Why phase 2 reads as one big circle

`draw_layout` draws 5-8 left turns that share exactly 2π, 0-2 small rights and at most one chicane, with 110-410 m of straight between turns. That is about 9 rad of heading change on 3-4 km, or 2.3 rad/km; a circle of the same length is 1.6 rad/km. The 44 m separation rule, applied at every height, also forbids any crossing, so the generator can only draw convex-ish rings.

### Layout: a skeleton plus macros

The lap is still a closed list of `straight` and `arc` pieces with eased curvature, and position still closes with the exact two-straight solve. What changes is what goes between the straights:

| Macro | Shape | Net heading |
|---|---|---|
| **Sweeper** | one arc 40-120°, R 70-180 m, banked past 60° most of the time | its angle |
| **Hairpin** | one arc 150-200°, R 26-40 m; half are banked 20-28° as a toy berm | its angle |
| **S-bend** | arc ±45-90°, 10-40 m straight, arc ∓ the same, R 45-90 m | 0 |
| **Esses** | 3-4 arcs alternating ±30-60°, R 50-90 m, 0-12 m between | small, kept |
| **Chicane** | the phase 1 ±25-40° pair | 0 |
| **Switchback** | hairpin, 60-140 m straight, hairpin the other way | 0 |
| **Helix** | one arc of 360° + 45-180°, R 45-70 m, banked, on a constant grade | 2π + its extra |

The skeleton is 3-6 sweepers or hairpins in one direction; macros go between them. The turning target is 2π for a ring (70%) or 0 for a figure-eight (30%), plus ±2π when the lap carries a helix. The last skeleton turn takes the remainder and must land in 20-200°, otherwise the draw is redone. A closed curve with turning number 0 must cross itself, so every figure-eight lap has at least one crossover; rings get them when a switchback or helix folds back over the track.

At least one straight is drawn 260-400 m long, so every lap still has room for a gap jump (`JUMP_BEFORE` 70 + span 125 + `JUMP_AFTER` 50). No loops: nothing leaves the heightfield contract (`Ground.height` is still a function of x and z per deck).

### Crossovers with real clearance

The 44 m rule changes meaning: two sections that aren't neighbours (more than 120 m apart along the lap) and come within 44 m of each other in xz must be at least `CLEARANCE` 10 m apart in y over that whole stretch. Same-level sections still keep 44 m, so gates, `GATE_RADIUS` and the deck lookup work as before.

- **Zones.** After the xz layout, every such close pair is grouped into a zone: the later pass's s-range and the earlier pass's s-range. A zone longer than 160 m (a shallow overlap rather than a crossing), more than 4 zones, a zone touching the start straights, or a zone overlapping a jump span rerolls the layout.
- **Profile, built in lap order.** The grade profile is still drawn front to back as rises and drops between fixed events (gap jumps, helix). A zone is a new event: when the cursor reaches the later pass, the earlier pass's heights there are already known, so the generator picks over (earlier max + 11 m) or under (earlier min − 11 m), whichever is reachable within the grade limits and the 140-400 m height band, solves one rise or drop that lands on that height before the zone, and holds it flat through the zone. If neither fits, the profile is redrawn, then the layout.
- **Helix.** The helix arc is one constant grade `g` with `|g| · 2πR ≥ CLEARANCE + 3`, ramped in on the straight before and out on the straight after. Its own coil overlap is covered by that grade; the final clearance check still verifies it.
- **What a zone keeps clear of:** checkpoints (and gate posts, which are circle solids with no underside), the start straights, open sections (the rails stay on both levels) and gap jumps.
- **Deck lookup.** `DeckIndex` marks the grid cells around every stacked pair at build time. Outside them nothing changes: the walk plus the grid fallback. In a marked cell `surface(x, z, y)` checks every section near the point and answers the highest deck the query is above the underside of; with no `y`, the highest. `Ground.normal` gains the same optional `y`, so a car under a crossover tilts with its own deck. Fall detection moves from the nearest road point to `World.fallen(pos)`, which compares against the lowest deck near the car. Camera floor, skid marks and the contact shadow pass their own y.

### Twistiness: the acceptance check

A pure `twistiness(samples)` in `worldgen/sky.ts`, run on every accepted layout and in `sky.test.ts`:

| Measure | Definition | Accept |
|---|---|---|
| **Turn density** | total absolute heading change over the lap, per km | ≥ 4.5 rad/km (a circle of the same length is 1.6) |
| **Corners** | runs where \|curvature\| ≥ 1/300 m⁻¹ that turn at least 20°; a sign change starts a new corner | ≥ 12 |
| **Constant stretch** | longest run whose curvature stays within ±0.002 m⁻¹ of its start, straights included, as a share of the lap | ≤ 14% |
| **Roundness** | 4π·\|area\| / length², 1 for a circle | ≤ 0.45 |

A layout that misses any of them is rerolled like any other reject. `sky.test.ts` checks that a circle and a rounded rectangle fail and a lap of esses passes. Seeds 0-19 measure 4.5-9.0 rad/km and 12-26 corners.

### Rail glide

Today a rail hit is the island wall response: an impulse with restitution 1.25 at the contact circle, `vel × 0.9`, and a yaw kick from the arm. On a toy track that bounces the car off and spins it.

On a sky world a box solid is always a rail, so `World.resolve` branches on `kind === "sky"` for boxes; the island keeps its walls as they are. The glide:

1. Push the car out of the rail as before.
2. Drop the velocity component into the rail, and send the rest along the rail tangent in the direction the car was travelling (the heading decides when the hit is near head-on).
3. Keep `1 − GLIDE_LOSS · sin θ` of the planar speed, θ the angle into the rail, `GLIDE_LOSS` 0.12: a head-on hit keeps 88%, 45° keeps 91.5%, a 10° graze keeps 98%. Never a dead stop.
4. Ease the yaw rate toward turning the nose onto the rail direction; no impulse yaw, so no spin back.
5. Return the into-rail speed as the impact, as before, for sounds, shake and the `sky-seeds.ts` crash count.

Deterministic, a few multiplies per contact, no new state.

### Rail look

Owner, on a crest: "you can see the top of the rail for some reason even tho it should be a simple ramp". The rail had a flat top and a lip folded over the deck; each caught the light as its own strip and stepped where grade or bank changed. Now the rail is one face leaning out from the deck edge to its top outer edge, plus the outer face, in the deck tone. Joint seams follow the leaning face.

### As built

- Closing the position: two straights alone missed most twisty draws, so every stretchy straight first takes a share of the error (bounded coordinate descent within its 44-420 m limits), and one pair closes the last centimetres exactly. A seed needs 3-200 of its 400 attempts; one whose every attempt fails takes `FALLBACK_SEED`'s track.
- Laps run 2.7-5.2 km and take the coupe autolap 117-220 s; autopilot rail hits stay under 8 m/s.
- The normal-continuity test keeps 0.5° on the centreline. 4 m off it, on a banked hairpin, the lookup steps up to 0.8° per sample, so the offset check allows that.

### Changes and checks

- `SKY_VERSION` 2 → 3: every sky seed is a new track, so sky records, ghosts and the net map id reset. Island output is untouched (`world_key` and `world_id` for island byte-identical).
- Internal API: `Ground.normal(x, z, out, y?)`, `World.fallen(pos)`. No schema, net or storage format change beyond the version.
- `scripts/sky-seeds.ts` 20/20 on all 8 cars, gap toes inside 22-40 m/s, each seed passing `twistiness`; `bun test` for the metric and for glide speed retention; World screen previews of 3 seeds and one in-game shot.
