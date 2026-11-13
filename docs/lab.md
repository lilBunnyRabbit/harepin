# Feel lab

A hidden test world for tuning how cars handle. The lead writes a **pack** of trials (car + overrides x station + goal), the owner drives it from a link, presses Copy and pastes one text block back; the lead diffs it against the last run and tunes. History and the options weighed: `docs/plan/feel-lab.md`.

Nothing in the lab touches the game around it: no records, ghosts, stars or goals; the garage build is never written; the room is solo; trial specs reach `Driver` only, `car.ts` never sees a difference.

## Open it

| Link | What loads |
|---|---|
| `/?lab=<id>` | the committed pack `src/lab/packs/<id>.ts` (`?lab=demo` is the sample) |
| `/?lab=~<code>` | an inline pack carried in the link itself: no deploy needed |

Works on the live site and in dev; no menu entry, like `?tune`. The lab world (`lab` kind, unlisted) loads, the car goes to the first trial's station and a toast names the trial, its try line and the car's class and PI.

Until the overlay lands (plan phase 4) the keyboard drives the pack:

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
  id: "t1-surfaces",           // same as the file and the PACKS key
  rev: 1,                      // bump on every edit: the export carries it
  title: "Surfaces",
  brief: "The hatch on every skidpad.",
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

Questions: `scale` (1-5 with `low`/`high` ends), `pick` (`options`), `text`. The clock starts at the first throttle or movement after the trial places the car.

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

(`src/lab/packs/demo.ts` holds these; today they rate 626 A, 647 A, 664 A, 680 A: a turbo alone does not reach S2.) Weight reduction is `add: { mass: -n }`, wider slicks `scale: { mu, rear_grip }`, big aero `add: { downforce, drag }`. A boost curve that rises with rpm is a lab car whose `torque` table is edited by hand.

### Inline packs

The same `Pack` object as JSON, base64url, after `~`. Print a link from a pack file:

```sh
bun -e 'import { pack_code } from "./src/lab/pack-code"; import p from "./src/lab/packs/demo"; console.log("https://<site>/?lab=" + pack_code(p))'
```

An inline pack is untrusted: `read_pack` checks every field, holds a lab car's `spec` to the shape of the shipped specs (same keys, finite numbers, only strings some car already uses) and resolves every trial before anything drives. The committed file stays the source the lead diffs; inline is for a quick round without a deploy.

## The export block

`=` copies it (the overlay's Copy will too). Line-based so two runs diff line by line and survive a chat app:

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

Still to build (plan phases 4-6): the Svelte overlay (pack card, trial list, HUD strip, results and question card, answers kept per pack and rev in `sessionStorage`), more packs and shared lab cars, and `scripts/lab.ts` (`--check`, sim baselines as an ` sim` line, `--promote <trial>`).
