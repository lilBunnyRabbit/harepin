# Big dunes: Sahara-style dune bashing

> **Status 2026-11-12 (v0.29.1):** Open. S1 is measured (`scripts/dunes.ts`, `car.test.ts` "dune sand"), and the §2 and §3 tables carry its numbers. S2, M1 and part of M2 are built: kind `dunes` v7 (base 9000, preset `B`), unlisted, loads from `?world=dunes`. M1: the big band has a planar face (`DuneFace`: 120 m, 850 m wave, 200 m flat corridor, 15° windward, slip face at 0.54 with rounded brink and toe), and the dune sea's bands lie down on the slip face at 0.6 height. `terrain.test.ts` holds both the gapped land and the stamped world inside 700 m under 34°. M2: the circuit runs two corridors with a half circle over the dune at each end (`corridor` in `path.ts`, laid out on the land's point function so the terrain is drawn once). The dunes part there (`DuneGaps`), so there are no road cuts. Two packed dirt lines cross the inner dune, up the windward face and down the slip face. Towns sit on pans only (`TownRecipe.pan`), so 3 of 20 seeds have one. Routes: circuit and circuit-rev at the shared par, no street races. The bus misses par on every dunes circuit and is baselined, like the volcano descent. Gen takes ~640 ms against the dune sea's ~250 ms. Not built from M2: crest lips and `gap_jump` benches (open: a 4 m drop bench on a 28° face needs a fill 15-50 m tall). M3 onward is not started.

Round 1, 2026-11-12, at `b442ceb`. Plan only. Nothing was run: no dev server, golden, races or car tests. Every file:line comes from reading the code at `b442ceb`. Numbers marked *est.* are hand calculations from the force model in `car.ts`. They hold only until a car test measures them (slice S1).

Owner idea: Sahara-style dune bashing. Huge sand mountains, off-roading over them, big jumps off crests.

## TL;DR

| Point | Answer |
|---|---|
| Fit | Terrain fits: heights are `Float32` and a dune is one point layer. The slider does not fit: it scales height, not wavelength. A 100 m dune needs a ~1 km wave, not a taller 280 m one |
| Climb on today's loose sand | Only **Rally, Raijin** (AWD) climb a 12-15° windward face at speed. Sturm manages it. Coupe, Hatch, Kaze, Muscle and Bus crawl at 30-60 km/h. **Formula stalls**. `SAND_GRIP` drag (`roll: 28`) is the cause, not the slope |
| Crests | A smooth (smoothstep) brink gives **no air** at the speeds sand allows. A sharp brink at 20 m/s gives 2.6 s of air and a 33° nose slap, because air settle levels the car to the world, not to the face |
| Where | **Own mini map kind ("Big dunes")**, with its own recipe, limits, road rule and records. Not a Dunes slider level. A mainland desert region comes later (300 m dunes need km of room) |
| Jumps | Make crest jumps built features: a crest lip plus a `gap_jump` bench on the slip face (`gap.ts:35`, `drop` ≤ 4 m is tested). Do not rely on raw brinks |
| Size | S → M → L. S is data plus one car test. The layer v2 and route are M. The air/camera physics are L |

## 1. Real dunes

