# Perf and code audit, 2026-11

Read-only audit of everything outside `src/menu` at `a8e2a47` (0.36.1): `main.ts`, `render/`, `world/`, `worldgen/`, `car/`, `hud/`, `net/`, `modes/`. Nothing in the code changed. Every number below was measured on the owner's Windows box under `hq lock run`, unless a line says it is an estimate.

## Measured baseline

How it was measured, so the numbers can be rerun after a fix:

- **Gen and chunk times:** `bun scripts/stream.ts 0 1 2`, `bun scripts/stream.ts --kind dunes 0 1`, `bun scripts/proof.ts --no-drive --jobs 1`.
- **Road layers' share of a chunk:** a throwaway bench (`.t107/chunk-bench.ts`, untracked). It runs `TileMesher.build` and then `road_layers` alone on the 120 chunks nearest the spawn.
- **Worker message sizes:** `node:v8` `serialize` byte counts of the exact `plan` / `chunk` replies `worldgen/worker.ts` posts. The bench is `.t107/msg-size.ts`, untracked.
- **Browser:** a Vite dev server on :5399 (never :5287) and Chrome through Playwright with `--use-angle=d3d11`, the same as `scripts/shots.ts`. The network goes to localhost only, and the menu is closed. The script is `.t107/measure.ts`, untracked.
  - Draw calls: `renderer.info` over 60 frames with `autoReset` off.
  - JS allocation: the CDP sampling heap profiler, counting objects already collected, over 2.5 s with the gas held.
  - Streaming churn: the car teleported round mainland seed 1 four times.
- `scripts/shots.ts` has no draw-call output; `renderer.info` stood in for it.

| World (seed 1) | Draw calls / frame | of which shadow | Triangles | Visible meshes (instanced) | JS garbage while driving |
|---|---|---|---|---|---|
| mainland | 323 | 34 | 560k | 634 (369) | 28.5 MB/s |
| island | 149 | 29 | 285k | 343 (169) | 22.7 MB/s |
| sky | 65 | 6 | 55k | 56 (3) | 13.0 MB/s |

Frame time sat at vsync (6.9 ms, 144 Hz) in every world, so this box is not frame-bound. The wins below are headroom for phones and for the 360 Hz sim, not a fix for a visible stutter here.

| Generation | Number |
|---|---|
| island gen | median 516 ms, slowest 873 ms; stage max: trails 296, terrain 214, lots 202 ms |
| island mesh (all 64 chunks) | 180-310 ms |
| mainland plan | 350-715 ms; mesher setup 38-56 ms; first 3x3 186-239 ms |
| mainland chunk build | p50 9.8-12.8 ms, p95 17.6-25 ms, max 46-71 ms |
| dunes chunk build | p50 11.8-12.2 ms, p95 34 ms |
| `road_layers` inside one mainland chunk | 5.2 ms of 13.1 (seed 0), 7.7 ms of 15.9 (seed 1) |
| worker `await setTimeout(0)` x100 | 398-406 ms (4.0 ms each); MessageChannel x100: 0.7-1.0 ms |
| `plan` message (structured clone, not transferred) | island 1.86 MB, mainland 1.99 MB, sky 0.70 MB; 14-20 ms to serialize in Bun |
| chunk reply (transferred) | island 497 kB, mainland 538 kB typed plus 41 kB of cloned tree and solid objects |

Memory over map use is clean. A map switch is a full navigation (`location.search` / `location.replace`), so the heap and the GL context go with the page. Within one page, streaming mainland for 4 laps of 5 teleports held GPU geometries at the same count per spot every lap (162-230). The JS heap stayed at 96-106 MB, with no growth lap over lap. Remote cars, mode runs and car swaps all reach `dispose_car_view` / `dispose()`.

## Ranked findings

Risk: S = local, provable by an existing check. M = touches output or several files, needs golden or shots. L = changes a data shape or an architecture.

