# Feel lab v2: plan

Status: plan for task t175, base master 6699bf7, 2026-11-14. No code changed. The owner picks the decisions in section 9 before the first edit.

Short version: v1 gave the owner a world, packs, a recorder and a paste-back block. What it lacks is everything around a session: no headless numbers before the owner drives, no list of which car and setup to cover, no way to compare a mod with stock or this session with the last, no per-car target to judge against, and no mechanical gate between "the owner liked trial C" and "cars.ts changed safely". v2 adds those, mostly as one script (`scripts/lab.ts`) built on scenario functions the handling scripts already export, a committed handling golden, a few recorder metrics per handling trait, and pack rules that keep a session under 20 minutes.

The loop v2 is built for:

1. Lead writes a pack, runs `bun scripts/lab.ts <pack>`: sim numbers per trial, a delta against the pack's base trial, an estimated drive time. Obvious outliers get fixed before the owner sees them.
2. Owner opens `?lab=<pack>`, judges one trait, drives at most 10 trials in at most 20 minutes, presses Copy.
3. Lead commits the paste, runs `bun scripts/lab.ts diff` against the last session, decides.
4. A winner goes into `cars.ts` one car per commit, through the gate in section 7.

## 1. What exists today

| Piece | Where | State |
|---|---|---|
| Lab world | `src/worldgen/lab.ts:320` `LAB_LAYOUT`, `:332` `generate_lab` | 14 stations, 47 lanes. Builds headless in about 100 ms: `new World(0, KINDS.lab.generate(0, []))` ran under Bun on this tree, stations `skidpad:11 runway:11 slalom:5 hill:4 sweeper:3 kicker:3 …`. Lanes carry spawn, ring, gates and a `path` (`src/worldgen/lab.ts:95`) |
| Packs | `src/lab/packs.ts:4-9` | `demo`, `first-look` (5 trials), `t1-surfaces` (22), `t2-drift` (12) |
| Recorder | `src/lab/recorder.ts:33` `Metrics`, `:68` `Recorder`, `:172` `step(dt, car, input)` | pure, allocation-free; lap, latg, slip, held/chain, spins, lag, rec, 0-100, stop, top, wheelspin, air/land/bounce, offs, resets, input shares |
| Trial spec | `src/lab/pack.ts:94` `resolve_trial`, `:68` `spec_hash`, `src/car/driver.ts:189` `swap(build, timed, spec)` | build code + `Mod[]` or a lab car; PI and class per trial |
| Export | `docs/lab.md` "The export block" | line-based `#lab` / `#trial` / ` m` / ` a` / ` n` / `#end` |
| Headless scenarios | `scripts/handling.ts:82` `bench(spec)` (13 columns), `scripts/drift.ts:37` `drift`, `catch_drift`, `launch`, `carve`, `wheel_trace` (all take a `CarSpec`), `scripts/slide.ts:19` `slide(spec, …)`, `scripts/pi.ts:35` `measure(spec)` | exported functions on a spec: reusable as is |
| Headless, not reusable as is | `scripts/feel.ts:6` and `scripts/telemetry.ts:5` read `car_spec(process.argv[2])` at module scope and run top-level blocks | car id only, no build, no import; 16 feel scenarios locked inside the script |
| Grounds | `scripts/grounds.ts:11-22` `GROUNDS` | asphalt, shoulder, dirt, hardpack, grass, scree, wet, sand, packed_snow, ice. No `snow`, no `slush`: the lab has 11 surfaces, the scripts 10 |
| Worker pool | `scripts/proof/pool.ts:3-8` `pool_size`, `run_pool` | `--jobs`, all cores by default |
| Car proof | `src/car/car.test.ts` | behaviour tests (steer modes, swap, settle, grass drag), `:322` pins the car-sized list. No digest: "bit-exact" today means running feel/telemetry on two commits by hand and diffing |
| Career marks | `scripts/career.ts:31-38` | race `three` = median of bot drives at the class cap; `LATER_CARS` (tsumuji, sajin) kept out so they never move the medians |
| Old feel targets | `docs/plan/handling.md:110-160` | targets and a measured table for 5 cars, 2026-11-09. Stale: today's coupe stops in 31.6 m where the table says 35.0 |

