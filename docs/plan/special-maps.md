# Special maps: Rooftops, Volcano, Ice canyon

Round 1, 2026-11-11, at `ae0323e` (v0.28.1). Plan only. Nothing was run: no dev server, golden, proof or races. Every file:line comes from reading the code at `ae0323e`. Numbers marked *est.* are guesses until a script measures them.

The owner liked three special maps in the spirit of Sky Track:

1. **Rooftops** (first): a night city. The track runs over the roofs, with jumps from building to building, car-park spirals, a bridge between towers and a drop down a crane arm. Falling between buildings resets you.
2. **Volcano**: a ring road round the crater with lava channels, and a one-way descent from the rim to the sea.
3. **Ice canyon** (maybe): a frozen riverbed descent with waterfall jumps.

## TL;DR

- **Rooftops is a Sky Track with a city under it, not a city with a track on it.** Same deck generator, same physics and the same fall reset. The new parts are data and a skin: a "terraced" height profile (flat roof runs, short drops), a building placed under every flat run, and building meshes in the deck chunk path. Size **L**.
- **Volcano is a land kind like Alpine**, built from a recipe: a new `crater` terrain layer, the ring road on the rim, the existing canyon planner as the ash gully down to the sea, and the existing switchback stacks on the flank. The new parts are a `LAVA` surface that resets the car, a glowing lava mesh, and **one-way race routes with checkpoint respawn**. Size **M-L**.
- **Ice canyon is Volcano's descent on Tundra's kit.** The canyon floor freezes to `ICE`, terrace steps in the floor become waterfall drops, and `gap_jump` kickers sit before them. It reuses everything Volcano adds. Size **M** once Volcano has shipped.
- **Build order:** R1-R4, then V1-V3, then I1-I2. Every slice ships a playable map behind `?world=`.
- **One hard limit: "night".** Lighting picks DUSK or DAY from the theme (`render/lighting.ts:81`), and the palette's `dark` flag is a module constant (`theme/palette.ts:7`). Forcing night on a light theme needs a palette refactor. Options in §5.

## 0. How Sky Track is built today

| Part | Where | What it does |
|---|---|---|
| Kind definition | `worldgen/kinds/sky.ts:23-37` | `ground: false`, `rails: true`, `fall_reset: true`, `LAND_GRIP`, 5 knobs (length, twist, gaps, pads, open) |
| Recipe | `worldgen/sky.ts:81-91` | `SkyRecipe` holds the macro odds, gaps, pads, open share and length |
| Layout | `sky.ts:172` `macro`, `:196` `skeleton`, `:221` `draw_layout`, `:755` `sky_layout` | A closed list of straight and arc pieces (sweeper, hairpin, S, esses, chicane, switchback, helix), closed by the two-straight solve |
| Height profile | `sky.ts:568` `draw_profile` | Rises and drops between fixed events (gap toes, helices, crossover zones). Limits: `MAX_CLIMB` 0.1, `MAX_DROP` 0.25 (`:39-40`), y from 140 to 400 (`:13-14`), `CLEARANCE` 10 m (`:19`) |
| Gap jumps | `sky.ts:300-345` `size_gap` | Sized for `GAP_SLOW` 22 m/s to `GAP_FAST` 40 m/s, landing `LANDING_DROP` 2 m lower (`:307`) |
| World data | `sky.ts:862-985` `generate_sky` | Deck line (`DECK_STRIDE` 9 floats: x, y, z, tx, tz, bank, **half-width per sample**, solid, s; `types.ts:252-269`), rail boxes with `bottom` (`:909-931`), checkpoints on flat, unbanked straights (`:934-958`), terrain filled with `ABYSS` (`:960`), `circuit_route` |
| Physics | `world/world.ts:308-319` | `height` = max(terrain, ramp, `deck.surface(x, z, y)`). `fallen()` (`:338`) checks for a car `FALL_DEPTH` 6 m under the lowest deck. Rail hits glide (`:599`) |
| Lookup | `worldgen/deck.ts:27` `DeckIndex` | 16 m grid, a walk from the last hit, and stacked cells for crossovers. Assumes **one closed line** (`length` wraps, `:46`) |
| Respawn | `car/driver.ts:117-122` `fall_back` | Back to the last circuit checkpoint passed, or `SPAWN_INDEX` when no race is running |
| Mesh | `worldgen/chunks.ts:275-284` `deck_chunks`, `sky-mesh.ts:60` `deck_layers` | Kinds with `ground: false` take this path, which always returns `buildings: null` |
| Scene | `worlds/sky.ts:5-21` | `mood: {}`, `dress: cloud_floor` |

