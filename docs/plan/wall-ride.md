# Wall-ride map: research

Status: research for quest 0aaad55 (Legend final, race `l12`), base 85cd537, 2026-11-13. No code changed. Owner picks an option (section 6).

Short version: the heightfield deck holds a car on a bank up to about 80°. The cars give out first: most bottom their suspension well before that. A true wall-ride, at 90° or past it, needs a second contact path in `car.ts`. That can stay byte-identical for every other world, but it is the big job. Recommendation: build steep velodrome bowls inside the heightfield now, as a Sky-generator kind like Rooftops. Keep real wall contact as a follow-up if the bowls don't sell the wall-ride feel.

## 1. How steep can a deck bank get?

### How contact works today

- Each wheel casts along **body** down, not world down (`car.ts:587-588` sets `up`/`down` from the body quaternion). It binary-searches `ray_gap` (`car.ts:412-415`) over `reach = rest + radius` (`car.ts:800`), 12 halvings. The search resolves to about 0.1 mm, so the march step is never the limit.
- `ray_gap` asks `ground.height(x, z, y)`, which is a vertical distance. On a deck the height comes from `DeckIndex.probe`: centreline height `+ u * tan(bank)` (`deck.ts:192`). The cross-section is one plane across the whole width.
- The probe returns no deck for a query from more than `DECK_UNDER` = 1.2 m **vertically** under the surface (`deck.ts:4`, `deck.ts:193`). On a bank θ, a ray end sitting `c` metres into the surface (c = compression) is `c / cos θ` under it vertically. Contact breaks when `c / cos θ > 1.2`, which gives **cos θ_max = c / 1.2**. The body's collision corners (`car.ts:947`) use the same height query, so once the wheels lose the deck the body falls through it too.
- Normal: `World.normal` builds `(-gx, 1, -gz)` (`world.ts:337-342`). This is exact for any θ under 90°: on the test ring the body sat within 0.5° of the surface normal up to 75°.
- Tyre load is `suspension * up·n` (`car.ts:862`). With the body square to the deck that dot is about 1, so steepness costs no load in itself. Gravity stays world-down (`car.ts:796`), which is correct.

### Test deck

The scratch script is `.t140/bank.ts` (untracked). It builds a ring `Deck` of radius r with a constant bank and a 6 m slant half-width, then plugs it into a real `World` (sky 0 data with the deck swapped and solids, ramps and items removed). A real `Car` drives it at 360 Hz. Steering is pure pursuit on the centreline; throttle and brake hold the target speed. Each run lasts 6 s, and the first 1 s is not measured. The neutral speed `v0 = sqrt(g r tan θ)` is the speed that needs no side grip. At v0 the total normal load is `m g / cos θ`, so the load factor depends only on the bank, not on the radius.

**Static probe:** coupe placed square to a straight bank, one step, wheels compared with the same placement on the flat (`bun .t140/bank.ts probe`):

| bank | wheels down | compression vs flat |
|---|---|---|
| 0-82° | 4/4 | identical (diff 0) |
| 84-89° | 0/4 | contact lost |

Static compression is about 0.13 m, and 1.2 · cos 83.8° = 0.13, so the rule above predicts the break exactly.

**Driving, coupe and formula, r = 60 m** (`bun .t140/bank.ts ring coupe,formula 60`). Excerpt at v0. "Scrape" is the share of steps with a body corner under the deck:

| car | bank | v0 km/h | load g | 4 wheels down | held km/h | scrape | result |
|---|---|---|---|---|---|---|---|
| coupe | 45° | 87 | 1.41 | 100% | 87 | 0% | clean |
| coupe | 60° | 115 | 2.0 | 100% | 115 | 0% | clean |
| coupe | 65° | 128 | 2.37 | 100% | 128 | 0% (100% at 1.15 v0) | edge |
| coupe | 70° | 145 | 2.92 | 100% | 143 | 93% | bottoms out |
| coupe | 75° | 169 | 3.86 | 100% | 150 | 100% | bottoms out, can't hold speed |
| coupe | 80° | 208 | 5.76 | 0% | - | - | **falls through the deck at 4.4 s** |
| formula | 75° | 169 | 3.86 | 100% | 168 | 0% | clean |
| formula | 80° | 208 | 5.76 | 100% | 206 | 4% | clean |
| formula | 85° | 295 | 11.5 | 100% | 228 | 62% | body 38° off the normal, can't hold speed |

Below and above v0 (0.85x and 1.15x), contact stayed at 100% up to 75° for both cars. The coupe drifted at most 1.7 m across the slope. Lane holding is not the problem.

**Whole roster at v0** (`bun .t140/bank.ts fleet 60`; at r = 30 m the results are about the same):

