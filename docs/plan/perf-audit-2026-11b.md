# Perf and code audit, 2026-11 round 2

Third pass (quest cfd843f). Previous: `perf-audit-2026-11.md` (a6ded77), whose safe wins shipped in 0.37.0. Measured 2026-11-13 on one box. Each of 0.36.1 (a8e2a47), 0.37.0 (2ba449b) and now (400c7fa, 0.41.0 + docs) was built fresh and served with `vite preview`, so all three columns share one machine state. Seed 1 everywhere.

## Measured baseline

| | 0.36.1 | 0.37.0 | now |
|---|---|---|---|
| Garbage while driving, prod desktop: mainland / island / sky (MB/s) | 27.4 / 23.3 / 12.7 | 14.0 / 12.9 / 11.4 | 14.0 / 12.6 / 11.5 |
| Garbage while driving, prod phone 844x390@3: mainland / island / sky (MB/s) | 10.9 / 13.3 / 11.9 | 10.7 / 12.1 / 10.6 | 10.9 / 11.7 / 10.6 |
| Garbage, old dev recipe, mainland (MB/s) | 28.0 | 26.0 | 26.1 |
| Draw calls desktop: mainland / island / sky (shadow pass share) | 323 / 149 / 65 | same | same (34 / 29 / 6) |
| Draw calls phone: mainland / island / sky | 86 / 75 / 48 | same | same |
| Triangles desktop: mainland / island / sky | 560k / 285k / 55k | same | same |
| Triangles phone: mainland / island / sky | 195k / 170k / 55k | same | same |
| Phone frame at 4x CPU throttle, prod, mainland (p50 / p95 ms) | 43 / 65 | 37 / 52 | 33 / 49 |
| Mainland `routes` plan stage, best of 3 (ms) | – | 24-28 | 57-78 |
| Mainland plan message (kB) | 1992 | 1992 | 2165 (routes 540 → 718) |
| Dunes plan message (kB) | 1 | 1 | 122 |
| Boot JS+CSS gzip (kB) | 469 | 503 | 529 |
| `main.js` raw (kB) | 841 | 946 | 1001 |
| `src` .ts/.svelte files / lines | 360 / 54.5k | 457 / 61.3k | 485 / 66.9k |

Draw calls are `renderer.info.render.calls` averaged per frame. Chunk p50/p95, mesher setup, `road_layers` (5.5-8 ms of a 14-18 ms chunk) and island/sky/dunes message sizes sit within noise of 0.36.1. Memory over 4 laps of 5 mainland teleports stays flat: 161-225 geometries, 100-111 MB heap.

### Regressions

- Mainland `routes` stage +30-50 ms and plan message +173 kB: the road trip (0.41.0).
- Dunes plan message 1 → 122 kB: jump ramps precomputed in `generate` (`Ramp.steep`).
- Boot bundle +26 kB gzip since 0.37.0: Runs, championship, season, phone HUD.
- Prod garbage unchanged. The dev recipe reads 26 MB/s because of a dev-only artifact (finding 3), not a regression.

## Ranked findings

Impact × risk, phone first. "Identical" = world output, golden and physics stay byte-identical.