## 1. Rooftops

### Reuse vs new

| | Reuse as is | Reuse with data | New |
|---|---|---|---|
| **Track** | `sky_layout` closure, macros, `DeckIndex`, rail glide, `size_gap`, open sections | `SkyRecipe` + `profile: "free" \| "terraced"`. Terraced means flat runs held at roof levels, joined only by drops (≤ 25%) or gap jumps (2 m+ down). A helix becomes the **car-park spiral** (always descending: R 20-30 m needs `g·2πR ≥ 13`, so g ≥ 0.07-0.10, which is past `MAX_CLIMB` going up) | Fold the terraced profile into `draw_profile` as a mode: a flat run between events instead of a parabola. About 80 lines *est.* |
| **Buildings** | `Building` (`types.ts:156`) with `Roof.FLAT`, `town_builders`/`town_meshes` (`chunks.ts:206,249`), glass with `shop_glow` (`world/buildings.ts:13,138`), street lights instanced (`buildings.ts:100`) | One building per flat run: footprint = the run's xz bounds + 2 m, top = deck y − `THICK` 0.4, `height` = deck y − street. Car parks get an open-sided `style` | Call `town_builders` from `deck_chunks` with a constant street ground. Cut the deck underside mesh wherever a roof sits under it (no z-fight) |
| **Bridge** | Long straight + `open` sections (`sky.ts:799`) | `half` per sample down to 4.5 m on the span; no checkpoint on it (gates need `ROAD_HALF`) | Tower-to-tower placement rule: the two buildings either side of the bridge are 1.5-2× taller |
| **Crane arm** | Drop macro at `MAX_DROP` 0.25 | Narrow deck (`half` 3.5-4 m), rails off both sides | Crane mesh (mast, jib, counter-jib): a new prop, 1 instanced draw |
| **Falling** | `fall_reset`, `FALL_DEPTH` 6, `fall_back` on the circuit | - | **Free roam respawn:** `fall_back` goes to `SPAWN_INDEX` when no race runs (`driver.ts:121`). Rooftops needs a "last safe deck s" kept by the driver (the last s where the car stood ≥ 1 s on solid deck, never in a gap span) |
| **Free roam** | The lap is drivable without a race | Wide **roof plazas**: `half` 15-20 m for 40-80 m on flat runs, rails kept, checkpoints off | Street level is visual only. Physics stays `ABYSS`, so a fall resets 6 m under the roof long before the street |
| **Routes** | `circuit_route` | Short routes: sprints over sub-ranges of the lap as open `Route`s (`closed: false`, as `offroad_routes` does, `routes.ts:409`) | Route-aware respawn (shared with Volcano V3) |
| **Look** | Neon accents from theme tokens (`Neon Black`, `Deep Neon`, `theme.ts:141,143`; `accent`/`tertiary`/`cottontail` for signs), bloom on the DUSK mood (`lighting.ts:29`: bloom 0.6) | `WorldDef.mood`: `sun_y` low, `fog_near` 80, `hemi_ground` asphalt. Deck tone = asphalt, not the toy `accent` (`palette.ts:79`) | Window bands as vertex colours on facades (no textures). Emissive sign quads in the glass soup. Far skyline: 1 `InstancedMesh` of boxes past the track bounds, fogged. Street plane + road stripes: 1 draw (as `cloud_floor`) |

### Layout sketches

`=` deck on roofs, `#` building, `@` spiral, `~` gap jump, `B` bridge, `C` crane arm, `S` start, `P` plaza.

**A. Downtown loop** (default ring)
```
   ###====~~====###========@@
   #S#            ###     @  @
   ###            #P#=====@@@     spiral down 2 levels
    |              ###
    ||                     ###
   ###==B=B=B=B=B==###=====#C#
   ###  (tower bridge) ###   C  crane arm drops 25 m
                             ###==== back to S
```
About 3 km, 2 gaps, 1 spiral, 1 bridge, 1 crane. The ring closes because the spiral loses height and one long ramp on a car-park roof gains it back (+10%).

**B. Figure-eight over the crossing street** (twist knob high)
```
  ###=====###           ###=====###
  #        \\          //         #
  #         \\  ###  //           #
  ###         >=#X#=<           ###    X: one pass on a roof,
  #         //  ###  \\           #       the other 11 m under it
  #        //          \\         #
  ###=====###           ###=====###
```
This reuses crossover zones (`CLEARANCE` 10 m). The lower pass runs through a gap between buildings on a car-park ramp.