| car | 40-45° | 50° | 55° | 60° | 65° | 70° | 75° | 80° |
|---|---|---|---|---|---|---|---|---|
| hatch | ok | ok | ok | scrape 35% | 68% | 75% | 75% | 68% |
| coupe | ok | ok | ok | ok | ok | 93% | 100% | fell |
| muscle | ok | ok | 12% | 100% | 100% | 100% | 100% | fell |
| rally | ok | ok | ok | 5% | 92% | 100% | 100% | fell |
| kaze | ok | ok | ok | ok | ok | 68% | 92% | fell |
| sturm | ok | ok | 34% | 70% | 85% | 100% | 100% | fell |
| raijin | 26% at 45° | 66% | 84% | 98% | 100% | 100% | 100% | fell |
| formula | ok | ok | ok | ok | ok | ok | ok | ok |
| bus | 13% at 40° | 77% | 84% | 87% | 89% | 91% | fell | fell |

A control run at 5° and 30° is clean for every car.

### Answer 1

- **Contact model:** holds exactly up to 82° when static. It breaks where `cos θ < compression / 1.2`, at about 84° static and at 80° once a soft car bottoms out under bowl load. Neither the ray march, the normal nor grip is the limit.
- **The real limit is suspension travel.** At v0 the load is 1/cos θ g. Most of the roster scrapes its floor from 55-60° (1.7-2 g), Raijin from 45°, the bus from 40°. Only the formula is clean to 80°. Scraping keeps contact but drags: hull friction is 0.6 (`car.ts:947-960`), and the coupe could not hold more than 150 km/h on a 75° bank.
- **Usable design envelope inside the heightfield:** banks up to **55°** at the design speed for every car except Raijin and the bus. Short **60-70°** kicks are fine as set pieces if a scrape is acceptable. Hard cap **75°**: past it a soft car can fall through the deck.
- **Rails:** not measured. A rail is a vertical box at the deck edge, `y + side * half * slope` (`sky.ts:971`). Collision is an xz circle test (`world.ts:625`, `glide` at :632), so a rail on a steep bank still catches in xz. The tilted body is narrower in xz than the circle assumes, so the hits will read a little early (unverified).

## 2. What a true wall-ride needs

The physics favours a **curved** wall:

| car | straight vertical wall: speed where μ · downforce = weight | curved wall at 90°, r = 30 m: min speed (μ N = m g, N = m v²/r) | r = 60 m |
|---|---|---|---|
| hatch / coupe / kaze / sturm / raijin | 411-453 km/h | 58 km/h | 81-83 km/h |
| muscle | 513 | 58 | 82 |
| rally | 437 | 59 | 84 |
| formula | 182 | 56 | 80 |
| bus | 2327 | 65 | 92 |

(`bun .t140/wall.ts`, from `mass`, `mu`, `downforce` in `cars.ts`. Downforce already pushes along body down, `car.ts:997-998`, so it does press into a wall.) The coupe tops out at 267 km/h (`scripts/telemetry.ts`). A straight vertical wall is therefore formula-only. A curved vertical wall (wall of death) works for every car at 60-90 km/h, at only about 1/μ ≈ 0.9 g of normal load. That is lighter on the suspension than a 65° bank at v0. Load fade (`car.ts:889`) shaves effective μ at high load, so margins should be checked once it exists.

What has to change for 90° and past:

1. **Contact query:** a new optional `Ground.cast(origin, dir, max, out_normal): number`. The wheel ray (`car.ts:800-819` loop) and the hull corners (`car.ts:947`) call it when the ground has it. Otherwise the old `height`/`normal` path runs unchanged. A heightfield can't hold a surface at or past vertical: one `y` per `(x, z)`, and stacked decks only by query height.
2. **Deck pieces with a cross-section profile:** bank as a function of `u` (floor, then curving up to 90°+). `DeckIndex` gains a ray-vs-profile intersection: nearest sample, local frame, a few facets. No mesh BVH, so no new dependency.
3. **Everything else that assumes up is up:** `air_settle` levels toward world Y in the air (`car.ts:987`), which is fine on a wall only while the wheels stay down. `World.collide` is xz circles plus `pos.y`. `World.fallen` uses the deck floor. The chase camera is world-up with a floor from `world.height` (`camera.ts:218`, `:247`), and a camera inside a bowl can end up behind the wall. Spawn and reset assume a level car.
4. **Gravity stays as it is.** No "wall-ride gravity" hack is needed on curved walls (table above).

**Byte identity:** achievable. `car.test.ts`, `scripts/telemetry.ts` and `scripts/feel.ts` drive object-literal `Ground`s with no `cast` (`telemetry.ts:7`, `feel.ts:15-16`). Every existing `World` would leave `cast` undefined: assign it only when the deck has a profile. The old branch stays textually untouched. Proof: `car.test.ts` bit-exact, telemetry and feel byte-identical, `golden.ts --check`. The real costs are in the 360 Hz loop (one extra branch per wheel and corner, no allocations allowed), in tuning, and in the camera.

## 3. Map shape

Rooftops is both a Sky recipe variant **and** its own kind. It has its own `WorldKind`, `kind_def` (base 8000, tag `roof`, own version) and `generate: (seed) => generate_sky(seed, ROOFTOPS, ROOFTOPS)` (`kinds/rooftops.ts:6`). The wall-ride map should follow the same pattern: a new `WorldKind` whose `kind_def` calls `generate_sky` with a new recipe. Keep it unlisted, played from career `l12` and `?world=`; whether Play lists it is the owner's call.

