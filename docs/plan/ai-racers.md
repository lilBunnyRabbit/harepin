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
| cb755ad, last fix commit | One `OFF_ROAD` 7 m in `driver.ts` for the trouble flag, the field's off-road time and resets, and `ai-race.ts`. A `KICKER_YIELD` floor (a car yielding into a kicker drops at most 4 m/s under the plan) went in with 529f057 and came out again: the car alongside is always also `decide`'s in-lane blocker, so the floor either never acted or, once it did (cb755ad), lifted the follow cap of a car right behind another. Hardest hit 5.7 -> 9.2 m/s, overtakes 31 / 35 / 40 -> 28 / 31 / 34 |

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