| # | Where | Evidence | Fix | Expected gain | Risk |
|---|---|---|---|---|---|
| 1 | `src/worldgen/worker.ts:115` | `await new Promise((next) => setTimeout(next, 0))` between chunks. Browsers clamp nested timers to 4 ms after five levels (HTML spec, timers, step "nesting level > 5"). Measured 4.0 ms per yield against 0.01 ms for a MessageChannel. | Yield through a `MessageChannel` port pair: still a task, so `focus` and `chunk` requests still interleave. | Island and other compact kinds: about 256 ms off load-to-`whole()` (64 chunks x 4 ms, on 180-310 ms of meshing). Mainland: a 4 ms gap on an 11 ms chunk is about 27% more stream throughput. | S |
| 2 | Shadow pass, every `InstancedMesh` that casts (`render/scene.ts:268-295` trees, `world/buildings.ts:72,107`, `world/jumps.ts:161`, `car/trackside.ts:101-102`, `world/landmarks.ts:53,74`) | three r187 `WebGLShadowMap.getDepthMaterial` gives every caster the one shared `_depthMaterial`. `setProgram` sees `instancing` / `instancingColor` flip between neighbours (trunks have no instance colour, crowns do) and re-keys the program on each flip. Measured with shadows on: 11.1 MB/s in `getParameters` / `getProgramCacheKey*` / `join`, against 0.00 with `shadowMap.autoUpdate = false`. Total garbage went from 27 to 12 MB/s. | Two shared `MeshDepthMaterial`s (plain instanced, instanced with colour), set as `customDepthMaterial` on each instanced caster. | About 40% of all JS garbage on land worlds, plus the per-flip program-key string build on the CPU (frame-time gain not measured). | S-M: shadows should be pixel-identical, so prove it with `shots.ts --diff` |
| 3 | `src/worldgen/road-layers.ts:241`, called per chunk from `worldgen/tile-mesher.ts:87` | Each streamed chunk runs the whole world's road network: every edge and segment, plus `ring_mouths` x2, `spurs.flatMap`, `near_spur` (points x gates) and `offset_reach`. It also builds a `Roads` holding 2 x 576 empty layers, then keeps one chunk's quads. Measured 5.2-7.7 ms of a 13-16 ms chunk. | Hoist the per-world work (mouths, spur gates, `near_spur`, reaches) into `road_junctions` / the mesher constructor, and bin segment indices per chunk once, so a chunk walks only its own segments. | Up to about 40% off every mainland and dunes chunk (5-7 ms of 13-16 ms). | M: `golden.ts --check` must stay `same` |
| 4 | `src/world/jumps.ts:197-213` (`knock`), `:217` (`fly`), `:186` | Each loose item, each frame, builds a closure for `car.spec.circles.some(...)`; `fly` makes a `new THREE.Quaternion()` per frame; `update` returns a fresh `{ clean }`. Measured 1.5 MB/s on island, the biggest app-side allocation site after the car step. | Plain `for` loop over the circles, a hoisted scratch quaternion, return the challenge (or a reused object). | -1.5 MB/s | S |
| 5 | `src/world/world.ts:565-590` (`near`: `found.length = 0`, `slots.length = 0`), `src/worldgen/deck.ts:110-125` (`levels`: `picks.length = 0` and a `findIndex` closure per grid sample), `world.ts:86-122` (`circle_contact` returns a literal per contact), `world.ts:546` (`for…of` over `near` in `collide_car`) | The comment says `near` "refills one array instead of allocating", but V8 frees an array's backing store on `length = 0` (`elements.cc` `SetLengthImpl`; unverified against the current V8 source, though the sampling below agrees). Sky driving measured `near` 534 kB/s, `levels` 560 kB/s, `collide_car` 496 kB/s, `hit` 1 MB/s. All of it runs inside the 360 Hz step. | Keep a count beside a fixed-capacity array instead of truncating; a loop in place of `findIndex`; one scratch `Contact` written in place. | About -2.5 MB/s on sky, less on land | S: `car.test.ts` bit-exact, `telemetry.ts` / `feel.ts` byte-identical |
| 6 | Tree and town instancing per chunk (`render/scene.ts:181-187`, `world/buildings.ts`) | 369 of 634 visible meshes on mainland are instanced, mostly 1-3 tree meshes per chunk. Draw calls are 323 per frame, and three's `projectObject` / `painterSortStable` allocate 1.3-2 MB/s sorting them. | One `InstancedMesh` per tree kind per ring of chunks (or `BatchedMesh`), rebuilt on add and drop. This trades per-chunk frustum culling for fewer calls. | About -150 draw calls on mainland (estimate). The biggest GPU-side win, and it matters most on phones. | M-L: an architecture call for the owner |
| 7 | `src/worldgen/worker.ts:82`, `world/world-stream.ts:71` | The plan crosses as a 1.9-2.0 MB structured clone: `graph` 0.6-1.2 MB, `routes` 0.5 MB, `road` 0.2-0.5 MB, all as `RoadPoint` objects. Deserializing it blocks the main thread at load (14-20 ms to serialize in Bun; the main-thread decode was not measured). | Pack point lists into typed arrays and transfer them. | Load-time main-thread block (estimate: tens of ms on a phone) | L: `RoadPoint[]` is read everywhere |
| 8 | `src/render/effects.ts:107-120` (`Smoke.update`) | Re-uploads all 420 instance matrices (27 kB) and colours (5 kB) every frame, and draws 420 instances (8.4k triangles, 1 transparent call), even with no puff alive. | Track the live count: skip the upload and set `mesh.visible = false` while none are alive, and upload colours only on `emit`. | 1 draw call and 32 kB/frame of upload while not sliding | S |
| 9 | `src/hud/hud.ts:236-243`, `:287` | Every frame: a `rows` array, a spread, a `map`, an object per player, a sort and `net.display_name` per remote. Line 85 says display names allocate and are throttled to 1 Hz for the map, but this path bypasses that. `JSON.stringify(finishers)` runs every frame during a lobby race. | Reuse `this.names` (already refreshed at 1 Hz), and rebuild rows only when a best or the roster changes. Key results on `finishers.length` plus the last time. | Small per frame; scales with peers | S |
| 10 | `src/render/render.ts:98-137` (`check_size`) | In every dev session it runs `getBoundingClientRect`, 2 `gl.getParameter` calls and a 10-part report string, after the frame's HUD writes. That forces a layout every frame and skews any dev profile (measured 180 kB/s). | Run it at 1 Hz, or only on a `fit` change or with `?debug`. | Cleaner dev profiling; prod is unaffected | S |
| 11 | `src/main.ts:654, 571-579, 699, 495`; `hud/minimap.ts:293`; `net/remotes.ts:97-103` | Per-frame `new THREE.Vector3` for `upright`, a `{ near, touched }` literal, the `audio.update({...})` literal, a `gate_views.forEach` closure, the minimap `arrow` returning 4-5 arrays, and `Remotes.nearest` returning a fresh object. `frame` measured 90 kB/s. | Hoisted scratch values, a reused frame object, index loops. AGENTS.md "Performance" already asks for this. | Under 0.1 MB/s each; hygiene | S |
| 12 | `src/car/car.ts` `step` / `ray_gap` / `curve_at` | 3.0 MB/s in `step`, 0.9 MB/s in `ray_gap`, 0.23 MB/s in `curve_at`, at 360 Hz. That is about 8 kB per step. Most of it looks like V8 boxing doubles returned from non-inlined calls and stored in tagged fields. The `reduce` / `some` / `every` closures at `car.ts:728, 736, 767, 775, 946, 997` are a smaller part (unverified split). | Profile with a trace before touching it. If the closures show up, replace them with loops; physics must stay bit-exact. | Unknown until profiled | M |

