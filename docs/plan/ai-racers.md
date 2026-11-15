# AI racers with car-to-car contact: plan

Status: research for quest ai-racers, base master 013ad41, 2026-11-14. No code changed. Decided 2026-11-15: see [Decisions](#decisions-owner-2026-11-15).

Short version: contact does not go inside `Car.step`. It is a second pass after every car has stepped, the same slot `world.collide` already sits in (`src/main.ts:753-756`), and it reuses the shape `world.collide` already uses: two circles per car along the heading, which make a capsule. With one car there are no pairs, so the pass writes nothing and single-car physics stays byte-identical by construction. The AI driver is `scripts/autolap.ts` with its per-step speed plan moved to a table built once per route, plus a racing-line offset and a 10 Hz awareness layer in route coordinates. A car step costs about 20 µs on this desktop; on a phone 5-7 AI cars at full rate eat about a fifth of a main thread that is already over budget, so AI cars away from the player drop to a kinematic line follower.

## Decisions (owner, 2026-11-15)

From questionnaire round 1 (`docs/plan/career-ai-r1.answers.md`, section 8 and 10). Career decisions are in `docs/plan/career-redesign-research.md`, performance in `docs/plan/sim-performance.md`.

| # | Decision | Differs from this plan |
|---|---|---|
| H1 | **AI in game first, then the career.** Owner: "we need to prove we can build good AI for this; without it none of it is worth it" | rec was both in parallel |
| H2 | An AI field replaces the dev ghost when a field is on (O3) | |
| H3 | Catch-up mild, ±3% pace, off by default (O4) | |
| H4 | Seasons get harder, plus one easy / normal / hard setting (O5) | adds per-season scaling |
| H5 | Aggression 3 on 1 (polite, never hits you) .. 5 (trades paint, dives inside) (accepted in bulk) | |
| H6 | Mistakes 3 on 1 (never) .. 5 (often: lockups, wide lines) (accepted in bulk) | |
| H7 | Far AI on phones: a cheap line follower when far and off screen (O7). The sim worker comes anyway (J1), so this is no longer the only phone fix | O7's "Worker only if that falls short" is superseded |
| H8 | AI is tested in lab trials on race worlds with a field (O8: `Trial.map` + `Trial.field`) | |
| H9 | **One tuning round first** for spins, resets and hard hits, before AI goes in game. Phase 2 numbers: 24-29 spins and 21-30 resets over 25 races, hardest hit 26.7 m/s in every run (branch `worktree-agent-a6399ebfcdb02730e`, this doc's §9 there) | |
| H10 | Career first; Runs later; online its own quest (O9 stays: career races only after tuning) | |
| I1 | First milestone: **one AI race in free play**, then **Season 1 Island vs an AI field** | rec was Season 1 first |
| I2 | Review by lab packs and short builds after each step, in bigger milestones when the owner is away | |
| I3 | **Career and AI ship together**, not B0 first. Possibly the whole thing on a worktree branch while other game changes land on master | rec was B0 first on ghosts |
| I4 | Failure: it kills the game's performance, or the AI looks stupid | |
| J6 / J7 | **Target: 60 fps on a Samsung Galaxy S24+ (latest software) during a 6-car race.** Measured on that phone, not only the CDP 4x throttle | |

Contact (D6, E3): no time penalty of any kind in an AI race; a clean race earns bonus points instead.

Order:

1. H9 tuning round, headless, on the AI branch.
2. Sim worker, one sim path for solo and field (J1, J5; `docs/plan/sim-performance.md`).
3. Phase 3: one AI race in free play behind a flag, grid start with lights, position and gap on the HUD, finish order card; phase 4 lab trials (H8) in the same milestone, since the owner reviews through them (I2).
4. Season 1 Island against a field of 6 (F3), then the rest of the career.

The full build order, with the WebAssembly spike, the shared-maths rebaseline and the WASM port between these steps, is in quest 36cf211 (career redesign) and `docs/plan/sim-performance.md`.

Phase 3 below assumed the far-AI switch was the phone plan and the field ran on main. With the worker first, phase 3 builds on the worker's field; the kinematic far AI (H7) is still built, as the owner chose, and the S24+ measurement says how far out it switches.

## 1. What exists

| Piece | Where | Use for AI |
|---|---|---|
| Fixed step loop | `src/main.ts:749-758`: `car.step`, `pads.step`, `world.collide`, `lab?.step` at `DT` = 1/360 | AI cars step in the same loop, then one contact pass |
| Wall contact | `src/world/world.ts:542` `collide`, `:96` `circle_contact`, `:655` `resolve` | Circles at `spec.circles` offsets along the heading, `spec.radius`; push-out by depth, then a normal impulse with yaw arm, restitution, 10% speed loss. Edits `pos`/`vel`/`ang` after `integrate`, outside the step |
| Collider shape | `src/world/world.ts:60` `Collider`: `pos`, `vel`, `ang`, `heading`, `spec.{mass, inertia, circles, radius, band}` | `Car` already satisfies it; car-car contact takes two |
| Car shapes | `src/car/cars.ts:86-89` `band`, `circles`, `radius`; e.g. coupe `circles: [1.25, -1.25]`, `radius: 1.05` (`:187-188`) | capsule 2.1 m wide, 4.6 m long |
| Rigid body | `src/car/rigid-body.ts` | One body per car, `apply(force, at)`, `integrate`. Nothing to change |
| Autopilot | `scripts/autolap.ts:84` `autolap` | Speed plan `corner_pace` (`:60`, v = sqrt(grip·r) plus a braking term over 90 points), pure pursuit to a speed-scaled point (`:110-112`), brake easing in a slide (`:123-125`), jump pace on kickers. Drives the centreline only |
| Route coordinates | `src/modes/route.ts:78` `RouteTracker` | nearest index in a window and unsigned offset; AI needs a signed offset (cross with the tangent) |
| Race mode | `src/modes/race-mode.ts` | today a race against a dev ghost (`:25`, `:47`) |
| Peer car drawing | `src/net/remotes.ts:92` `Remotes`, `src/car/ghost.ts:70` `Ghost` (owns a `CarView`) | AI cars are drawn the way a ghost or remote is: a `CarView` per car |
| Lab packs | `src/lab/pack.ts:35` `Trial` (`station`, `lane`, `goal`, `ask`) | trials sit on lab stations; no circuit station and no other cars |

Rewind is already off in a mode (`src/main.ts:735`, `!modes.active`), so an AI race never has to rewind the field.

## 2. Car-to-car contact

### Where it runs

```ts
while (acc >= DT) {
  for (const c of field) c.step(DT, c.controls, world);   // player first, then AI in grid order
  for (const c of field) impact_of[c] = world.collide(c);
  contacts.resolve(field);                                 // new: pairs, fixed order
  ...
}
```

Not inside `Car.step`: the step integrates one body and is what `car.test.ts`, `scripts/telemetry.ts` and `scripts/feel.ts` pin. A separate pass after `world.collide` matches the existing pattern (contact edits velocity after the integrate) and leaves the step untouched. Order: walls first, then cars, so a car pinned against a wall gets pushed out of the other car last and the wall pass catches it next step.

### Shape

| Option | Cost | Fit |
|---|---|---|
| **Capsule from `spec.circles` + `spec.radius`** (segment-segment closest points) | ~30 flops a pair | Same shape the car has against walls, so a car-car hit and a wall hit feel alike. Sides are round: two cars side by side touch about 0.15 m early on the coupe |
| Circle pairs (2×2 circle tests) | 4 circle tests | Lumpy along the side: rubbing door to door bumps at each circle |
| Rounded box from `spec.corners` (OBB SAT + radius) | ~3× capsule | Truest footprint, but walls still use circles, so it disagrees with the world |

Recommend the capsule. Height gate from `spec.band` the way boxes with a `bottom` use it (`world.ts:621`), so a car landing on another from a jump passes over instead of snagging in 2D.

### Impulse exchange

Two-body version of `resolve` (`world.ts:655`), per touching pair:

1. Normal n and depth from the closest points of the two segments.
2. Push-out split by inverse mass: `a.pos -= n·depth·ma⁻¹/(ma⁻¹+mb⁻¹)`, b the other way.
3. Relative normal velocity at the contact point with each car's yaw arm (`ang.y × r`, as `resolve` does in 2D). Approaching only.
4. Normal impulse `j = -(1+e)·vn / (1/ma + 1/mb + armA²/IyA + armB²/IyB)`, a low `e` (cars crumple; wall `RESTITUTION` is the start point).
5. Tangential friction impulse clamped to `μ·j`, so door-to-door rubbing slows both and side-swipes turn the struck car instead of sliding it frictionless.
6. Roll and pitch rate damping as `resolve` does (`ang.x *= 0.7`), but softer: a tap should not settle a car's body.
7. Return `-vn` as the impact, fed into the same `impact` max that drives audio, rumble and camera bump (`main.ts:760-765`).

No `vel.multiplyScalar(0.9)` per contact: on a wall it is one hit, between cars it fires every step of a 2 s rub and would brake both cars hard.

Broadphase: 8 cars is 28 pairs. One bounding-circle check a pair (`|Δpos| < half_length_a + half_length_b`) per step, no grid.

### Determinism and identity

- Pairs run in a fixed order (i < j by grid slot), scratch at module level, no `Math.random`; same inputs give the same output bit for bit.
- Single car: the field is one car, there are no pairs, the pass returns before touching anything. `car.test.ts`, telemetry and feel never build a field, so they stay byte-identical without a special case. Add one test: two cars 10 m apart stepped with and without the pass end bit-identical; two cars driven into each other conserve momentum to rounding (restitution aside).
- Sequential impulses, one pass. A three-car pile-up gets a second pass only if the field test shows cars sinking into each other.

## 3. AI driver

Layers as agreed in the brief; what is reused and what is new:

| Layer | Rate | Reuse | New |
|---|---|---|---|
| Line | once per route, race start | `corner_pace` formula, `CORNER_GRIP`, `CORNER_BRAKE`, ice share, bowl bank (`autolap.ts:24-58`) | Precomputed per point: lateral offset (racing line) and target speed with one backward braking pass. Removes the 45-iteration scan autolap does every step |
| Steer and pedals | every 360 Hz step | pure pursuit, speed-scaled look-ahead, brake easing on slide, air = straight wheel (`autolap.ts:107-127`) | aim at the line point plus the lane offset the awareness layer asks for; outputs `Controls` like a player, no grip help |
| Awareness | 10 Hz | `RouteTracker` (`route.ts:78`) | signed lateral offset, along-track gap to each car within 60 m; pick a lane: follow, pull out (side with more room at the next bend's inside), alongside (hold a 0.5 m gap), defend (take the inside on the braking zone, once per straight) |
| Recovery | 10 Hz | autolap's flip check (`autolap.ts:149`) | spun or stopped for 2 s: reverse, re-aim; off the road or flipped for 4 s: the same fall reset the player gets |
| Personality | constants per AI car | — | `pace` (share of plan speed, 0.90-1.0), `brake_margin` (m/s over the braking curve), `aggression` (lane gap, how late it gives up a line, contact it accepts), `mistakes` (seeded chance a lap of a late brake or a wide line), `catch_up` (±3% pace by gap to the player, off by default) |

Racing line: start with a curvature-minimising relax of the centreline inside `ROAD_HALF` minus a car half width (a few hundred iterations of "move each point toward its neighbours' midpoint, clamp to the road"). Cheap, done once, and good enough for a game; a true minimum-time line is not needed. Kickers and sky-track bowls keep autolap's special cases (jump pace, bowl aim).

`scripts/autolap.ts` stays as it is: `races.ts` and `career.ts` marks depend on its exact output. The runtime driver is a new pure module that autolap may switch to later in its own commit, with the races baseline as proof.

## 4. Cost per AI car

Measured on this desktop (12 threads), Bun 1.3.0, island seed 0, after 720 warm-up steps, 7200 steps (20 s of sim) each. Script: scratchpad `bench/step.ts`, not committed.

| car | `car.step` + `world.collide` µs/step | autolap step (step + collide + per-step plan) µs |
|---|---|---|
| coupe | 20.7 | 28.7 |
| rally | 17.6 | 24.5 |
| formula | 20.0 | 16.0 |

The formula row's autolap is lower than its open-loop drive: the open-loop drive weaves off the road into more solids and rough ground. Treat 20 µs as the step, ~8 µs as autolap's per-step plan (gone once the plan is a table).

Budget (360 steps a second per car):

| | per car | 7 AI cars |
|---|---|---|
| Desktop | 20 µs × 360 = 7 ms CPU per second, 0.7% of a core | 50 ms/s, 5% |
| Phone, at the 4x CPU throttle the perf audits use as a phone proxy (unverified against a real phone) | ~80 µs × 360 = 29 ms/s, 3% | ~200 ms/s, 20%: +3.4 ms on every 60 Hz frame |

The phone is already over budget: 33-43 ms p50 frame at 4x throttle on mainland (`docs/plan/perf-audit-2026-11b.md:16`). Compact circuits are lighter than mainland, but 20% more main-thread time is not free. Options, lightest first:

| Option | Cost | What breaks |
|---|---|---|
| **Kinematic far AI**: beyond ~120 m and off screen, a car moves along its line at planned speed (pose from the table, ~1 µs); within range it becomes a physics car with the line's speed and heading | new code, one switch | the switch must not pop: hand over on a straight, never in sight. Far cars cannot crash into each other; nobody sees it |
| Fewer steps for far cars (180 Hz) | one flag | the suspension and hull are tuned at 360 Hz; a half-rate car is a different car (stability unverified). Rejected |
| AI physics in a Worker | new infra | contact with the player needs the same step on both sides: a frame of latency in every bump. ~~Only if phones still fall short with kinematic far AI~~ **Decided J1, J5:** the whole sim, the player's car included, runs in a worker, so contact is in one step |
| Cap the field on phone (4 AI under `pointer: coarse`, the test `quality.ts:46` already uses) | one line | fewer racers on phone; fallback, not the plan |

With kinematic far AI a typical pack has 2-3 physics cars near the player: phone cost ~70-90 ms/s, close to one extra car's worth of rendering. Rendering each car is its own cost (a `CarView`, ~10 draw calls each, unmeasured here).

## 5. Which modes first

| Mode | When | Why |
|---|---|---|
| Race on compact circuit worlds (`circuit`, `circuit-rev`) | phase 3 | closed loop, one route, `ROAD_HALF` road, the autopilot already finishes every circuit (`scripts/races.ts` baseline) |
| Career race events | later | marks today are times (bot median, `career.ts:50`, dev ghosts); AI makes them position-based. Needs a new grading rule per event: owner call |
| Runs, street and offroad routes | later | open routes, junctions, narrow streets; the line relax and overtaking need more road than they give |
| Sky track | later | rails glide (`world.ts:632`) instead of bouncing; banked bowls need the bowl aim per AI car |
| Online lobby races | separate quest | section 7 |

Race view needs: grid start (staggered slots behind the start line), position and gap in the HUD, finish order on the result card. A race with AI counts as a run for the `Updater` busy callback.

### Feel lab

Lab trials sit on lab stations (`pack.ts:42`), and the lab world has no circuit. Two ways:

| Option | Cost |
|---|---|
| **`Trial.map` (a map code) + `Trial.field` (AI cars, personality each)**: an AI trial loads a race world instead of the lab | pack shape change, versioned by `rev` as any pack |
| A circuit station in the lab world | worldgen change, lab `version` bump, a lab circuit is not a real race world |

Ratings per trial: fairness (did contact feel caused by me or by them), aggression (too timid .. too dirty), believability (would a person drive like that), pace (too easy .. too hard). Recorder adds: contacts, hardest contact, positions gained and lost, laps led, spins caused.

Headless first, the way feel-lab v2 does it: `scripts/ai-race.ts <map> <field>` drives the whole field with no player and prints per car: lap time, spread to the fastest, overtakes, contacts, spins, offroad, finish order. Outliers get fixed before the owner drives.

## 6. Phases

| Phase | What | Proof | Size |
|---|---|---|---|
| 0 | Contact pass, pure, `Collider` pairs; test for identity and momentum | `car.test.ts` + telemetry/feel byte-identical; contact test | S |
| 1 | Line table + runtime driver, one AI car alone on a circuit headless | `scripts/ai-race.ts`: AI lap within 5% of autolap on every circuit in the races baseline | M |
| 2 | Field of 5-7 headless: grid, awareness, overtake, defend, recovery, contact reaction, personality | ai-race numbers: no car stuck, contacts per lap in a band, finish order not fixed by grid | L |
| 3 | In game: race mode with AI on compact circuits, `CarView` per AI car, HUD position, result order, kinematic far AI | by eye desktop and phone, phone frame time with 6 AI vs none | M |
| 4 | Lab: `Trial.map` + `field`, AI pack, recorder metrics | one owner session, ratings in | M |
| 5 | Career races, Runs, sky track | per mode | M each |
| 6 | Online | own quest | L |

Phases 0-2 are pure and headless: no DOM, Bun runs them.

## 7. Online: why solo first

- Each peer simulates only its own car; remotes are interpolated packets (`net/remotes.ts`), behind by the link's latency. A local car pushed off a remote's stale pose hits a car that is no longer there, and the remote peer never sees the hit: one side bumps, the other does not.
- Fixing that needs authority (who owns the result of a contact), prediction of remote poses, and correction on both sides: a new protocol field set and a `PROTOCOL` bump.
- AI cars online need one owner per AI car (the host simulates, others interpolate), so every guest races AI that lags by the link's latency, and contact with them has the same problem twice.
- Solo makes the contact model, the driver and the tuning right with none of that. Online contact then reuses the same pass with a remote's predicted pose.

## 8. Owner decisions

| # | Question | Recommendation | Owner, 2026-11-15 |
|---|---|---|---|
| O1 | Contact shape | capsule from `circles` + `radius`, same as walls | as recommended |
| O2 | Where the code lives | new `src/ai/` feature folder (line, driver, awareness, field); contact pass in `src/car/contact.ts` | as recommended |
| O3 | Race mode: AI field replaces the dev ghost, or both | AI replaces the ghost when a field is on; ghost stays for time-only races | as recommended (H2) |
| O4 | Catch-up | mild (±3% pace), off by default, one personality number | as recommended (H3) |
| O5 | Difficulty for the player | one setting (easy / normal / hard scaling `pace` and `mistakes`), a `FIELDS` entry in `menu/prefs.ts` | plus harder seasons (H4) |
| O6 | AI cars: which cars | the player's class cap, presets from `car/presets.ts`, no two alike in a field | as recommended (G2) |
| O7 | Far AI on phone | kinematic follower beyond ~120 m off screen; Worker only if that falls short | follower kept (H7); the worker comes first anyway (J1) |
| O8 | Lab | `Trial.map` + `Trial.field`, not a lab circuit station | as recommended (H8) |
| O9 | Career and Runs with AI | not before phase 4 tuning; position-based marks are a separate design | career first, Runs later, online its own quest (H10) |

## 9. Findings and log

Numbers from `2f0dba2` + the phase 2 field, checked 2026-11-14 on the 25 island golden seeds, coupe. Rechecked after merging master `4ac6b0c` (car step split into phases, `steering.ts` / `tyre.ts` / `curve.ts`): no AI code needed a change, every number below came out the same to the printed precision.

| Phase | Proof | Result |
|---|---|---|
| 0 | `car.test.ts`, `contact.test.ts`; telemetry and feel vs master | 273 tests in `src/car` + `src/ai` pass; `scripts/telemetry.ts` and `scripts/feel.ts` byte-identical to `4ac6b0c` |
| 1 | `ai-race.ts solo`, 25 circuits | every lap within; AI vs autolap min -11.7%, median -9.0%, max -7.8% (AI faster everywhere), no offroad |
| 1 | `src/ai/driver.test.ts` | a lone AI car's taped controls replayed on a fresh car end bit-identical over 30 s on island seed 0 (a 1e-12 steer nudge on one step fails it) |
| 2 | `ai-race.ts field all` (6 cars, 2 laps) | stuck 0; contacts/lap 0.5-6.0, median 3.0, 0 out of band; grid order kept 0/25, mean rho 0.55; 27 overtakes, 24 spins, 21 resets |
| 2 | same, 6 cars, 3 laps | stuck 0; contacts/lap 0.7-5.7, median 2.7, 0 out; grid kept 0, rho 0.44; 28 overtakes, 26 spins, 26 resets |
| 2 | same, 7 cars, 2 laps | stuck 0; contacts/lap 0.0-5.0, median 3.0, 1 out (seed 4: a clean race, 0 contacts); grid kept 0, rho 0.61; 44 overtakes, 29 spins, 30 resets |

Open after phase 2:

- A clean race (0 contacts) counts as out of band. Either the floor drops to 0 or the field races closer; no tuning done for it.
- Hardest hit 26.7 m/s in every run and about one reset per race: spins and resets are high for a field that rarely touches. Worth a look before phase 3 puts it on screen.
- Spins do not come from reversing: skipping the spin count while a car reverses left every count unchanged.
- Defending rolls `aggression` on every awareness tick (20 Hz), so a timid driver still defends within about a second. One roll per attacker would make aggression matter; it changes behaviour, so it waits for a tuning round.
- Per-race rho reaches 0.75-0.79 on some seeds; the mean stays under `RHO_MAX` 0.7.

### Tuning round H9 (2026-11-16)

Baseline re-measured after the lead merged master into the branch (`69121e2`: 0.45.0, drift fix `ab625c1`): the drift and launch changes moved the field's numbers, so the table above is history. Same 25 island golden seeds, coupe.

Cause split from `bun scripts/ai-why.ts all coupe <count> <laps>`. A spin's trigger is the earliest of a touch, a wall hit, the car's own slide starting (still going counts however old) or leaving the road, in the 3 s before it; a reset with a spin in the 8 s before it takes that spin's trigger. "Kicker" is within 40 road points of a kicker's run.

| Trigger | 6 x 2 spins / resets | 6 x 3 | 7 x 2 |
|---|---|---|---|
| Wall at a kicker (challenge frame posts) | 9 / 11 | 10 / 12 | 14 / 13 |
| Own slide at a kicker | 0 / 0 | 0 / 0 | 2 / 1 |
| Off the road (a weave or running wide) | 5 / 8 | 6 / 11 | 4 / 7 |
| Contact | 4 / 4 | 4 / 6 | 3 / 5 |
| Wall elsewhere | 0 / 0 | 1 / 1 | 1 / 1 |
| Own slide elsewhere | 0 / 1 | 1 / 1 | 0 / 0 |
| Total | 18 / 24 | 22 / 31 | 24 / 27 |

What the triggers were:

- **Kicker frames, about half of everything.** A challenge frame's gap is 2.6 m each side of its centre and a body is 1 m wide each side (`world/jumps.ts`, `BODY_HW`), so a car over the run at `RAMP_SIDE` 1.5 m off the centre scraped the posts, more so passing or alongside another car. Two cars cannot fit through one gap at all.
- **Off the road: the steering fishtailed.** Traced on seed 4, 7 cars: at 37-42 m/s, passing, the pure-pursuit P law (`STEER_GAIN` 3 on the heading error) overshot each catch; heading swung ±0.5 rad off the road over about 4 s, each swing larger, until the car crossed the edge at 12 m/s sideways with no slide to speak of. Solo laps never get there; a pass's lane change at full speed starts it.
- **Hard hits all had the car ahead already in trouble.** Every hit over 10 m/s: the front car had just hit a wall, run off or been touched, and the follower was braking flat out (cap 0-10 m/s) 0-4 m behind. Awareness saw a spinning car only once it slid into the follower's lane (`IN_LANE` 2.6 m) and planned on its speed, not its speed along the road.

| Hardest hits, baseline | closing | front car | follower |
|---|---|---|---|
| 7 x 2, seed 4 | 17.2 m/s | 7.1 m/s, ran 14 m off the road into a solid | 18.6 m/s, brake full, 4 m back |
| 7 x 2, seed 5 | 16.5 m/s | 8.3 m/s, just touched by another car | 8.1 m/s, brake full, 4 m back |
| 6 x 3, seed 3 | 15.4 m/s | 15.5 m/s, wall at a kicker | 21.5 m/s, 0 m (alongside) |

Fixes, one commit each:

| Step | Change |
|---|---|
| 2 | Kicker runs: `RAMP_SIDE` 1.5 -> 0.5 m; within `KICKER_LOOK` 60 m of a run no pass starts or carries on from behind, no defend, and a car alongside with its nose behind follows (`FOLLOW`) instead of yielding 1.5 m/s: single file through the frame |
| 2 | Steering: `STEER_DAMP` 1, a term against the aim error's rate, forgotten after a reverse or reset (`Driver.recovered`). Solo laps: AI vs autolap min -11.7%, median -8.8%, max -7.4% (was -11.7 / -9.0 / -7.8), no offroad |
| 3 | A car sliding past 0.5 rad, moving more across the road than along it, or reversing is in trouble: it blocks the whole road (`HAZARD_LANE` 6 m) for a follower, the follower plans on its speed along the road, and no pass starts past it |
| 4 | Defend rolls `aggression` once per defender and attacker pair for the race (`defend_roll`): two attackers trading places no longer reroll |
| 5 | Owner levels, below |
| - | Recovery: a reset on a kicker run puts the car back `RESET_RUNUP` 150 m before it (`reset_point`). Found on the second pass: on seed 2, 7 cars, a car slowed to 13 m/s by the single-file rule took the kicker short, wedged on the frame, and every reset put it back on the same spot (260 resets, 1 stuck) |
| - | `CONTACT_BAND` floor 0.2 -> 0: a clean race passes (lead, H9) |

Before and after, `bun scripts/ai-race.ts field all coupe <count> <laps>`:

| | 6 x 2 before | after | 6 x 3 before | after | 7 x 2 before | after |
|---|---|---|---|---|---|---|
| Spins | 18 | 0 | 22 | 0 | 24 | 4 |
| Resets | 24 | 0 | 31 | 0 | 27 | 2 |
| Reverses | 3 | 0 | 5 | 0 | 5 | 4 |
| Hardest hit (m/s) | 13.5 | 4.3 | 15.4 | 4.3 | 17.2 | 4.3 |
| Stuck | 0 | 0 | 0 | 0 | 0 | 0 |
| Contacts/lap min, median, max | 0.5, 3.0, 6.0 | 0.0, 1.5, 5.0 | 0.7, 2.3, 5.3 | 0.0, 1.0, 4.0 | 0.0, 4.0, 9.0 (4 out) | 0.0, 2.5, 6.0 (0 out) |
| Mean rho | 0.52 | 0.53 | 0.43 | 0.43 | 0.65 | 0.63 |
| Grid order kept | 0 | 0 | 0 | 0 | 0 | 0 |
| Overtakes | 24 | 15 | 32 | 18 | 44 | 25 |

Every target met: spins and resets at most half the baseline (worst 4 spins and 2 resets, at 7 x 2), hardest hit 4.3 m/s, stuck 0, contacts in the 0-6 band, rho under `RHO_MAX` 0.7, grid order never kept. The 7 x 2 leftovers: seed 2, the car slowed at the kicker, now put back before it once (2 spins, 1 reset); seed 6 circuit-rev and seed 9 one spin each, seed 9 one reset. The 6-car columns ran before the kicker reset fix: it only acts on a reset and those runs had none, and a rerun on `8b80999` matched them race for race as far as it went (7 and 5 races). Only the combined change was measured; the per-step share is not split (a run of the three takes 30-60 minutes on a loaded machine). `src/car` + `src/ai` tests pass (286); `scripts/telemetry.ts` and `scripts/feel.ts` byte-identical to `69121e2`, and nothing under `src/car`, `src/world` or `src/worldgen` changed.

Owner levels (H5, H6): `personalities(seed, count, aggression = 3, mistakes = 3)` in `ai/field.ts`. Each car draws its number uniformly from its level's range; level 3 is today's field, so every number above is level 3.

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| `aggression` range | 0-0.6 | 0.1-0.8 | 0.2-1 | 0.4-1 | 0.6-1 |
| `mistakes` range (chance a lap of one late brake) | 0-0.1 | 0.02-0.2 | 0.05-0.3 | 0.1-0.4 | 0.2-0.5 |

What `aggression` moves: how tight a pass is called squeezed (`PASS_TIGHT`), diving into a braking zone past 0.85 (`DIVE`), the push over pace while passing (`PUSH`), how long a touch keeps it wary (`WARY_BOLD`), and now the one defend roll per attacker.

Open after H9:

- Overtakes dropped by about 40% (6 x 2: 24 -> 15, 6 x 3: 32 -> 18, 7 x 2: 44 -> 25): single file at kickers and no pass past a car in trouble take passes away. Rho stays under `RHO_MAX`, so the grid still does not decide the race, but a field that rarely passes may read as a procession on screen.
- The single-file rule can brake a car under jump pace on the run itself (seed 2, 7 cars: 13 m/s at the lip, the plan is 32). The reset now gets it out; holding pace on the run and sorting the order before it would stop it falling short at all.
- `ai-why.ts` labels a weave that ends with the car straight but off the road as "off the road", not "own slide": the slide had already settled under 0.15 rad when the car crossed the edge.

### Overtakes round (t273, 2026-11-16)

H9 cut overtakes by about 40%. Bisected on 6 x 2 (`ai-race.ts field all`, one run per commit): 69121e2 24, 847bb94 (kicker single file) 26, f31ac63 (steering damper) 25, 162acc2 (car in trouble) 25, e59e38d (defend rolls once) 17, e57924c 15. Kickers and cars in trouble cost 0-2 passes each. The drop came from the defend fix: rolled every tick, nearly every car covered the inside into every braking zone, left its own line and handed the pass over. The old counts were inflated by that.

Changes:

| Commit | Change |
|---|---|
| 83119f9 | `ai-race.ts` and `ai-why.ts` take `[aggression] [mistakes]` after laps (owner levels, 3 by default) |
| 529f057 | A pass may start into a wide bend: gentler than `CALM_BEND` 0.02 + `BOLD_BEND` 0.02 x aggression (1/m; was a flat 0.01) while the plan holds `CALM_SHARE` of its pace. A car in trouble is passed on a side that leaves `TROUBLE_FLANK` 4 m, at its speed along the road + `TROUBLE_CLOSE` 8 m/s, instead of queued behind |
| a282208 | A driver over `OUTSIDE` 0.6 aggression goes around the outside of a car ahead covering the inside. A car off the road counts as in trouble, and a car in trouble alongside is kept `TROUBLE_FLANK` off by the guard: on seed 3 at level 5, a car ran wide off the road, hit something and bounced back into the car alongside at 22.6 m/s |
| cb755ad, 9055faa | One `OFF_ROAD` 7 m in `driver.ts` for the trouble flag, the field's off-road time and resets, and `ai-race.ts`. A `KICKER_YIELD` floor (a car yielding into a kicker drops at most 4 m/s under the plan) went in with 529f057 and came out again: the car alongside is always also `decide`'s in-lane blocker, so the floor either never acted or, once it did (cb755ad), lifted the follow cap of a car right behind another. Hardest hit 5.7 -> 9.2 m/s, overtakes 31 / 35 / 40 -> 28 / 31 / 34 |

Before and after, level 3, `bun scripts/ai-race.ts field all coupe <count> <laps>` (25 races each):

| | 6 x 2 69121e2 | H9 e57924c | now | 6 x 3 69121e2 | e57924c | now | 7 x 2 69121e2 | e57924c | now |
|---|---|---|---|---|---|---|---|---|---|
| Overtakes | 24 | 15 | 30 | 32 | 18 | 37 | 44 | 25 | 40 |
| Spins | 18 | 0 | 0 | 22 | 0 | 0 | 24 | 4 | 1 |
| Resets | 24 | 0 | 0 | 31 | 0 | 0 | 27 | 2 | 1 |
| Hardest hit (m/s) | 13.5 | 4.3 | 5.7 | 15.4 | 4.3 | 5.7 | 17.2 | 4.3 | 5.7 |
| Stuck | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Contacts/lap median (max) | 3.0 (6.0) | 1.5 (5.0) | 2.0 (4.8) | 2.3 (5.3) | 1.0 (4.0) | 1.3 (4.8) | 4.0 (9.0) | 2.5 (6.0) | 2.5 (5.5) |
| Mean rho | 0.52 | 0.53 | 0.53 | 0.43 | 0.43 | 0.43 | 0.65 | 0.63 | 0.64 |

6 x 2 and 6 x 3 pass more than the old baseline. 7 x 2 is at 40 against 44. Tried on 7 x 2 and not kept: a flat 0.03 bend limit 34, `OUTSIDE` 0.4 41, `BOLD_BEND` 0.03 38, `PASS_PACE` 0.002 38, `PASS_WINDOW` 8 31. `CALM_SHARE` 0.8 gave 44 but 5 spins, 5 resets and a 14 m/s hit, and on 6 x 2 / 6 x 3 dropped to 22 / 26 with a 16.2 m/s hit; 0.82 gave 40 with 5 spins. One-parameter changes move a 25-race total by about ±5, so 40 against 44 is close to that noise, and the 44 carried the defend handouts.

Owner levels, 6 x 2, aggression and mistakes both at the level, on the final commit:

| Level | 1 | 3 | 5 |
|---|---|---|---|
| Overtakes (e57924c) | 8 | 15 | 29 |
| Overtakes | 8 | 30 | 34 |
| Mean rho | 0.78 | 0.53 | 0.42 |
| Contacts/lap median (max) | 1.0 (3.5) | 2.0 (4.8) | 1.5 (5.5) |
| Hardest hit (m/s) | 3.6 | 5.7 | 15.2 |
| Spins / resets | 1 / 0 | 0 / 0 | 0 / 0 |

Lead's targets per level: `RHO_MAX` and a hardest hit under 15 m/s hold at level 3, the owner's level. Level 1 may be a procession. Level 5 stays under 20 m/s. Before the outside pass, level 5 passed less than level 3 (21 against 30): every bold car defended, and nothing got around a defender. With defend switched off it went to 29.

Open after this round:

- 7 x 2 overtakes 40 against the old 44 (see above).
- Level 5's 15.2 m/s is a car braking flat out (cap 3.6 m/s) into the back of one that had just hit a wall, 4 m apart, on seed 3 lap 0.
- Jump pace for a car yielding into a kicker is unsolved: single file still brakes it to the car ahead's pace. Kicker spins and resets stay 0-1 over every run here; seed 2 at 7 x 2 is the known case (§9 H9).

### Phase 3: one AI race in free play (t277, 2026-11-15)

Behind `?airace` in dev and review builds only (`REVIEW_BUILD`); `?airace=<level>` starts one at load. Career, Runs and lobby races never get a field (`ModeCtx.field` is null there).

| Piece | Where |
|---|---|
| Race run | `modes/ai-race.ts`: a race level on a closed route of a compact world without rails runs against the field instead of the dev ghost (H2). Nothing is recorded (O9) |
| Laps | from the route's par toward 4 min (D4), at most 3: an island circuit lap is 4-5 min, so D3's three laps would be a 13 min race. Every island circuit gets 1 lap |
| Grid | `grid_spot` in `ai/field.ts`: the AI on slots 0-5, the player last; three lights over the 3 s countdown (`modes/race-lights.ts`) |
| HUD | the run card's "more" slot: `P3/7 · +1.2 s · lap 1/1`; P1 shows `lead 0.8 s`. Gap = how long ago the car ahead stood where the player is now (`ai/standings.ts`) |
| Finish order | the result card's standings list, the player highlighted; cars still racing read "racing" and fill in as they cross the line |
| Field cars | `ai/field-pick.ts` (O6): presets of the player's class, the closest rating first, cycled; under the class only when it has none. Each car its own paint and number |
| Player in the field | the field tracks the player along the road (`Field.progress`, sent after the AI poses in the sim packet), sees it in the awareness, and never resets a car onto it. A garage swap keeps the player's place |
| Far AI (H7) | past 120 m from the player and outside the view (padded 30 m) a car coasts on its line at its pace, under the awareness's cap; inside 100 m or in view it is parked back on the physics at that speed and gear (`Driver.coast` / `resume`) |
| Far view | past 75 m from the camera a car draws as its view baked into one matte mesh (`car/far-view.ts`) |
| Dev | `?aidrive`: the field's driver drives the player's car (shots, frame time). `?aicars=1-6`: field size |

Proof: `src/ai/field.test.ts` (coasting cars keep lapping and resume without a reset or spin; seen cars never coast; a swap keeps the player tracked), `standings.test.ts`, `field-pick.test.ts`, `src/sim/sim.test.ts` (worker and main bit-identical with a raced field, the seen mask and a stop). Without a rival the field runs exactly as before, so the headless `ai-race.ts` numbers above stand. Shots in `.t277/` (untracked): grid, mid-race and finish card at 1440 x 900 and an 844 x 390 phone. Frame time: `sim-performance.md`, "AI race frame time".

Open after phase 3:

- D3 (3 laps) against D4 (4 min): on island circuits they cannot both hold. Built as D4.
- No difficulty setting (H4) and no level choice in game: the field is level 3 (H5, H6).
- Lab trials with a field (phase 4, H8) are not built.
- The resume hands a car back wherever the switch fires, not on a straight; off screen and padded, so not seen.
- The phone frame time (S24+) is not measured.

### Phase 4: lab trials with a field, and the difficulty setting (t279, 2026-11-15)

| Piece | Where |
|---|---|
| Race trials (H8, O8) | `Trial` is a station trial or a race trial: `map` (a map code), `route` (`circuit` by default) and `field` (`cars`: one `{ aggression, mistakes }` pair of owner levels per AI car, 1-6 of them; `difficulty`). Goal `race` (to the player's finish) or `time`. A world loads once a page, so a trial on another map reloads with `&map=<code>&trial=<n>` beside `?lab`; answers and numbers ride in the tab's storage. The race is the free-play AI race (`Modes.lab_race`: past the unlock order and the lab's closed modes), held until the trial's cards close, since its lights run on the wall clock. The field's class follows the trial car's resolved spec (`FieldHost.rating`), and the player's offs count against the route's centreline (`race_path`). docs/lab.md, "Race trials" |
| Mixed field | `field_personalities(seed, cars)` in `ai/field.ts`: each car draws in its own levels' ranges from the one race rng, so a field of one level draws exactly what `personalities` drew before |
| Field results | when a race trial ends (finish, time, Stop) the race's order is kept (`AiRace.places`, through `FieldHost.attach`) with each AI car's counts from the field (`lab/field-rows.ts`), stored with the trial's numbers and listed on its results card. Export: the `#trial` line gets `<map>/<route> field=<n>x<levels>:<difficulty>`, then one ` f` line a car: place, name, finish or `racing`, gap to the leader, `spins`, `resets`, `hits`, `hard`, `pass` |
| Pack | `?lab=ai-field`: the stock coupe last of seven on island seed 4's circuit. `start` (level 3, first 60 s), `overtakes` (aggression 5, whole race), `defending` (4/2 on easy for 180 s, so the player catches them), `mixed` (1/1, 2/4, 3/3, 4/2, 5/5, 5/1, whole race). Asks fairness, aggression, believability, pace and a note. Budget 15 min |
| Difficulty (H4, O5) | `ai_difficulty` in `menu/prefs.ts`, a row under Driving shown in dev and review builds only (where `?airace` runs). `ai/difficulty.ts` scales each drawn `pace` and `mistakes`: easy x0.9 and x1.5, normal as drawn, hard x1.04 and x0.5. The free-play race reads it on each start; nothing is recorded (O9) |

Headless, `bun scripts/ai-race.ts field all coupe 6 2 3 3 <difficulty>` (25 races each, level 3):

| | easy | normal | hard |
|---|---|---|---|
| Mean lap (s) | 260.1 | 236.2 | 228.9 |
| vs normal | +10.1% | | -3.1% |
| Overtakes | 34 | 30 | 24 |
| Spins / resets | 1 / 0 | 0 / 0 | 6 / 3 |
| Reverses | 1 | 0 | 2 |
| Hardest hit (m/s) | 15.5 | 5.7 | 8.6 |
| Contacts/lap median (max) | 1.5 (6.0) | 2.0 (4.8) | 2.0 (5.0) |
| Mean rho | 0.34 | 0.53 | 0.60 |
| Stuck | 0 | 0 | 0 |

Normal reproduces the level 3 column of the overtakes round race for race (30 overtakes, 0 spins, 5.7 m/s). Hard's spins and resets have no touch in them: cars over pace 1.0 run past the line's plan into their own slides (seeds 3, 7, 9, 19). Easy's 15.5 m/s is seed 3: two cars braking into the back of a third, all on a late brake (mistakes x1.5).

By eye (`.t279/`, untracked): the pack opens straight onto the island for trial 1 with its brief up; Drive puts the car on the grid and the lights start; after 60 s the results card lists the field's order with the player highlighted, 1440 x 900 and an 844 x 390 phone.

Open after phase 4:

- Hard's own-slide spins (6 / 3 resets in 25 races): pace over the plan. A cap at the plan with only fewer mistakes would make hard barely harder (the line is the limit); left for the owner's first hard race.
- Nothing in the trial counts the player's contacts, positions gained or laps led (the plan's recorder adds); the ` f` lines give the order and every AI car's counts.
- The first trial of a race pack reloads once on open (the lab world loads first, then the trial's map).

### Braking-zone dives and series options (t290, 2026-11-15)

Owner r1/r2 (`docs/lab/sessions/ai-field.r{1,2}.2026-11-15.txt`): too easy, barely passes, slow starts, yields the line. 73eecac's numbers showed why: equal cars only gained in corners, and most cars finished a race with `pass 0`.

| Piece | Where |
|---|---|
| Late braking curve | `RaceLine.late` (`ai/line.ts`): the line's corner speeds braked for at `LATE_BRAKE` 4 m/s² against the line's 2.5 |
| Dive | `Awareness.dive`: behind a car within its follow gap + `DIVE_REACH` 15 m, with a braking zone (plan drops `DIVE_DROP` 5 m/s) within `DIVE_LOOK` 60 points and the inside of its apex open, a driver rolls once per zone on aggression. A dive holds the inside lane down to the apex and plans on the late curve (`Driver.late`, pedal up to `LATE_PEDAL` 0.8). Equal cars may dive: up to `DIVE_SLOWER` 0.02 pace under the car ahead. It dives on the player too |
| Defender | `Awareness.diver_on`: overlapped (centre within `OVERLAP` 5 m behind) on the inside of a braking zone, by an AI diver or by the player there on its own, the defender runs round the outside of it; the timid also lift (`concede`, as before) |
| Lone run-offs | a late-brake mistake carried a flat 3 m/s: a 10 m/s hairpin at 30% over, off the road (seed 9, car 1, lap 1). Now `MISTAKE_OVER` 10% of the plan, at most 3 m/s |
| Player grid slot | `Field(…, grid)` and `FieldStart.grid`: the AI cars fill the other slots in order, last by default. `FieldEvent.grid` from `grid_slot` (`career/series.ts`): behind every driver of the event's field ahead in the table. From-back scores only from the last slot |
| Retire | `field_retire` sim command, `Field.retire`, `FieldView.retire`: a knocked-out AI car stops under the world, out of contact, awareness, recovery and pass counts; it keeps its progress. `AiRace` sends it as the tally knocks a car out |

`bun scripts/ai-race.ts field all coupe 6 2 3 3 <difficulty>`, 25 races each: 73eecac before, eda08d3 (a dive rolled again every tick in its zone, so nearly every car within reach dived), b2910aa (one roll per zone, the final code; grid and retire do not touch the script):

| | easy 73eecac | eda08d3 | b2910aa | normal 73eecac | eda08d3 | b2910aa | hard 73eecac | eda08d3 | b2910aa |
|---|---|---|---|---|---|---|---|---|---|
| Mean lap (s) | 240.1 | 240.1 | 240.0 | 220.2 | 220.2 | 220.4 | 214.8 | 215.1 | 215.2 |
| Overtakes | 46 | 67 | 68 | 27 | 45 | 48 | 22 | 31 | 42 |
| Spins | 0 | 0 | 2 | 3 | 1 | 4 | 6 | 4 | 6 |
| Resets | 0 | 0 | 3 | 4 | 3 | 2 | 6 | 3 | 7 |
| Reverses | 0 | 0 | 5 | 1 | 0 | 0 | 2 | 2 | 2 |
| Hardest hit (m/s) | 9.5 | 5.1 | 15.7 | 26.0 | 11.0 | 10.9 | 15.3 | 16.2 | 10.0 |
| Contacts/lap mean | 4.3 | 6.3 | 5.5 | 4.3 | 6.1 | 6.5 | 4.6 | 6.0 | 5.9 |
| Races over 6 contacts/lap | 6 | 13 | 8 | 5 | 10 | 11 | 4 | 9 | 12 |
| Mean rho | 0.48 | 0.39 | 0.35 | 0.63 | 0.45 | 0.49 | 0.65 | 0.62 | 0.50 |

b7a6c07's normal column (phase 4 above): 236.2 s, 30 overtakes, 0 / 0, 5.7 m/s. 73eecac sped the field up 7% and cut its passing.

Normal's spins and resets on b2910aa are all seed 3 (its kicker and the wall after it, which reset cars before too). Tried and not kept: the dive on the inside edge (pass room) instead of the `PASS_LANE` 2.8 m lane, on eda08d3: 40 overtakes, 4 spins, 7 resets.

Open after this round:

- Contacts per lap rose with the passing: 10 of 25 normal races sit over the script's 6/lap band (5 before), so `ai-race.ts field` exits 1. Nearly all are rubs under 2 m/s between a car alongside and the one it is passing (73eecac's bold drivers rub, `RUB`); the hardest hit fell. Either the band moves to about 8, or `RUB` comes down and some of the bumping the owner asked for goes with it.
- Easy went from 0 / 0 to 2 spins, 3 resets, 5 reverses and a 15.7 m/s hit on b2910aa; hard's resets 6 -> 7. Not traced yet (`ai-why.ts` per seed is the next step).
- The AI cars grid in `season.field` order around the player's slot, not by the table: a driver second on points can start behind the player in third. Ordering them needs `event_field` and `event_result` to agree on one order for the whole event.
- The grid slot and the retire are covered by `field.test.ts` and `series.test.ts` only; a knockout in game is not driven by eye.

### Owner r3: corner speed, judder, grid at once (t296, 2026-11-15)

Owner r3 (`docs/lab/sessions/ai-field.r3.2026-11-15.txt`) and the series build: better starts, passing and line holding, but still easy ("cars slow down way too much on turns"), AI cars twitch a little (mostly close behind the player, in view), a lag before a series race's cars pop in.

| Piece | Where |
|---|---|
| Corner speed | `LINE_GRIP` 5.5 -> 6 m/s² (`ai/line.ts`). The coupe holds 0.94 g (9.2 m/s²) on the skidpad, so the plan sat at 60% of the car; the pursuit steering is what limits it, not the tyres |
| Judder | AI cars drew at their last physics step while the player's car draws between its last two at the frame's blend: a car moves a whole number of 360 Hz steps a frame (2 or 3 at 144 Hz), so against the player it jumped 0.5x-1.5x its speed frame to frame. `SimHost.field_from` keeps each AI car's pose before the frame's last step, the worker packet carries it (`SIM_PACKET` 3), `FieldView` lerps at `Sim.blend`, and a reset is drawn where it lands. Median frame-to-frame judder of the nearest car against the drawn player (island seed 4, 90 s): 50 -> 1.2 mm at 144 Hz, 23 -> 1.4 mm at 60 Hz. Not the far/near switch: a car inside 100 m or on screen never coasts |
| Lag before the cars | The field started on the race's first update: `race_line` took 320-420 ms on this desktop in that frame, then six car views were built, so the grid stood empty through a frozen frame. `FieldView` is now built with the race and draws each car parked on its slot until the sim's field has stepped; `race_line` runs in 70-130 ms (`inverse_radius` with one square root, not three `Math.hypot`). In worker mode the mirrors no longer draw at the origin before the first reply |
| Town laps | `MAX_LAPS` 3 -> 15 in `modes/ai-race.ts`: laps still come from the route's par toward 4 min (D4), so a 0.23-0.33 km town loop runs about ten |
| Series grid | `event_field(season, event, progress)` orders an event's drivers by the standings; `series_host` takes that order once for the cars, names and grid, and `event_result` maps the race through it |

`bun scripts/ai-race.ts field all coupe 6 2 3 3 <difficulty>`, 25 races each, b2910aa-equivalent before (e3b5a6c) and after (d3cd453):

| | easy before | after | normal before | after | hard before | after |
|---|---|---|---|---|---|---|
| Mean lap (s) | 240.0 | 234.3 | 220.4 | 215.3 | 215.2 | 210.7 |
| Overtakes | 68 | 81 | 48 | 52 | 42 | 55 |
| Spins | 2 | 3 | 4 | 6 | 6 | 5 |
| Resets | 3 | 1 | 2 | 7 | 7 | 4 |
| Reverses | 5 | 3 | 0 | 3 | 2 | 0 |
| Hardest hit (m/s) | 15.7 | 4.8 | 10.9 | 16.4 | 10.0 | 26.1 |
| Contacts/lap median (races over 8) | 5.0 (4) | 6.0 (5) | 5.5 (8) | 5.3 (3) | 5.5 (6) | 7.0 (9) |
| Mean rho | 0.34 | 0.41 | 0.49 | 0.43 | 0.49 | 0.61 |

Tried on normal and not kept:

| `LINE_GRIP` / pass grip | Mean lap | Overtakes | Spins / resets | Hardest | Rho |
|---|---|---|---|---|---|
| 6.5 / x1.4 (9.1) | 211.5 | 40 | 12 / 10 | 36.4 | 0.53 |
| 6.5 / 7.7 flat (today's) | 211.6 | 52 | 9 / 6 | 7.7 | 0.70 |
| 6.0 / 7.7 flat | 215.7 | 46 | 10 / 6 | 32.1 | 0.44 |

Solo (`ai-race.ts solo`, AI vs autolap median): 5.5 -13.7%, 6.0 -15.7% (seed 3 off the road 5.9 s), 6.5 -17.4% (2 off by under 0.5 m), 7.5 -19.0% (19 off). Braking at 3 instead of 2.5 put 8 of 25 off.

Open after this round:

- 6 m/s² buys about 2.5% a lap; the owner may still find corners slow. More needs the steering to hold a tighter line (pursuit aim and damping) before grip can rise: at 6.5 the field runs off the road in traffic. Done below.
- Normal's resets 2 -> 7 and hard's hardest hit 26.1 m/s are not traced (`ai-why.ts` per seed). Traced below.
- The town circuit's par is not measured here; the lap count follows it.

### Steering, then corner speed (t296 r2, 2026-11-15)

Where the speed went, from a solo diagnostic (each lap's worst distance off the line and what the car was doing there, first spot off the road):

- **Hairpins (radius 16-20 m) are lock-limited.** At 10-11 m/s the driver is at full wheel (`steer` ±1) with no slide and still sits 6-8 m off the line, inside the road. Grip there buys nothing.
- **Fast bends ran wide from the steering.** The solo laps that left the road at 6.5 did it in 200-400 m bends at 38-49 m/s with the wheel at 0.4-0.5: pure pursuit at `STEER_GAIN` 3 with the aim 40 m out turns only off its error, and the car drifted 3 m wide of the line before it turned enough.
- A steering feed-forward from the line's bend made it worse at every gain tried (x1: mean off the line 1.01 -> 2.77 m; x0.2-0.5: no change). A shorter aim (`AIM_PER` 4, 5) changed nothing. `STEER_GAIN` 4.5 took every solo lap onto the road, seed 3's kicker included.

Traced:

- **Normal's resets (6.0 run, `ai-why.ts`)**: 5 of 7 spins and 2 of 7 resets at seed 3's kicker (point 232-246, as before); 2 resets at seed 7 point 2692-2704 and 3 at seed 9's start. On the new steering the kicker ones are gone; seed 7's are a crest.
- **Seed 7, point 2640-2700 (hard's 30.7 m/s on f994ab2)**: a 9% climb straight into a 9% drop inside a 180-220 m bend at 36-39 m/s. Over the crest the car goes about a third light and slides. Car 1 spun there at 13.6 m/s, car 2 braking flat out (cap 7.8 m/s) hit it, then the two met sideways at 30.7 m/s closing. The line now plans crests as `v² = G R / (1 + G R k / g)`, k the road's vertical curvature over 10 points each side: 35.6 -> 31.2 m/s over that crest.
- **Hard's 21.0 m/s (crest in, x1.03)**: seed 2 point 2506, a car at pace 1.037 sliding 1.24 rad on the exit of a downhill hairpin, the follower braking into it. Own slide past the plan: hard's pace factor.

| Commit | Change |
|---|---|
| 2b0cb52 | `grip_at(bend)`: `LINE_GRIP` at `HAIRPIN_RADIUS` 25 m and tighter, eased to `FAST_GRIP` at `FAST_RADIUS` 80 m. A pass plans on at most `PASS_MAX` 8.4 m/s² (6 x 1.4). Both 6: no change |
| f994ab2 | `STEER_GAIN` 3 -> 4.5, `FAST_GRIP` 7 |
| e1de98d | crests in the corner speed |
| 68cc37b | hard pace x1.03 -> x1.02 |

`bun scripts/ai-race.ts field all coupe 6 2 3 3 <difficulty>`, 25 races each. Before = e3b5a6c (this round's start), 6.0 = d3cd453:

| | easy before | 6.0 | now | normal before | 6.0 | now | hard before | 6.0 | now |
|---|---|---|---|---|---|---|---|---|---|
| Mean lap (s) | 240.0 | 234.3 | 229.6 | 220.4 | 215.3 | 212.1 | 215.2 | 210.7 | 208.5 |
| Overtakes | 68 | 81 | 61 | 48 | 52 | 68 | 42 | 55 | 48 |
| Spins | 2 | 3 | 0 | 4 | 6 | 2 | 6 | 5 | 0 |
| Resets | 3 | 1 | 0 | 2 | 7 | 3 | 7 | 4 | 2 |
| Reverses | 5 | 3 | 0 | 0 | 3 | 0 | 2 | 0 | 1 |
| Hardest hit (m/s) | 15.7 | 4.8 | 6.4 | 10.9 | 16.4 | 11.3 | 10.0 | 26.1 | 8.7 |
| Contacts/lap median (races over 8) | 5.0 (4) | 6.0 (5) | 5.5 (3) | 5.5 (8) | 5.3 (3) | 7.0 (11) | 5.5 (6) | 7.0 (9) | 6.5 (7) |
| Mean rho | 0.34 | 0.41 | 0.36 | 0.49 | 0.43 | 0.61 | 0.49 | 0.61 | 0.65 |

Solo (`ai-race.ts solo`): all 25 laps on the road, AI vs autolap median -17.3% (-13.7% at the start of t296). Normal laps 3.8% faster than at the start of t296, with spins and resets back near 4 / 2 and the hardest hit at 11.3 m/s. Most of the gain is in fast bends: 7 m/s² there is 8% more corner speed than 6, and 13% more than the 5.5 the owner drove against.

Tried on normal and not kept (solo diagnostic: total of 25 laps, laps off the road):

| Variant | Solo total, off | Field: lap, overtakes, spins / resets, hardest, rho |
|---|---|---|
| 6 hairpin / 7 fast, gain 3 | 5167.7 s, 3 | |
| 6 / 7.5, gain 3 | 5326.0 s, 5 (seed 9 off 300 s) | |
| 6.5 / 7, gain 3 | 5137.1 s, 3 | |
| 6 / 7, gain 6 | 5144.5 s, 1 | |
| 6.5 / 7, gain 4.5 | 5123.7 s, 0 | 208.9 s, 57, 7 / 9, 9.1, 0.66 |
| 6 / 7.5, gain 4.5 | 5100.5 s, 3 | 208.2 s, 52, 6 / 8, 14.7, 0.69 |
| 6 / 7, gain 4.5 (kept) | 5149.8 s, 0 | 210.2 s, 59, 4 / 3, 9.0, 0.62 (before the crest fix) |
| hard x1.03 on the kept line, crest in | | 207.4 s, 58, 3 / 2, 21.0, 0.71 |
| hard x1.01, crest in | | 210.1 s, 39, 3 / 2, 6.4, 0.58 |

Open after this round:

- Contacts: normal's median is 7.0 per lap, and 11 of 25 races go over the script's band of 8, so `ai-race.ts field` exits 1. Faster cars close up more; most contacts are rubs while passing, as in t290.
- Rho rose to 0.61 / 0.65 (normal / hard): with less time lost in corners, pace differences decide less and the grid more. Still under `RHO_MAX` 0.7.
- Hairpins stay at 6 m/s², lock-limited. More there means a different wheel law (full lock earlier, entry speed from the lock), not more grip.
- Seed 16's lone slide on a 12% climb and seed 18's in a dip are not traced.
- The crest term also caps straight crests, at the speed the car would leave the ground (`sqrt(g / k)`: about 33 m/s over a 9% climb into a 9% drop); the autopilot has no such braking point. Fixed below.
- The town circuit's par is still not measured in a race here; a review's count on seeds 0-4 gives 240-328 m, par 23-28.5 s, so 8-10 laps.

Lead's calls on the open list:

| Commit | Change |
|---|---|
| 208893f | `CONTACT_BAND` 0-8 -> 0-10 contacts per lap in `ai-race.ts` |
| this one | A crest takes at most `CREST_LIGHT` 0.5 g of load off the corner plan: on a straight the plan no longer brakes for the take-off speed, and seed 7's bend crest (about a third light) plans as before |

Normal, 25 races, on the final code: mean lap 211.8 s (212.1 before the cap), overtakes 54, spins 2, resets 2, reverses 0, hardest hit 11.4 m/s, contacts/lap median 7.5 (max 14.0, 5 races over 10), mean rho 0.55, stuck 0. Five races over the new band still make `ai-race.ts field` exit 1.

### Automatic tuning: ai-tune.ts (t300, 2026-11-15)

Owner's "ML-style tuning": not a learned driver, a search over the AI's tuning numbers using headless races.

| Piece | Where |
|---|---|
| Injection point | `AI_TUNING` (`ai/tuning.ts`): line and fast grip, line and late braking, crest cap, pass grip and cap, pursuit aim, steering gain and damping, `rub`, personality ranges. `line.ts`, `driver.ts`, `awareness.ts` and `field.ts` read it; the game never writes it. Defaults are today's: the 25-race normal `ai-race.ts field all coupe 6 2` output is byte-identical before and after (52824c6) |
| Search | `scripts/ai-tune.ts`: separable CMA-ES (`ai-tune/cma.ts`, diagonal covariance, unit box, clamped samples) over 15 bounded parameters (`ai-tune/params.ts`). Aggression and mistakes rows stay hand-set: they are the cars' character. `aim_base` is whole road points |
| Races | each candidate races a level 3 field of 6 coupes, 2 laps, normal, on every island circuit of the train seeds, on worker pools (`--jobs`, a quarter of the cores by default; run it under `hq lock run --`). Deterministic: candidates come from the run seed and generation |
| Objective | `ai-tune/objective.ts`, lower is better: 100 x (field lap / autolap lap) - 1.5 x overtakes a race + 4 x (spins + resets) a race + reverses a race + 0.2 x mean hardest hit + 0.5 per m/s of the worst hit over 15 + 20 x share of races out of the 0-10 contact band + 30 x mean rho over 0.6 + 100 x share stuck. Weights signed off by the lead |
| State | `.ai-tune/<run>.json` (git-ignored) after every race: the same command resumes, a larger `--gens` extends a finished run. At the end the defaults and the best candidate race held-out `--check` seeds; best values go to `.ai-tune/<run>.best.json`. `--eval <file>` races one values file beside the defaults and scores it against their pass floor |

Demo run, `bun scripts/ai-tune.ts --run demo --seeds 0-7 --check 8-19 --pop 8 --gens 4 --jobs 3` (33 candidates, about 25 min on 3 workers):

| Gen | Sigma | Best loss | Median |
|---|---|---|---|
| defaults | | 87.13 | |
| 0 | 0.200 | 83.46 | 102.68 |
| 1 | 0.191 | 84.50 | 87.27 |
| 2 | 0.183 | 82.93 | 85.46 |
| 3 | 0.169 | 83.81 | 87.34 |

| | Defaults (train) | Best (train) | Defaults (held out) | Best (held out) |
|---|---|---|---|---|
| Races | 11 | 11 | 14 | 14 |
| Loss | 87.13 | 82.93 | 86.36 | 85.08 |
| Lap vs autolap | -16.1% | -15.9% | -15.5% | -15.5% |
| Overtakes / race | 1.27 | 1.27 | 2.86 | 2.14 |
| Spins + resets / race | 0.09 | 0 | 0.21 | 0 |
| Hardest hit mean (worst), m/s | 5.5 (11.4) | 3.6 (5.1) | 5.1 (11.3) | 4.5 (7.8) |
| Races out of the contact band | 18% | 0% | 21% | 14% |
| Mean rho | 0.57 | 0.31 | 0.54 | 0.55 |
| Stuck | 0 | 0 | 0 | 0 |

Best candidate (gen 2), against today's: `fast_grip` 7 -> 6.48, `aim_per` 3 -> 3.63, `steer_damp` 1 -> 1.28, `rub` 0.8 -> 0.62, `pace_hi` 1.02 -> 1.043, `brake_margin_hi` 0.8 -> 0.69; the rest within 3% of today's (`line_grip` 5.96, `line_brake` 2.57, `late_brake` 3.98, `crest_light` 0.49, `pass_grip` 1.38, `pass_max` 8.37, `aim_base` 7, `steer_gain` 4.5, `pace_lo` 0.961). Not applied as defaults: the lead decides after the owner drives.

On the held-out seeds the best candidate beats today's by 1.3 loss points. It is cleaner: no spins or resets, worst hit 11.3 -> 7.8 m/s, out-of-band races 3 -> 2 of 14. It passes less (2.86 -> 2.14 a race), and it is no faster. Train rho fell 0.57 -> 0.31 but held-out rho did not move, so that part was the 11 train races, not the parameters.

Open after this round:

- 11 races a candidate is noisy: gen 0's best (83.46) was a lucky draw that later generations did not beat by much. A run meant to ship values wants more train seeds (`--seeds 0-11`) and more generations; at 3 workers that is about 2 hours.
- Pace does not move: no candidate got faster than -16% against the autolap. Lap time is bound by what the search cannot reach (hairpin lock, kicker pace), or the 1% = 1 point weight is too light against the contact and spin terms.
- The search trades overtakes for clean racing on held-out seeds. If the owner wants the passing kept, `W_PASS` goes up.

### Tuner reweight and long run (t302, 2026-11-15)

The demo made races cleaner, not faster, and passed less. The owner's order: (1) faster in corners, (2) passing, (3) few spins and resets; light rubbing is fine.

| Change | Where |
|---|---|
| Pace 2 points per 1% of lap (was 1), overtakes 3 a race (was 1.5), spins + resets 8 (was 4, still 4% of lap), stuck 200 (was 100); contact terms keep their weights, so rubbing costs half as much against pace | `ai-tune/objective.ts` |
| Pass floor: each overtake a race under the defaults' on the same seeds costs 20 more. The defaults race the train seeds first and set the floor; the held-out best is scored against the defaults' held-out overtakes | `objective.ts` `score(…, floor)`, `ai-tune.ts` |
| State version 2: run files scored on the old weights refuse to resume | `ai-tune.ts` |

Long run: `hq lock run -- bun scripts/ai-tune.ts --run long --seeds 0-11 --check 12-23 --pop 10 --gens 10 --jobs 3` (101 candidates).