**C. Tower climb sprint** (open route, short)
```
  S ### ~ ### ~ ### == @@@ == ###B###B### == C == finish on a low roof
    40m   35m   30m   up spiral  bridge        crane drop
```
About 1.2 km, one-way, 60-80 s *est.* "Up spiral" means climbing at 10%: R 45-55 m, the sky helix as it is today.

### Routes and goals

| Route | Kind | Length *est.* | Goal |
|---|---|---|---|
| Downtown lap | circuit | 2.4-3.6 km | Lap record, ghost |
| Tower sprint | open | 1-1.5 km | Time, 0 falls bonus |
| Crane drop | open | 0.5 km | Time |
| Free roam | - | - | Gap counter ("roofs jumped"), longest airtime (uses existing goals, *est.*) |

## 2. Volcano

### Reuse vs new

| | Reuse as is | Reuse with data | New |
|---|---|---|---|
| **Kind** | `land_kind` + `kind_def` (as `kinds/alpine.ts:8-22`), `LAND_GRIP` | `VOLCANO: Recipe` in `recipe.ts` | `WorldKind.VOLCANO`, base 6000 |
| **Terrain** | `peak` layer (`recipe.ts:37`), `terrace` (`:45`), mask | Peak: height 260, radius 700 *est.* | `crater` layer: a bowl cut inside the peak (rim radius, depth, rim lip). A pure `f(x, z)`, tile-safe |
| **Ring road** | `loop_path` | `loop.radius` ≈ rim radius (180-260 m), `swing` small, `stacks: []` | None if the loop holds the rim (*est.*: the loop clamp runs `min` 380-500 today, `recipe.ts:292,387`; the rim needs it lower) |
| **Descent** | `plan_canyon` from `FLANK` 0.6 of the peak to the sea (`canyon.ts:9,102`), `carve` (`:124`), `switchback` + `guard_rails` (`switchback.ts:160,215`) | `canyon.outlet` 2 (sea), `stacks: [4, 3]` on the outer flank | Join the rim road → stack → ash gully as one **open race route** |
| **Ash** | `SCREE` footing (`kind-def.ts:108`: grip 0.8, loose 0.9) | Ash = `SCREE` under the wheels, new `Ground` colour row | Ground row only |
| **Lava** | Canyon carve for the channel shape | 2-4 narrow channels from the crater down the flank, never across the road (bridged where the road crosses) | `SurfaceId.LAVA`. `World.fallen` also returns true when a wheel touches lava, so the reset is instant (`drowned` waits 1.5 s, `main.ts:533-535`). Lava mesh: an emissive strip per channel plus the crater lake, 1-2 draws, picked up by bloom |
| **Respawn** | `driver.reset` (nearest road) in free roam | - | **Route checkpoint respawn:** `fall_back` reads only `world.checkpoints` (the circuit), `driver.ts:118-121`. A one-way race respawns at the last gate of the route being raced |
| **Look** | `WorldDef.mood` delta: `sun_y`, fog, `hemi_ground` (`lighting.ts:46`) | `hemi_ground` = lava tone (red bounce), `fog_near` 60 (ash haze) | Ash fall particles: optional, later |

### Layout sketches

`o` crater lava lake, `=` road, `L` lava channel, `Z` switchback stack, `G` ash gully (canyon), `~~` sea.

**A. Rim ring + one descent** (default)
```
            =========
         ==/  ooooo  \==
        ||   ooooooo   ||      rim ring 1.2-1.6 km
        ||   ooooooo   ||
         ==\  ooooo  /==
            ====+====
           L    Z    L         stack: 3-4 hairpins
          L     Z     L
         L      G      L       gully: ash, walls, 1 kicker
        ~~~~~~~~=~~~~~~~~~ sea, finish at the harbour
```

**B. Rim ring with a lava bridge**: a channel cuts the ring once and the ring crosses it on a short bridge (a kicker gap if the knob allows it). The descent leaves on the far side.

**C. Two descents (race choice)**: a fast gully with loose ash, and a slow switchback road on asphalt. They meet at the coast. Both are open routes, each with its own record.

### Routes and goals

| Route | Kind | Length *est.* | Goal |
|---|---|---|---|
| Crater ring | circuit | 1.2-1.8 km | Lap record |
| Rim to sea | open, one-way | 2-3 km, 300 m drop | Time, 0 lava |
| Gully only | open | 0.8-1.2 km | Time |

## 3. Ice canyon (maybe)

### Reuse vs new

