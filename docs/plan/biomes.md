# Biomes and the Create-world page

Round 1, 2026-11-10, at `28f3b04` (K2 map options landed; mainland tiles in flight in the working tree). Plan only, no code. Owner feedback (11-10): "dunes and main island are very similar". Owner wants Minecraft-style world creation: pick the biome and other settings.

Owner decisions this plan builds on:

1. Settings travel as a shareable **map code string**: a new optional field on `hello` / directory announce; `w` carries a hash of it so the different-map check stays one integer compare; records are keyed by the code.
2. **Distinct biomes first**, then the Create-world page.
3. The 6×6 km mainland becomes **the main world** (regions of different biomes over time). The 2 km worlds become **Mini maps**.
4. Snow both ways: a **tundra biome** of its own and a **winter season** over other biomes (§1.3).
5. Players can tune a biome themselves with sliders (§3.3).

Nothing here is measured. Costs marked *est.* scale from `road-network.md` §1 (island gen 307-905 ms, terrain stage 183 ms, 718-799k tris). File:line refs are at `28f3b04`; `biomes.ts` refs include the uncommitted `plant_at` split in the working tree.

## TL;DR

- **Why desert reads like the island:** both run the same `raw_height` (`terrain.ts:25-38`): radial mask, one seeded peak, 520 m fbm hills, 300 m ridges. Desert only adds a 6 m dune term and terraces (`recipe.ts:101-129`). Same `loop_road`, same canyon, same town grid, same four biome slots cut at thirds (`biomes.ts:59-94`), same 3 tree kinds, same snow line at 165 m (`chunks.ts:79`), and only two surfaces under the wheels (`GRASS`/`DIRT`, `world.ts:318,326-330`). Colour and props changed; shape, water, road and town style did not.
- **Fix: a biome is a recipe of composable parts, not a colour swap.** Terrain = an ordered list of **point layers** (pure `f(x, z, seed)`, tile-safe) plus **planned features** (lakes, rivers, washes, cliffs, snowbanks) that run on the coarse plan grid and replay as `GroundOp`s, exactly like today's plateaus and road edges (`mainland.ts:39-45`). Plus surface rules (with grip per surface), scatter rules, a tree palette, a road style, a town style and a mood delta. All data, no `if (biome === …)`.
- **Six biomes:** Temperate (today's island, kept as "Classic"), Dune sea, Canyonlands, Alpine, Tundra, Tropical coast. Each differs to *drive* (grip, relief, road shape) and to *see* (silhouette, density, water, light), not just in tint.
- **Snow:** one shared snow kit (SNOW/ICE/SLUSH surfaces + grip rows, frozen-lake op, snowbank op, snowy tree tint, winter mood). Tundra = its own terrain + the kit always on. **Season** = a separate setting that applies the kit to any biome. Two settings, one data set.
- **Map code v1:** Crockford base32, case-insensitive, `1D04K7ZQ3` (9 chars) for a preset + seed, plus 2 chars per changed setting: `1D04K7ZQ3-HPTG`. Field letters are append-only, so old codes always parse. `w` = kind id in the low 16 bits (old builds still read the kind) + a 15-bit hash of the canonical code above it.
- **Order:** B0 terrain layers (identical goldens) → B1 surfaces + grip per surface (identical) → B2 Dune sea → B3 Alpine → B4 water (lakes, then rivers) → B5 snow kit (Tundra + winter) → B6 map code + Create-world page → B7 Canyonlands, Tropical → B8 mainland regions.

## 1. What makes each biome different

### 1.1 What the generator can and cannot vary today

| Part | Today | Data or hard-coded | Blocks a distinct biome? |
|---|---|---|---|
| Height | `raw_height` `terrain.ts:25-38`: mask + `fbm/520` hills (`** 1.75` via sqrt) + ridged `fbm/300` + one peak bump + optional `terraced` + optional `dunes` | Amplitudes are recipe (`recipe.ts:4-17`); every noise scale, the radial mask, the single peak and the `5 +` floor are code | **Yes**: every map is "a round island with one mountain" |
| Water | Only the sea: terrain below 0 under the scene's water plane (`worlds/*.ts` `dress`) | Code | Yes: no rivers or lakes |
| Biome field | 4 fixed slots (coast, meadow, forest, upland), cut at thirds of one fbm score + height (`biomes.ts:51-100`) | Slot names are code; the recipe only relabels what each slot plants and paints | Partly: desert reuses "forest" as "dune" |
| Ground colour | `Ground` rows `types.ts:21` (7 rows); rock above 120/135 m and on slopes, snow above 165 m (`chunks.ts:77-80`) | Thresholds are code | Yes for alpine / tundra |
| Surface under wheels | `surface` grid is GRASS or DIRT (`types.ts:65`); grip is 5 numbers per kind (`kind-def.ts:4-13,55,61`, `world.ts:326-330`) | Kind data | **Yes**: snow, ice, loose sand vs hardpack vs rock all collapse into `ground` |
| Trees | 3 kinds (pine, broadleaf, scrub) by `TreeRule` per slot; height window 3-125 m (`biomes.ts:15,180`) | Rule is recipe, window is code | Partly |
| Props | `ScatterRule` per biome slot (`recipe.ts:27-33`, `scatter.ts:88`); kinds cactus, boulder, spire, tank (`types.ts:154-164`, meshes `landmark-mesh.ts:152-185`) | Data | No: the pattern is right, it needs more kinds |
| Road | `RoadRecipe`: loop radius/swing, stacks, canyon, kickers (`recipe.ts:41-49`) | Data | Partly: no "long straights", no two-flank stacks, no coast hugging |
| Towns | `TownRecipe` count, block size, trees-or-tanks (`recipe.ts:51-58`); always a grid (`towns.ts:116`) | Data, layout code | Yes for villages and outposts |
| Landmarks | List of 4 (`recipe.ts:60-61`, `index.ts:37-42`) | Data | No |
| Light | `WorldDef.mood` delta over the theme (`worlds/world-def.ts:29`, `worlds/desert.ts:17`) | Data | No |

### 1.2 The six biomes

Grip numbers are *est.*: calibrate with `scripts/surfaces.ts` / `offroad.ts` before shipping. Today: asphalt 1, island grass 0.72, sand 0.74 with roll ×24 (`kind-def.ts:55,61`).

| | **Temperate** ("Classic island") | **Dune sea** | **Canyonlands** | **Alpine** | **Tundra** | **Tropical coast** |
|---|---|---|---|---|---|---|
| **Drive** | Mixed: circuit, towns, trails, summit stack | Fast and open: long straights, big sweepers, dune jumps, sliding on loose sand, quick on hardpack pans | Technical rhythm: terrace drops, wash floors, rim roads with sheer edges, arch run-throughs | Climb and descend: hairpin stacks on both flanks, crests, cliffs you can fall off, rails | Low grip everywhere: long braking, slides, frozen lake as a drift pad, snowbanks as soft walls | Coast road hugging beaches, tight jungle roads with no sightlines, beach run-off |
| **See** | Rolling green, forests with edges, sea all round | Wind-aligned crest lines to the horizon, slip faces, pale pans | Flat-topped mesas, layered red bands, hoodoos, arches, dry washes | Saw-tooth ridges, snow caps, valley floors, pines to a tree line | White flats, blue ice, dark pine bands, low sun | Turquoise shallows, white beaches, dense palms, green hills |
| **Terrain layers** | Today's: mask, peak, hills, ridge | Mask (dune wall edge, `recipe.ts:104`); low base fbm; **dune layer**: crests along a seeded wind heading (one of 16 exact headings, `noise.ts` `circle16`), asymmetric (gentle windward, steep lee), 2 wavelengths (big draa 600 m, small 120 m); **pan** layer: flatten basins under a level | Mask; plateau fbm; **terrace** with steep risers (`terraced`, `terrain.ts:41`) at 2-3 step heights; **warp** so rims meander | **Ridge band**: ridged noise along a seeded axis with a saddle; **valley** layer: `abs()` fold on a low fbm, carving V-valleys; terrace at the tree line for ledges | Very low relief fbm (≤ 15 m), wide basins, a few drumlin bumps (stretched fbm) | Mask with a long shallow shelf (beaches 40-80 m wide); volcanic peak (today's peak, steeper); low hills |
| **Planned features** | (today) canyon | **Dry washes**: `plan_canyon` + `carve` (`canyon.ts:103,125`) reused shallow and wide, 2-3 per map | Washes deeper with flat floors; arch over road (exists, `Landmark.ARCH`) | Cliffs (terrace op on the plan grid), passes | **Frozen lakes** (lake op, ICE surface), snowbanks along roads | **Lagoons** (lake op connected to sea), river mouths |
| **Water** | Sea | None (no water plane) | Rare pothole pools, else none | Lakes in valleys, a river down the main valley | Frozen lakes; sea frozen at the shore (ice shelf) | Sea, lagoons, rivers to the coast |
| **Vegetation** | Today's rules | None; scrub at pan edges | Sparse juniper (scrub), cactus | Pines dense low, thinning to tree line ~110 m; rock above | Pine bands only in sheltered low ground, snowy tint | Palms (new tree kind), broadleaf jungle at 2× density, scrub on dunes |
| **Props** | Logs, hay, rocks | Boulders rare, half-buried tanks, wind pump (new) | Spires/hoodoos (exist), boulders, balanced rocks (new mesh) | Boulders, scree, avalanche fences (new, solid row) | Snow-capped boulders, marker poles (new, cheap) | Rocks on beaches, beach huts (new), driftwood (log item) |
| **Surfaces** (grip *est.*) | grass 0.72, dirt 0.88 | loose sand 0.70 roll ×28; **pan hardpack 0.92 roll ×1** (new surface written by the pan layer) | slickrock 0.95 (rock surface), sand in washes 0.72 | grass 0.72, gravel shoulder 0.8, rock 0.9, snow above line 0.55 | snow 0.55, **ice 0.35**, packed-snow road 0.8 | beach sand 0.74, mud in jungle 0.6 roll ×20, grass 0.72 |
| **Road style** | Loop + summit stack + town spurs | Few loop controls, high radius (long straights), no stacks, causeway across pans | Rim-and-floor: loop climbs terraces via short stacks, crosses washes on fords | **Two stacks** (both flanks of the saddle), rails on every stack (`guard_rails`, `index.ts:206`), loop over the pass | Wide loop, gentle; snowbank berms both sides | Coast road: loop radius near the mask so it runs on the shelf; inland jungle spurs |
| **Town style** | Grid, gabled, gardens (today) | **Adobe outposts**: 1-3, tiny blocks (`block` 35/15 exists), flat roofs (`Roof.FLAT`), water tanks (exists) | Outposts on mesa tops or wash junctions | **Mountain villages**: strip along the road (new `layout: "strip"`), steep gable roofs | Cabins: 2-4 loose buildings, no grid | Beach villages: strip along the coast road, hip roofs, stilts *later* |
| **Mood delta** | Theme as is | Warm haze, `hemi_ground` dirt (exists) | Warm, longer shadows (lower `sun_y`), red bounce | Cool, fog pulled in at height *later* | Bright `hemi_ground`, cool fog near, low sun | Saturated, high sun, light haze |
| **Reuse** | Everything | `dunes()` `terrain.ts:48`, `canyon.ts`, `JumpPlanner.hills()` on crests, cactus/boulder/tank, `SAND_GRIP`, desert mood | `terraced` `terrain.ts:41`, spire, arch, canyon | `switchback.ts`, `guard_rails`, `limit_grade`, `paint` rock/snow rows | Pines, kit from §1.3 | Sea, beach `Ground.SAND` under 2.2 m (`chunks.ts:77`), lighthouse |
| **New** | none | Dune layer v2 (heading, asymmetry, 2 bands), pan layer, HARDPACK surface, wind pump | Warp layer, balanced rock mesh | Ridge-band layer, valley layer, saddle + second stack in `loop_road`, strip towns, avalanche fence | Snow kit, lake op | Palm tree kind, shelf mask, lagoon, beach hut, coast-road loop rule |
| **Gen cost** *est.* | 307-905 ms (today) | +30-60 ms (2 extra fbm per vertex) | +20-40 ms | +40-80 ms terrain, stack planning ~2× today's | ≈ today (cheap terrain, lake op ~10 ms) | +10-20 ms; tree planting ×2 attempts in jungle (+40 ms) |
| **Tris / phone** *est.* | 718-799k (today); survives on `MOBILE_FAR`/`MOBILE_TREES` (`scene.ts:19-20`) | 0.6-0.7×: few trees | 0.8× | 1.0-1.1×: more road mesh in two stacks, rails | 0.8× | **1.3×**: jungle density; needs `MOBILE_TREES` lower for this biome (tree budget as recipe data) |