### Gen hot paths beyond chunks

- **Island stages:** trails (up to 296 ms), terrain (214 ms) and lots (202 ms) are the slow ones. The slowest seed, 6, takes 873 ms. The plan runs in the worker while the bundle loads, so it gates first frame only on a cold load. Profile with `proof.ts --no-drive --jobs 1` per stage before changing anything.
- **Mainland plan:** 350-715 ms, plus 38-56 ms of mesher setup, before the spawn's 3x3 (186-239 ms).
- **`worker.ts:52-66` (`nearest`):** a `forEach` closure plus `splice` per chunk over `left`. That is O(n) on at most 576 entries, so it is negligible beside a 10 ms build.

## Dead code and duplication

| Item | Where | Note |
|---|---|---|
| Unused export | `src/car/car.ts:36` `CAR_BODY` | Referenced nowhere |
| Unused exports | `src/modes/drift.ts:39` `DRIFT_IDS`, `modes/duel.ts:25` `DUEL_IDS`, `modes/hunt.ts:38` `HUNT_IDS` | Referenced nowhere (`LEVEL_IDS` and `PARK_IDS` are test-only) |
| Dead overload | `src/world/world.ts:530-538` positional `collide(pos, vel, ang, heading)` | "callers not yet passing the car": every caller in `src/` and `scripts/` passes a `Collider` now. Dropping it also drops an `instanceof` per 360 Hz step. |
| Debug-only switches in prod | `src/render/render.ts:11-13, 37-58` `BISECT` canvas-bug switches, `NanProbe` | Shipped and parsed on every load. Remove them if the canvas bug they bisected is closed (owner's call). |
| Test-only exports | `worldgen/kinds/options.ts:56` `opts_code`, `net/turn-code.ts:12` `encode_turn`, `worldgen/path.ts:485` `loop_road`, `theme/random-theme.ts:33` `DEFAULT_GENERATE` | Fine as test seams; listed so nobody mistakes them for live API |
| Needless `export` | About 130 symbols (mostly interfaces and tuning constants) | Used only inside their own file. Low value; skip unless a lint wants it. |
| Duplicate: angle wrap | `Math.atan2(Math.sin(a), Math.cos(a))` in `render/camera.ts:8`, `modes/gymkhana.ts:103`, `modes/parking.ts:184`, `modes/route.ts:8`, `modes/mode.ts:116`, `worldgen/facts.ts:22`, `world/world.ts:641` | One `wrap_angle` in a shared maths module |
| Duplicate: grid key | `world/world.ts:81` `grid_key` and `worldgen/deck.ts:23` `key` | Same formula; `world.ts` `nearest` (ring search) and `DeckIndex.nearest` are near twins too |
| Duplicate: chunk distance | `render/scene.ts:220-221` and `world/world-stream.ts:104-105` | Same distance from a point to a chunk box |
| Duplicate: solid bounds | `world/world.ts:287-314` `index_solid` / `unindex_solid` | They repeat the bounds math; one `solid_cells` helper |

## Safe wins for tonight

Each one is S risk, stays inside one feature folder, and has a proof that already exists. Order is by gain.

1. **Worker yield without the 4 ms clamp** (`worldgen/worker.ts:115`). Swap `setTimeout(0)` for a MessageChannel round trip. Proof: `bun test src/worldgen`, `golden.ts --check` (output is untouched), and island plus mainland loads by eye. The gain is about 256 ms off a compact world's full load and about 27% more mainland stream throughput.
2. **Instanced shadow casters get their own depth material** (two shared `MeshDepthMaterial`s, set as `customDepthMaterial` on the instanced casters). Proof: `shots.ts --diff` against a pre-change run, plus the allocation sample. The gain is -11 MB/s of garbage on land worlds.
3. **`JumpsView.knock` / `fly` without per-frame closures and quaternions** (`world/jumps.ts:197-217`). Proof: `bun test src/world`, plus knocking cones in a drive by eye. The gain is -1.5 MB/s.
4. **`World.near`, `DeckIndex.levels` and `circle_contact` stop allocating** (count-based reuse, a loop in place of `findIndex`, a scratch `Contact`). Proof: `car.test.ts` bit-exact, `scripts/telemetry.ts` and `scripts/feel.ts` byte-identical, `bun scripts/crash.ts`. The gain is about -2.5 MB/s on sky, inside the 360 Hz step.
5. **Delete the dead code:** `CAR_BODY`, `DRIFT_IDS` / `DUEL_IDS` / `HUNT_IDS`, and the positional `collide` overload. Proof: `typecheck`, `bun test`.

Also safe, smaller:

- `Smoke` skips its upload and draw with no puff alive (finding 8).
- HUD player rows built only on change (finding 9).
- `check_size` throttled in dev (finding 10).

Not tonight:

- `road_layers` per-chunk binning (finding 3, M). This is the biggest gen win, but it needs a golden-identical refactor of `road-layers.ts`.
- Tree instancing across chunks (finding 6) and packed plan points (finding 7). Both are architecture calls for the owner.

## Sources

- HTML Living Standard, timer initialisation steps, "If timer nesting level is greater than 5, and timeout is less than 4, then set timeout to 4" (https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timer-initialisation-steps). Applies to `WorkerGlobalScope`. Confirmed here by measurement, Chrome stable, 2026-11-13.
- three.js r187 `build/three.module.js`: `WebGLShadowMap.getDepthMaterial` (shared `_depthMaterial` unless `customDepthMaterial`), and `WebGLRenderer.setProgram`'s `needsProgramChange` checks on `instancing` / `instancingColor` (around line 18270 in the installed package).
- V8 `src/objects/elements.cc`, `SetLengthImpl`: a length of 0 re-initialises the elements, freeing the backing store. Recalled, not re-read for the current V8 (unverified). The allocation samples above support it.
