# Sim performance: profile, WebAssembly, determinism, worker

Research spike (task t198), measure only. Decided 2026-11-15: see [Decisions](#decisions-owner-2026-11-15). Question: the AI field (`docs/plan/ai-racers.md` §4) and whatever comes after it need a lot of sim per frame. Does WebAssembly buy it, does a Web Worker, and what does either do to determinism, ghosts and records?

Code measured: the AI field branch (`worktree-agent-a6399ebfcdb02730e`, 94b6bf0: `src/ai`, `src/car/contact.ts`). The spike's scripts and the AssemblyScript port live in a scratch folder. They are not committed.

Machine: i7-8700K (6 cores, 12 threads), Windows 11. Runtimes: Bun 1.3.0 (JavaScriptCore), Node 22.14 (V8 12.4), headless Chrome 157 (V8), and Playwright's WebKit build 2359 (JavaScriptCore on Windows). AssemblyScript 0.28.9, `-O3 --runtime stub --noAssert`.

## Answer first

- Half the field step is ground height queries, not tyre maths: 64 `ground.height` calls per car per step. The branchy tyre and assist code is not the main cost.
- WebAssembly runs `Car.step` (with its ground) **1.5-1.8x** faster than JS in every engine. JS↔WASM calls and pose copies cost almost nothing (5-9 ns a call, 0.02 µs a car, within run-to-run noise).
- A worker takes **88-90%** of the sim's main-thread time off the main thread, at 1x and 4x throttle alike. One round trip per frame costs 40 µs at 1x and 0.35 ms at 4x.
- The JS physics is **not** bit-identical across engines today. JSC and V8 differ on step 0, and so do two V8 versions (Node 22 and Chrome 157). A seeded 7-car race finishes in a different order in Bun and in Node.
- The WASM port gives the same bits in all four runtimes. The reason is its own maths library, not WebAssembly. With that maths swapped into `Math.*`, the **JS** physics also gives the same bits in JSC and V8. Determinism needs a deterministic maths module, not WASM.
- Recommendation: worker first, cheap ground-query wins second, and a deterministic maths module if identical results across browsers matter. No WASM sim core now: 1.5-1.8x does not pay for a second physics source. **Superseded in part (J2, J3):** shared maths everywhere incl. worldgen, and a WASM core for physics, ground and worldgen as the only physics source.

## Decisions (owner, 2026-11-15)

From questionnaire round 1 (`docs/plan/career-ai-r1.answers.md`, section 9). The owner went past this doc's recommendation on J2 and J3: shared maths everywhere, and WebAssembly for car physics, ground and world generation.

| # | Decision | Differs from this doc |
|---|---|---|
| J1 | **Whole sim in a worker first**, then the ground-query wins | |
| J2 | **One shared maths source everywhere, worldgen included.** Every world kind's output moves, so every kind bumps its `version` and players' records reset once. Recommendation: land it in the same release as the career redesign, so players lose records once and the old career retires in that release | rec was car physics only, worldgen later |
| J3 | **WebAssembly for car physics + the whole ground, and for world generation** | rec was no WASM core now |
| J4 | **No SharedArrayBuffer**, no cross-origin isolation: post small messages | |
| J5 | **One sim path for everything**: solo driving runs in the worker too | |
| J6 / J7 | Target: 60 fps on a Samsung Galaxy S24+ (latest software) during a 6-car race | |
| J8 | **Measure first**: port the spike to Rust and compare with AssemblyScript before picking the language | |
| J9 | OffscreenCanvas (render in a worker): measure on the phone after the sim worker, then decide | |
| J10 | **Exact suspension raycast in the same rebaseline as J2**, so baselines are re-recorded once | |

What follows from them:

- **One rebaseline, three changes.** Shared maths in car physics, world queries, AI and worldgen, plus the exact raycast, land together: `car.test.ts`, telemetry, feel, `races-baseline.txt` and `scripts/golden/` are re-recorded once, every world kind's `version` bumps once.
- **WASM must not cause a second records reset.** The WASM port comes after the rebaseline. Its car step and its worldgen must give the JS shared-maths bits exactly (the §2 lockstep harness for the car, `bun scripts/golden.ts --check` for worldgen). If the port ships after the career release and its worldgen differs by one bit, every kind bumps again and players lose records a second time.
- **The JS physics goes when WASM lands** (§5: two physics sources are the worst option). Bun tests and scripts then call the WASM build too. Until then the JS sim is the only source.
- **The worker owns the player's car (J5)**, so car-to-car contact is in one step and §4's one-frame-late contact does not arise. The main thread reads what it needs (HUD speed, audio rpm, rumble and camera impacts, rewind and ghost recording, the lab recorder) from the worker's reply; the reply carries more than poses.
- **No SharedArrayBuffer (J4)**: §4's cloned `Float32Array` per frame is the transport.
- J2 and J10 need no WASM and no new dependency. J3 needs a compiler (Rust toolchain or AssemblyScript) as a build dependency: J8 picks which.

## 1. Where the field step goes

Island seed 0, first circuit, 7 coupes driven by `Field`, 720 warm-up steps, then 7200 steps (20 s of sim).

Plain `Field.step`: **80 µs/step in Bun, 79 µs in Node**, about 11.4 µs per car. For comparison, `ai-racers.md` §4 measured 20 µs per car on an open-loop drive that weaved off the road into more solids. On the line, a car costs about half that.

Split, measured with `performance.now()` marks in a copy of `car.ts`. The marks add about 24% (99 µs against the plain 80), so read the shares:

| part | µs/step, 7 cars (Bun) | share |
|---|---|---|
| `car.step` | 83.8 | 85% |
| · suspension raycasts (4 wheels × 14 `height` calls) | 34.5 | 35% |
| · tyre and suspension forces (normals, footing, magic formula, wheel spin) | 29.2 | 29% |
| · controls, steer, gearbox, TCS | 9.8 | 10% |
| · hull corners (8 × `height` + `normal`) | 7.6 | 8% |
| · assists, aero | 1.1 | 1% |
| · `body.integrate` | 0.75 | 1% |
| `driver.drive` (AI driver) | 7.5 | 8% |
| `world.collide` (solids) | 4.1 | 4% |
| `distance_to_road` (field bookkeeping) | 2.6 | 3% |
| `awareness.update` (20 Hz, spread over its steps) | 0.4 | <1% |
| recovery, pass counting | 0.4 | <1% |
| `collide_cars` (contact pass) | 0.6 | <1% |

Seed 2 gives the same picture: raycasts 25 µs, tyres 32 µs. In Node the split is the same shape, and its marks cost more.

The same ground calls, recorded during the run and replayed alone:

| query | calls/step, 7 cars | ns/call Bun / Node | µs/step Bun / Node |
|---|---|---|---|
| `height` | 448 | 106 / 71 | 47.6 / 31.6 |
| `normal` | 28 | 120 / 95 | 3.4 / 2.7 |
| `grip`, `loose`, `roll` | 28 each | 75-85 | 7.0 / 6.7 |
| total | | | **58 / 41** |

`TileStore.height` alone costs 46 / 33 ns. `World.height` adds the ramp scan (8 wedges on this map) and the deck check on top of it. The bisection in the suspension raycast (2 + 12 calls per wheel) makes most of the 448 calls.

Rewriting the ramp scan as an indexed loop (`for of` with destructuring today) gives the same output bit for bit. It saved 10% of the field step in Bun and nothing in V8, so it is not a real win in Chrome.

## 2. Car.step in AssemblyScript

Port: `Car.step` for analog input, which is what `Driver` sends. Every assist, drift and TCS branch is in it, plus `RigidBody`, the three.js vector and quaternion ops in their exact operation order, and a tile heightfield ground (height, slope normal, footing from `road_dist`). Car state lives in linear memory as `@unmanaged` structs. JS reads poses through `Float64Array` views and writes controls the same way. Size: 656 lines of AssemblyScript against `car.ts`'s 1013 lines, plus 233 lines of host glue.

Left out: keyboard steer modes, nitro, `park`/`place`, and every part of `World` past the tiles (ramps, decks, water, laid surfaces, dirt, solids `collide`).

Bench: each runtime runs both sides on the same `SpikeGround` heightfield built from island seed 0's tiles. Controls replay 10 s (3600 steps) recorded from the AI field. Times are the median of 5 runs after a warm-up run.

| µs per car per step | Bun | Node | Chrome | WebKit |
|---|---|---|---|---|
| JS, 1 car | 7.31 | 6.35 | 6.75 | 6.11 |
| JS, 7 cars | 5.78 | 6.57 | 5.73 | 5.75 |
| WASM, 1 car | 3.82 | 3.37 | 3.17 | 3.61 |
| WASM, 7 cars, one call per car | 3.87 | 3.59 | 3.22 | 3.57 |
| WASM, 7 cars, one `step_all` call | 3.88 | 3.52 | 3.25 | 3.61 |
| WASM, 7 cars, poses copied back into three objects every step | 3.90 | 3.57 | 3.24 | 3.61 |
| **speedup, 7 cars** | **1.49x** | **1.83x** | **1.78x** | **1.61x** |
| empty WASM call | 8.1 ns | 5.2 ns | 5.2 ns | 9.0 ns |

- Call and copy overhead does not matter. One call per car and one call for all cars cost the same. Copying pos, quat, vel and ang into the JS `Car` adds about 0.02 µs per car (-0.01 to 0.05 across runtimes, within noise).
- A WASM build that imports the host's `Math.sin` and friends (bit-identical to the JS, see §3) runs at 4.2 µs/car in Node, against 3.5 µs/car with its own maths.
- On the real `World` the JS car costs 11.4 µs in the field, against 5.8 µs on the spike ground. The real ground costs about as much as the rest of the step. A WASM physics would have to own the whole ground (tiles, ramps, decks, water, footing), or it would cross the boundary 60+ times per car per step.
- Projected saving for 7 cars on desktop: about 15-20 µs/step, 6-7 ms of CPU a second. That is real, but the worker in §4 takes about 40 ms a second off the main thread.

The port can be checked bit for bit. With host `Math` imported, the WASM matched the JS on every field of all 7 cars for all 3600 steps, in Bun and in Node. The lockstep diff found both porting bugs on the first step (an unset `Y` axis, a buffer allocated before the spec was filled). Any future port can keep that harness as its proof.

## 3. Determinism

The digest covers all 7 cars' full state (body, car scalars, wheels) over the 3600 replayed steps:

| run | final digest |
|---|---|
| JS, Bun (JSC, Windows) | `b0de7eb0` |
| JS, WebKit (JSC, Windows) | `b0de7eb0` |
| JS, Node 22 (V8 12.4) | `2af93e0d` |
| JS, Chrome 157 (V8) | `32d179dd` |
| WASM with its own maths, all four runtimes | `6c601001` |
| **JS with the AS maths swapped into `Math.*`, Bun and Node** | **`6c601001`** |

- JSC and V8 split on step 0. Chrome 157 and Node 22 split on step 1. JS addition, multiplication, division and `Math.sqrt` are exact IEEE-754 in every engine. Only the transcendental `Math` functions are left to the implementation.
- In the open-loop replay the gap stays small: 3-65 µm after 10 s.
- Closed loop it does not stay small. 7 AI coupes on island seed 2, 2 laps: JSC finished in grid order `2031546`, V8 in `2016453`. One car's finish differed by 8.8 s (373.9 s against 382.7 s), and the contact counts differed.

How often each engine's `Math` differs from the AssemblyScript maths (musl, which comes from fdlibm), over 10⁶ inputs in the car's ranges:

| fn | JSC Windows (Bun, WebKit) | V8 12.4 (Node 22) | V8 Chrome 157 |
|---|---|---|---|
| sin / cos | 1.9% / 1.8% | 0.8% / 1.1% | 3.2% / 3.1% |
| tan / atan / atan2 / asin | 4.2 / 0.2 / 17.7 / 2.5% | 0 / 0 / 0 / 0% | 3.8 / 4.3 / 17.8 / 6.0% |
| hypot | 9.7% | 35.7% | 35.7% |
| exp / log / pow | 0.5 / 0.03 / 0.1% | 9.7 / 3.4 / 9.7% | 0.1 / 0.01 / 0.1% |

So V8 changed its maths library between 12.4 and Chrome 157, and the same JS gives different bits after a browser update. JSC calls the platform libm. On Windows, Bun and WebKit agree with each other. Safari on macOS uses Apple's libm, which is a third answer (not run here). Firefox was not tested.

What it means here:

- **Ghosts are unaffected.** `ghost.ts` records poses every 100 ms, and dev ghosts are the same JSON. Playback is identical in every browser whatever the physics does.
- **Records are unaffected.** A record is a time from the player's own sim. It was never comparable bit for bit, only as a time.
- **A seeded AI race is not the same race in every browser.** A daily or career event with an AI field gives a different result per engine and per Chrome version.
- **The Bun scripts measure JSC, while players run V8.** `car.test.ts` bit-exact, telemetry, `races.ts` baselines and goldens all hold within JSC. They are not the bits a Chrome player gets. Worldgen also calls `Math.*`, so golden worlds probably differ in the last bit in Chrome too (not measured).
- Things that would need identical sims, none of which exist today: input-replay ghosts (inputs in place of poses), lockstep netcode, re-simulating a record to check it, and "everyone races the same field".

Could a WASM physics make ghosts and records identical across browsers? Yes for the sim: one WASM build gave the same bits in four runtimes. But the last row of the table shows the JS physics does the same once `sin`, `cos`, `tan`, `atan`, `atan2`, `asin` and `hypot` come from one deterministic library. Determinism needs **one maths source**, not WebAssembly.

## 4. Whole field in a worker

Prototype: the branch's `Field` (world, 7 AI cars, awareness, contact) runs in a dedicated worker. Each `requestAnimationFrame` the main thread posts how many 360 Hz steps are due. The worker steps them and posts back a `Float32Array` of 7 poses (49 floats). Compared with the same field stepped on the main thread in rAF. Headless Chrome 157, 10 s per mode. Headless rAF ran at 144 Hz, so the table also gives ms per second of sim.

| mode | CPU throttle | main ms/frame | main ms/s | `postMessage` µs | `onmessage` µs | reply after post, mean / p95 |
|---|---|---|---|---|---|---|
| sim on main | 1x | 0.31 (p95 0.5) | 45 | | | |
| worker, cloned | 1x | 0.039 | 5.6 | 23 | 16 | 0.48 / 0.7 ms |
| worker, transferred | 1x | 0.038 | 5.4 | 23 | 15 | 0.49 / 0.8 ms |
| sim on main | 4x | 3.44 (p95 5.8, worst 26) | 488 | | | |
| worker, cloned | 4x | 0.35 | 50 | 168 | 180 | 1.2 / 1.9 ms |
| worker, transferred | 4x | 0.38 | 55 | 197 | 188 | 1.3 / 2.1 ms |

- The main thread saves 88-90% at both throttles. At 60 Hz on the 4x phone proxy, that is about 8.1 ms of sim per frame on main, against 0.8 ms of messaging.
- Transferring the buffer gains nothing at 196 bytes. Every message has a fixed cost.
- Caveats:
  - CDP's CPU throttle does not reach the worker: its step took 0.32-0.34 ms per frame at 1x and at 4x. On a real phone the worker is slower, but it runs on another core. 7 cars at ~4x desktop cost is ~20% of that core.
  - The throttle inflates short main-thread tasks by about 10x where 4x would be expected, so the 4x rows are an upper bound.
- The cost `ai-racers.md` §4 names still holds: with the player's car on main and AI in the worker, car-to-car contact sees the other car one frame late. Another option is to put the player's car in the worker too and render from the reply: the reply came 0.5 ms (1x) to 1.3 ms (4x) after the post. Not prototyped.

## 5. What WASM buys and costs

| | WASM sim core | worker (JS) | deterministic maths module (JS) |
|---|---|---|---|
| desktop gain, 7 cars | ~15-20 µs/step (1.5-1.8x on step + ground) | 88-90% of sim time off main | none (slightly slower than native `Math`) |
| phone frame | ~1.7x less sim on main | sim leaves main: ~8 ms becomes ~0.8 ms per frame at 4x | none |
| identical across browsers | yes | no | yes |
| port | step + full world ground + collide + contact: estimate ~1500 lines of AS | Field and World built in the worker, poses back | estimate 300-400 lines (fdlibm port of 7 functions), one import swap |
| physics sources | two, unless JS physics is deleted and Bun tests, scripts and the game all call WASM | one | one |
| new dependency | AssemblyScript compiler (owner's call) | none | none |
| records and ghosts | ghosts are poses, unaffected; physics moves by ulps, so `car.test` and telemetry rebaseline | unaffected | sim: ulp moves, rebaseline once. Worldgen too: golden output moves, so every kind bumps `version` and its records reset |

Two physics sources are the worst option: every tuning change made twice, and drift between them that only a lockstep diff would catch. Going WASM means deleting the JS physics, and losing three.js types, closures and readable stack traces in the hottest code. 1.5-1.8x does not pay for that today.

## Recommendation

1. **Worker first.** Run the AI field (world queries, AI, contact) in a worker. It is the only option that moves the phone's frame budget by milliseconds. Decide on the player car's side with a one-frame-contact test on device.
2. **Cheap ground wins in JS.**
   - The suspension raycast bisects (14 `height` calls per wheel) a ground made of flat triangles. An exact ray-triangle hit needs about 2-3 lookups. Estimate: about a third of the field step, not measured. It changes physics output, so the feel and telemetry baselines get re-recorded.
   - Ramp and deck lookups cost more than the tile itself. An index there gives the same output.
3. **Deterministic maths module, if same-everywhere matters.** It is needed for seeded AI fields, input ghosts or lockstep later. One `sim-math.ts` for the 7 functions, used by car, world queries and AI. Worldgen only with a deliberate version bump of every kind: its output moves, which resets players' records. The Bun scripts then prove the bits Chrome and Safari players get.
4. **WASM later, scoped.** (**Superseded, J3:** WASM is decided for physics, ground and worldgen, after the worker and the rebaseline; J8 measures Rust vs AssemblyScript first.) Only if phones still miss budget after 1-3, and then as the only physics source (car step plus the whole world ground in AS). Use the lockstep harness from this spike as the proof. Also worth it for batch work that is pure numbers with few boundary crossings: far-AI planning or many kinematic cars.

## Next steps

- Worker spike in the repo behind a flag: `Field` in a worker on circuits, poses to `CarView`s. Measure on a real phone, not only the CDP throttle.
- Replace the raycast bisection with an exact ray-heightfield hit, and index ramp and deck lookups. Re-run this spike's profile and re-record `car.test`, telemetry and feel.
- ~~Owner decision: do seeded AI races or input ghosts need identical results across browsers?~~ Decided yes (J2): write the maths module, rebaseline once with the exact raycast (J10), and add a test that runs the car in Bun and checks it against a digest recorded in Chrome.
- Revisit a WASM core only with phone numbers from the worker in hand.

## Render frame after the look passes (t238)

Measure only. 0.44.1 (aceadcc) against 85cca8a (0.45.0, the look passes: houses, landmarks, firs, ramps, car bodies, puffs, dusk lamps), 2026-11-15, same box as above, shared with other agents' heavy jobs. Each version is a `git archive` copy built with `vite build --mode review`, one patch in both: `open_road` exposed outside dev, plus `place_road`. Served by `vite preview` on one port, headless Chrome on the real GPU (ANGLE D3D11). Scripts and raw JSON are in `.t238/` (untracked): `probe.mts`, `profile.mts`, `final.cjs`, `passes.cjs`, `census.cjs`.

- **Phone:** 844x390 at DPR 3, touch, so the mobile tier at `quality=high` (ratio 2, no shadow map, no bloom, no MSAA, fog 700 m). CPU throttled 4x.
- **Desktop:** 1440x900 at DPR 1, desktop tier high (2048 shadow map, bloom, MSAA), no throttle.
- **Scenes:** seed 1, parked, 8 s warm and then a 10 s sample. "Town" scenes teleport to the road nearest the biggest town: Mainland town, Island coast town, Desert, Alpine, Dunes. The replay is `?replay=r1` (Island, coupe) on Brand Dark, so dusk with headlights.
- **Columns:** frame work is the CPU time inside the rAF callback. Draw calls and triangles come from wrapping WebGL2 `draw*` and multi-draw. GPU MB tracks buffer, texture and renderbuffer bytes; the canvas backbuffer is not in it. Long tasks come from `PerformanceObserver`. Each solo cell is the median of 2-3 runs (6-car rows: see below); runs with more than 5 long tasks were dropped as machine contention (3 runs).
- **Frame gap:** headless rAF runs at the display's 144 Hz, so the gap's p50 is 6.9 ms everywhere and says nothing. The gap's p95 shows dropped frames.

### Before / after, phone

| Scene | Frame work p50 / p95 (ms) | Gap p95 (ms) | Draw calls | Triangles | GPU MB | Long tasks |
|---|---|---|---|---|---|---|
| Mainland town | 6.3 / 10.3 → 6.4 / 11.3 | 14 → 14 | 69 → 69 | 163k → 162k | 6.7 → 6.8 | 0 → 0 |
| Island coast | 7.3 / 13.0 → 7.2 / 11.9 | 14 → 14 | 79 → 79 | 312k → 308k | 18.3 → 18.5 | 0 → 0 |
| Desert | 5.8 / 10.9 → 6.2 / 11.0 | 14 → 14 | 57 → 57 | 114k → 114k | 3.8 → 3.8 | 0 → 0 |
| Alpine | 6.3 / 11.6 → 6.6 / 11.6 | 14 → 14 | 77 → 77 | 185k → 185k | 8.3 → 8.5 | 0 → 2 |
| Dunes | 4.4 / 8.4 → 4.7 / 9.1 | 14 → 14 | 34 → 34 | 91k → 91k | 3.2 → 3.3 | 1 → 0 |
| Replay r1, dusk | 7.3 / 12.1 → 6.3 / 10.1 | 21 → 14 | 86 → 84 | 231k → 224k | 15.6 → 16.0 | 5 → 1 |
| **6-car, Island coast** (5 peers) | 10.6 / 14.6 → 12.6 / 20.4 | 21 → 28 | 139 → 139 | 320k → 320k | 19.0 → 19.6 | 0 → 0 |
| **6-car, Mainland town** (5 peers) | 9.6 / 14.6 → 10.2 / 15.2 | 21 → 21 | 129 → 129 | 171k → 174k | 7.4 → 7.6 | 0 → 0 |

The 6-car rows: 5 peer tabs at `quality=low` join the same room over BroadcastChannel and park on the same spot, so 5 remote cars are in view. Island has 2 runs for 0.44.1 and 3 for 0.45.0; Mainland has 1 run each. A control run had the 5 peers in other rooms, so no remotes: 7.2 / 10.4-10.8 ms on Island for both versions, the same as solo. The peer tabs' own load does not explain the gap.

### Before / after, desktop

| Scene | Frame work p50 / p95 (ms) | Gap p95 (ms) | Draw calls (shadow + main + bloom) | Triangles (shadow / main) | GPU MB |
|---|---|---|---|---|---|
| Mainland town | 2.3 / 3.3 → 2.5 / 3.1 | 17 → 17 | 168 → 166 (10 + 144 + 12) | 491k / 791k → 437k / 740k | 189 → 189 |
| Island coast | 1.8 / 3.9 → 1.5 / 2.4 | 7 → 7 | 125 → 121 | 159k / 448k → 145k / 435k | 190 → 191 |
| Desert | 1.2 / 1.7 → 1.2 / 1.9 | 7 → 7 | 78 → 78 | 12k / 134k → 13k / 134k | 175 → 175 |
| Alpine | 1.8 / 3.7 → 2.0 / 2.9 | 7 → 7 | 124 → 124 | 211k / 456k → 201k / 447k | 185 → 185 |
| Dunes | 1.3 / 2.2 → 1.2 / 1.8 | 7 → 7 | 87 → 87 | 1k / 247k → 2k / 247k | 180 → 181 |
| Replay r1, dusk | 1.6 / 2.6 → 1.6 / 2.3 | 7 → 7 | 130 → 128 | 158k / 412k → 144k / 399k | 192 → 192 |

No long tasks on desktop in either version. About 135 MB of the desktop GPU memory is the MSAA and composer render targets; geometry is 3-20 MB. On Mainland, the desktop frame drops to 72 Hz in half the runs of both versions. The GPU is the limit there (1.2M triangles, 2048 shadow map), and the CPU frame is only 2.5 ms.

### What regressed and why

- **World scenes did not regress.** Draw calls are the same to ±4. Triangles are flat, or down 2-8% on Island, Alpine, Mainland and the replay. Frame work is within run-to-run noise. Every long-task burst in a solo run lined up with another agent's heavy job: it went away on rerun.
- **The new houses (t259) did double the plain-building mesh, but the mesh was small.** Island seed 1, whole map: building plus prop soup went from 3.7k to 7.8k triangles, glass from 3.3k to 6.8k (Desert 16.3k → 20.1k plus 2.0k → 3.6k, Alpine 2.6k → 3.7k plus 0.4k → 1.3k). That is +7.6k triangles on the whole Island, against 300-600k drawn per frame. Other passes shed more than the houses added: the shadow pass lost 10% on desktop, the puffs moved to an unlit instanced shader, and parked cars became one shell. Mainland's high-street glass did not change.
- **What regressed most: remote cars, +0.1-0.4 ms per remote per frame at 4x (Mainland to Island).** It shows only in the 6-car rows: Island +2.0 ms p50 and +5.8 ms p95, Mainland +0.6 ms. The draw calls (12 per remote car) and triangles are unchanged, so this is CPU work, not the GPU. The pass is `Remotes.draw` → `stand_on_drawn` (`car/drawn-stand.ts`). Since 0d68c73, 12b7fd6 and a5a23d6, every wheel of every remote calls `World.drawn_lift` each frame: paving lift, junction grid, `road_dist`, and `nearest(lane_grid, …, lane_point)`. In the 4x profile, `nearest` and `lane_point` cost 24 ms/s against 9.5 ms/s for 0.44.1's `nearest`. The rest of the gap is inside noise, from one profile per version.
- **The target is not met in a 6-car race at 4x.** A solo phone frame is 6-7 ms p50 and 10-13 ms p95, which fits 60 fps. With 5 remotes on 0.45.0, Island reaches 12.6 / 20.4 ms, so p95 is past the 16.7 ms budget. A 4x throttle on this i7-8700K is probably slower than an S24+ core, so the device CPU likely has more headroom than these rows show; unproven. The GPU side, ratio 2 at 1664x768 with Lambert and the dusk lamps, cannot be emulated here. Only a real S24+ run settles either.

### Cheapest wins

From 4x phone CPU profiles of 0.45.0 (`.t238/profile-*.txt`, unminified review build, Island town, solo and 6-car). None changes sim output. Wins 2 and 3 draw the same frame; win 1 moves remote wheels by up to a few cm between snapshots, so it needs a visual check at junction paint and kerbs.

1. **Remote wheel grounding at packet rate, not frame rate.** `stand_on_drawn` for remotes runs `drawn_lift` 4 times per car per frame, and `place_contact_shadow` (`car/contact-shadow.ts:83`) a fifth. A remote's pose comes from snapshots sent at most every 25 ms (`MIN_GAP_MS`), and the lift under a wheel changes by centimetres. Cache the per-wheel lifts per snapshot pair, or skip them past about 60 m where a 2 cm lift is sub-pixel. That wins back most of the regression above. The own car keeps per-frame lifts.
2. **`PadMenu.is_open` runs `document.querySelector("dialog:modal")` on every input read.** The path is `input.blocked` → `pad_menu.is_open` → `overlay()` (`menu/pad-menu.ts:131,225`), several times per frame, and it builds a layer object with closures each time. That is 28-35 ms/s at 4x, 2.2-2.9% of the main thread, about 0.4 ms a frame. Fix: answer `is_open` from a live `document.getElementsByTagName("dialog")` checked for `.open`, plus `settings.is_open` and `chat`, without building the layer.
3. **Freeze static chunk matrices.** `updateMatrixWorld` plus `multiplyMatrices` cost 58-78 ms/s at 4x (4.7-6%). Most of it is walking terrain, road, water, building and tree meshes that never move after placement. Set `matrixAutoUpdate = false` and `matrixWorldAutoUpdate = false` on them after placement, with one `updateMatrixWorld(true)` there. Three then skips them every frame.

Also seen, below these three:

- The minimap redraws its full road layer and N every frame: `drawImage`, 13-15 ms/s at 4x. It could redraw only when a dot moves a pixel.
- Each remote car is 12 draw calls, so a 6-car race is +60 calls over 79 on phone. Merging a remote's meshes by material would cut that if a real device turns out GPU or driver bound.
- t259's other idea, dropping back-wall glass on plain buildings (about 25% of glass), saves about 1.7k triangles on the whole Island. That does not buy frame time. Keep or drop it for looks only.

## Rust vs AssemblyScript (t275, J8)

Measure only. Both ports are re-cut from master f21c597 (0.46.1, after the drift and launch fixes). They use the same `SpikeGround` (island seed 0 tiles from t198's fixture), the same 7 cars and the same 3600 replayed AI steps. Scripts, both ports and raw logs are in `.t275/` (untracked): `as/car.ts`, `rs/src/lib.rs`, `bench/run.ts` (lockstep and bench) and `bench/sim.ts` (one JS glue for both builds).

Toolchains:

- rustc 1.100.0, `wasm32-unknown-unknown`, release: `opt-level 3`, LTO, one codegen unit, `panic = "abort"`, no crates.
- AssemblyScript 0.28.9, `-O3 --runtime stub --noAssert`.

Runtimes are §2's: Bun 1.3.0, Node 22.14, headless Chrome 157 and Playwright WebKit 2359. The box ran 2-4 other agents' `ai-race` jobs throughout. So every case runs once per round, the rounds interleave, and each cell is the median of 5 rounds after a warm-up round. Repeat runs moved cells by up to 15%.

### Answer first

- **Both ports are bit-identical to the JS slice.** With the port's own maths swapped into `Math.*`, the lockstep harness found no difference in any of the 126 numbers per car. That covers all 7 cars, all 3600 steps and all four runtimes. It held for the AI replay and for a scripted drift run with the assist off (launch from rest, handbrake taps, held drifts, loose ground).
- **Each port gives one digest in all four runtimes.** The island terrain stage gives the same heights in JS and in both ports, in every runtime.
- **The two ports differ in one maths function: `hypot`.**
  - Rust's `f64::hypot` (the compiler's libm) and AssemblyScript's `Math.hypot` differ by 1 ulp on 13% of inputs, so their digests differ.
  - `sin`, `cos`, `tan`, `atan`, `atan2` and `asin` agree bit for bit over 10⁶ inputs.
  - With `hypot` written as `sqrt(a·a + b·b)` in both, Rust and AssemblyScript give the same digest.
- **Speed is a wash on the target engine.**
  - As written, Rust is 19-33% slower with 7 cars. That is `hypot`: Rust's costs about 150 ns a call against 100 ns (in Bun), at about 20 calls per car step (5 per wheel on the ground).
  - With the same `sqrt` hypot, the two tie in Chrome, and Rust is 15-22% faster with 7 cars in Bun, Node and WebKit. With 1 car they are within 7% everywhere.
  - The S24+ runs Chrome's V8. There they tie on the car step, and AssemblyScript is 3-15% faster on the terrain stage (Chrome and Node).
- **Dev cost favours AssemblyScript.** It is half the lines and reads like `car.ts` line for line. It installs as an npm dev dependency, so `bun install` covers every machine and CI. Rust needs rustup on every machine that runs a test.

### µs per car per step

| | Bun | Node | Chrome | WebKit |
|---|---|---|---|---|
| JS, 1 car | 5.40 | 5.42 | 5.69 | 5.87 |
| JS, 7 cars | 5.87 | 5.91 | 6.06 | 5.95 |
| AssemblyScript, 1 car | 4.27 | 3.45 | 3.27 | 4.25 |
| AssemblyScript, 7 cars, one `step_all` | 4.32 | 3.90 | 3.32 | 3.89 |
| Rust, 1 car | 5.26 | 4.81 | 4.18 | 4.33 |
| Rust, 7 cars, one `step_all` | 5.24 | 4.90 | 4.43 | 4.64 |
| AssemblyScript, `sqrt` hypot, 1 car / 7 cars | 3.77 / 4.09 | 3.25 / 3.57 | 3.06 / 3.05 | 3.69 / 3.97 |
| Rust, `sqrt` hypot, 1 car / 7 cars | 3.87 / 3.40 | 3.10 / 3.04 | 3.19 / 3.13 | 3.45 / 3.10 |
| **speedup over JS, 7 cars: AS / Rust** | 1.36x / 1.12x | 1.52x / 1.21x | 1.83x / 1.37x | 1.53x / 1.28x |
| **same, `sqrt` hypot: AS / Rust** | 1.44x / 1.73x | 1.66x / 1.94x | 1.99x / 1.94x | 1.50x / 1.92x |

- "1 car" steps each car alone through its own 3600 steps.
- Three ways of driving 7 cars cost the same within 0.4 µs, which is noise: one call per car, one `step_all` call, and `step_all` with the pose copied back into the JS `Car`'s three.js objects every step.
- An empty call costs 7-27 ns, measured cold. The glue passes controls as call arguments and reads state through one shared `f64` buffer, so the same JS drives either build.

### Worldgen: island terrain stage, ms per map

The stage is picked by profile. `terrain()` (`worldgen/terrain.ts`) folds hills fbm, ridged fbm, the peak and the shore mask over the 513×513 lattice. It takes 155 ms of the 425 ms that island seeds 0-4 take in Bun (37%). Next come trails at 65 ms, then jumps, stamp and links at 30 ms each.

The stage is pure numbers: about 4 million value-noise lookups, no transcendental maths, and one `Float32Array` out. The port is the island recipe's five layers with their constants inlined. JS draws the peak position (`mulberry32`) and passes it in.

| | Bun | Node | Chrome | WebKit |
|---|---|---|---|---|
| JS | 188.7 | 113.8 | 108.0 | 153 |
| AssemblyScript | 56.8 | 71.7 | 75.0 | 66 |
| Rust | 50.5 | 82.1 | 77.2 | 61 |

WebKit's timer counts whole milliseconds here. All 263,169 heights are bit-identical between JS and both ports in all four runtimes (digest `e1a2435f`).

### Determinism digests

Final digest of all 7 cars' state after 3600 steps:

| run | AI replay (assist on) | drift script (assist off) |
|---|---|---|
| JS, Bun and WebKit (JSC) | `b0de7eb0` | `8282048e` |
| JS, Node 22 | `2af93e0d` | `f6558de4` |
| JS, Chrome 157 | `32d179dd` | `d8a2274e` |
| AssemblyScript, own maths, all four runtimes | `6c601001` | `3de6e3ea` |
| JS with AssemblyScript's maths in `Math.*`, all four runtimes | `6c601001` | `3de6e3ea` |
| Rust, own maths, all four runtimes | `3e3b7eae` | `ab081c57` |
| JS with Rust's maths in `Math.*`, all four runtimes | `3e3b7eae` | `ab081c57` |
| either port with `sqrt` hypot, and JS with that maths | `5ca9c322` | `b7706d2e` |

- The replay's JS and AssemblyScript digests are the same as t198's. The drift and launch fixes since then sit on branches the AI replay never takes: the assist stays on, and no car drops below 1 m/s.
- The assist-off drift script covers those branches: about 7000 launched car steps, 17000 held-drift car steps and 7000 with the TCS split brake, plus 6500 wheel steps in the air and 44000 on loose ground. Its inputs are arithmetic only, so every runtime replays the same ones.
- Native JS still splits three ways (JSC, Node's V8, Chrome's V8), as in §3.

### Build, size, install

| | AssemblyScript | Rust |
|---|---|---|
| `.wasm` (gzip -9) | 30.5 KB (11.6 KB) | 79.2 KB (28.1 KB); 73.5 KB stripped |
| build | 2.2 s (`asc`; every build is a full build) | 1.5 s from clean, 1.4 s after a touch (no crates) |
| imports | `env.abort` | none |
| install on Windows | an npm dev dependency, `assemblyscript` (102 MB with binaryen) | rustup (`rustup-init.exe` or `winget install Rustlang.Rustup`) with the stable MSVC host, then `rustup target add wasm32-unknown-unknown` |
| where the toolchain must exist | anywhere `bun install` ran, CI included | every dev machine and CI image, outside `package.json` |

- AssemblyScript on Windows: `bunx asc` fails on Bun 1.3.0 ("does not provide a binary named …asc.js"). `npx asc` or `node node_modules/assemblyscript/bin/asc.js` works.
- Rust on Windows: the wasm link uses the bundled `rust-lld`. The MSVC host wants Visual Studio Build Tools for host crates. This box has VS 2022; a no-crate build without it was not tried.
- Rust's extra size was not broken down. It is likely std's allocator behind `Vec` and the panic formatting for index checks. `no_std` or `wasm-opt` would cut it. Neither was tried.

### Dev cost

| | AssemblyScript | Rust |
|---|---|---|
| lines, car slice (code lines, no blanks or comments) | 566 | 1239 (rustfmt at 160 columns; 1424 at its default 100) |
| lines, terrain stage | 51 | 77 |
| JS it ports | 1004 code lines: `car.ts`, `steering.ts`, `tyre.ts`, `rigid-body.ts`, `curve.ts`, `axles.ts`, with the keyboard modes, nitro and `park` the ports leave out | same |
| memory safety | `@unmanaged` structs are raw pointers with no index check. A wrong pointer that lands inside memory reads garbage without a trap | `Vec` indexing is checked. A bad car index panics, which traps as `unreachable` |
| stack traces | V8: `wasm-function[22]`, no names unless built with `--debug`. JSC: `unknown` | V8: mangled Rust symbol names (`rust_panic`, `panic_with_hook`). JSC: `unknown`. With `panic = "abort"` the panic message is lost unless a hook forwards it |
| source-level debugging | `--sourceMap` maps to the `.ts` in DevTools | DWARF needs Chrome's C/C++ DevTools extension. Not tried |
| from Bun tests and scripts | `WebAssembly.instantiate(readFileSync("sim.wasm"))` and raw exports. Build with `asc` in a pretest step or a `bunfig` preload | The same glue served both builds here. Build with `cargo build` first, so tests fail on a machine without rustup unless the `.wasm` is committed |

How close each reads to `car.ts`:

- **AssemblyScript:** line for line. It keeps the same expressions and `Math.*` names, plus an `@unmanaged` `V3` and `Q4` with three.js's method names and op order. The port was t198's file plus the five commits since.
- **Rust:**
  - Names are the same (snake_case already), and the phases are the same, as methods.
  - The `V3` value type returns new vectors instead of mutating them.
  - rustfmt spreads every `a ? b : c` into a five-line `if`.
  - JS `Math.max`, `min` and `sign` need hand-written helpers. Rust's `f64::max` returns the other argument when one is NaN and does not order ±0, and `signum(0)` is 1. A build on `f64::max` and `f64::min` gave the same digests and the same speed here, so the helpers are insurance.

Both ports had to copy three.js's operation order by hand: `applyQuaternion`, `normalize`'s `length() || 1`, and `setFromAxisAngle`'s `0 * s`, which can be -0. In both, the lockstep diff is what proves it. Neither language helps there.

### Recommendation

**AssemblyScript.**

- On the phone's engine (V8) it ties Rust on the car step once both use the same maths, and it is faster on the terrain stage.
- It is half the code, and it reads line for line against `car.ts`.
- It is one dev dependency, which `bun install` brings to every machine and CI.
- Rust's edge does not reach the S24+: checked indexing, and 15-22% more speed in JSC and Node with equal maths. It costs a second toolchain outside `package.json`.

Whichever lands, the J2 maths module should define two-argument `hypot(a, b)` as `Math.sqrt(a * a + b * b)`:

- It is the only function where the two compilers' maths differ.
- `sqrt` is exact IEEE in every engine and in WebAssembly, so this needs no library to be deterministic.
- With 7 cars it made the car step 1.3-1.9 µs cheaper in Rust. In AssemblyScript the change, -0.1 to +0.3 µs, is within noise.
- The car's inputs never come near overflow.
- It moves the physics by ulps, so it belongs in the J2/J10 rebaseline, not after it.

## Sim worker, built (t276)

Quest 2732f6d (J1, J4, J5). `src/sim/`: `SimHost` steps the player's car, pads, `world.collide`, an AI field with the player in its contact pass, the near-miss pass and the car's rewind (body, nitro, pads). Main runs it in place by default. `?simworker` hosts the same `SimHost` in a worker.

- **Transport.** One post per frame carries the commands since the last frame (place, park, swap, shift, aids, refill, a knocked item's drag, rewind clear, field start, world ops) and the frame's request (kind, step count, controls, `now`, blend, peer spots). The reply is one cloned `Float64Array` with a fixed, append-only layout (`sim-packet.ts`, `SIM_PACKET` 1): a header (epoch, kind, steps, stepped, impact, blend), the player's car (pose, the pose before the last step, gear, rpm, steer, braking, throttle, nitro, scrape, every wheel's contact, point, slip, angle, spin, reach), then each AI car's pose, braking and wheels. 8 + 39 + 12 a wheel floats for the player, 8 + 3 a wheel per AI car: 215 floats, 1720 bytes, for the coupe and 6 AI.
- **Float64, not the planned Float32.** Main times laps and modes and picks reset spots from the car it reads; float32 would make those differ from the flag-off game by rounding. The test proves the flag-on packet equals the flag-off car bit for bit.
- **Main draws one frame late.** Frame N reads the reply to frame N-1's post, and every per-frame reader (HUD, audio, rumble, camera, ghost record, modes, stuck and fall checks) takes the reply's own kind, step count and impact, so flag-on is flag-off shifted by a frame. A place, park, swap or refill moves main's mirror at once and starts a new epoch; replies from before it are dropped. Two things land a frame later still: a knocked item's drag (found on the mirror, applied in the worker's next frame) and the first and last frame of a rewind (main rewinds the lap clock in the frame it decides, the car one reply later).
- **World.** The worker builds its `World` from the plan main built from (`WorldStream.plan`). A `WorldJournal` on main's world records every tile, plant, `place` and `lay` in order from before the first chunk lands, and the ops ride in the frame posts.
- **Rewind and ghost.** Car body, nitro and pads rewind in the sim (nitro's near-miss keys are solid objects that do not cross to main). The lap clock stays a rewind part on main, recorded and stepped with the same `now`. The ghost records on main from the mirrored car: it draws and saves to localStorage, which a worker has not got.
- **Main only.** `?lab` (the recorder reads every step) and review shots (they set the pose) keep the sim on main under the flag.
- **`?field=<cars>`** (1-7): an AI field on the island circuit in free drive, the player's build on every car, for measuring before race mode has one.

Proof:

- `src/sim/sim.test.ts`: a packet read back into a mirror car re-encodes to the same bits. Island seed 1, coupe: 900 frames solo, 900 with a 6-car field, 300 after a park and a swap to the rally, with holds, rewinds, shifts, refills, an aids change and peer spots, 5-7 steps a frame. Every worker reply equals the flag-off packet bit for bit. Removing the aids command in the worker turns it red at frame 700.
- `car.test.ts`, `scripts/telemetry.ts` and `scripts/feel.ts` import none of the changed files (25 files, import graph walked), so they are byte-identical by construction.

### Main-thread ms per frame

Vite preview build, headless Chrome (rAF at ~134 Hz), island seed 1, coupe, throttle held. CDP `Performance.getMetrics` `TaskDuration` over 12 s, after 3 s warm-up, divided by frames. Mean of 3 runs (range in brackets).

| | CPU throttle | sim on main | `?simworker` | saved |
|---|---|---|---|---|
| solo | 1x | 1.61 (1.52-1.67) | 1.64 (1.63-1.65) | none |
| 6 AI | 1x | 2.16 (2.05-2.22) | 2.05 (2.00-2.12) | 0.11 ms (5%) |
| solo | 4x | 13.8 (11.8-15.0), 73 fps | 15.5 (13.5-18.3), 65 fps | none, within noise |
| 6 AI | 4x | 19.4 (17.7-21.2), 51 fps | 16.6 (15.4-17.6), 60 fps | 2.9 ms (15%) |

- The 6-car field costs main 0.55 ms a frame at 1x (5.7 ms at 4x) over solo. The worker takes 0.11 (2.9) of it. The rest is drawing six more `CarView`s: phase 3 needs a cheaper AI car view (fewer draws, LOD, the far-AI follower), or the frame stays view-bound.
- Solo gains nothing on main: one car's steps (about 0.05 ms a frame at 1x) are what the post, the message task and the mirror read cost. §4's 88-90% was sim time alone; these numbers are the whole main thread.
- The 4x rows carry §4's caveats: the throttle does not reach the worker and inflates short tasks, so run-to-run spread is ±2 ms. The phone (S24+, frame time with 6 AI, worker on vs off) is the number that decides the default.

## AI race frame time (t277)

Phase 3's free-play race (`?airace=circuit`, `src/modes/ai-race.ts`) with the two phase 3 savings in: AI cars past 75 m from the camera draw as one baked mesh (`car/far-view.ts`, one draw call, no shadow), and past 120 m from the player and off screen they coast on their line with no physics (H7, `Driver.coast`).

Vite preview of a `--mode review` build, headless Chrome, 1440 x 900, island seed 0, circuit, CPU throttle 4x. `?aidrive` drives the player's car with the field's own driver; `?aicars=1` is the baseline, since the autopilot needs a field. CDP `TaskDuration` over 12 s, divided by frames; two runs each. "start" measures from 8 s after the lights show (the pack still bunched, every car close and on the physics); "60 s" from 60 s in (the pack strung out over a few hundred metres). Script: `.t277/perf.ts` (untracked).

| | CPU throttle | sim on main | `?simworker` |
|---|---|---|---|
| 1 AI, start | 4x | 30.2 (29.8-30.5), 33 fps | |
| 6 AI, start | 4x | 34.4 (34.4-34.5), 29 fps | 30.1 (29.0-31.2), 33 fps |
| 1 AI, 60 s | 4x | 34.5 (32.5-36.6), 29 fps | |
| 6 AI, 60 s | 4x | 35.9 (34.0-37.8), 27 fps | 30.1 (29.7-30.6), 32 fps |

- Five more AI cars cost main 4.2 ms a frame with the pack bunched at the start and 1.4 ms (inside the ±2 ms spread) once it strings out. With the sim in the worker both rows sit at the 1-AI baseline on main.
- The baseline is not t276's 13.8 ms solo row: this is the circuit start in a race, with its marks, beams and cones, and a different machine state. Compare rows within this table only.
- A CPU profile at 1x has JavaScript at a few percent: 41% `(program)` (GL submission and compositing) and 30% idle. The race scene is draw-bound before the AI adds anything.
- The phone (S24+, J6/J7) is still the number that decides; not measured here.