### 1.1 Today's numbers (`bun scripts/handling.ts`, this tree, stock spec, flat asphalt)

| car | drive | PI | 0-100 s | top | 100-0 m | skidpad g | turn-in ms | roll ° | lift-off ° | power-on ° | slide hold s | grass g |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hatch | fwd | 407 C | 9.14 | 190 | 33.6 | 0.99 | 50 | 2.3 | 11.0 | 0.6 | 0.4 | 0.67 |
| coupe | rwd | 540 B | 5.09 | 275 | 31.6 | 0.94 | 61 | 2.4 | 4.1 | 26.5 | 1.5 | 0.66 |
| muscle | rwd | 543 B | 5.28 | 285 | 32.3 | 0.92 | 67 | 4.4 | 3.5 | 30.1 | 2.0 | 0.66 |
| rally | awd | 511 B | 4.53 | 236 | 32.9 | 0.92 | 56 | 3.2 | 15.6 | 17.9 | 0.7 | 0.85 |
| kaze | rwd | 513 B | 5.75 | 256 | 31.6 | 0.93 | 56 | 2.0 | 4.8 | 27.5 | 2.5 | 0.66 |
| sturm | rwd | 573 B | 4.44 | 292 | 29.0 | 0.97 | 72 | 2.2 | 2.2 | 1.2 | 0.0 | 0.68 |
| raijin | awd | 521 B | 4.48 | 267 | 31.7 | 0.94 | 61 | 2.7 | 4.9 | 16.0 | 0.9 | 0.75 |
| formula | rwd | 740 S1 | 4.07 | 301 | 24.2 | 1.17 | 42 | 0.5 | 14.9 | 29.5 | 2.5 | 0.61 |
| fujin | awd | 803 S2 | 2.64 | 324 | 21.6 | 1.35 | 36 | 0.7 | 19.1 | 4.0 | 0.0 | 0.63 |
| tsumuji | rwd | 415 C | 9.31 | 183 | 33.8 | 0.96 | 50 | 2.4 | 17.5 | 20.8 | 1.5 | 0.67 |
| sajin | awd | 483 C | 4.58 | 189 | 36.0 | 0.83 | 53 | 4.9 | 24.1 | 18.8 | 0.1 | 0.78 |

The bus (PI 116 D) is left out of the matrix (decision O6).

Questions this table already raises, before anyone drives: Sajin lifts off to 24° and Fujin to 19° (the hatch, the "safe" car, sits at 11°); the Sturm, a rear-engine RWD car, shows 1.2° power-on where every other RWD car is 20-30°; the hatch out-grips the coupe on the skidpad. Each is either intended character or a bug, and nothing written says which. That is the gap section 2 closes.

## 2. Per-car targets

A tuning session needs a "right" to judge against. `docs/plan/handling.md` has one for 5 cars; 6 cars have none. v2 adds `docs/car-feel.md`, the handling twin of `docs/car-style.md`: one row per car, a one-line character, and a target band per trait column of the golden (section 5). The lead drafts it from the handling.md spec, the car-style references and the measured table above; the owner approves it once (decision O1). From then on a number outside its band is a bug, a number inside it with a bad rating is a feel problem, and a pack exists to resolve one or the other.