| | Reuse as is | Reuse with data | New |
|---|---|---|---|
| **Kind** | `TUNDRA` recipe (`recipe.ts:399`), `WINTER_GRIP` (`kind-def.ts:146`), `SNOW_KIT` (`snow.ts:21`) | `ICE_CANYON: Recipe` = Tundra + taller peak + `canyon` on | `WorldKind.ICE_CANYON`, base 7000 |
| **Riverbed** | `plan_canyon`/`carve`, Volcano's open descent route | Floor half-width 10-14 m (`Canyon.floor`, `types.ts:302`) | Floor surface = `ICE` (`kind-def.ts:120`: grip 0.35). Run-ups and landings = `PACKED_SNOW` (0.8), so a jump never launches off ice |
| **Waterfalls** | `terrace` layer for the steps, `gap_jump(..., drop)` (`gap.ts:35`), road kickers (`jumps.ts`) | 3-5 steps of 4-8 m, along the canyon only | Terrace masked to the canyon corridor. Frozen-fall riser faces painted with `Ground.ICE` |
| **Walls** | Carved canyon walls | Steeper walls, snowbanks on the rim road | None |
| **Look** | Tundra mood | Cooler fog, low `sun_y` | Icicle props: optional |

### Layout sketches

`|` canyon walls, `=` ice floor, `^` kicker, `v` waterfall step, `S` start, `F` finish.

**A. Single descent**
```
 S (rim, packed snow)
  \\
   |  ===^v===   |
   |       ===^v=== |       4 waterfall steps, 6 m each
   |  ===^v===      |
   |      ====^v====|
                  F (frozen lake at the mouth)
```

**B. Descent + rim return loop**: the rim road on packed snow climbs back up, making it a circuit with the canyon as its downhill half.

### Routes and goals

| Route | Kind | Length *est.* | Goal |
|---|---|---|---|
| Riverbed | open | 1.5-2.5 km | Time |
| Canyon loop | circuit | 3-4 km | Lap record |

## 4. Risks

### Physics

| Risk | Map | Why | Mitigation |
|---|---|---|---|
| **Upward gaps** | R | `touchdown`/`size_gap` assume the landing is lower (`LANDING_DROP` 2 m, `sky.ts:307`) | Terraced profile: a gap always goes **down** a level. Climbs happen only on ramps and spirals |
| **Long airtime** | R | A drop of a whole building level after a lip, at 40 m/s | Cap the drop across a gap at 2-6 m. Run `jumps.test.ts` `ground_gap` for every car at each drop size first (the same gate Sky phase 2 used) |
| **Kerb-free edges** | R, V | Open sections, the bridge and the crane have no rails. Volcano rim falls into lava | Only on straights. Never 50 m before a corner. Checkpoint 20-40 m before |
| **Narrow deck** | R | Crane and bridge at `half` 3.5-4.5 m; `GATE_RADIUS` 15 m expects `ROAD_HALF` 6 | No gates on them. `eligible()` (`sky.ts:933`) already requires a straight; add a `half ≥ ROAD_HALF` check |
| **Wall-ride** | V, I | Canyon walls are heightfield slopes, so a car can climb a wall at speed (no rail) | Wall grade over 1:1 near the floor, `guard_rails` on stack bends. Check with `offroad.ts` |
| **Ice jumps** | I | `LAUNCH_KEEP` 0.91 was fitted on asphalt kickers; on ice a sliding car launches yawed | Packed-snow pads 30 m before and after every kicker. `jumps.test.ts` with slip 1.5 |
| **Lava reset at the edge** | V | Wheel contact with lava; a bus is wide | Reset on lava under 2+ wheels, or under the body centre |
| **Fall in free roam** | R | `fall_back` goes to `SPAWN_INDEX` with no race (`driver.ts:121`) | Last-safe-deck respawn (R4) |
| **Bots / autopilot** | all | `drive_time` corner pace = √(grip × radius) (`routes.ts:28,73`); autolap reads deck kickers through `ramps` with `deck: true` | Rooftops: reuse `sky-seeds.ts` as is. Volcano/Ice: `races.ts` over the new open routes, gate 20/20 COUPE. Ice grip 0.35 halves corner speed: par stays fair because `par_ms` comes from the same model |

### Performance (phones: 300k tris, ≤ 120 draws, from `sky-track.md` §Budget)

| Item | Rooftops *est.* | Volcano / Ice *est.* |
|---|---|---|
| Deck / terrain | ~40k tris, 1 draw per visible chunk (sky today) | As Alpine/Tundra today |
| Buildings | 150-300 buildings × ~60 tris with window bands = 10-20k. **2 draws per chunk** (buildings + glass, `town_meshes`), 6-10 chunks visible = 12-20 | Rim huts only |
| Street lights | 1 instanced draw (`buildings.ts:100`) | - |
| Neon signs | In the glass soup: 0 extra | - |
| Skyline | 1 instanced draw, ~200 boxes | - |
| Street plane | 1 | - |
| Lava | - | 1-2 draws, emissive |
| Real point lights | **None.** Every light is emissive + bloom. Point lights per sign would multiply shader cost | None |
| Total | ~35-45 draws, 80-120k tris | Alpine + 2 |

