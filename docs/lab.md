# Feel lab

A hidden test world for tuning how cars handle. The lead writes a **pack** of trials (car + overrides x station + goal), the owner drives it from a link, presses Copy and pastes one text block back; the lead diffs it against the last run and tunes. History and the options weighed: `docs/plan/feel-lab.md`.

Nothing in the lab touches the game around it: no records, ghosts, stars or goals; the garage build is never written; the room is solo; trial specs reach `Driver` only, `car.ts` never sees a difference.

## Open it

| Link | What loads |
|---|---|
| `/?lab=<id>` | the committed pack `src/lab/packs/<id>.ts` (`?lab=demo` is the sample, `?lab=first-look` the first real session, `?lab=t1-surfaces` the stock coupe on every skidpad and runway lane, `?lab=t2-drift` the Drift preset on the drift circle, eight and hairpins with three mods) |
| `/?lab=~<code>` | an inline pack carried in the link itself: no deploy needed |

Works on the live site and in dev; no menu entry, like `?tune`. The lab world (`lab` kind, unlisted) loads, the car goes to the first trial's station and the pack card opens instead of the menu or the first-visit guide. Modes are off in the lab: the Modes page shows each one as "Not in the lab", and no lobby race starts.

## The overlay

| Piece | What it shows | Controls |
|---|---|---|
| Pack card (trial list) | title, rev, trials driven, brief; one tile per trial: id, car, class and PI, station/lane, goal, status `To do` / `Running` / `Done` / `Stopped` | tap or A on a tile starts that trial; Start (or Back to trial); Copy results; Leave lab (the same link without `?lab`: the game as usual, the tab's stored answers and numbers kept for the next visit) |
| Strip (top, where the lap strip sits) | `Lab n/N`, the trial id, goal, status; while a trial measures, a second line of live numbers: goal progress (`Lap 2/3`, `41 s left`, `Gate 1/2`, `Brake from 60`), lateral g, speed, slip angle. Each is rewritten only when its shown digits change | Trials, Retry, Stop and rate |
| Results card | after a trial's goal or Stop: the trial's feel line, the questions, then every metric it measured | Trials, Copy, Previous, Retry, Next |

The cards are modal and hold the sim like the menu does. A 1-5 scale is five big buttons, never a slider; a note is one optional line (400 characters at most). Answers save on every change to `sessionStorage` under `harepin.lab.<pack>.r<rev>`, and each trial's numbers when it ends (goal or Stop) under `harepin.lab.<pack>.r<rev>.results`, so a reload keeps both. A trial still running at the reload loses that attempt and keeps its last finished one. Both are checked against the pack on load: answers that do not fit are dropped, and so are numbers whose `spec#` no longer matches the trial (a deploy moved the car) or whose fields do not check out.

Pad: Start opens the strip (and the HUD bar beside it), the d-pad walks the buttons, A presses; in a card up/down moves between questions, left/right along a scale, B closes it. When the browser refuses the clipboard, the pack card shows the block in a box to select and copy by hand.

Keys stay as shortcuts while no card has focus:

| Key | Does |
|---|---|
| `]` / `[` | next / previous trial (a running trial is kept as `stopped`) |
| `\` | restart the current trial |
| `=` | copy the export block to the clipboard |

Reset, rewind and lava work as anywhere; each placement counts as a reset in the trial.

## The world

`src/worldgen/lab.ts` lays it on flat ground (`LAB_GROUND`, seed ignored: every link drives the same lab). Asphalt pieces are road edges, every other surface a painted `SurfaceId`; dune sand is `SurfaceId.SAND`, the one id that exists for the lab (grass and dune sand side by side). Bare ground is grass. The same `LAB_LAYOUT` gives each lane its spawn, ring, gates and path, so what the recorder measures is what was laid.

| Station | Lanes (`ring`: laps count turns round it; `gates`: a start and finish line time the run) |
|---|---|
| `hub` | `asphalt`: a 120 m pad in the middle |
| `skidpad` | one 90 m pad per surface, cones on the 30 m ring: `asphalt`, `grass`, `sand`, `dirt`, `hardpack`, `scree`, `wet`, `snow`, `packed_snow`, `ice`, `slush` (ring) |
| `runway` | the same eleven surfaces as parallel 520 m lanes, start line and a 400 m line (gates) |
| `grid` | `mixed`: a 400 m checkerboard of every painted surface, asphalt down its west side |
| `oval` | `asphalt`: the 1.3 km straights round everything, top speed (ring round the centre) |
| `brake` | `asphalt`: the oval's east straight, a long run-up, two cone boards, then cones every 10 m for 120 m past the brake line (start gate) |
| `slalom` | `asphalt` (24 m cones, the default), `asphalt18`, `asphalt30`, `dirt`, `packed_snow` (gates) |
| `hairpin` | `asphalt`, `dirt`: three 180° bends, r = 12 m, 80 m legs (gates) |
| `sweeper` | `r120`, `r200` on asphalt, `hardpack` r = 150, 120° each (ring and gates) |
| `drift` | `asphalt`, `packed_snow`: a pad with a 20 m cone ring (ring) |
| `eight` | `asphalt`: two cone posts 40 m apart on a 140 x 70 m pad |
| `kicker` | `small`, `big`, `drop` (a kicker whose back falls at 25%, to land on): asphalt run-up, dirt landing (gates) |
| `lava` | `dirt`: a track 6 m off a 30 m lava pool (ring) |
| `hill` | `10`, `20`, `30` (% grade, asphalt), `dirt20` (gates) |

Not in the lab yet: banked bowls (a deck over ground kinds does not mesh; banked turns stay on `?world=velodrome`), a ford (water needs the flood planner), a shoulder pad (shoulder is the strip beside every asphalt piece). Moving a station is free: bump `LAB_VERSION` in `src/worldgen/kinds/lab.ts`, rerun the lab golden (`bun scripts/golden.ts`, commit `scripts/golden/lab.txt`); the lab keys no records.

## Writing a pack

One file per pack in `src/lab/packs/<id>.ts`, default export, plus one line in `PACKS` (`src/lab/packs.ts`). Each pack is its own chunk. `bun test src/lab` loads every registered pack and resolves every trial, so a broken pack fails before it ships.

```ts
import type { Pack } from "../pack";

const pack: Pack = {
  id: "hatch-ice",             // same as the file and the PACKS key
  rev: 1,                      // bump on every edit: the export carries it
  title: "Hatch on ice",
  brief: "The hatch on the ice pad.",
  cars: { /* lab-only cars, see below */ },
  trials: [
    {
      id: "hatch-ice",          // unique in the pack; the export keys on it
      car: "hatch.4.0.2.1.0",  // a build code, or "lab:<key>" of `cars`
      mods: [{ scale: { rear_grip: 0.95 } }],
      aids: { stability: false },
      station: "skidpad",
      lane: "ice",              // the station's first lane when absent
      goal: { kind: "laps", laps: 3 },
      try: "hold the ring at the edge of grip",
      feel: "slides early but never snaps",
    },
  ],
  ask: [{ kind: "scale", id: "grip", label: "Grip", low: "slides everywhere", high: "glued" }],
};
export default pack;
```

### Trial

| Field | Meaning |
|---|---|
| `car` | a shipped build code (paint, decal, parts: `build_code` in `src/car/build.ts`), or `lab:<key>` |
| `mods` | `Mod[]` folded after the build's parts exactly as one more part: every `scale` multiplies first, then every `add` sums on, then `LIMITS`. Fields: any numeric `CarSpec` field (`mass`, `mu`, `rear_grip`, `peak_slip`, `spring`, `damper`, `drag`, `downforce`, `aero_front`, `redline`, `final`, …) and the derived ones `torque` (the whole curve), `inertia`, `rest`, `cog`, `nitro`, `grip_dirt`, `grip_grass` |
| `aids` | `tcs`, `abs`, `assist`, `stability`, `auto`, `steer_mode` for this trial only, over the player's own |
| `station`, `lane` | from the table above |
| `goal` | `laps` (turns of the lane's ring), `time` (seconds driven), `stop` (a brake stop from at least 90% of `from_kmh`), `run` (start to finish gate), `free` (never ends) |
| `try`, `feel` | what to do and what to feel for |
| `ask` | questions for this trial, else the pack's |

Questions: `scale` (1-5 with `low`/`high` ends), `pick` (`options`), `text`. `src/lab/ask.ts` holds the plan's set: `ASK` (grip, predictability, fun, note) and `with_station_asks(trials)`, which gives each trial those plus drift ease on the drift, eight, skidpad and hairpin stations, landing on the kickers, and "vs last trial" (worse / same / better) when the trial before ran the same station. Group a pack's trials by station so that last one asks. The clock starts at the first throttle or movement after the trial places the car.

### Lab cars (unreleased cars and parts)

```ts
cars: {
  tsumuji: { name: "Tsumuji", spec: { ...CARS.kaze, name: "Tsumuji", mass: CARS.kaze.mass - 80 }, look: "kaze", parts: { tyres: 3 } },
},
```

`spec` is a whole `CarSpec`: the literal that later gets pasted into `cars.ts`. Its id becomes `lab:<key>`, which never parses as a build code, so it cannot reach the garage, a peer or a save. `look` is a shipped body drawn in its place (its size still comes from `spec.body`); `parts` are drawn and folded into the spec before the trial's mods. Shared prototypes go in `src/lab/cars/<name>.ts` so two packs never fork one car.

A new part is just `mods` on a trial; a new slot is a set of mods crossed with cars by listing trials. What no field covers (per-axle tyres, a torque curve that changes shape rather than scale) needs a lab car with its own `torque` table, or a new `CarSpec` field landed as a car-physics task first.

### Worked example: top-tier parts (turbo stages)

The quest `top-tier-parts` wants road cars into S2/X. A pack compares stages side by side; the toast and the export show each trial's PI and class, so the class a stage reaches is read off the run:

```ts
const STURM = "sturm.4.0.2.1.2"; // race engine
trials: [
  { id: "sturm-race",   car: STURM, station: "runway", goal: { kind: "run" }, try: "flat out", feel: "baseline" },
  { id: "sturm-turbo1", car: STURM, mods: [{ scale: { torque: 1.15 }, add: { mass: 10 } }], station: "runway", goal: { kind: "run" }, try: "flat out", feel: "stage 1" },
  { id: "sturm-turbo2", car: STURM, mods: [{ scale: { torque: 1.3 }, add: { mass: 18, redline: 300 } }], station: "runway", goal: { kind: "run" }, try: "flat out", feel: "stage 2" },
  { id: "sturm-turbo3", car: STURM, mods: [{ scale: { torque: 1.45 }, add: { mass: 25, redline: 500 } }], station: "oval", goal: { kind: "laps", laps: 1 }, try: "one lap", feel: "stage 3 at speed" },
]
```

(`src/lab/packs/demo.ts` holds these; today they rate 626 A, 647 A, 664 A, 680 A: a turbo alone does not reach S2.) Weight reduction is `add: { mass: -n }`, wider slicks `scale: { mu, rear_grip }`, big aero `add: { downforce, drag }`.

Boost curves (lead's call, for now): a turbo whose torque rises with rpm is a lab car with a hand-edited `torque` table, not a new mod field or a `CarSpec` change. A `torque` mod only scales the whole curve; a different shape needs that lab car until a turbo stage is worth landing as a car-physics task.

### Inline packs

The same `Pack` object as JSON, base64url, after `~`. Print a link from a pack file:

```sh
bun -e 'import { pack_code } from "./src/lab/pack-code"; import p from "./src/lab/packs/demo"; console.log("https://<site>/?lab=" + pack_code(p))'
```

An inline pack is untrusted: `read_pack` checks every field, holds a lab car's `spec` to the shape of the shipped specs (same keys, finite numbers, only strings some car already uses) and resolves every trial before anything drives. The committed file stays the source the lead diffs; inline is for a quick round without a deploy.

## The export block

The overlay's Copy (or `=`) copies it, answers and note included. Line-based so two runs diff line by line and survive a chat app:

```
#lab demo r1 v0.41.1 2026-11-13T23:14Z keys 1440x900
#trial hatch-asphalt-pad hatch.4.0.2.1.0 spec#af22e9be pi422C skidpad/asphalt laps3 done
 m time=70.1 lap=21.8,22.4,22.1 latg=0.81/0.74 ring=37.1 slip=22/18.8 held=14.2 chain=6.1 spins=0 rec=0.84 top=61.6 spin=0.33/1.81 air=0 bounce=0 offs=2 resets=0 lock=0.42 thr=0.91 hb=0 rev=0.1
 a grip=2 pred=4 fun=4
 n "slides early, catches fine, a bit slow to rotate back"
#trial sturm-turbo1 sturm.4.0.2.1.2 +torque*1.15 +mass+10 spec#7a22f86b pi647A runway/asphalt run skipped
#end 1/8 trials
```

| Line | Fields |
|---|---|
| `#lab` | pack id, `r<rev>`, game version, UTC time, input (`touch`, `keys`, `pad`), viewport |
| `#trial` | id, car, mods (`field*scale`, `field+add`), `spec#` (8-hex hash of the resolved spec: which physics ran, even across deploys), PI and class, station/lane, goal, status `done` / `stopped` / `running` / `skipped` |
| ` m` | metrics, fixed order; a key the trial never measured is left out |
| ` a` | answers (`note` goes on its own line) |
| ` n` | the note, quoted |
| `#end` | trials with numbers / trials in the pack |

Metric keys (numbers keep 3 significant digits):

| Key | Unit | How |
|---|---|---|
| `time` | s | driven since the first throttle |
| `lap` | s each | a turn round the lane's ring |
| `seg` | s | start gate to finish gate |
| `latg` | g peak/mean | `|yaw rate x speed| / 9.81` on the ring band above 20 km/h (`scripts/telemetry.ts`' skidpad) |
| `ring` | km/h | mean speed on the ring band |
| `slip` | ° peak/mean | body slip `atan2(-local.x, local.z)` (`scripts/feel.ts`), mean while past 10° |
| `held`, `chain` | s | total and longest drift between `MIN_ANGLE` and `MAX_ANGLE` over `MIN_SPEED` (`modes/drift.ts`) |
| `spins` | count | slip past `SPIN_ANGLE` (100°) |
| `lag` | s | steer reversal to the yaw rate turning the new way |
| `rec` | s | slide past 15° caught to under 5° with yaw under 0.05 rad/s (`scripts/drift.ts`' catch) |
| `0-100` | s | from rest to 100 km/h |
| `stop` | m@km/h | brake press over 30 km/h to under 0.5 km/h, and the speed it started from |
| `top` | km/h | best forward speed |
| `spin` | share/peak | time a driven wheel turns 1.15x faster than the ground, under throttle; peak ratio |
| `air`, `land`, `bounce` | s, up, count | time airborne in flights over 0.2 s; lowest `upright` at touchdown (1 flat); flights starting within 0.5 s of a landing |
| `offs` | count | 0.5 s outside the lane's path or ring band |
| `resets` | count | placements after the trial started |
| `lock`, `thr`, `hb` | share | time at full lock, full throttle, handbrake |
| `rev` | per s | steer reversals: tells a twitchy car from a driver sawing at it |

## Sim before the owner drives: `scripts/lab.ts`

Run it on every pack before sending the link (plan `docs/plan/feel-lab-v2.md`). It runs the headless scenarios for each trial's station on its lane's ground, across all cores (`--jobs n` to cap).

```sh
bun scripts/lab.ts <pack>                   # sim lines, deltas, drive time; exit 1 on a failed sim or a pack over budget
bun scripts/lab.ts <pack> --base <trial>    # deltas against one trial instead of the first trial per station
hq lock run -- bun scripts/lab.ts matrix [car]   # the car x setup matrix as a markdown table, all cars about 30 s
```

Pack output, one block per trial in the export's shape and key order, so a ` sim` line sits beside the owner's ` m` line:

```
#sim demo r1 base first trial per station
#trial sturm-turbo1 sturm.4.0.2.1.2 +torque*1.15 +mass+10 spec#7a22f86b pi647A runway/asphalt run est 0m20s
 sim 0-100=3.82 stop=28.5@100 top=303
 d 0-100=-0.103 stop=+0.104 top=+10.9 vs sturm-race
#end 8 trials, drive 5m09s + cards 6m00s = 11m09s
```

| Station | Scenarios (`scripts/lab/sims.ts`) | Keys |
|---|---|---|
| skidpad, sweeper, lava | telemetry's skidpad (best steady g at 70 km/h), feel's lift-off mid corner, assists on | `latg`, `slip` |
| slalom, hairpin | feel's power on mid corner (TCS on), step steer t90 | `slip`, `lag` |
| drift, eight | `catch_drift` from 60 km/h aiming 30°, and its let-go time | `slip` (peak), `held`, `rec` |
| runway, oval, brake | telemetry: 0-100 TCS on, 100-0 ABS on, top speed | `0-100`, `stop@100`, `top` |
| hub, hill, grid, kicker | none yet (` sim -`): landings and seams need the bot on the lab world (plan P2b), the hill a sloped scenario | |

- Scenarios run on the flat ground named after the lane surface (`scripts/grounds.ts`, every lab surface has one). The drift scenarios only drive asphalt; their line ends `on asphalt` when the lane is another surface.
- Keys steer with the trial's `aids.steer_mode` (Smooth by default); every other aid is the scenario's own, not the trial's.
- `d` is the delta against the base: `--base`, else the pack's first trial on the same station. A trial with nothing in common with its base prints no `d`.
- `est` and the `#end` budget come from `src/lab/budget.ts`: a lap or run per station (skidpad laps grow by `sqrt(1 / grip)` on low grip), a time goal's seconds, 45 s per card. Caps: 10 trials and 20 minutes; `pack.test.ts` holds every committed pack to them except the two written before them (`t1-surfaces`, `t2-drift`).
- Numbers that never happened print as the scenario's limit: `0-100=20` never reached 100 km/h, the matrix's `kick` -1 never settled.

The matrix (`scripts/lab/setups.ts`): per car its families (`stock`, `grip`, `aero`, `drift`, `dirt`, `max`, built from parts by name), every shipped preset of the car, and on the coupe a sweep of each tyre and aero part. `stock` and `dirt` also run on dirt, grass, sand, packed snow and ice. The bus is left out. Columns: spec hash, PI and class, 0-100, top, 100-0, skidpad g, step-steer t90, lift-off slip, power-on slip (2nd, TCS off), handbrake flick degrees, yaw kick settle at 220 km/h.

Not built yet: the handling golden (`lab.ts golden`, P3), `lab.ts diff` between sessions (P5), `lab.ts promote` (P6).

## Reading results

- Diff only like against like: same pack id and `r`. A changed `spec#` with the same trial id means the physics moved (a deploy changed the car); compare the numbers with that in mind.
- Read numbers next to the inputs: high `lock` and `rev` with low `latg` is a driver fighting the car; `offs` and `resets` say whether a lap counts.
- Ratings against numbers: "grip 2" with `latg` at the car's usual figure is a feel problem (how the slide arrives, `rec`, `lag`), not a grip number.
- `stopped` and `running` trials carry what they measured so far.

## Promoting a winner

| Winner | Copy into | Proof |
|---|---|---|
| Mods on a shipped car | fold the values into the car's literal in `src/car/cars.ts` | `car.test.ts`, `scripts/telemetry.ts` / `feel.ts` / `drift.ts` numbers move as meant, `bun scripts/races.ts --changed`, release notes |
| A new part | append `{ name, blurb, mod }` at the end of its slot in `SLOTS` (`src/car/build.ts`; codes are one digit per slot, so 10 parts at most) | `build.test.ts`, `pi.test.ts`, the garage card |
| A new slot | append it to `SLOTS` last | as above |
| A lab car | its `spec` into `cars.ts`, its id into `BodyStyle` and `CARS`; the compiler lists every `Record<BodyStyle, …>` missing it (design, model, sound). Then point packs at the real id and delete the lab car | `presets.test.ts`, `pi.test.ts`, `models.test.ts`, design review shots |

## Code map

| File | Holds |
|---|---|
| `src/worldgen/lab.ts` | layout, stations and lanes, `generate_lab` |
| `src/worldgen/kinds/lab.ts`, `src/worlds/lab.ts` | the kind and its UI def |
| `src/lab/pack.ts` | `Pack`, `Trial`, `LabCar`, `resolve_trial` (spec, hash, PI, class, lane) |
| `src/lab/pack-code.ts` | inline codes and the untrusted-pack reader |
| `src/lab/packs.ts`, `src/lab/packs/*.ts` | registry and packs |
| `src/lab/recorder.ts` | per-step metrics, no allocation in `step` |
| `src/lab/export.ts` | the export block |
| `src/lab/lab.ts` | trial flow, keys, Copy; lazy-loaded by `main.ts` on `?lab` |
| `src/lab/answers.ts` | questions per trial, answer checks, the stored-answers reader |
| `src/lab/ask.ts` | the shared questions and `with_station_asks` |
| `src/lab/results-store.ts` | the stored-numbers writer and reader |
| `src/lab/lab-view.svelte.ts`, `LabOverlay.svelte`, `TrialList.svelte`, `ResultCard.svelte`, `Scale.svelte` | the overlay: strip, pack card, results and question card |

| `src/lab/budget.ts` | drive time per trial and the session caps |
| `scripts/lab.ts`, `scripts/lab/*.ts` | sim lines per trial, the setup matrix, their worker pool |
| `scripts/bench/feel-cases.ts`, `scripts/bench/telemetry-cases.ts` | the feel and telemetry scenarios as functions on a `CarSpec`; `scripts/feel.ts` and `telemetry.ts` print them |

Still to build: shared lab cars (Tsumuji, Sajin), and the rest of `scripts/lab.ts` (golden, diff, promote; `docs/plan/feel-lab-v2.md` 10).