| car | one line (draft) | traits that must stand out |
|---|---|---|
| hatch | FWD, light, safe | sharpest turn-in of the road cars, power-on near 0°, never spins on lift |
| coupe | balanced RWD reference | none: every other car is read against it |
| muscle | heavy, lazy, wild on power | laziest turn-in, most roll, most power-on oversteer |
| rally | AWD gravel car | quickest 0-100 of the B cars, rotates on lift, best on loose |
| kaze | easiest drifter | longest slide hold, forgiving catch |
| sturm | rear-engine, fast, traction out of corners | top speed, brakes, rear bite on exit; lift-off snap risk to judge |
| raijin | AWD sedan, grip | high skidpad, neutral, stable at speed |
| formula | downforce car | grip rises with speed, nervous on lift, poor off road |
| fujin | prototype, most grip | the limit car: highest g, stable at top speed |
| tsumuji | light pop-up roadster, momentum drifter | rotates on lift, carries speed through slides |
| sajin | sand buggy | best on sand and grass, soft, slow on tarmac |

## 3. Matrix: which car x setup to cover

Not every build: 11 cars x 6 tyres x 5 aero x 5 suspension is thousands of specs. Families, each meaning one question, built from parts by name in `scripts/lab/setups.ts` (codes generated with `build_code`, never hand-typed):

