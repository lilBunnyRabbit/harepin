# AI racers with car-to-car contact: plan

Status: research for quest ai-racers, base master 013ad41, 2026-11-14. No code changed. The owner picks the decisions in section 8 before the first edit.

Short version: contact does not go inside `Car.step`. It is a second pass after every car has stepped, the same slot `world.collide` already sits in (`src/main.ts:753-756`), and it reuses the shape `world.collide` already uses: two circles per car along the heading, which make a capsule. With one car there are no pairs, so the pass writes nothing and single-car physics stays byte-identical by construction. The AI driver is `scripts/autolap.ts` with its per-step speed plan moved to a table built once per route, plus a racing-line offset and a 10 Hz awareness layer in route coordinates. A car step costs about 20 µs on this desktop; on a phone 5-7 AI cars at full rate eat about a fifth of a main thread that is already over budget, so AI cars away from the player drop to a kinematic line follower.

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
| AI physics in a Worker | new infra | contact with the player needs the same step on both sides: a frame of latency in every bump. Only if phones still fall short with kinematic far AI |
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

| # | Question | Recommendation |
|---|---|---|
| O1 | Contact shape | capsule from `circles` + `radius`, same as walls |
| O2 | Where the code lives | new `src/ai/` feature folder (line, driver, awareness, field); contact pass in `src/car/contact.ts` |
| O3 | Race mode: AI field replaces the dev ghost, or both | AI replaces the ghost when a field is on; ghost stays for time-only races |
| O4 | Catch-up | mild (±3% pace), off by default, one personality number |
| O5 | Difficulty for the player | one setting (easy / normal / hard scaling `pace` and `mistakes`), a `FIELDS` entry in `menu/prefs.ts` |
| O6 | AI cars: which cars | the player's class cap, presets from `car/presets.ts`, no two alike in a field |
| O7 | Far AI on phone | kinematic follower beyond ~120 m off screen; Worker only if that falls short |
| O8 | Lab | `Trial.map` + `Trial.field`, not a lab circuit station |
| O9 | Career and Runs with AI | not before phase 4 tuning; position-based marks are a separate design |