New `SkyRecipe` fields (`sky.ts:86`), each off in `SKY` and `ROOFTOPS` and never drawing from the rng when off, so `golden.ts --check` stays identical for sky and roof:

- **Velodrome bowl:** a 180-360° arc at 40-60 m radius. Bank 45-55° on the racing line, rolled in faster than `BANK_RATE` 1.2°/m (`sky.ts:43`): at 1.2°/m a 55° bank takes 46 m to roll in. This fits as a new `Turn` kind beside today's banked turns (0.26-0.52 rad, `sky.ts:227`).
- **Half-pipe wall:** needs a curved cross-section. Add an optional per-deck profile in `DeckIndex.probe` (`deck.ts:192`), keeping the old planar formula when absent, plus the same curve in `sky-mesh.ts`. Inside the heightfield the lip stops at about 70°.
- **Wall-ride section:** only real with option B. Within the heightfield it is a 60-70° bowl segment taken over v0. Fall-reset: sky kinds already reset under `deck.floor - FALL_DEPTH`. An open outer edge (`open` sections) makes going over the top a reset, not a crash.
- Registries: `WorldKind` value, `KINDS`, one `PRESETS` char (`map-code.ts`), `worlds/<kind>.ts`, images, a new version constant.

## 4. "The accident" (board t31)

Board evidence (`~/dev/hq/team/car-sim/tasks.md`, 2026-11-12): t30 "Road with extreme side tilt (owner shot 64)" was added at 01:42 and t31 "Designed banked turns / wall-ride challenge (owner liked the accident)" at 01:49, from the same owner round. t30's cause, fixed in 02099cc: a trail's deep-run face pulled the island circuit onto its 1:1 bank. The owner's own words are not in the vault, so **the link between t31 and t30 is inferred**, not confirmed.

Reproduced on the pre-fix tree (54de4f3, island v8, seed 49, Hills max, `.t140/old/tilt.ts`): 44 road samples were over 6% cross-tilt. The worst is circuit edge 45 near (-379, 532) at **54% = 28°** across the road. Driving the coupe through it:

| speed | max body tilt | wheels down | airborne |
|---|---|---|---|
| 60 km/h | 33° | 0 at times | 0.37 s |
| 100 km/h | 72° | 0 | 3.2 s |

At speed, the tilted road works as a sideways kicker: the car rides up the cross-slope and is thrown rolling, close to sideways. That is the likely "accident". It is a steep cross-slope taken fast, well inside what option A can build on purpose.

## 5. Options

| | A. Steep banks in the heightfield | B. Real wall contact | C. Scripted wall run |
|---|---|---|---|
| What | New kind on `generate_sky`: bowls at 45-55°, 60-70° kicks, optional curved deck profile, open top edge with fall-reset | A, plus `Ground.cast`, profiled deck pieces to 90°+, car/hull/camera/reset on body-down | A, plus a wall section where the car, at enough speed, follows a spline along a vertical wall like the rail `glide`, physics paused |
| Feels like | Velodrome, banked bowls, the t31 kick | Wall of death, true wall-ride | Wall-ride as a set piece; can read as on-rails |
| Size | ~400-600 lines: recipe + planner pieces in `worldgen/`, kind def, `worlds/`, images, `l12`. +~100 for a curved profile (deck.ts + sky-mesh) | A + ~600-900: `car.ts` contact branch, `deck.ts` ray cast, `world.ts`, `camera.ts`, reset, tests | A + ~200-300: section data, a `world/` controller beside `glide`, enter/exit rules |
| Risk | Low. Physics measured above. Raijin and the bus scrape early (exclude the bus as on the volcano descent, or keep the bus line at ≤ 40°) | High: hot-loop changes in car.ts, new tuning, camera inside a bowl, every assist written for up = Y | Medium: entry and exit snaps, multiplayer remotes, ghosts mid-script |
| Byte identity, other worlds | Free: car.ts untouched; `golden --check` proves sky/roof unchanged | Achievable with an optional `cast` and the old path untouched; proof: car.test bit-exact, telemetry/feel identical, golden | Free: new code runs only inside the section |

## 6. Recommendation

**A now, as a new Sky-generator kind.** The measurements say the heightfield is not the bottleneck below 75°; the suspensions are. A 45-55° velodrome with a few 60-70° kicks is the steepest the whole roster drives cleanly. It also covers what the owner liked. It ships with no car code change and no byte risk.

Keep **B** as its own quest, taken only if the owner drives A and still wants vertical walls. Its physics are friendly (curved walls work at 60-90 km/h for every car), but it is the hot loop plus the camera. I'd skip C: it is the cheapest "wall" but the most likely to feel fake.

Owner picks needed:
1. A, B or C.
2. Bus on `l12`, yes or no.
3. Should Play list the kind?
