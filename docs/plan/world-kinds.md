# World kinds: which maps to build, in what order, and how

Round 1, 2026-11-10, v0.20.0 (`0a45e25`). This is a plan only. No code has been written. Owner direction (11-10): finish map generation before more race work. That means more complex, more polished maps and more *types* of map. Candidates: mountain pass, desert, test track, city, snow season, giant room, plus player map options.

Every claim comes from reading the code at `0a45e25`. Nothing here was measured. Costs marked *est.* are scaled from the island numbers in `road-network.md` §1 (gen 307-905 ms, 718-799k tris, 24.8 MB of mesh).

## TL;DR

- **Compact kinds don't need the streaming split.** A 2 km kind can stay monolithic: `generate()` once, then 2a/2b slice and stream its grids. Only `mainland` and a streamed pass need 2c (`plan`/`tile`). So every compact kind below can ship before, during or after streaming without adding to 2c's "identical output" burden.
- **Do one refactor first (K0): a kind becomes data.** Move `id`/`key` onto `base + version + tag`. Pull the island's tuning constants into a `Recipe` (terrain, biome, road, town, landmark and grip knobs). Replace the two `kind === "sky"` branches with data fields (`ground`, `backdrop`). Make the Play grid stop naming kinds. The island and sky checksums must stay byte-identical. Without K0, every new kind adds another `if`.
- **Recommended kinds and order:** K0 → **Desert** (pure recipe, proves K0) → **map options** (island and sky knobs that already exist as constants) → **Test track** (the sky layout laid on flat ground) → **Mountain pass** (compact recipe with stacks on both flanks) → **Snow** as a *season option*, not a kind → **Giant room** (deck plus floor plus furniture, the most distinctive) → **City** (compact; becomes the mainland's city tier) → mainland after 2c → streamed pass corridor last.
- **Snow is an option, not a kind.** It changes grip, ground colours, trees and mood, not the shape of the land. As a `season` knob it works on island, pass and mainland at once.
- **Map options travel in the world id's high bits.** The car packet's `w` is a u32 (`car-packet.ts:52`), and peers already treat a different `w` as a foreign map (`net.ts:491-492`). Packing the option code into bits 16+ needs no `PROTOCOL` bump and no new wire field. Records get a key suffix only when the options differ from the defaults, so today's saves keep working.
- **Watch out for one hidden trap:** `grip() >= 1` currently means "on asphalt" in effects and the HUD (`effects.ts:70,81,174`, `main.ts:464`). Snow roads or a room floor with grip < 1 would read as off-road. Fix that before any per-kind grip table.

## 1. Candidates

### What makes each one play differently

| Kind | Driving feel | Surfaces (grip) | Road style | Landmarks and set pieces |
|---|---|---|---|---|
| **Island** (today) | Mixed: circuit, towns, trails | asphalt 1, dirt 0.88, shoulder 0.85, grass 0.72 (`world.ts:45,288-291`) | Loop with a summit switchback, spurs, links, town grids | Mast, lighthouse, turbines, arch (`index.ts:170-176`) |
| **Desert** | Fast and open. Long straights into a few big bends, roaming off-road at speed, dune jumps | asphalt 1, packed sand 0.86, loose sand 0.78 (*est.*, tune with `scripts/surfaces.ts`); no grass | Long straights, wide sweepers, 1-2 canyons with causeways, a dry-lake flat | Mesas (terraced terrain), a rock arch over the road, water tower, wind pump, a salt flat as a speed and drift pad |
| **Mountain pass** | Technical. Hairpin stacks on both flanks, crests, drops, guard rails, punishing mistakes | asphalt 1, gravel run-off 0.8, rock; snow above the line | Circuit over a saddle: one stack up, one down. Point-to-point "touge" up and down routes | Summit hut or mast at the saddle, tunnel-look rock cut, avalanche gallery look (mesh only), rails on every stack |
| **Test track** | Clean, repeatable. Corners you learn, kerbs, run-off, the place for handling work | asphalt 1, kerb, run-off grass 0.72, gravel trap 0.6 | Planned circuit from `sky_layout` pieces on flat ground, plus an infield: skidpad, 400 m drag strip, gymkhana pad | Pit building, grandstand, control tower, tyre walls (solids) |
| **City** | Slow and tight. 90° corners, junctions, curbs, short straights, street races | asphalt 1, sidewalk (curb), park grass | Dense grid, one main street, a ring road as the circuit, junction patches everywhere | Tall blocks, a square, a tower, a park, parking garages (gymkhana and parking sites) |
| **Giant room** | Toy scale: the car is a toy in a 1:40 room. Under the bed, up a book ramp, along a toy track on the table, jumps off the sofa | wood floor 1, rug 0.8 (*est.*), toy track deck 1 | A sky-style deck (toy track) that starts on the floor and climbs onto furniture. Free roam on the floor | Bed (drive under it), table, sofa, bookshelf, lamp, toy blocks as items |
| **Snow** (season option) | Low grip everywhere, long slides, braking zones double | packed-snow road 0.75, snow field 0.55, ice patches 0.4 (*est.*) | Same as the base kind | Snow ground, snowy pines, a frozen lake (ice) on the island |
| **Mainland** (`road-network.md` 3a) | Travel: 6×6 km of highways and towns | as island | RNG network, graph cycles | Per region |

### What the generator needs, and what is reused

`R` = reuse as is, `P` = reuse with a parameter, `N` = new code.

| Kind | Terrain shape | Biome params | Road network rules | Towns and landmarks | Props | Sky and lighting |
|---|---|---|---|---|---|---|
| **Desert** | P `raw_height` (`terrain.ts:27-38`): a ridged dune term plus terraced mesas (`floor(h / step) * step` blended near edges; bit-exact ops only). The island mask stays: the sea becomes a sand sea, and the edge is a dune wall *est.*. R `plan_canyon` / `carve` (`canyon.ts:103,125`), run 1-2 times | P `RULES` / `ITEM_OF` (`biomes.ts:31-57`): biomes erg, reg (gravel plain), mesa, oasis. N `Ground` rows SAND/DUNE already exist (`chunks.ts:16,68-73`) | P `loop_path` (`path.ts:348`): fewer, wider controls (`RADIUS_SPAN` `path.ts:9` down), `STACKS` (`path.ts:26`) `[]`. R spurs and links | P `place_towns` (`towns.ts:6-7`): 1-3 hamlets. N props `WATER_TOWER`, `WIND_PUMP`. R `ARCH` | R `JumpPlanner.hills()` (`jumps.ts:574`) on dune crests. P items rock/barrel | N `WorldDef.mood`: higher `sun_y`, warm haze, `fog_near` lower. No water plane (`worlds/island.ts:16` dress) |
| **Mountain pass** | P `raw_height`: a ridge band across the square instead of a radial peak (`PEAK_*` `terrain.ts:5-7`), with a saddle at a seeded point. Snow line R (`chunks.ts:90`, y > 165) | P `RULES`: forest low, upland and rock high | P `loop_path`: a saddle attractor (beside the summit attractor, `path.ts:21-24`) and **two** stack sites. R `switchback.ts`, `guard_rails` (`index.ts:199`), `limit_grade`, crest easing (`path.ts:54-62`). N route ids `pass-up` / `pass-down` (open `Route`, `types.ts:272`) | R mast, turbines. N `HUT` prop. Towns: 1-2 valley villages | R | P mood: cooler, fog closer at height (optional) |
| **Test track** | P `raw_height`: flat, low-amplitude noise (≤ 2 m), no peak, mask at 960 | P one biome: mown grass, few trees, edges only | N lay `sky_layout` (`sky.ts:747`) pieces on the ground: take `samples` x/z, ignore the profile, Y = ground. Stamp it as ring edge 0 (`index.ts:57-61` pattern). R `road_layers`, trackside kerbs (`car/trackside.ts`). Bounds: `BOUND` 880 (`sky.ts:15`) fits 2 km | N infield `Lots`: skidpad circle, drag strip edge, gymkhana pad as an `empty` lot (`lots.ts`). N `PIT`, `TOWER`, `GRANDSTAND` props | P items: tyre walls as barrier rows (`ITEMS.barrier`, `index.ts:201`) | R day or dusk per theme |
| **City** | P flat-ish, low relief, coast on one side (reuse the bays from `world.md` §4) | P parks only | P `town_streets` (`towns.ts:118`) at radius 600-800 m, variable block size (`BLOCK_MIN`/`BLOCK_SPAN` `towns.ts:14-15`), main street axis. R junction patches (`junction.ts`), `link_towns`. Circuit = ring road around the grid (`loop_path` with `LOOP_RADIUS` ≈ the city radius) | P `Lots`: taller buildings (`Building.height`), shop frontage (`chunks.ts:197`). N `TOWER` landmark | R street lights (`PropKind.STREET_LIGHT`), parking | R |
| **Giant room** | N flat floor at y 0 (constant heights; terrain mesh can be half-res everywhere). Walls = box solids at the room edge | N one "floor" biome, rug patches through the `surface` grid (`types.ts:61`) | N/P the sky deck (`generate_sky` `sky.ts:852`) with `Y_MIN` 0 and heights in furniture tiers (floor 0, bed ~20 m, table ~30 m at 1:40). R `deck_layers` (`sky-mesh.ts`), `DeckIndex` (`deck.ts`), pads and gaps. `World.height` already takes the max of terrain, ramp and deck (`world.ts:243-249`) | N furniture meshes (like `landmark-mesh.ts`, ≤ 400 tris each). Bed = box solid with `bottom` (drive under it, `types.ts:288-294`). Books = R `RampKind.KICKER` | R items (cone, barrel) as toy blocks; N `BLOCK` item | N backdrop: indoor. No sun disc, no ring clouds (`main.ts:82` adds `sky()` and `clouds()` unconditionally). A lamp as key light |
| **Snow** (option) | R base kind | P `RULES`: pines up, broadleaf down. N `Ground` rows SNOW_FIELD, ICE (token mixes only) | R | R | R | P mood: brighter hemisphere ground, fog closer. Snowfall particles: no (cost) |

### Streamed or compact, and phone cost

Island phone baseline: 718-799k tris for 64 chunks, against a 300k mobile budget (`architecture.md:75`). The island is already over budget and survives through `MOBILE_FAR` / `MOBILE_TREES` culling.

| Kind | Shape | Why | Phone cost vs island *est.* |
|---|---|---|---|
| Desert | **Compact 2 km** | Same pipeline as the island. A bigger desert is a mainland region later | Lower: 30-50% fewer trees; terrain the same. ≈ 0.9× |
| Mountain pass | **Compact first**, then a **streamed corridor** (≈ 2×8 km) after mainland | The compact loop over a saddle fits in 2 km. A real 10 km pass needs `plan`/`tile` | Compact: ≈ 1.0× (more road mesh in stacks, fewer towns). Corridor: like mainland, with a resident set of ≈ 44 chunks on mobile |
| Test track | **Compact** | Fixed venue; 2 km is plenty | Lowest of the terrain kinds: flat ground, few trees, no towns. ≈ 0.6× |
| City | **Compact**; its generator becomes the mainland city tier | Dense buildings cost more than size does | Highest: buildings ≈ 2k tris today, ×20-40 for a city ≈ 40-80k tris, glass draws in most chunks. ≈ 1.2× tris, +1-2 draws per chunk. The `big` split (`chunks.ts:57`) carries the far LOD |
| Giant room | **Compact** (≈ 400×320 m room in the 2 km square) | Indoors; no horizon | Lowest overall: floor at half res, deck ≈ sky's, furniture ≤ 10k tris. ≈ 0.3× |
| Snow | Option on island, pass and mainland | n/a | Same as its base kind |

## 2. A WorldKind as data

### Target shape

Two halves stay as they are today (worker `KindDef` in `kinds/`, UI `WorldDef` in `worlds/`). They gain fields, so a new kind on an existing pipeline is one recipe object plus copy and images.

```ts
// worldgen/kinds/kinds.ts (worker)
interface KindDef {
  kind: WorldKind;
  /** id = base + version; key = `${seed}:${tag}${version}` (+ option suffix). */
  base: number;
  tag: string;
  version: number;
  pipeline: "land" | "deck" | "room";
  recipe: Recipe;              // only read by the pipeline it names
  options: readonly OptionDef[];
  open_ground: boolean;
  rails: boolean;
  /** Terrain mesh and terrain map raster; false = deck only (sky). */
  ground: boolean;
  /** Falling under the deck resets the car (sky); false = land on the floor (room). */
  fall_reset: boolean;
  grip: GripTable;             // { road, shoulder, dirt, ground, extra?: Record<Surface, number> }
}

interface Recipe {
  terrain: { mask: number; peak: PeakShape | null; ridge: number; terrace: number; amp: number };
  biomes: { rules: Record<Biome, TreeRule>; items: Record<Biome, ItemKind | null>; ground: Record<Biome, [Ground, Ground]> };
  road: { loop: LoopShape; stacks: readonly number[]; canyons: number; kickers: number };
  towns: { min: number; max: number; radius: [number, number]; block: [number, number] };
  landmarks: readonly PropKind[];
}
```

```ts
// worlds/world-def.ts (UI)
interface WorldDef {
  /* … today's fields … */
  mood: Partial<MoodSpec>;          // merged over the theme's DUSK/DAY (lighting.ts:28-56)
  backdrop: "sky" | "indoor";       // main.ts:82 adds sky()+clouds() only for "sky"
}
```

Rules for K0:

- The island recipe holds exactly today's constants. `bun scripts/gen.ts` `world_checksum`, the colour checksum and the `build_chunks` hash stay identical over seeds 0-9 for island and sky (`worldgen/AGENTS.md`). `kinds.test.ts:5-11` keeps passing unchanged (ids 5 and 1003, keys `42:w5` and `42:sky3`).
- Recipes are module constants, not loose knobs: a recipe is part of a kind's version. Changing a recipe value bumps that kind's `version`.
- Grip goes on the kind, not on the car. `car.ts:543` already consumes a scalar `ground.grip()`, so cars stay untouched.
- The world map backdrop follows `ground`: false → `cloud_pixels`. The terrain LUT rows are main-thread tones, so new `Ground` rows are token mixes in `palette.ts`, never hex (`AGENTS.md` Rules).

### Leftover branches that block "a kind is data"

| Where | What | Fix |
|---|---|---|
| `worldgen/chunks.ts:252` | `if (data.kind === "sky") return sky_chunks(…)` | Build by data: terrain if `ground`; road layers if the graph has edges; deck layers if `data.deck` (today only inside `sky_chunks`, `chunks.ts:239`). The room needs terrain **and** deck, so the branch can't just stay. |
| `worldgen/map.ts:85` | `if (data.kind === "sky") return cloud_pixels(…)` | `ground` false → clouds. The room uses the floor raster. |
| `worldgen/map.ts:133` | `size: SIZE` | From the kind once `SIZE` moves off module scope (`road-network.md` 3a) |
| `worldgen/sky.ts:950-955` | Sky allocates a full (N+1)² `ABYSS` grid | Fine for now; drops out with tiles |
| `worldgen/index.ts:219`, `sky.ts:953` | Literal `kind: "island"` / `"sky"` | Pass the kind in, so one pipeline serves several kinds |
| `worldgen/kinds/island.ts:7-8`, `kinds/sky.ts:8-9` | `id` and `key` written by hand per kind | Derive from `base`/`tag`/`version` (same values) |
| `worldgen/types.ts:19,22` | `WORLD_VERSION`, `SKY_VERSION` as separate exports | Become each def's `version`; keep the exports as aliases while other files import them |
| `world/world.ts:272-275` | `fallen()` = any deck present | `fall_reset` |
| `world/world.ts:45, 288-295` | Grip and roll constants global | `KINDS[kind].grip` |
| `render/effects.ts:70, 81, 174`; `main.ts:464` | `grip >= 1` used as "on asphalt" | Ask `world.on_road(x, z)` (distance to road), not the grip value. **Must land before any kind with road grip < 1.** |
| `render/lighting.ts:64, 71` | Mood by theme only; fog far fixed at 1300 | Merge `WorldDef.mood` over the theme spec |
| `main.ts:82` | `sky()` and `clouds()` always added | `backdrop` |
| `render/scene.ts:258` | Water plane `SIZE * 4` | Already per kind via `dress` (`worlds/island.ts:16`). Fine. |
| `menu/menu.css:277, 499-500, 597, 636` | Play grid names `island` and `sky` areas | One `worlds` area holding all world tiles as a sub-grid, so a new kind adds no CSS. Layout stays CSS-only. |
| `modes/modes.ts:28` | `SKY_NOTICE` copy says "drive the island" | Copy from the kind (any `open_ground` kind) |
| `goals/catch-up.ts:39, 57`; `menu/settings.ts:429` | Sky goal and its `:sky` key mark | Legit: the goal is *about* the sky. Leave it. A per-kind "drive X" goal would be data on `WorldDef` if wanted. |
| `modes/track.ts:114`, `net/directory.ts:124`, `world/world-pick.ts:30` | Default kind is the island | Back-compat defaults. Leave them. |

## 3. Map options for players

### Knobs

Each knob has 3 levels (`less` / `default` / `more`, or off / on where it is a switch). Discrete levels keep map codes short, shareable and testable. Every knob maps to a constant that exists today.

| Kind | Knob | Drives | Levels |
|---|---|---|---|
| Island | Length | `LOOP_RADIUS`, `LOOP_SWING`, `LOOP_MIN/MAX` (`path.ts:11-14`) | short / default / long |
| Island | Twist | `RADIUS_SPAN` (`path.ts:9`) plus the control count | smooth / default / twisty |
| Island | Hairpins | `STACKS` (`path.ts:26`): `[]` / `[4, 2]` / `[6, 4]` | none / default / more |
| Island | Jumps | `MAX_ROAD_KICKERS`, `MAX_KICKERS`, `MAX_BIG` (`jumps.ts:287-290`) | few / default / many |
| Island | Canyon | `plan_canyon` on or off (`index.ts:52`) | off / on |
| Island | Towns | `TOWN_MIN/MAX` (`towns.ts:6-7`) | few / default / many |
| Island, pass, mainland | Season | grip table, ground rows, tree rule, mood | summer / snow |
| Sky | Open sections | `OPEN_SHARE` (`sky.ts:62`) | railed / default / exposed |
| Sky | Gaps | `MAX_JUMPS` (`sky.ts:60`) | 0 / default / more |
| Sky | Pads | `MAX_PADS` (`sky.ts:85`) | 0 / default / more |
| Sky | Twist | `HAIRPIN_ODDS`, `HELIX_ODDS`, `EIGHT_ODDS` (`sky.ts:25-28`) | flowing / default / wild |
| Sky | Length | Length window 2400-5200 (`sky.ts:753`) | short / default / long |
| Desert | Canyons, jumps, length | as island | as island |
| Test track | Layout length, twist | as sky length and twist | |
| Room | Track length, gaps | as sky | |

Not knobs: towns on the city (that *is* the city), terrain amplitude (it breaks the grade and stack rules in ways the retry loops can't promise to fix).

### Keys, ids and peers

| Thing | Rule |
|---|---|
| Option code | One base-36 character per knob in `options` order, for example `h2j0`. All defaults → empty code. |
| Saved records | `key(seed, opts)` = today's key + `:` + code when the code is non-empty. Default maps keep `42:w5`, so no save resets. |
| Version | A kind's `version` covers all its option levels. Changing what a level *means* bumps the version and resets every variant of that kind, as today. Adding a new knob whose default equals today's behaviour needs no bump. |
| Peers | `w` = `id + (code_number << 16)`. `w` is a u32 in the car packet (`car-packet.ts:52,67`) and checked in hello (`net.ts:214`, `uint(h.world, MAX_SEED)`). A different `w` is already a foreign map (`net.ts:491-492`). `kind_of_world` masks with `& 0xffff`. **No `PROTOCOL` bump, no new wire field.** Old builds show the room as Island (same as for sky today, `kinds.ts:33-35`) and see its cars as foreign. |
| URL | `?seed=42&world=island&opts=h2j0`. `world_query` (`world-pick.ts:29-31`) adds `opts` only when it is non-empty. `pick_world` parses it and falls back to defaults on anything invalid. |
| Prefs | `last_opts` beside `last_world` / `last_seed` (`menu/prefs.ts` `FIELDS`) |
| Lobby | Route ids stay per seed *and* variant. They come from the generated `routes`, so `sanitize_event` already checks against the variant's own list. |
| UI | Toggles on the World page (`menu/world-page.ts`) under the map preview. The preview regenerates the whole world (`map-worker.ts:11-14`, 0.3-0.9 s), so debounce the toggles. |

Test cost: knobs multiply combinations. The gate is each knob at each level with the others at default, over seeds 0-9 (`scripts/seeds.ts`, `races.ts`, `sky-seeds.ts`), plus 20 random combinations. A combination the retry loop can't satisfy must degrade (fewer hairpins than asked), not throw. The sky's fallback (`sky.ts:784-785`) would otherwise hand many seeds the *same* track. Facts on the World page show what was actually built.

## 4. Order and how it interleaves with streaming

Streaming phases from `road-network.md` §4: 2a tile runtime, 2b persistent worker plus chunk requests, 2c `plan`/`tile` split, 3a mainland, 3b mainland modes, 4 at 10×10 km.

| # | Step | Size | Depends on | Runs alongside | Bump |
|---|---|---|---|---|---|
| K0 | **Kind as data**: `base`/`tag`/`version`, island `Recipe`, `ground`/`fall_reset`/`grip`/`backdrop`/`mood`, chunks and map branches by data, the `on_road` fix, Play `worlds` area | M | none | 2a (2a is `world/` + `render/`; K0 is `worldgen/kinds`, `index.ts` params, `chunks.ts:252`, `map.ts:85`). Agree on `world.ts`: both touch it | none (checksums identical) |
| K1 | **Desert** | M | K0 | 2a / 2b | new kind |
| K2 | **Map options** on island and sky, with key, `w` and URL plumbing | M | K0 | 2b | none for defaults |
| K3 | **Test track** | S-M | K0 | 2b | new kind |
| K4 | **Mountain pass**, compact | M | K0 (K2 shares the stack knob) | 2b / 2c | new kind |
| K5 | **Snow season** option (island, pass) | S-M | K0, K2 | 2c | none for defaults |
| K6 | **Giant room** | L | K0 (data-driven chunks are needed for terrain plus deck) | 2c | new kind |
| K7 | **City**, compact | L | K0 | 2c / 3a | new kind |
| 3a | **Mainland**, using the desert, pass and city recipes as region recipes | | 2c, K7 | | new kind |
| K8 | **Streamed pass corridor** (≈ 2×8 km) | M | 3a | after 3a | the pass gets a new version or a separate `pass-long` kind |

Why this order:

- **K0 first:** after it, each kind costs one recipe. Before it, each kind costs another branch in shared files.
- **Desert before pass:** desert is almost pure recipe (terrain plus biome plus grip plus mood). That makes it the cleanest proof that K0 works. The pass needs new road rules (a saddle attractor, two stacks).
- **Options early:** the knobs already exist as constants. They give the most variety per line of code, and the island is the most-played map.
- **Test track before room and city:** cheap, and it gives `handling.md` work a repeatable venue.
- **Room and city later:** the room is the most new code (furniture meshes, indoor backdrop, deck on a floor). The city's generator is also the mainland's city tier (`road-network.md` Q10), so it should land just before 3a.
- **None of K1-K7 waits on 2c,** because compact kinds stay monolithic. The cost: 2a/2b must slice *every* compact kind's grids, and that is generic already.

## 5. Open questions for the owner

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Snow: a kind or a season option? | (a) `snow` kind. (b) `season` knob on island, pass and mainland | **(b)**: one knob covers three maps. Its records are keyed apart through the option code. |
| 2 | Which kind first after K0? | Desert / mountain pass / giant room | **Desert**: least new code, proves the recipe. The room is the biggest "wow" but also the biggest build. |
| 3 | Mountain pass: compact loop now, or wait for a streamed corridor? | Compact over a saddle now / corridor after mainland only / both | **Both**: compact now (2 km, loop over the saddle, up and down routes), corridor after 3a. |
| 4 | How many knob levels? | Free sliders / 3 levels / on-off only | **3 levels**: short codes, a testable matrix, map codes friends can type |
| 5 | Options encoding for peers | High bits of `w` / new optional `opts` field plus `PROTOCOL` bump | **High bits of `w`**: no wire change. Old peers already treat it as a foreign map. |
| 6 | Play grid with 6-8 worlds | One `worlds` area (sub-grid, scrolls on phone) / a picker page only | **One `worlds` area** on Play showing the last 3 driven, plus the full list on the World page |
| 7 | Giant room scale | 1:24 / 1:40 / 1:64 | **1:40** (room ≈ 400×320 m): a bed is about 20 m tall to drive under; the room fits a 2-3 km toy track |
| 8 | Test track: also the home of `scripts/telemetry.ts` and `feel.ts`? | Yes / keep scripts on synthetic ground | **No for now**: the scripts' synthetic ground is bit-exact and byte-checked. The track is for the player. |
| 9 | City as its own kind, or only inside mainland? | Kind / mainland region only | **Kind first**: a compact place to tune dense towns before 3a. It is reused as the mainland city tier. |
| 10 | Kind moods override the theme's dusk/day? | Per-kind full mood / deltas over the theme | **Deltas** (`fog_near`, `sun_y`, hemisphere ground token). Themes stay the owner's main look control (`art-direction.md`). |
| 11 | Should recipe changes on the island reset records? | Yes, via version bump / never touch the island recipe | **Bump as today**: K0 itself changes nothing. Later island tuning bumps `WORLD_VERSION` as `AGENTS.md` already says. |

## Not checked

- Every cost marked *est.* Nothing was generated for desert, pass, track, room or city.
- Grip values for sand, snow, ice and rug. Calibrate them with `scripts/surfaces.ts` and `offroad.ts` before shipping.
- Whether `sky_layout` pieces on flat ground give a good test track without the sky's crossover zones. Crossovers need clearance (`sky.ts:19`), which ground can't give, so the track would reject layouts with zones, and that may cost many attempts.
- Whether `w` with high bits survives every path that reads it: directory announce, `kind_of_world`, and `sanitize_hello`'s `uint` check up to `MAX_SEED`. The bits fit in a u32 on paper.
- Room deck plus floor collisions: the deck's underside test (`world.ts:242`, `y` argument) when a car drives under a toy-track section. Run `crash.ts` on it.