### 1.3 Snow: one kit, two settings

| Piece | Shared kit (one module, data) | Tundra biome | Winter season over another biome |
|---|---|---|---|
| Surfaces | `SNOW`, `PACKED_SNOW`, `ICE`, `SLUSH` ground rows + grip rows | Always on: ground = snow, roads = packed snow | Grass/dry/forest/upland rows → SNOW; sand rows → SLUSH (beach); roads → packed snow |
| Grip | `WINTER_GRIP` per surface (snow 0.55, ice 0.35, packed 0.8) | Its grip | Replaces the biome's grip rows for the mapped surfaces |
| Water | Lake op takes `frozen: true` → ICE surface, no water mesh, drivable | All lakes frozen. Built apart: frozen lakes come from their own hollow-disc planner and `ice` ground op (`ice.ts`), because the water basin planner (`water.ts` priority flood) sees tundra, ringed by its mask hills, as one map-wide bowl (1 basin on seeds 0-9) | All lakes and rivers frozen; the sea stays water |
| Road edges | Snowbank op: raise the strip past the shoulder 0.6-1 m as a terrain stamp (so collision is free), white paint | On | On |
| Trees | Snowy tint per tree kind (vertex colour LUT row), broadleaf → bare-branch variant *later* | Pines only | Same tree positions, tinted |
| Snow line | Recipe `snow_line` (today hard 165 m, `chunks.ts:79`) | 0 | 0 (all snow) |
| Mood | Winter delta: bright hemi ground, cool fog | On | On |
| Geometry | — | Its own terrain layers | **Unchanged except snowbanks**: same seed, same roads, towns, trails; lap lines stay comparable |