| Setup | Parts (slot: part) | Question it answers |
|---|---|---|
| `stock` | all defaults (`DEFAULT_PARTS`, `src/car/build.ts:213`) | the car's own character |
| `grip` | tyres Semi-slick, suspension Race, brakes Race (`build.ts:79`, `:114`, `:126`) | does the car keep its character when built for grip |
| `aero` | `grip` + aero Race kit (`build.ts:101`) | high-speed balance and stability with full downforce |
| `drift` | suspension Drift, engine Tuned, bias Rear (the Drift preset's parts, `src/car/presets.ts:13`) | entry, hold, exit |
| `dirt` | tyres Rally, suspension Lifted, engine Tuned (the Dirt rally preset, `presets.ts:11`) | loose-surface behaviour and landings |
| `max` | the shipped top build (`presets.ts:10`, `:15`) | the class ceiling |
| `preset:<name>` | every `PRESETS` row as it ships (`presets.ts:9-17`) | what players actually pick |

Coverage:

| car | stock | grip | aero | drift | dirt | max | specs |
|---|---|---|---|---|---|---|---|
| hatch | x | x | x | | x | | 4 + preset |
| coupe | x | x | x | x | x | | 5 + sweeps |
| muscle | x | x | x | x | | | 4 + preset |
| rally | x | x | x | | x | | 4 + preset |
| kaze | x | x | x | x | | | 4 |
| sturm | x | x | x | x | | | 4 |
| raijin | x | x | x | | x | | 4 + preset |
| formula | x | | | | | x | 2 + preset |
| fujin | x | | | | | x | 2 + preset |
| tsumuji | x | x | | x | | | 3 + preset |
| sajin | x | | | | x | | 2 + preset |

Sweeps on the coupe only, the reference car: every tyre (6, `build.ts:77-82`) and every aero level (5, `build.ts:91-104`), so the lead learns what one step of a part does with the car held fixed. `scripts/surfaces.ts` already sweeps tyres x grounds for one car; the coupe sweep reuses its `measure` shape.

About 45 car setups + 9 presets + 11 sweep rows, roughly 65 specs. Grounds per spec: asphalt for all; dirt, grass, sand, packed snow, ice for `stock` and `dirt` only. Runtime estimate: `bench` took 2.5 s per car on this machine including Bun start, so about 65 x 2 s on asphalt plus about 40 x 5 grounds x 1 s, about 6 minutes on one core, under a minute on the pool (unverified until built). It runs as a heavy check: `hq lock run -- bun scripts/lab.ts golden --check`.

## 4. Traits: stations, metrics, questions

One row per handling trait. "Headless" is what `scripts/lab.ts` prints; "Lab" is where the owner feels it and what the recorder logs. New metrics go into `Recorder` the same allocation-free way as the existing ones and append to the export's key order (old pastes still parse).

| Trait | Headless (exists unless marked) | Lab station / lane | Recorder metric | Question (1-5) |
|---|---|---|---|---|
| Turn-in | `bench.turn_in` (ms to 0.2 rad/s), feel "step steer" t90 + overshoot (needs P1) | `slalom/asphalt`, `hairpin/asphalt` | `lag` (exists), new `yawover`: yaw peak over its settled value after a reversal | lazy - darty |
| Mid-corner balance | `bench.skidpad`; new `balance`: steer angle over kinematic angle (`wheelbase / R`) on a held radius, above 1 pushes | `sweeper/r120`, `skidpad/*` | new `us`: the same ratio from the live steer angle and ring radius | pushes - rotates |
| Power oversteer | `bench.power` (2nd gear, TCS off) | `hairpin/asphalt` exits | new `pwr`: peak slip within 1.5 s of throttle going past 0.8 with steer over 0.3 | none - snaps |
| Lift-off | `bench.lift`, feel "lift-off mid corner" both assists | `sweeper/r120`, `sweeper/r200` | new `lift`: peak slip within 1.5 s of throttle dropping from over 0.5 to under 0.1 above 0.5 g | none - snaps |
| Braking stability | telemetry 100-0 ABS on/off, `bench.stop`, `bench.dive`, feel "trail brake" | `brake/asphalt` (straight), hairpin entries (trail) | `stop` (exists), new `bdev`: heading change in a straight stop, degrees; new `trail`: peak slip while brake > 0.3 and steer > 0.2 | wanders - straight |
| Drift entry | `drift.launch` (armed, t30), feel "handbrake flick" | `drift/asphalt`, `eight/asphalt` | new `entry`: s from slip past 10° to past 25° | won't go - easy |
| Drift hold | `drift.drift` held, `bench.hold` | same | `held`, `chain`, `slip` mean (exist) | can't hold - holds |
| Drift exit | `drift.catch_drift` | same | `rec`, `spins` (exist) | spins - catches |
| Landing | new headless: the bot drives `kicker/*` on the lab `World` (P2b) | `kicker/small`, `big`, `drop` | `air`, `land`, `bounce` (exist), new `pitch`: peak pitch rate in the 0.3 s after touchdown | bounces - plants |
| Surface transitions | new headless: bot straight across `grid/mixed` on the lab `World` (P2b) | `grid/mixed`, sand-to-asphalt and ice-to-packed-snow seams | new `xslip`: peak slip within 0.5 s of the ground row changing (`step` takes the footing the sim already resolved; no lookup of its own) | jolts - smooth |
| Top-speed stability | feel "yaw kick at 220" and "lane change 160" (need P1), telemetry top | `oval/asphalt` straights | `top` (exists), new `yawsd`: yaw-rate RMS above 200 km/h, with steer RMS beside it | nervous - planted |

Questions per pack: at most 3 scales plus the note, picked from this table for the trait the session judges. `ask.ts` gets one entry per row so packs never retype labels.

## 5. Automated baselines

### 5.1 `scripts/lab.ts`

| Command | Does |
|---|---|
| `bun scripts/lab.ts <pack>` | resolves every trial (`resolve_pack`, `src/lab/pack.ts:102`), runs the headless scenarios for the trial's station on the trial's lane ground, prints one ` sim` line per trial in the export's key order, a delta column against the trial marked `base: true`, and the estimated drive time (section 6.1). Fails on NaN or a budget over 20 min |
| `bun scripts/lab.ts matrix [car]` | the section 3 matrix as a table: setups down, trait columns across |
| `bun scripts/lab.ts golden` / `--check` | writes / diffs `scripts/golden/handling.txt` (5.2) |
| `bun scripts/lab.ts diff <old> <new>` | two pasted export blocks, section 6.3 |
| `bun scripts/lab.ts promote <pack> <trial>` | the v1 plan's printer: resolved spec as a TS literal with the base car's values beside each changed field |

Scenarios come from the exported functions in section 1 (`bench`, `drift`, `catch_drift`, `launch`, `slide`). The feel.ts and telemetry.ts blocks move into `scripts/bench/feel-cases.ts` and `scripts/bench/telemetry-cases.ts` as functions on a `CarSpec`, both scripts keep their CLI and print byte-identical output: its own `refactor:` commit (P1). `scripts/grounds.ts` gains `snow` and `slush` rows so every lab surface has a ground.

### 5.2 Handling golden

`scripts/golden/handling.txt`: one line per matrix spec x ground, fixed decimals, the spec hash at the front:

```
coupe.stock asphalt spec#1a2b3c4d t100=5.09 top=275 stop=31.6 dive=2.8 g=0.94 turn=61 roll=2.4 lift=4.1 pwr=26.5 hold=1.5 bal=1.08 hb=24 kick220=0.41
coupe.stock ice     spec#1a2b3c4d t100=… 
```

It does for cars what the worldgen goldens do for worlds: `--check` lists which lines moved. A change to one car that moves any other car's line is wrong by definition. This replaces the hand-run two-commit diff of feel/telemetry that AGENTS.md calls the bit-exact proof, and it fits the rule that the committed goldens are the base. Decision O3.

### 5.3 Bot on the lab world (P2b, later)

The flat-ground scenarios cannot measure landings or seams. For those two traits, a straight-line or path-following bot (the `scripts/autolap.ts:133` controller shape on the lane `path`) drives the lane on a headless lab `World` and feeds the real `Recorder`, so the ` sim` line uses the same code as the owner's ` m` line. Only for `kicker` and `grid`; every other station keeps the flat scenarios, which are faster and already trusted.

## 6. Sessions and comparisons

### 6.1 Session rules (owner time)

| Rule | Why |
|---|---|
| One trait per session, named on the pack card ("Today: lift-off") | the owner judges one thing; mixed packs blur ratings |
| At most 10 trials and 20 min estimated (drive + 45 s per card), checked by `pack.test.ts` | estimate per goal: skidpad lap about 12 s on asphalt (r = 30 m at about 0.9 g), longer on low grip by `sqrt(1/g)`; hairpin run about 40 s; sweeper about 10 s; runway about 20 s |
| An anchor trial first and last: the stock coupe, same station | the two ratings of one car give the session's noise band |
| At most 3 scales + note | 30 s per card, not 2 minutes |
| Lead has already run `scripts/lab.ts <pack>` and removed every trial whose numbers alone answer the question | owner time goes only on what numbers cannot tell |

Today's packs against these: `t1-surfaces` is 22 trials, about 26 min; split it into `t1a` pads and `t1b` brakes if not yet driven. `t2-drift` is 12 trials, about 19 min: over the trial cap, under the time cap; leave it.

### 6.2 A/B in one pack

A pack marks one trial per group `base: true`. With `blind: true` (decision O2), the strip and cards show trials as `A`, `B`, `C` in an order seeded by the pack `rev`, the `feel` line is replaced by the group's neutral one, and every non-base trial asks `vs A: worse / same / better`. The export keeps the real ids, so nothing changes for the lead. Blind matters because t2-drift's feel lines say "8% less rear grip": the owner rates the label as much as the car.

### 6.3 Session vs session

Pastes are committed as `docs/lab/sessions/<pack>.r<rev>.<yyyy-mm-dd>.txt` (decision O4). `scripts/lab.ts diff` matches trials by id and prints:

| Column | Read |
|---|---|
| `spec#` same / moved | moved means the physics changed between sessions: compare knowingly |
| metric deltas | the ` m` numbers, with the ` sim` delta beside them: an owner delta the sim also shows is the car; one the sim does not show is the driver or the input |
| rating deltas | flagged only when bigger than the anchor's spread in either session |
| input shares | `lock`, `rev`, `thr`: a rating that moved with a big input change is the driver |

## 7. Results into car specs safely

One car per commit, in this order:

| Step | Command | Pass when |
|---|---|---|
| 1. Fold | `bun scripts/lab.ts promote <pack> <trial>`, paste into `src/car/cars.ts` (or append a part to `SLOTS`) | the printed spec hash equals the trial's `spec#` in the paste |
| 2. Car tests | `bun run test src/car` (car, build, pi, presets, models) | green |
| 3. Golden | `hq lock run -- bun scripts/lab.ts golden --check` | only the tuned car's lines moved, each inside its `docs/car-feel.md` band; then `bun scripts/lab.ts golden` and commit the file with the change |
| 4. Class | PI and class printed by step 3 | class unchanged, or the owner approved the move (decision O7) |
| 5. Races | `hq lock run -- bun scripts/races.ts --changed` | no run missing from `scripts/golden/races-baseline.txt`; a car change moves only the canaries, so a red one is the car |
| 6. Career | `hq lock run -- bun scripts/career.ts <events of the car's class>` | printed `stars` unchanged; when a median moves, decision O5. Tsumuji and Sajin are in `LATER_CARS` (`scripts/career.ts:38`) and skip this step |
| 7. Release | the lead, once: `fix:` / `feat:` + changelog line for the player | `src/version.test.ts` |

A mod that never passes step 3 never ships: the lab keeps it as a trial.

## 8. Next three packs

Chosen from section 1.1's open questions. Each is under the session caps; each runs `scripts/lab.ts` first.

| Pack | Trait | Trials | Est. | What the owner judges |
|---|---|---|---|---|
| `t3-lineup` | character | coupe anchor, then hatch, muscle, rally, kaze, sturm, raijin, formula, fujin, tsumuji, sajin stock, coupe anchor: 13 runs of `hairpin/asphalt`. One exception to the 10-trial cap: it is the pass that lets O1's targets be checked by hand | about 18 min | per car: turn-in, balance, power on exit, and a pick "fits its line / too tame / too wild". Output: which rows of `docs/car-feel.md` the numbers or the feel get wrong |
| `t4-throttle` | lift-off and power-on | coupe anchor; lift-off on `sweeper/r120` for sajin (24°), fujin (19°), tsumuji (18°), rally (16°), formula (15°); power-on on hairpin exits for sturm (1.2°), muscle (30°); coupe anchor: 9 | about 12 min | which lift-off numbers are character and which are snaps; whether the Sturm's flat power-on reads as traction or as a dead rear |
| `t5-parts` | do parts read | blind coupe: tyres Street vs Sport vs Semi-slick on `sweeper/r200`; aero None vs Wing vs Race kit on `sweeper/r200` then `brake/asphalt` from 150; base = stock: 8 | about 10 min | whether a part step is felt at all. If Semi-slick and Street rate the same, the part is a PI number, not a feel |

After those, by what they show: a `t6-drift` follow-up on t2's winner across the 5 RWD drift setups, and `t7-loose` (the `dirt` family on `grid/mixed` and kickers) once P2b exists.

## 9. Owner decisions

| # | Decision | Recommended | Alternatives and cost |
|---|---|---|---|
| O1 | Per-car targets in `docs/car-feel.md`, approved once | yes, lead drafts, owner ticks it in one read and `t3-lineup` checks it | none: every rating stays "better or worse than before", with no "right" to aim at |
| O2 | Blind A/B | on for variant groups, off for lineup packs | off: ratings read the feel line as much as the car |
| O3 | Commit `scripts/golden/handling.txt` | yes | keep the hand-run two-commit diff: slower, and a second car moving goes unseen unless someone runs it on that car |
| O4 | Pastes in `docs/lab/sessions/` | yes, in the repo so `lab.ts diff` and review see them | the hq project's knowledge folder: out of reach of the script and the review |
| O5 | A tuning moves a career median | hold the marks when `three` moves under 2%; re-run `career.ts --write` above that, in the car's own commit | always re-tune: players' stars shift on every polish |
| O6 | Bus out of the matrix | yes: a novelty, D class, nothing to polish against | in: 5 more specs, nothing learned |
| O7 | A tuning crosses a class floor (`src/car/pi.ts:128-136`) | ask per case; a car near a floor (Sajin 483, hatch 407) is a warning on the pack card | allow freely: events filter by class, so a car can drop out of or into a career tier |

Rejected outright: live sliders for the owner (v1 D3-D, still right: the owner rates options, the lead finds numbers); a results server (no server; the paste is the record); a state layer for sessions (the lab's own object holds them, as in v1).

## 10. Phases

| Phase | What | Files | Size |
|---|---|---|---|
| P1 | Scenario refactor: feel.ts and telemetry.ts blocks into functions on a `CarSpec`, CLIs byte-identical; `snow`, `slush` grounds | `scripts/bench/feel-cases.ts` (~250), `scripts/bench/telemetry-cases.ts` (~80), `scripts/feel.ts`, `scripts/telemetry.ts`, `scripts/grounds.ts` | S, 0.5 day, own `refactor:` commit |
| P2 | `scripts/lab.ts`: `<pack>` sim lines + base delta + time estimate, `matrix`, setups table, pool workers; `pack.test.ts` budget check | `scripts/lab.ts` (~250), `scripts/lab/setups.ts` (~80), `scripts/lab/worker.ts` (~60), `src/lab/pack.test.ts` | M, 1 day |
| P3 | Handling golden + `--check`; `docs/car-feel.md` draft for O1 | `scripts/golden/handling.txt`, `docs/car-feel.md` | S, 0.5 day |
| P4 | Recorder trait metrics (`yawover`, `us`, `pwr`, `lift`, `bdev`, `trail`, `entry`, `pitch`, `xslip`, `yawsd`), export keys appended, `ask.ts` per-trait questions; each metric tested against the matching headless number on the same spec | `src/lab/recorder.ts` (+~120; past 400 lines, split the trait folds into `src/lab/traits.ts`), `src/lab/export.ts`, `src/lab/ask.ts`, tests | M, 1 day |
| P5 | Sessions: `blind` and `base` on `Pack`, A/B labels in the overlay, `lab.ts diff`, sessions folder | `src/lab/pack.ts`, `src/lab/lab-view.svelte.ts`, `TrialList.svelte`, `scripts/lab.ts` (+~100) | S-M, 0.5-1 day |
| P6 | `lab.ts promote` and the section 7 gate as one `lab.ts gate <car>` that runs steps 2-6 in order and stops on the first red | `scripts/lab.ts` (+~80) | S, 0.5 day |
| P2b | Bot on the lab world for kickers and the grid, feeding the real `Recorder` | `scripts/lab/bot.ts` (~150) | M, 1 day, after t7 is wanted |

Order: P1, P2, P3 before `t3-lineup` ships (the lineup needs O1 targets and sim lines); P4 before `t4-throttle` (it needs `lift` and `pwr`); P5 before `t5-parts` (blind). P6 lands with the first promotion. Proof per phase: P1 byte-identical feel/telemetry output on every car; P2-P3 `bun run test src/lab`; P4 `bun run test src/lab` + `check:svelte` when a component changes; P5 shots of the strip and a card at phone and desktop.

## 11. Risks

- Flat-ground scenarios and the lab world disagree (lab lanes are painted surfaces with `road_dist` edges, flat scripts are one grip row): the ` sim` line could mislead. Mitigation: P4's tests pin each recorder metric against its headless twin on the same spec and ground; a gap over 10% is a bug in one of them.
- Owner ratings are noisy across devices and days. The anchors measure that; a delta inside the anchor spread is not acted on.
- The golden makes every intended car change a two-file commit. That is the point, but a tuning sweep across 11 cars becomes 11 commits; acceptable, it is the "one car per commit" rule.
- Recorder per-step cost: ten new folds at 360 Hz. Same rule as v1: preallocated fields, no allocation; check frame time on the phone once P4 lands.
- `docs/plan/handling.md`'s measured table is already stale; once the golden exists, that table should point at it rather than hold numbers.
