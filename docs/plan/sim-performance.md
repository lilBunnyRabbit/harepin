# Sim performance: profile, WebAssembly, determinism, worker

Research spike (task t198), measure only. Question: the AI field (`docs/plan/ai-racers.md` §4) and whatever comes after it need a lot of sim per frame. Does WebAssembly buy it, does a Web Worker, and what does either do to determinism, ghosts and records?

Code measured: the AI field branch (`worktree-agent-a6399ebfcdb02730e`, 94b6bf0: `src/ai`, `src/car/contact.ts`). The spike's scripts and the AssemblyScript port live in a scratch folder. They are not committed.

Machine: i7-8700K (6 cores, 12 threads), Windows 11. Runtimes: Bun 1.3.0 (JavaScriptCore), Node 22.14 (V8 12.4), headless Chrome 157 (V8), and Playwright's WebKit build 2359 (JavaScriptCore on Windows). AssemblyScript 0.28.9, `-O3 --runtime stub --noAssert`.

## Answer first

- Half the field step is ground height queries, not tyre maths: 64 `ground.height` calls per car per step. The branchy tyre and assist code is not the main cost.
- WebAssembly runs `Car.step` (with its ground) **1.5-1.8x** faster than JS in every engine. JS↔WASM calls and pose copies cost almost nothing (5-9 ns a call, 0.02 µs a car, within run-to-run noise).
- A worker takes **88-90%** of the sim's main-thread time off the main thread, at 1x and 4x throttle alike. One round trip per frame costs 40 µs at 1x and 0.35 ms at 4x.
- The JS physics is **not** bit-identical across engines today. JSC and V8 differ on step 0, and so do two V8 versions (Node 22 and Chrome 157). A seeded 7-car race finishes in a different order in Bun and in Node.
- The WASM port gives the same bits in all four runtimes. The reason is its own maths library, not WebAssembly. With that maths swapped into `Math.*`, the **JS** physics also gives the same bits in JSC and V8. Determinism needs a deterministic maths module, not WASM.
- Recommendation: worker first, cheap ground-query wins second, and a deterministic maths module if identical results across browsers matter. No WASM sim core now: 1.5-1.8x does not pay for a second physics source.

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
4. **WASM later, scoped.** Only if phones still miss budget after 1-3, and then as the only physics source (car step plus the whole world ground in AS). Use the lockstep harness from this spike as the proof. Also worth it for batch work that is pure numbers with few boundary crossings: far-AI planning or many kinematic cars.

## Next steps

- Worker spike in the repo behind a flag: `Field` in a worker on circuits, poses to `CarView`s. Measure on a real phone, not only the CDP throttle.
- Replace the raycast bisection with an exact ray-heightfield hit, and index ramp and deck lookups. Re-run this spike's profile and re-record `car.test`, telemetry and feel.
- Owner decision: do seeded AI races or input ghosts need identical results across browsers? If yes, write the maths module first, rebaseline once, and add a test that runs the car in Bun and checks it against a digest recorded in Chrome.
- Revisit a WASM core only with phone numbers from the worker in hand.