Recommendation: **two settings, one kit.** `biome` picks the land; `season` (summer / winter, autumn later) applies the kit. Tundra is always winter and has no Season row at all (built that way in B5, accepted over a greyed-out row). Winter is part of the map code and the records key: grip changes lap times. Why not make winter a biome: it would have to copy every biome's terrain to exist in winter, the opposite of data over branches. Why not make tundra "temperate + winter": the owner wants flats and frozen lakes, which is a different terrain, not a different tint.

## 2. Generator architecture

### 2.1 Biome as data

```ts
// worldgen/biome-def.ts (worker side)
interface BiomeDef {
  id: BiomeId;                 // "temperate" | "dunes" | "canyon" | "alpine" | "tundra" | "tropical"
  tag: string;                 // record key part, never reused
  version: number;             // bump when this biome builds a different world for a seed
  terrain: readonly TerrainLayer[];   // point layers, in order
  features: readonly FeatureRule[];   // planned on the plan grid, replayed as GroundOps
  zones: ZoneRecipe;           // replaces the 4 fixed slots: N named zones from a score field
  surfaces: Record<ZoneId, SurfaceRule>;   // ground row + grip surface per zone (today's GroundRule + `harden`)
  trees: Record<ZoneId, TreeRule>;
  scatter: readonly ScatterRule[];   // as today (recipe.ts:27-33)
  items: Record<ZoneId, ItemKind | null>;
  road: RoadRecipe;            // as today + `straights`, `stacks_per_flank`, `coast_hug`
  towns: TownRecipe;           // as today + `layout: "grid" | "strip" | "loose"`, `roofs` weights
  landmarks: readonly Landmark[];
  grip: Record<Surface, { grip: number; roll: number }>;
  limits: { snow_line: number; tree_line: number; rock_slope: number };  // today's constants in chunks.ts:78-79, biomes.ts:180
  winter: boolean;             // tundra: kit always on
}
```