Biggest perf risk: **bloom at night on phones**. DUSK uses bloom 0.6 (`lighting.ts:29`). Whether the bloom tier stays on the phone budget is *unverified*.

## 5. Mood: night or dusk

| Option | How | Cost | Breaks |
|---|---|---|---|
| A. Follow the theme | DUSK on dark themes, DAY otherwise; `mood` lowers `sun_y` | 0 | Not night on light themes |
| B. Dusk delta | `MoodDelta` gains `key_intensity`, `bloom`; Rooftops sets `sun_y` −0.05 and a dim key | S | Light-theme palette tones (pale buildings, light glass) still look like day under a dark sky |
| C. Forced night | Rooftops loads with the dark half of the palette whatever the theme: `dark` becomes per world (`palette.ts:7`) | L, touches every tone consumer | - |

Recommendation: **A for R1-R3, B in R4.** C only if the owner insists.

## 6. Size and build order

S ≈ a day, M ≈ 2-4 days, L ≈ a week, one coder.

| Slice | Scope | Size | Gate |
|---|---|---|---|
| **R1** | `WorldKind.ROOFTOPS` (base 8000) sharing `generate_sky` with a recipe; terraced profile; a building under each flat run; buildings in `deck_chunks`; street plane; mood A | M | `sky.test.ts` cases on the terraced profile; `sky-seeds.ts --kind rooftops` 20/20 COUPE; island + sky goldens unchanged |
| **R2** | Building-to-building gaps (down only), descending spiral, tower bridge with narrow deck | M | `jumps.test.ts` drops 2-6 m all cars |
| **R3** | Look: window bands, neon signs, skyline, street lights | S-M | Screenshots × 3 seeds × 2 themes; phone draws ≤ 120 |
| **R4** | Crane arm, roof plazas, open sprint routes, last-safe-deck respawn, mood B | M | `races.ts` on the sprints |
| **V1** | `crater` layer, `VOLCANO` recipe, rim ring road | M | `seeds.ts`, `worldcheck.ts` |
| **V2** | `LAVA` surface, instant reset, lava mesh + glow | S-M | Unit test: wheel on lava means `fallen` |
| **V3** | Descent: stacks + ash gully as one open route; route-aware checkpoint respawn | M | `races.ts` 20/20 COUPE |
| **I1** | `ICE_CANYON` recipe on Tundra; icy floor; packed-snow pads | S | `surfaces.ts` on ice |
| **I2** | Waterfall steps + kickers in the canyon | M | `jumps.test.ts` slip 1.5 on packed snow |

Rooftops total **L** (R1-R4 ≈ 2-2.5 weeks *est.*). Volcano **M-L** (≈ 1.5 weeks). Ice canyon **M** (≈ 1 week, assumes V3 has landed).

Approvals needed: 3 new `WorldKind`s and their ids (map identity, net `w`); `SurfaceId.LAVA` (schema); `profile` in `SkyRecipe`; driver respawn rules; a `MoodDelta` extension (option B). No dependency.

## 7. Owner picks

1. **Rooftops layout first:** A downtown loop, B figure-eight, or C tower sprint?
2. **Rooftops mood:** follow the theme (A), a dusk delta (B), or forced night (C, about a week extra)?
3. **Rooftops free roam:** wide roof plazas on the lap (planned), or roam the lap only?
4. **Volcano layout:** A one descent, B lava bridge on the ring, or C two descents?
5. **Lava:** instant reset (planned), or a 1.5 s "drowned" wait like water?
6. **Ice canyon:** build it after Volcano, or drop it?
7. **Records:** lap and route times only, or also free-roam stunts (roofs jumped, longest air)?
8. **Fall penalty:** keep "drive back from the checkpoint" (Sky rule), or add time?

**Owner answers (2026-11-11):** Rooftops layout A downtown loop first · mood follows the theme · Volcano layout A one descent · Ice canyon yes, after Volcano. Open (lead defaults until asked): roof plazas on the lap, lava instant reset, lap/route records only, Sky fall rule.

**Owner 2026-11-12:** Rooftops dropped for now ("just sky map with blocks below"). R1 code stays unlisted. Career tier-1 final stays on its Sky stand-in.