1. **Minimap "N" forces a style recalc every frame on phone.** `Minimap.north` (`src/hud/minimap.ts:211`), called from `:408` in the disc HUD. Setting `ctx.font` plus `strokeText` resolves the font against the canvas's computed style after the HUD's DOM writes: 26-35% of main-thread CPU in a 4x-throttled phone profile, all three worlds. Fix: draw "N" once into an `OffscreenCanvas` and `drawImage` it per frame. Identical. Win size not yet isolated.
2. **`render.fit` reads layout every frame.** `src/render/render.ts:77`, from `src/main.ts:656`: `clientWidth`/`clientHeight` per frame forces layout, 7-9% of throttled CPU. Fix: `ResizeObserver` sets a dirty flag, `fit` runs only when dirty. Identical.
3. **Dev measurement recipe skewed.** Since 3c3b8d1 (guide to Svelte, first eager `mount`), dev builds add ~11 MB/s desktop / 3.5 MB/s phone inside three's `renderObject`; prod does not. Bisected; an `Array.prototype` patch ruled out; cause unknown. Fix: measure prod builds; expose `open_road` under `--mode review` (`src/main.ts:780`) so the recipe runs on a review build.
4. **Mainland plan +50 ms.** `trip_route` (`src/worldgen/routes.ts:495`) traces every town pair; `road_junctions` computed twice (`mainland.ts:85`, `mainland-lots.ts:77`). Fix: trace the best pair only, reuse junctions. Golden must stay `same`. Bigger target: the lots stage at 213-504 ms.
5. **Per-frame and per-step allocations.** `main.ts:708` (`new Vector3`), `:756` (audio object literal), `:540`, `Remotes.nearest`; `on_pad` and `PadTimer.step` use `.some` closures in the 360 Hz step (`world/sky-pads.ts:20,37`); `Smoke` uploads with nothing alive (`effects.ts:107`). Fix: hoist scratch, plain loops, skip empty upload. Identical.
6. **Still open from the last audit.** Tree batching (#6, biggest desktop draw-call win); `road_layers` binning (#3); `World.hit`/`near` ~1.4 MB/s on sky (quest 6c094ba).

## Code quality

- `modes/modes.ts` 619 → 769 lines; the event-car policy at `:307-456` belongs in `modes/event-car.ts`.
- `main.ts` most-churned file (17 commits since last audit, `frame()` 145 lines, one lost-edit fix 104ee37); `menu/settings.ts` 16 commits and a merge conflict.
- 23 `:global(.ui-*)` reach-ins across 11 page components (CarPick, GarageStrip, SettingsPage, ThemeCreate, LinkRow, others).
- Dead export: `save_setting` (`src/menu/prefs-store.ts:41`).
- Angle-wrap, grid-key and solid-bounds duplicates from the last audit still present.
- AGENTS.md: no `runs/` row; no notes for championship (`modes/championship.ts`) or season (`runs/season.ts`).

## Safe wins for this round

All identical; no world, golden or physics change.

1. Minimap "N" cached bitmap (finding 1).
2. `render.fit` behind `ResizeObserver` dirty flag (finding 2).
3. Per-frame / per-step allocations and empty `Smoke` upload (finding 5).
4. `trip_route` best pair + shared `road_junctions` (finding 4), golden `--check` must stay `same`.
5. `modes/event-car.ts` split, `save_setting` removal, AGENTS.md `runs/` row + championship/season notes.

Later, owner call: tree batching, `road_layers` binning, `:global` cleanup (quest 0be37af), dev-recipe root cause.

## Sources

Scripts in `.t133/` (untracked): `measure2.ts`, `probe3.ts`, `cpu.ts`, `stages.ts`, `dead.ts`, `fnsize.ts`, `msg-size.ts`.

## Follow-up: what dirties style every frame (t138)

Caching the minimap "N" moved the forced recalc to `PadMenu.rotated()` instead of removing it. CDP traces with invalidation tracking, prod build, phone 844x390@3, mainland seed 1:

- `set_text` (`src/hud/hud.ts:42`) replaces the text node of `#speed` (and gear, map distance). Each replacement schedules a `:has()` invalidation on `body`/`html` that marks the whole document dirty: about 22% of the 4x-throttled main thread. Writing `Text.data` instead: lifecycle recalc 1226 → 200 ms per 5 s.
- `#rpm-fill` has `transition: width 40ms linear` (`src/hud/dash.css:97`) and its width is written every frame (`hud.ts:208`), so a transition is always running and dirties style before each rAF. About 2% plus a layout per frame.
- `PadMenu.rotated()` (`src/menu/pad-menu.ts:284`) calls `checkVisibility` every frame from `navigate()` (`src/main.ts:673`), even with no presses: it pays the forced flush. `#rotate` shows only under `(orientation: portrait) and (pointer: coarse)` (`src/hud/overlays.css:130`), so a `matchMedia` list answers the same with no style read.
- `src/hud/stuck-prompt.ts:22` writes `hidden` every frame.

Both fixes together: 153 → 233 frames in the same 5 s throttled run.

Fixes (t139): `set_text` writes `firstChild.data` when the element holds one text node, else `textContent`; same at `hud-sheet.ts:54` and `net/remotes.ts:206`. Drop the `#rpm-fill` transition. `rotated()` reads one `MediaQueryList`. `navigate` returns early with no presses and the bar closed. `stuck-prompt` writes `hidden` only on change.

## Round 4 (t182)

Round 3's open items, no new audit. Measured 2026-11-14 on the same box, prod builds of 0342cd8 (before) and the round's last commit (after) under `vite preview`, seed 1, one run each while other agents shared the machine: frame times are noisy, garbage and calls are steady. Scripts in `.t182/` (untracked): `probe.mts` (heap sampling, draw calls by wrapping WebGL2 `draw*`, frames at 4x throttle; runs under `node --experimental-strip-types`, as Playwright under Bun hangs at launch on Windows), `chunk-bench.ts`, `ident.ts`, `names.mts`.

| | before | after |
|---|---|---|
| Garbage driving, prod desktop: mainland / island / sky (MB/s) | 13.5 / 12.1 / 10.4 | 13.4 / 11.9 / 9.2 |
| Garbage driving, prod phone: mainland / island / sky (MB/s) | 10.4 / 11.3 / 9.5 | 10.3 / 11.3 / 8.5 |
| `hit` + `near` + `collide` on sky, unminified prod (kB/s) | 937 + 226 + 133 | under 100 total, below the top 14 sites |
| Draw calls desktop / phone | 326 / 149 / 65, 86 / 75 / 48 | same |
| Mainland mesh, all chunks, `proof --no-drive --jobs 1`: seeds 0 / 1 / 2 (ms) | 8305 / 10187 / 9517 | 5285 / 4699 / 4343 |
| Mainland chunk build, 120 nearest spawn, seeds 0 / 1: mean / p50 (ms) | 13.2 / 10.5, 15.9 / 13.3 | 10.3 / 8.1, 10.0 / 7.8 |
| Mainland mesher setup (ms) | 48-51 | 61-73 (the road layout is built once here) |

Island, desert and other compact kinds mesh in one `road_layers` call, so their times stay within noise. Golden: 108 worlds identical; `proof` golden column `same` on all 97.

What changed:

1. **`World.collide`** (`src/world/world.ts`): traced first. The garbage was boxed doubles, not arrays: the 360 Hz step runs past V8's inlining budget, so every double handed to `hit`, `circle_contact` and `near` was boxed. A conservative reach test inline in `collide` (1 mm slack, rereads `pos` after each push) skips `hit` for solids clear of the car; `near` takes the solid cell instead of a point and walks cell lists with index loops. Proof: `.t182/ident.ts` (autolap on sky 0/1 and island 0 routes, four cars, 23 runs with contacts) and `scripts/crash.ts` byte-identical before/after; `src/world` and `car.test.ts` pass.
2. **Minimap car names** (`src/hud/minimap.ts`): each name is stroked once into an `OffscreenCanvas` per pixel ratio and drawn with `drawImage`, like the N. No `ctx.font` or text per remote per frame. Checked by eye with two tabs in one BroadcastChannel room, desktop full map and phone disc, before/after match. The style-recalc win was not isolated (it needs a peer in the throttled run).
3. **`road_layers` binning** (`src/worldgen/road-layers.ts`, `roads.ts`, `tile-mesher.ts`): `road_layout` builds once per world what every chunk used to redo: offset reach and per-chunk segment bins for every strip (`StripLine`), ring mouths, the edge-line mask, street `near_spur` and stretched street lines. `Roads.strip_line` walks only the segments that start in its chunk, in the same order, so draping order and output are unchanged.

Not done: **tree batching** needs a new structure, an owner call. Today each chunk holds its own trunk and crown `InstancedMesh`es (`render/scene.ts:194`, `tree_meshes`), shown or hidden per chunk on phones (`MOBILE_TREES`). Design: one `BatchedMesh` per tree material (bark, leaf) in a small `TreeBatch` beside `SceneView`, with every geometry (trunk, crowns) added once; a chunk's `add` takes instance ids from it and its drop frees them; per-chunk phone hiding becomes `setVisibleAt` over the chunk's ids; `perObjectFrustumCulled` keeps per-tree culling. The depth-material fix from 0.37.0 must be redone for `BatchedMesh` casters, and it changes how `dispose` and `trees_shown` work. Expected: about -150 calls on desktop mainland, little on phones, where far chunks' trees are already hidden (86 calls).