`Recipe` today (`recipe.ts:64-71`) already holds most of this; B0/B1 grow it, they do not replace it. The UI half (`worlds/*.ts` `mood`, `ground_puff`, `dress`) gets a per-biome table the same way.

### 2.2 Terrain layers

Two kinds of terrain work, split by whether they are tile-safe:

| Kind | Rule | Examples | Where it runs |
|---|---|---|---|
| **Point layer** | Pure `(x, z, seed, h_in) → h_out`. No neighbours, no global state. Tile-safe by construction: mainland tiles rebuild terrain from `ground.base` alone (`mainland.ts:54`, `tile-mesher.ts:43`) | `fbm(scale, amp, octaves, gain, power)`, `ridged(scale, amp, sharp)`, `peak(height, radius, reach)`, `mask(shape: island/continent/wall, radius, edge)`, `terrace(base, step, riser)`, `dunes(heading, wave, height, lee)`, `ridge_band(axis, width, saddle)`, `valley(scale, depth)`, `warp(scale, amount)` (domain warp), `pan(level)` (flatten under) | Every vertex, compact and per tile |
| **Planned feature** | Needs a neighbourhood or a path (downhill, connectivity). Planned once on the coarse plan grid (`plan-grid.ts:12`; 32 m on mainland `mainland.ts:14`, use 16 m on Mini maps), emitted as `GroundOp`s, replayed per tile in order like `plateau`/`edge`/`blend` | `lake(x, z, radius, level, frozen)`, `river(points, width, depth)`, `wash(points)` (= today's canyon carve), `cliff(polygon, drop)`, `snowbank` (rides on road edges) | Plan stage, then `build_tile` (`ground.ts`) |

Real hydraulic or thermal erosion is **out**: it is global, iterative, slow (seconds per km²) and breaks tile independence. The `valley` point layer plus planned rivers give the "eroded" read for a fraction of the cost.

`raw_height` (`terrain.ts:25-38`) becomes a fold over `recipe.terrain` layers. B0 expresses ISLAND, DESERT and MAINLAND as layer lists that reproduce today's arithmetic **in today's operation order** (`5 + hills^1.75·amp + ridge³·amp + top`, then terraced, then mask blend, then dunes): same floats, so goldens stay identical.

### 2.3 Exact math and determinism

Every peer must build the same world from the code (`index.ts:44-46`; `exact.test.ts` counts inexact `Math.*` calls per file and fails on any new one).

| Need | Exact way |
|---|---|
| Powers (sharpness, `** 1.75`) | Integer powers and nested `Math.sqrt`, as `terrain.ts:34` already does. Slider "sharpness" picks from a table of exact forms (`t`, `t·√t`, `t²`, `t²·√t`, `t³`), not a float exponent |
| Wind heading, ridge axis | One of 16 headings from `circle16()` (`noise.ts`), sqrt-built, never `sin`/`cos` |
| Exponential falloff | Polynomial bump `(1 - t)³` as `terrain.ts:33` |
| Slider → value | `lo + level * (hi - lo) / 31` with integer `level` 0-31: plain IEEE `+ - * /` |
| Randomness | `hash`/`fbm` (`noise.ts`) and `sub(seed, "<name>")` streams; a feature's stream is named by the feature, not by call order, so adding a feature never shifts another's dice |
| Region weights | `smoothstep` (exact) of distance (sqrt) to region sites |
| Float32 storage | Heights stay `Float32Array`; layers compute in f64 and store once at the end, as today |

### 2.4 Mini maps and mainland regions

| | Mini map (2 km, monolithic) | Mainland (6 km, tiled) |
|---|---|---|
| Biome | One biome, or a mix of 2-3 (option) | Regions, several biomes |
| Region field | Sites seeded on a 16 m plan grid | Sites seeded on the 32 m plan grid; region ≈ 1.5-2.5 km across *est.* |
| Height at a point | Nearest two sites `a`, `b`; `w = smoothstep(0, BLEND, d_b - d_a)`; `h = lerp(h_b, h_a, w)` where each `h` runs that biome's point layers. Inside a region (w = 1) only one stack runs | Same function, per tile; sites are plan data so every tile agrees |
| Blend width | 200 m | 300-400 m: wide enough that a dune sea fades through scrubland into meadow, not a seam |
| Ground, trees, scatter | Pick the biome per point by dithered weight (`hash(x, z) < w`), as `ground_at`'s `soft` fray already does (`biomes.ts:118`) | Same |
| Zone cuts | Today's thirds are computed over the whole map (`biome_cuts`, `plan_cuts` `biomes.ts:59-83`): fine for one biome; per region they become thirds over that region's plan cells | Per region, from the plan grid, once |
| Roads | Road recipe of the biome where the loop's centre sits | Network is global (`mainland-network.ts`); each edge takes grade and style rules from the region at its midpoint; towns take the town style of their region |
| Features | Planned once; a lake in tundra is frozen, in temperate it is water | Same |
| Cost | Borders run two stacks: ≈ +15-25% terrain time *est.* on a 2-biome mix | Per tile: ≤ 2 stacks at any point, so worst case 2× a single tile's terrain time on border tiles only |

The winter season is a global overlay on all regions; tundra regions are winter in any season.

## 3. The Create-world page

### 3.1 Settings

v1 rows, top to bottom. Each row is a field with a stable letter in the map code (§3.2).

| Row | Field | Levels | v1? | Drives |
|---|---|---|---|---|
| Preset | `P` | Classic island, Dune sea, Canyonlands, Alpine pass, Frozen lakes, Tropical coast, Sky track | yes | Fills every field below with that preset's values |
| Shape | `S` | Island / Continent (land to the edges, no sea ring) / Sky | yes (island, sky); continent with B7 | Mask layer; Sky switches the whole page to the sky's knobs (`kinds/sky.ts:5-18`) |
| Biome | `B` | One of six, or Mix (2-3 regions) | yes; Mix with B8 | `BiomeDef` |
| Season | `W` | Summer / Winter | with B5 | Snow kit |
| Hills | `H` | 0-31 | yes | Amplitude of the biome's main relief layers |
| Roughness | `R` | 0-31 | advanced | fbm gain on the relief layers |
| Ridges | `G` | 0-31 | advanced | Ridged layer amplitude / sharpness table index |
| Dunes | `D` | 0-31 | advanced, dune biomes only | Dune height and band mix |
| Water level | `L` | 0-31 | advanced | Sea level offset (shifts mask edge and land fraction) |
| Trees | `T` | 0-31 | yes | `TreeRule.fill` multiplier |
| Rocks | `K` | 0-31 | advanced | `ScatterRule.odds` multiplier |
| Snow line | `N` | 0-31 | advanced | `limits.snow_line` |
| Road length | `E` | 3 levels (K2) | yes | `loop` |
| Twist | `Q` | 3 levels (K2) | yes | `loop.swing` |
| Hairpins | `Y` | 3 levels (K2) | yes | `stacks` |
| Towns | `C` | 3 levels (K2), later 0-31 count | yes | `towns.min/max` |
| Town size | `Z` | 0-31 | advanced | `block`, radius |
| Jumps | `J` | 3 levels (K2) | yes | `kickers` |
| Canyon / washes | `X` | Off / On | yes | `road.canyon` |
| Landmarks | `M` | On / Off | later | `landmarks` |
| Time of day | — | — | later | Mood only; not in the code (it does not change the world or lap times) |

The preview map regenerates the whole world (`map-worker.ts`, 0.3-0.9 s), so sliders debounce to release, and the preview shows the facts (`facts.ts`) of what was actually built.

### 3.2 Map code string

Format v1:

```
1  D  04K7ZQ3  -  H P T G
│  │  │           └─ overrides: <field letter><value char>, sorted by letter, only where ≠ preset
│  │  └─ seed: u32 as 7 Crockford base32 chars
│  └─ preset (one char)
└─ format version (one char)
```

| Rule | Why |
|---|---|
| Crockford base32 (`0-9 A-Z` minus `I L O U`), case-insensitive, decoder maps `I/L → 1`, `O → 0`, ignores spaces and extra dashes | Typeable, readable over voice, no ambiguous glyphs |
| Plain preset + seed = 9 chars; each changed setting +2 | `1D04K7ZQ3` / `1D04K7ZQ3-HPTG` |
| Field letters are **append-only**: never reuse or renumber | Old codes parse forever |
| Value char is the level (0-31); 3-level knobs use `0/1/2` | One char per field |
| Canonical form = sorted overrides, overrides equal to the preset dropped | One map, one code; records and the hash key on the canonical form |
| Unknown field letter or format version → "made in a newer Harepin, update to drive it" | Never silently build a different map |
| Format version bumps only when the grammar changes, not when a biome's generator changes | Generator changes are the biome's `version` (records, hash), not the code |

**Legacy (K2) codes** (`42-121111`, `world-pick.ts` `map_code` at `28f3b04`) parse as: kind's preset + seed + the 6 digits mapped to `E Q Y J C X`. The URL `?seed=&world=&opts=` keeps parsing.

**Net:**

| Thing | Rule |
|---|---|
| `hello` / announce | New optional field `map: string` (canonical code), sanitized by grammar and length ≤ 64 (`net.ts:43,214`; `directory.ts:46,102`) |
| `w` (u32, `car-packet.ts:52,67`) | Plain preset that equals an existing kind's defaults: `w = kind id` (unchanged, old peers keep matching). Otherwise `w = kind_id \| (fnv1a(canonical + biome versions) & 0x7fff) << 16` |
| Different-map check | `w` differs → foreign, as today (`net.ts:491-493`). Same `w` and both sent `map` → compare strings (catches the 1/32768 hash collision) |
| Old builds | Read `w & 0xffff` as the kind (`kinds.ts:19-30`) and see a foreign map. No `PROTOCOL` bump: `map` is optional |
| `kind_of_world` | Unchanged; `opts_of_world` (K2 bit-packing) is retired: the code now travels in `map` |

**Records key:** `${seed}:${tag}${version}` (today's, `kind-def.ts:49-52`) for plain presets that equal an old kind, so `42:w6` and `42:d1` keep their records; otherwise `${seed}:${tag}${version}:${biome.tag}${biome.version}:${overrides}`. A biome version bump resets only that biome's records.

**URL:** `?map=1D04K7ZQ3-HPTG&room=…`. `world_query` writes `map` only when it is not the plain island.

**Presets** (each = one `P` char, a biome, a season, and field values):

| Preset | Biome | Notes |
|---|---|---|
| Classic island | Temperate | Today's island, byte-identical, `42:w6` |
| Dune sea | Dune sea | Replaces today's desert look (§5 Q1) |
| Canyonlands | Canyonlands | |
| Alpine pass | Alpine | Hairpins `More` by default |
| Frozen lakes | Tundra | Winter locked |
| Tropical coast | Tropical | |
| Winter island | Temperate + winter | Shows the season off on a map players know |
| Sky track | (sky) | Today's sky knobs |

### 3.3 Custom biomes: sliders that always build a drivable world

| Expose as slider | Range *est.* (× biome default unless noted) | Why safe |
|---|---|---|
| Hills (relief amplitude) | 0.4-1.5× | Grade limits and spur fitting already degrade (`index.ts:104-117` falls back to the least-steep spur) |
| Roughness (fbm gain) | 0.40-0.55 (today 0.5, `noise.ts`) | Above ~0.6 small bumps dominate and kickers/trails misplace |
| Ridges | 0-1.5× | Additive, smooth |
| Dunes | 0-1.6× height, band mix 0-1 | Dunes sit on top of the ground; roads stamp over them |
| Water level | −6 to +6 m | Clamp so land fraction stays ≥ 45% of the mask (checked) |
| Trees, rocks | 0-2× | Pure placement; jungle at 2× costs tris, so phone caps density in the tier, not the code |
| Snow line | 0 m-200 m | Paint and grip only |
| Town size | block 30-70 m | Lots already fit to whatever block they get |
| Town count, twist, length, hairpins, jumps | K2's 3 levels | Already swept (`proof.ts --options`) |

**Fixed (never a slider):** `CELL`, `SIZE`, road grade and curve limits (`SHAPE_GRADE`, `MIN_RADIUS`, `HAIRPIN_RADIUS`), noise scales (wavelength), town relief/grade rules, mask radius, landmark shapes, grip numbers (a grip slider makes records meaningless).

**Validation and graceful degradation:**

1. **Coupled clamp before generating.** Sliders interact: hills × roughness sets the steepest slope. The recipe computes `relief = hills · (1 + 2·(gain − 0.5))` and clamps it to the biome's `max_relief`; the page shows the clamp as the slider's reachable end, so the player sees it, not a silent change.
2. **Post-checks after generating** (cheap, already computed): a circuit exists; land fraction ≥ 45%; ≥ 1 town when towns ≠ none; spawn on road. On failure, rebuild with relief × 0.85, at most 3 times, deterministically (same code → same retries → same world for every peer).
3. **Degrade, never throw, never borrow another seed's map.** K2's sky rule already does this (`options.test.ts` "falls back to that seed's plain track, never another seed's").
4. **Facts show what was built** ("4 of 6 towns fit").
5. **Proof:** `proof.ts --options` grows to: each slider at 0, 15, 31 with the rest at preset values, over seeds 0-9, per biome; plus 50 random full combinations per biome. A failure means the range shrinks, not that the generator gets a special case.

**Saving and sharing:**

| What | Where |
|---|---|
| Named custom maps | `localStorage` list `{ name, code }[]` under prefs (`menu/prefs.ts` `FIELDS`), validated on load, capped ~50 |
| Share | Copy code / copy link (`?map=`) |
| Import | The existing "type a friend's map code" box on the map page (`menu/settings.ts:412`) accepts v1 and K2 codes |

**Biome editor scope:**

| Version | Scope |
|---|---|
| **v1** (B6) | Create-world page: preset tiles, ~6 visible rows (shape, biome, season, hills, trees, towns) + "Advanced" fold with the other sliders, live preview, save-as-name, copy code. Sliders tune a biome; they do not build one |
| v2 | Mix: pick 2-3 biomes for a Mini map; region size slider |
| v3 *maybe* | Layer editor (add/remove/reorder terrain layers). Code grows unbounded and every combination needs proof; only if players ask |

## 4. Phases

Every step: `typecheck`, `bun test`, `bun scripts/golden.ts --check` (`worldgen/AGENTS.md`). "Identical" = goldens for island 0-19, sky 0-9, desert 0-9 unchanged (`scripts/proof/golden-file.ts:7`). Add each new biome to `GOLDEN_SEEDS` with 10 seeds as it lands.

| # | Step | Proof | Player sees | Size |
|---|---|---|---|---|
| B0 | **Terrain layers.** `TerrainRecipe` → layer list; `raw_height` folds it; ISLAND/DESERT/MAINLAND as layers; `limits` (snow line, tree line, rock slope) move from `chunks.ts:78-79`/`biomes.ts:180` into the recipe | Identical goldens; `exact.test.ts` unchanged counts; one `proof.ts --no-drive --jobs 1` timing table (terrain stage within noise of 183 ms) | Nothing | M |
| B1 | **Surfaces + grip per surface.** `surface` grid holds surface ids (GRASS=0, DIRT=1 kept); `GripTable` → per-surface rows; `world.ts` grip/roll read them; zones generalise the 4 slots | Identical goldens; `car.test.ts`, `telemetry.ts`, `feel.ts` byte-identical (island grip numbers unchanged) | Nothing | M |
| B2 | **Dune sea** (desert v2): dune layer v2, pan layer + HARDPACK surface, shallow washes, adobe outposts (flat roofs, `layout`), long-straights road rule, wind pump | Island/sky identical; desert goldens rewritten and committed; `races.ts --changed` on desert routes | Desert finally looks and drives unlike the island: crest lines, fast pans, sliding sand | M |
| B3 | **Alpine**: ridge band + valley layers, saddle + two stacks, strip villages, avalanche fences | Others identical; new goldens; `races.ts --changed`; `crash.ts` on rails | New preset "Alpine pass" (as its own Mini map kind until B6) | L |
| B4 | **Water**: lake op (+ water disc mesh at lake level), then river op (plan downhill path, carve, ribbon water mesh, ford surface) | Others identical; mesh-only water passes golden mesh digests for the biomes that use it | Lakes in alpine valleys; rivers on a new temperate variant (Classic stays as is) | L |
| B5 | **Snow kit**: Tundra biome + winter season over every land biome | Summer identical; tundra goldens; winter variants in `proof.ts --options` | "Frozen lakes" preset; Winter toggle | M |
| B6 | **Map code v1 + Create-world page**: grammar, legacy K2 parse, `map` field on hello/announce, `w` hash, records key, `?map=`, saved custom maps, sliders with clamp + post-checks | Default keys unchanged (`kinds.test.ts`, `options.test.ts` extended: round-trip every field, K2 codes, collision fallback); slider sweep green | Create-world page, presets, sliders, share codes | L |
| B7 | **Canyonlands, Tropical coast** (+ palm tree kind, shelf mask, lagoon), Continent shape | New goldens | Two more presets | L |
| B8 | **Mainland regions**: region sites on the plan grid, two-stack blending, per-region zones/towns/road rules; Mini map Mix | Mini map goldens identical; mainland golden seeds added (today `mainland: []`) | The main world gets biome regions | L |
| — | **"Mini maps" rename** of the 2 km worlds in menu copy | Copy only | New names | S, any time |

## 5. Open questions for the owner

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Today's desert when Dune sea lands | (a) Replace it (desert v2, desert records reset). (b) Keep it as a "Classic desert" preset | **(a)**: it is the map the owner called too similar; keeping it is clutter. Desert records are days old |
| 2 | Desert one biome or two | Dune sea and Canyonlands separate / one desert with both | **Separate**: dunes are fast and open, canyons are technical; one map can't be both |
| 3 | What water does to a car | Slow wade (high roll, low grip) up to a depth, then reset / always reset / float | **Wade then reset**: fords become a choice, deep water resets as falling does. (Unverified what the sea does today; check `world.ts` before B4) |
| 4 | Winter in records | Own records / shared with summer | **Own**: grip changes lap times |
| 5 | K2 codes (`42-121111`) | Keep parsing forever / drop | **Keep parsing**, map onto v1 fields; records stay on their K2 keys |
| 6 | Hash width in `w` | 15 bits + `map` string compare / 16 bits, no compare | **15 bits + compare**: one spare bit, and a collision never puts two maps in one race |
| 7 | Sliders in v1 | 6 visible + advanced fold / all visible / presets only | **6 + fold**: Minecraft-style, not a mixing desk |
| 8 | Mainland region size | ~1 km (many small) / ~2 km (4-9 regions) / owner-placed | **~2 km**: each region is a place you drive across, not a patch |
| 9 | Mini map biome mix | v1 / later | **Later (B8)**: one biome per Mini map first, so each reads clearly |
| 10 | Should winter freeze the sea | Shore ice only / no | **Shore ice only**: a frozen sea removes the island edge |
| 11 | Tropical before canyonlands? | Either | **Canyonlands first**: reuses terraces, spires, arch; tropical needs palms and the heaviest tree budget |

## Not checked

- Every *est.* cost and grip number. Nothing was generated for the new biomes.
- What the car does in the sea today (reset or not).
- Whether `loop_road` can place a saddle loop with two stacks in 2 km on most seeds (alpine is the riskiest generator change).
- Dune lee-face steepness against kicker and trail placement (`jumps.ts`, `trails.ts` assume today's slopes).
- Whether `fnv1a` on the canonical string plus the biome versions fits the u32 `w` alongside every existing kind id without a clash (ids today 6, 1003, 2001, 3001: all < 0x10000, so yes on paper).
- Phone frame time on jungle density.