| Form | Shape | Height | Spacing / length | Windward | Slip face | Source |
|---|---|---|---|---|---|---|
| Barchan | Crescent, horns downwind, one slip face | 9-30 m | ~370 m wide | ~15° ("packed by the wind") | 30-35° (repose, dry medium-fine sand) | [Barchan, Wikipedia](https://en.wikipedia.org/wiki/Barchan), read 2026-11-12 |
| Linear (seif) | Long ridges along the net wind, slip faces swap sides | Up to 300 m (Sahara), over 300 m (Rub' al Khali) | Up to 300 km long. Flat interdune corridors between ridges | Gentle both flanks | 30-34° near the crest | [Dune, Wikipedia](https://en.wikipedia.org/wiki/Dune), read 2026-11-12 |
| Star | Pyramid, 3+ arms each with its own slip face | Typically 100-300 m. Up to 500 m in Badain Jaran | Isolated, km apart. Dominant in Grand Erg Oriental | Arms ~10-15° | 30-34° on every arm | [Star dune, Wikipedia](https://en.wikipedia.org/wiki/Star_dune), read 2026-11-12 |
| Draa (megadune) | Compound: small dunes ride on a big one | Tens to hundreds of m | Several km | - | - | [Dune, Wikipedia](https://en.wikipedia.org/wiki/Dune) |

| Number used below | Value | Status |
|---|---|---|
| Windward slope | 10-15° (grade 0.18-0.27) | 15° sourced (barchan); 10° low end (unverified) |
| Slip face | 32° (grade 0.62), planar, at repose | 30-35° sourced |
| Height on a 2 km mini map | 80-150 m | A design cap, from map size (§2) |

## 2. Fit with our terrain

### Today's dune layer

| Fact | Where | Value |
|---|---|---|
| Profile | `dunes()` `terrain.ts:64-81` | Smoothstep rise over `1 - lee` of each wave, smoothstep fall over `lee`. Crests bend (`DUNE_BEND`) and fields fade in and out (`DUNE_FIELD`) |
| Desert bands | `recipe.ts:336-342` | `{wave 280, height 16, lee 0.18}` + `{wave 70, height 3, lee 0.2}` |
| Steepest windward (smoothstep peak = 1.5 × mean) | derived | 1.5·16/230 = 0.10 (**6°**) |
| Steepest lee | derived | 1.5·16/50 = 0.48 (**26°**) |
| Dunes slider | `land-knobs.ts:69-78` | 0-1.6×, **height only** |
| At 1.6× | derived | Windward 9.6°, lee 0.76 (**37°**). Past `scree.up` 0.8 normal (36.9°) the lee paints half-rock (`chunks.ts:101`) |
| Relief budget | `land-kind.ts:7` `MAX_RELIEF` 1.5 | Hills × dunes are capped together |

### What big dunes need

| Need | Today | Change | Kind of change |
|---|---|---|---|
| ~1 km wave, 80-150 m tall | Wave 280 m | New big band `{wave 900-1200, height 80-150, lee 0.2}` under the existing two bands. The small bands ride on it like a draa | Recipe data |
| Planar 32° slip face | Smoothstep lee: steepest in the middle, 1.5× its mean. Capping it at 34° leaves a long soft face | Dune layer v2 (as `biomes.md` B2): a linear face at repose, a brink fillet of radius `R_b` and a toe fillet. Still a pure point layer, so it stays tile-safe | Code in `terrain.ts` |
| Height storage | `Float32Array` (`plan-grid.ts:15`, terrain heights) | None. No quantisation, so there is no height budget to hit | - |
| Paint limits | `LIMITS` `recipe.ts:294`: scree 120 m, rock 135 m, **snow line 165 m**. Desert spreads them (`recipe.ts:351`) | A Big-dunes `limits` with scree, rock and snow at 10 000 m. Otherwise 120 m+ crests turn to scree and snow, and lay the scree surface (`biomes.ts:133`) | Recipe data |
| Mesh resolution | `CELL` 4 m, chunk 256 m / 64 cells (`chunk-grid.ts:3`) | A 100 m slip face is ~160 m long, ~40 cells. A brink is a 1-cell crease: fine | - |
| Plan grid | 16 m on mini maps (`biomes.md:114`) | A 1 km wave is ~60 samples: fine | - |
| Map room | 2048 m map, shore mask r 960 | 1.5-2.5 big crests across. 300 m dunes need a ≥ 2 km wave, so they wait for mainland (6 km) | - |
| Road | Loop road stamps over the dunes (`biomes.md:240`). `straights: 4` | The loop must run the **interdune corridors**, along the wind heading as linear dunes do. A road across a 100 m dune is a 100 m cut. New corridor cost in `loop_road` / path planning | Code |
| Trails | `MAX_GRADE` 0.2 (`trails.ts:14`, 11°) | Trails can climb the windward face (10-11°) but never the slip face | - |
| Kickers | `hills()` `jumps.ts:590`: `BIG` on the top N hilltops (`HILL_MIN` 22 m, spacing 260 m). The ramp is rejected on `\|grade\| > 0.2` (`jumps.ts:416`) | Every big crest becomes a hilltop. Crest jumps want a placement rule of their own (§3) | Code |

### Can the cars climb the windward face on sand?

The model reads per wheel, from `car.ts:302-304`, `:841` and `:890`:

- Grip share = `clamp(0.7 + 0.3·offroad)`.
- Traction = `mu · share · axle grip · driven weight share`.
- Sand drag = `v · roll_resist · (28 − 1) · (1 − offroad)` per wheel, so it grows **linearly with speed**.
- Highest steady speed up grade `g`: `v = (traction − g) / drag-per-m/s`.

This leaves out weight transfer (helps RWD, hurts FWD), TCS, engine power, cos θ and the loose curve's shape. All numbers are *est.*

**Measured (S1, `bun scripts/dunes.ts`):** km/h up the face after 30 s flat out from rest, aids on. Loose sand is the `SAND_GRIP` GRASS row (`roll: 28`), packed is its DIRT row. `car.test.ts` "dune sand" asserts the readings below.

| Car | Drive, offroad | Loose 12° | 15° | 20° | 32° | Packed 12° | 15° | 20° | 32° |
|---|---|---|---|---|---|---|---|---|---|
| Rally | AWD, 0.8 | 142 | 129 | 110 | **72** | 166 | 151 | 131 | 91 |
| Raijin | AWD, 0.3 | 108 | 98 | 81 | 3 (stalls) | 164 | 151 | 124 | 82 |
| Sturm | RWD (60% rear), 0 | 65 | 65 | 35 | 0 | 67 | 66 | 66 | 0 |
| Muscle | RWD, 0 | 62 | 43 | 0 | 0 | 170 | 153 | 111 | 0 |
| Coupe | RWD, 0 | 56 | 38 | 2 | 0 | 168 | 151 | 117 | 0 |
| Kaze | RWD (47% rear), 0 | 48 | 33 | 0 | 0 | 149 | 129 | 89 | 0 |
| Bus | RWD, 0.2 | 25 | 26 | 0 | 0 | 41 | 27 | 3 | 0 |
| Hatch | FWD, 0 | 25 | 14 | 0 | 0 | 87 | 79 | 0 | 0 |
| **Formula** | RWD, −0.5 | **20** | **14** | **0** | 0 | 259 | 245 | 215 | 0 |

The estimate had Raijin up the loose slip face at ~120 km/h: it stalls there. Sturm hunts 1st-2nd up any grade at ~66 km/h, packed or loose. On a 20° packed face the Hatch and Bus stop.

| Reading | Consequence |
|---|---|
| Sand drag, not slope, decides it | Coupe on flat loose sand at 30 m/s decelerates at ~0.39 g *est.* Momentum dies, so "carry speed up the dune" does not work on `SAND_GRIP` |
| On trail dirt (`DIRT` roll 1, grip 0.84) | No drag. Every car climbs a 12° packed line at ≥ 40 km/h (Bus 41, Sturm 67, the rest ≥ 87) |
| Can't bash | Formula, Hatch and Bus (≤ 26 km/h from 12°). Every RWD car stops at 20°. The loose slip face is Rally-only |

## 3. Crests

| Brink | What a car does | Numbers (*est.*) | Survivable? |
|---|---|---|---|
| **Smooth** (today's smoothstep lee) | It leaves the ground only when `v² > g·R`, with R = w²/(6H) at the brink | H 100 m, 34° max face: R ≈ 82 m, so lift-off needs **> 28 m/s (102 km/h)**. Up to ~34 m/s it rides the face. At 40 m/s it touches 165 m out, 83 m down, with ~18 m/s into the face (like a 16 m fall) | Below 28 m/s: yes, no air at all. Sand speeds (≤ 20 m/s for most cars) never get there. Above 34 m/s: no |
| **Sharp** (real dune, 1-cell crease) | Leaves horizontally at any speed and lands on a planar 32° face at `x = 2sv²/g` | 15 m/s: 2.0 s air, 19 m down, 8.2 m/s into the face. 20 m/s: 2.6 s, 35 m, 10.9 m/s. 25 m/s: 3.3 s, 54 m, 13.6 m/s. If the face is shorter than that drop, the car overshoots onto flat: `sqrt(2gH)` | Tested envelope: 2-4 m drops at 22-40 m/s on near-flat decks (`jumps.test.ts:141-143` `DROPS`, sky 2 m, rooftops 2-4 m), so ≤ 9 m/s into the deck. 15 m/s off a sharp brink sits at that edge. 20 m/s+ is untested |
| **Built crest jump** | A lip on the crest, then a `gap_jump` landing bench cut into the slip face (`gap.ts:35`, `drop` param, `DECK_GRADE` −0.04), then the face below | Sized for 22-40 m/s (`GAP_V_MIN/MAX`, `gap.ts:5-7`). Drops ≤ 4 m are tested. `gap.ts:11-13` records that a deck as steep as the descent let fast cars fly far and bottom out | Yes, inside the tested drops. It needs a **packed run-up**: on loose sand no RWD car reaches 22 m/s up 12° |

**Measured (S1, `bun scripts/dunes.ts`):** a 120 m dune on loose sand, coasting over the brink. Smooth is the smoothstep band S2 uses (wave 1000 m, lee 0.29, face peaks at 32°). Sharp is a 14° windward ramp creased onto a planar 32° face. Cells: air s / m/s into the face / most tilt off the face, deg.

| Brink | 15 m/s | 20 m/s | 25 m/s | On its wheels |
|---|---|---|---|---|
| Smooth, every car | 0 / 0 / ≤ 2 | 0 / 0 / ≤ 2 | 0 / 0 / ≤ 2 | all |
| Sharp, Hatch / Coupe / Muscle / Kaze | 1.9-2.0 / 7.6-8.5 / 11-22 | 2.9 / 10.3-11.4 / 21-28 | 3.8 / 13.5-14.2 / 24-29 | all |
| Sharp, Rally / Raijin / Sturm | 1.9-2.0 / 5.6-6.1 / 20-25 | 2.9-3.0 / 8.9-9.7 / 24-29 | 3.8 / 12.4-13.3 / 26-29 | all |
| Sharp, Formula / Bus | 1.9-2.0 / 6.1-6.4 / 6-8 | 2.9-3.0 / 8.6-8.9 / 3-8 | 3.8-4.0 / 11.3-11.4 / 7-10 | all |

A rounded crest never gives air at sand speeds, as estimated. Off a sharp brink every car lands upright. The estimated 33° nose slap does not happen: tilt stays ≤ 29°. Air runs ~10-15% past the estimate. Impact speed matches it, so 20 m/s and up is still past the tested ≤ 9 m/s.

| Air settle fact | Where | Effect on a slip face |
|---|---|---|
| Levels pitch and roll to **world up** (`crossVectors(up, Y)`), rate `air_settle` | `car.ts:933-940` | A car levelled in the air meets a 32° face rear-first, then the nose slaps 32° |
| Strength per car | `cars.ts`: Rally 5, Formula 4, Sturm/Raijin 3, Kaze/Hatch 2, Coupe/Muscle 1.5 | The Rally levels hardest, so it is the most "wrong" on a face. The Coupe keeps more of its take-off pitch |
| Test bound | `car.test.ts:558`: ≤ 40° tilt, on its wheels, flat grass only | Not tested on a sloped landing |
| Fix option | Settle toward the terrain normal under the predicted touchdown, not world Y | Car physics change: L slice, needs new crest-landing tests on slopes |

## 4. Where it lives

| Option | How | Breaks / costs | Verdict |
|---|---|---|---|
| Dunes slider level ("Big dunes" at the top of `D`) | Extend `land-knobs.ts:69` past 1.6× | The slider scales height only, so 6× gives 60°+ faces. The desert road, trails, kickers, canyon and towns were tuned at 16 m (`biomes.md:311`). `MAX_RELIEF` clamps it. The records key changes per level | **No** |
| Slider that swaps band sets | `D` picks a band list, not a factor | Same road and town problems. Big dunes need their own limits, road rule and fewer towns: a whole other recipe behind one knob | No |
| **Own mini map kind** | `kinds/big-dunes.ts` like `kinds/volcano.ts` (20 lines: `land_kind` + `kind_def`, `SAND_GRIP`). Recipe `BIG_DUNES` from `DESERT`. Next free base thousand. Preset char appended to `PRESETS` (`map-code.ts:17`, append-only) | One kind file, one recipe, a menu tile. Own records keyspace. Desert goldens untouched | **Yes** |
| Mainland desert region | B8 regions (`biomes.md:287`) | Not built. A 300-400 m region blend is narrower than one big dune. It is the only place 300 m dunes fit | Later, after B8 |

**Recommendation:** a "Big dunes" mini map kind, built after B2's dune layer v2 (it shares the planar slip face). Its own knobs: dune height (80-150 m), crest jumps, and corridor road on/off. When B8 lands, reuse the recipe as a mainland desert region at 200-300 m.

## 5. Fun layer

| Feature | Reuse | New | Notes |
|---|---|---|---|
| Corridor circuit | `circuit_route` (`routes.ts:104`), loop road in the interdune corridors | Corridor rule in the loop planner | Fast, open, for every car |
| Dune-bash route | Open `Route` like `offroad_routes` (`routes.ts:409`): `closed: false`, gates on crests | Route planner: crest to crest across the wind, packed run-up on each windward face | AWD class events. Par from autolap (below) |
| Crest jump goal | Kickers/benches (`gap.ts`), goal list (`goals.ts`) | Goals "Clear N crests", "Longest airtime". `goals.ts` has no air goal today (grep) | Free roam |
| Career events | `career.md` §1: `map` = map code + preset char, `car.cap`/`car.preset`, stars from autolap median | 1 Rookie corridor sprint (any car), 1 Club dune bash (AWD preset), 1 Pro crest-jump route | Stars need autolap to finish the route (§6) |

## 6. Risks

| Risk | Why | Mitigation |
|---|---|---|
| Bot driving | autolap follows route points with flat-ground pace rules (`autolap.ts:12-16`: `JUMP_PACE` 32, `CORNER_GRIP` 4.5). The `BOT` par model (`routes.ts:31`) has no grade or surface. On loose 15° faces most cars crawl, so bots stall and pars are wrong | Pack every route line (DIRT ribbon) up the windward face. Add grade and drag to `drive_time`. Run `scripts/races.ts` on the new kind before career events |
| Sand grip | `SAND_GRIP` `roll: 28` (`kind-def.ts:106`) was tuned for pans: speed lives on hardpack. On big dunes it makes most cars crawl (§2) | Owner Q1: a softer "dune sand" row for faces (roll ~6-8 *est.*), or keep it and make dune bashing an AWD thing |
| Landings | Sharp brinks give 10-14 m/s into the face at 20-25 m/s. Tests cover ≤ 4 m drops. Air settle levels to the world | Smooth brinks plus built benches (M). Settle-to-terrain only with new tests (L) |
| Camera on big drops | Chase height eases at 6/s (`camera.ts:221`), so at 30 m/s fall speed it lags ~5 m. The camera floor clamps to the ground under it (`camera.ts:233`). Behind a crest, the brink sits between the camera and a car on the face, so the car is hidden *est.* | Lift the pivot or shorten `back` while airborne. A line-of-sight test against `world.height` |
| Perf | Same vertex count. One more band = 2 more 3-octave `fbm` per vertex (`terrain.ts:71,76`): ~+50% of the dune term *est.* Tall relief makes long shadows. Phone fog (`MOBILE_FAR` 200 LOD, 700 m fog) hides dunes 1 km away | `scripts/stream.ts`/gen timing on the new kind. Accept fog on phones |
| Paint | 120 m+ crests hit scree/rock/snow limits (`recipe.ts:294`). Faces over 36.9° paint half-rock (`chunks.ts:101`) | Own `limits`. Cap the face at 32-34° |
| Roads and towns | Stamping a road across 100 m relief makes huge cuts | Corridor road rule. Towns only on pans (`pan` layer) |

## 7. Slices

| Slice | Content | Gate | Size |
|---|---|---|---|
| **S1** | Measure before building: a car test on `SAND_GRIP` slopes (reuse the `slope()` helper, `car.test.ts:253`) giving max climb speed per car at 12/15/20/32°, and a crest test (sharp and smooth brink, 15-25 m/s) on a sloped landing | Table in §2 and §3 replaced by measured numbers | S |
| **S2** | `BIG_DUNES` recipe behind `?world=` only: a big band over the desert bands, own `limits`, kickers off, today's smoothstep profile | Free-roam drivable. `drivable()` passes on 20 seeds. Owner drives it | S |
| **M1** | Dune layer v2: planar repose face, brink and toe fillets (shared with B2) | Terrain goldens for the new kind. Faces ≤ 34° | M |
| **M2** | Corridor loop road, towns on pans, packed windward lines, crest lips + `gap_jump` benches (drop ≤ 4 m) | `jumps.test.ts` covers the bench drops. `races.ts` on the kind | M |
| **M3** | Kind file, preset char, menu tile, knobs (height, crest jumps), dune-bash route, grade-aware par | Own records key. autolap finishes every route | M |
| **L1** | Air settle toward the terrain normal and a camera fix for crest occlusion | New slope-landing tests per car. Existing crest tests still green | L |
| **L2** | Goals (crests, airtime), career events, mainland desert region at 200-300 m after B8 | Career thresholds from autolap. B8 goldens | L |

## 8. Owner questions

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Who can bash dunes? | (a) Every car: softer sand on dune faces. (b) Keep `SAND_GRIP`: big dunes are for Rally and Raijin, other cars stay on the packed lines | **(a) for faces, (b) for pans.** Formula still can't |
| 2 | Crest air | (a) Smooth crests you ride over, plus built crest jumps. (b) Real sharp brinks with big free air (needs L1) | **(a) first.** Add (b) only if L1 lands clean |
| 3 | Home | Own mini map / Dunes slider level / mainland region | **Own mini map**, region later |
| 4 | Height on the 2 km map | 80-150 m now, or wait for mainland for 300 m | **~120 m now** |

**Owner picks (2026-11-12):** only off-road cars bash dunes (keep SAND_GRIP; others use packed lines) · rounded crests + built crest jumps first · own mini map, ~120 m dunes now; 300 m later as a mainland region.
