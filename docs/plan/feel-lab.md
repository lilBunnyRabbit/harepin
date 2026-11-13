# Feel lab: plan

Status: plan for quest 3133da1 (feel-lab), base 86d5c41, 2026-11-13. No code changed. The owner reviews this and picks the decisions in section 9 before the first edit.

Short version: a new unlisted world kind, `lab`, hand-laid on flat ground. It holds a station for every handling question and a pad for every surface the game has. `?lab=<pack>` loads it in a solo room and lazy-loads `src/lab/`. A pack is a typed TS file in the repo: a list of trials, each one car + spec override x station + goal. Overrides become a `CarSpec` that only the lab hands to `Driver`, so `car.ts` never changes. A recorder samples the car each physics step and folds the numbers the headless scripts already print. The owner rates each trial on 1-5 scales, presses Copy and pastes back one text block the lead can diff. Unreleased cars and parts live as lab-only defs that never touch `CARS`, `SLOTS` or build codes; promoting one is a copy into those registries.

The loop it is built for:

1. Lead writes `src/lab/packs/<id>.ts`, runs `bun scripts/lab.ts <id> --check` (headless sanity: every trial resolves, sim baselines print), pushes.
2. Owner opens `https://<site>/?lab=<id>` on phone or desktop, drives the trials, rates them, presses Copy.
3. Owner pastes the block. Lead diffs it against the last run of the same pack, tunes, bumps the pack's `rev`, back to 1.

## 1. What exists today

| Piece | Where | What the lab takes from it |
|---|---|---|
| Unlisted kind pattern | `src/worldgen/kinds/rooftops.ts:8-22`, `src/worldgen/kinds/velodrome.ts:21-35`, `src/worlds/velodrome.ts:33` (`listed: false`) | `kind_def({...})` + a `WorldDef` with `listed: false, mini: false`; loads from `?world=` only |
| Kind registry | `src/worldgen/kinds/kinds.ts:18` (`KINDS: Record<WorldKind, KindDef>`), `src/worldgen/types.ts:44` (`WorldKind`) | one value + one registry line; the compiler lists the rest |
| Surfaces | `src/worldgen/types.ts:28` `SurfaceId` (10 ids, never renumber), `src/worldgen/types.ts:31` `SURFACE_GROUND` | the pads paint these |
| Grip rows | `src/worldgen/kinds/kind-def.ts:94-118`: `LAND_GRIP`, `SAND_GRIP`, `WINTER_GRIP` | one table per kind; `GRASS` is "the kind's own ground" (grass on land, loose sand on dunes) |
| Grip lookup | `src/world/world.ts:246` (`this.grips = snow?.grip ?? KINDS[data.kind].grip`), `src/world/world.ts:435-440` (`dry_footing`: road_dist first, then laid surface, then shoulder, then own ground) | why one world cannot show both grass and dune sand today (section 2.3) |
| Ground ops | `src/worldgen/stamp.ts:53-68` (`paint` lays a `SurfaceId` along lines, `junction` writes `road_dist` inside a polygon, `lava`, `water`), `src/worldgen/stamp.ts:70` (`GroundBase` has a `flat` variant) | the whole lab ground is a flat base plus ops; no new op needed |
| Deck | `src/world/world.ts:333-339` (height is `max(deck, terrain)`, normal from the deck when above) | banked turns as deck pieces over the flat ground |
| URL world pick | `src/world/world-pick.ts:30` (`URL_WORLD_PARAMS`), `:33` `names_world`, `:39` `pick_world` | `?lab` joins the list |
| Solo room | `src/main.ts:88` (`solo = (event \|\| run \|\| review) && !room`) | `?lab` joins it: no peers, no lobby |
| Lazy dev-ish panel | `src/main.ts:612` (`?feel` imports `hud/feel-panel` on demand), `src/hud/feel-tests.ts` | proves the lazy-chunk pattern; the lab supersedes the panel (it can stay) |
| Hidden-in-prod precedent | `src/review/params.ts:3` (`REVIEW_BUILD`: dropped from prod) vs `career.ts` `?tune` (ships) | the lab must ship, so it follows `?tune`/`?feel`, not `REVIEW_BUILD` |
| Spec from build | `src/car/build.ts:22` (`Mod`: `scale`/`add` per `Field`), `src/car/build.ts:259` (`apply_build` folds every slot's `Mod` over the base) | lab overrides are `Mod`s, same semantics |
| Car swap | `src/car/driver.ts:63` and `:191` (`new Car(build_spec(build))`) | the single seam where a lab spec goes in |
| Build codes | `src/car/build.ts:222` (`CODE` regex built from `Object.keys(CARS)`) | a lab-only car id can never parse as a build code: free leak guard |
| Peer car | `src/net/heartbeat.ts:13` sends `build_code(garage build)` | the lab never writes the garage build |
| Metric maths | `scripts/feel.ts:48` (`slip_angle`), `scripts/telemetry.ts` (0-100, 100-0, skidpad g as `ang.y * v / g`, top speed), `scripts/drift.ts:37` (`drift`: held, spin, peak), `:201` (`catch_drift`), `scripts/grounds.ts:11` (`GROUNDS`: flat ground per grip row) | the recorder folds the same quantities live; `scripts/lab.ts` runs the same trials headless for a sim baseline |
| Drift thresholds | `src/modes/drift.ts:9-12` (`MIN_SPEED`, `MIN_ANGLE` 10°, `MAX_ANGLE` 60°, `SPIN_ANGLE` 100°) | "in a drift" and "spun" mean the same in the lab as in Drift mode |
| Pad nav | `src/menu/pad-menu.ts:123` `PadMenu` | lab overlay buttons are plain focusable buttons, so pad focus works the same way (unverified until built) |
| Svelte UI kit | `src/menu/ui/*.svelte` (`Segmented`, `Button`, `Card`, `TextField`, `Stepper`) | the lab overlay builds from these |

## 2. World

### 2.1 New kind vs a recipe on an existing kind

| Option | What it is | Cost / what breaks |
|---|---|---|
| A. Recipe/option on an existing kind (e.g. a mainland map option) | stations as a recipe value | Recipes drive seeded procedural generation: no way to lay a 30 m skidpad ring at a known spot. Every recipe value is part of that kind's `version`, so tuning a station would reset players' records on a real map. Rejected. |
| B. `?world=velodrome`/`sky` for banks, island for surfaces, no lab world | reuse what ships | No braking box, no skidpad per surface, no repeatable spots; stations move with the seed. The owner would be measuring different things each run. Rejected. |
| **C. New unlisted kind `lab` (recommended)** | `worldgen/kinds/lab.ts` + `worldgen/lab.ts` (hand-laid layout, pure data) + `worlds/lab.ts` (`listed: false`, `mini: false`) | One `WorldKind` value, one `KINDS` line, one `WORLDS` line, golden file for the kind. Its `version` keys nothing a player owns: the lab saves no records. |

The seed is ignored: `generate(seed)` returns the same lab for every seed, so a pack link needs no seed and every run of a pack drives the same ground.

### 2.2 Layout

Size `SIZE` (2048 m). `GroundBase` `flat` at a height above `SEA_LEVEL` (0, `src/worldgen/water.ts:35`) with `road_dist` far, so the bare ground reads as the own-ground row. Asphalt areas are `junction` outlines (they write `road_dist`, so they grip as road and stand off trees like a curb); every other surface is a `paint` op. Kickers are `Ramp`s (`RampKind` `kicker`/`big`/`landing`, `src/worldgen/types.ts:360`). Solids are cones and low barriers only, as `Solid` boxes.

| Station | Shape and size | Surfaces | What it answers |
|---|---|---|---|
| Hub | 120 m asphalt disc at the centre, spawn and station signposts | asphalt | where every trial starts and resets to |
| Skidpad row | one pad per surface, 90 x 90 m, a marked ring r = 30 m (cones every 15°), 4x4 grid with 20 m gaps | asphalt, shoulder, grass, dune sand, dirt, hardpack, scree, wet, snow, packed snow, ice, slush (12) | steady lateral g, understeer/oversteer balance, how the car breaks away per surface |
| Surface runway | 12 parallel lanes, 14 m wide x 500 m, one surface each, start line, 100 km/h mark and a braking box (5 m stripes) at the far end | same 12 | 0-100, 100-0 and wheelspin per surface, side by side |
| Transition grid | 400 x 400 m checkerboard, 50 m squares, surfaces mixed so every pair meets | all 12 | what a car does crossing sand onto asphalt, ice onto packed snow (the dune road and winter map case) |
| Top-speed oval | two 1.6 km straights on the long sides, joined by deck bowls at each end | asphalt, deck | top speed, high-speed stability, banked turn (bowls: 25° and 45° banks, r = 60 m, the velodrome's numbers in `worldgen/kinds/velodrome.ts:17`) |
| Braking box | on the oval's back straight: 100/150/200 km/h boards, 5 m stripes for 120 m | asphalt | 100-0 and 200-0 distances, stability under braking, ABS on/off |
| Slalom | three cone lines on asphalt (gaps 18, 24, 30 m), one 24 m line on dirt, one on packed snow | asphalt, dirt, packed snow | transient response, yaw lag, recovery between direction changes |
| Hairpins | a switchback ribbon: three 180° bends r = 12 m joined by 80 m straights, 12 m wide | asphalt (one copy on dirt) | rotation on entry, traction on exit, handbrake turns |
| Sweepers | constant-radius arcs r = 60, 120, 200 m, 120° each, 14 m wide | asphalt (one r = 120 on hardpack) | mid-corner balance at speed, lift-off oversteer |
| Drift circle + figure-eight | asphalt disc r = 45 m with a r = 20 m ring; beside it two tangent r = 20 m rings (figure-eight) on a 140 x 70 m pad; a packed-snow copy | asphalt, packed snow | drift entry, hold, angle and transitions |
| Kicker field | a run-up lane into small, big and table kickers, each with a flat landing and a downslope landing | asphalt, then dirt landings | air attitude, landing stability, bounce |
| Lava edge | a lava pool r = 30 m with a 10 m `LAVA` ring and a dirt track running 3-6 m off it | dirt, lava | how close a car holds a line by lava; the reset on touch |
| Ford | a water pool 60 x 30 m, 0.3-0.8 m deep, track through it | wade row | wading drag and grip |
| Hill | 10%, 20%, 30% ramps (long `Ramp` wedges, no lip) | asphalt, dirt | hill start, roll-back, low-gear traction (`scripts/feel.ts` slope cases) |

All stations sit inside a 1600 m square so the oval rings them. Signposts are props with text labels from the `worlds/lab.ts` dress (no new mesh kind).

### 2.3 Every surface in one world

The problem: `World` reads one `GripTable` per kind (`world.ts:246`), and the `GRASS` id means "this kind's own ground": grass on land (`grip 0.72, roll 12, loose 0.7`), loose sand on the dune sea (`0.7, 28, 1`). Ten `SurfaceId`s, but the game drives on at least thirteen distinct rows: road, shoulder, grass, dune sand, dirt, hardpack, scree, wet, snow, packed snow, ice, slush, lava, plus wade. A lab with `LAND_GRIP` has no dune sand; one with `SAND_GRIP` has no grass. The sand table's dirt and hardpack also differ a little from the land table's (0.84 vs 0.82, 0.92 vs 0.86); the lab shows the land rows and says so.

Decision D1 in section 9.

## 3. Packs

### 3.1 Where they live and how a link names one

`src/lab/packs/<id>.ts`, one default export per file, plus one line in the registry `src/lab/packs.ts`:

```ts
export const PACKS: Record<string, () => Promise<{ default: Pack }>> = {
  "t1-surfaces": () => import("./packs/t1-surfaces"),
  "t2-tsumuji": () => import("./packs/t2-tsumuji"),
};
```

Each pack is its own Vite chunk, so a new pack adds nothing to the main bundle. A typed TS object (not JSON) lets the compiler reject a wrong car id, a misspelled `Field` or a missing station; `bun test src/lab` loads every pack and resolves every trial, so a broken pack fails CI before it ships.

`?lab=<id>` in the URL. Decision D2 in section 9 covers how it stays hidden and whether a link can also carry a pack inline.

### 3.2 Shape

```ts
export interface Pack {
  id: string;
  /** Bumped by the lead on every edit: the export carries it, so two pastes of different revs never get diffed as one. */
  rev: number;
  title: string;
  /** One line shown on the lab's first card: what this round is about. */
  brief: string;
  cars?: Record<string, LabCar>;
  trials: Trial[];
  /** Scales asked after every trial unless a trial names its own. */
  ask: Question[];
}

export interface Trial {
  id: string;
  /** A build code for a shipped car, or `lab:<key>` of this pack's `cars`. */
  car: string;
  /** Applied after the build's parts, same fold as a part (`build.ts:22`). */
  mods?: Mod[];
  /** Aids and steer settings for the trial only; the player's own come back after. */
  aids?: Partial<Pick<SettingsState, "tcs" | "abs" | "assist" | "stability" | "auto" | "steer_mode">>;
  station: StationId;
  /** Which skidpad / runway lane / slalom line; a station's default when absent. */
  lane?: SurfaceName;
  goal: Goal;
  /** What to try and what to feel for, as on the `?feel` panel. */
  try: string;
  feel: string;
  ask?: Question[];
}

export type Goal =
  | { kind: "laps"; laps: number }
  | { kind: "time"; seconds: number }
  | { kind: "stop"; from_kmh: number }
  | { kind: "free" };

export type Question =
  | { kind: "scale"; id: string; label: string; low: string; high: string }
  | { kind: "pick"; id: string; label: string; options: string[] }
  | { kind: "text"; id: string; label: string };
```

`StationId` and `SurfaceName` are const objects in `src/lab/stations.ts`, next to the station positions the worldgen side exports from `worldgen/lab.ts`. One source: the trial's station resolves to a spawn pose, a gate line and a lap ring read from the same data the world was laid from.

Example trial, the shape a lead writes:

```ts
{ id: "kaze-ice-pad", car: "kaze.3.0.2.1.0", mods: [{ scale: { rear_grip: 0.95 } }], station: "skidpad", lane: "ice",
  goal: { kind: "laps", laps: 3 }, try: "hold the ring at the edge of grip", feel: "slides early but never snaps" }
```

### 3.3 Overrides only inside the lab

Decision D3 in section 9. Whatever the option, the invariants:

- `car.ts`, `axles.ts`, `rigid-body.ts` untouched. The lab makes a `CarSpec` and hands it to `Driver`; physics cannot tell a lab spec from a garage one.
- The garage build, saved builds and prefs are never written. On a trial the lab swaps the car through `Driver.swap`; on leaving the lab (reload without `?lab`) the garage car is what it was.
- No mode runs, so no `ModeDef`, no `Track`, no records, no stars, no season stars, no ghost saved.

### 3.4 Unreleased cars and parts (owner addendum)

A pack's `cars` map holds lab-only cars:

```ts
export interface LabCar {
  name: string;
  /** Full spec literal, typed as `CarSpec`: the same object that will later be pasted into `cars.ts`. */
  spec: CarSpec;
  /** A shipped body drawn in its place until the car's own design lands; its `body` dims still come from `spec`. */
  look: BodyStyle;
  /** Paint, decal and parts used for the drawn car and as the base the trial's `mods` stack on. */
  parts?: Partial<Record<Slot, number>>;
}
```

Shared lab cars (Tsumuji, Sajin) live in `src/lab/cars/<name>.ts` and packs import them, so two packs never fork the same prototype.

Why a placeholder body: `CarId` is `BodyStyle` (`src/car/cars.ts:104`) and every design table is `Record<BodyStyle, …>`, so a new design cannot exist without becoming a garage car. The lab draws the closest shipped body (Tsumuji on `kaze` or `coupe`, Sajin on `raijin`) with the spec's own size. When the design is ready it ships together with the car at promotion, not before.

Why it cannot leak:

| Path | Guard |
|---|---|
| Garage, car picker, presets | read `CARS` / `PRESETS`; the lab car is in neither |
| Build codes, saved builds, shared links | `CODE` is built from `Object.keys(CARS)` (`build.ts:222`): `lab:tsumuji…` never parses; the lab never calls `garage.use_code` |
| Peers | the lab runs in the solo room (`main.ts:88`); the heartbeat sends the garage build (`heartbeat.ts:13`), which the lab never changes |
| Records, ghosts, stars | no mode runs |
| Lobby car id | `lobby.car` reads `driver.car.spec.id` (`main.ts:281`): no lobby in a solo room; lab spec ids carry the `lab:` prefix anyway |
| Accidental collision | `src/lab/cars.test.ts` asserts no lab car id equals a `CARS` key and every lab spec passes `axles_of` |

New parts are just `mods` on a trial: a `Mod` is exactly what a `Part` carries (`build.ts:45`). A new slot is a named group of mods in the pack (`variants: { "long-travel": Mod, … }`), crossed with cars by listing trials.

What the lab cannot prototype: anything `CarSpec` has no field for. Sajin's per-axle tyres (front and rear tyre radius, per-axle loose-ground grip) need new optional `CarSpec` fields read in `car.ts`, absent meaning today's behaviour, landed in the car folder with the bit-exact proof (`car.test.ts`, `telemetry.ts` and `feel.ts` byte-identical). That is a car-physics task, done before the pack that tests it; the lab then exercises it like any field. Long travel and sand grip are already fields (`wheel.rest`, `strut_max`, `spring`, `damper`, `bump`, `grip_grass`, `offroad`, `roll_resist`).

### 3.5 Promoting a winner

| Thing | Promotion | Proof |
|---|---|---|
| Spec tweak on a shipped car | Fold the trial's `mods` into the car's literal in `cars.ts` (the lab export prints the resolved values per changed field, so it is a copy) | `car.test.ts`; `scripts/telemetry.ts`, `feel.ts`, `drift.ts` numbers move as expected; `bun scripts/races.ts --changed` if route times move; release notes |
| New part | Append the `Mod` as a new `Part` at the end of its slot in `SLOTS` (append-only: codes are digit-per-slot, `build.ts:222`, so a slot holds 10 parts at most) | `build.test.ts`, `pi.test.ts`; garage card |
| New slot | Append to `SLOTS` last (the comment above `SLOTS` says so) | as above |
| New car | Copy the `LabCar.spec` into `cars.ts` as `TSUMUJI`, add `"tsumuji"` to `BodyStyle`, add it to `CARS`; the compiler then lists every `Record<BodyStyle, …>` missing it (design, model, sound…). Delete the lab car file and point packs at the real id | `presets.test.ts`, `pi.test.ts`, `models.test.ts`, the car's design review shots |

A `scripts/lab.ts <pack> --promote <trial>` printer (phase 6) writes the resolved spec as a TS literal, with the base car's values beside it, so the copy is mechanical.

## 4. Metrics

### 4.1 Captured per trial

A `Recorder` (`src/lab/recorder.ts`, pure: no DOM, no THREE beyond the car's own vectors) takes the car each physics step (360 Hz) and folds running values into preallocated fields: no allocation per step. Station geometry decides which segments count (gate lines and rings come from `worldgen/lab.ts`).

| Metric | How | Same maths as |
|---|---|---|
| lap / segment times, ms | gate line crossings | race gates |
| lateral g, peak and mean in the ring | `|ang.y * |vel|| / g` while on the ring and above 20 km/h | `scripts/telemetry.ts` skidpad |
| ring speed, mean km/h | `forward_speed * 3.6` on the ring | telemetry |
| body slip (drift angle), peak, mean while > `MIN_ANGLE` | `atan2(-local.x, local.z)` of velocity in the body frame | `scripts/feel.ts:48`, `modes/drift.ts` |
| drift held, s and longest chain | time with slip between `MIN_ANGLE` and `MAX_ANGLE` above `MIN_SPEED` | `modes/drift.ts:9-12` |
| spins | slip past `SPIN_ANGLE` | `modes/drift.ts:12` |
| yaw response, ms | slalom: time from a steer input reversal to yaw rate crossing 90% of its next peak | `scripts/feel.ts` t90 |
| recovery, ms | from slip > 15° to slip < 5° and yaw rate < 0.05 rad/s | `scripts/feel.ts` handbrake flick, `scripts/drift.ts:201` `catch_drift` |
| 0-100, s; 100-0 and 200-0, m | runway and braking box: time from first throttle to 100; distance from brake press at the board to < 0.5 km/h | `scripts/telemetry.ts` |
| top speed, km/h | max `forward_speed` on the oval | telemetry |
| wheelspin, share of time and peak | driven wheel `omega * radius` over ground speed, > 1.15 counts | `scripts/surfaces.ts` launch rows |
| air time, landing upright, bounce | wheels-off duration; `upright` at the first contact; second airborne within 0.5 s | `scripts/feel.ts` `upright` |
| offs | wheels outside the station's lane or ring for > 0.5 s | new |
| resets, lava touches | the driver's reset count; `World` lava test | new |
| inputs | share of time at full lock, full throttle, handbrake; steer reversals per second | new: tells "car is twitchy" apart from "driver was sawing at it" |

Numbers keep 2-3 significant digits in the export; the recorder keeps full precision.

### 4.2 Sim baseline

`scripts/lab.ts <pack>` runs each trial's resolved spec through the headless scenario that matches its station (skidpad g on that surface, 0-100 and 100-0, `drift`, `catch_drift`) using `scripts/grounds.ts` flat grounds. The same numbers ride in the export header for the trial as `sim:`, so the lead sees "the owner held 0.71 g where the sim car holds 0.84": the gap is the driver, the camera or the inputs, not the tyre curve. It also gives `--check`: every pack resolves and no trial throws NaN before it ships. Moving the scenario functions out of the scripts into a shared module is a separate `refactor:` commit with byte-identical output.

## 5. Opinion form

After each trial's goal (or Stop), the results card shows the numbers and the questions.

| Question | Kind | Default for every trial |
|---|---|---|
| Grip | 1-5, "slides everywhere" - "glued" | yes |
| Predictability | 1-5, "snaps without warning" - "always telegraphs" | yes |
| Fun | 1-5 | yes |
| Drift ease | 1-5, "won't slide / won't hold" - "easy to start and hold" | on drift, skidpad, hairpin stations |
| Landing | 1-5, "bounces or flips" - "plants" | on the kicker field |
| vs last trial | pick: worse / same / better | when the trial before it was on the same station |
| Note | text, one line | yes |

Phone and pad:

- A 1-5 scale is a `Segmented` row of five buttons, sized to the theme's touch target, no slider: a slider is fiddly with a thumb and impossible to set exactly with a pad.
- Pad: D-pad up/down moves between questions, left/right through 1-5, A confirms, X skips the note, Start goes to the next trial. Every control is a focusable button so `PadMenu` focus rules apply (to confirm when built).
- The note is optional and short; a phone keyboard opens only when tapped.
- The card covers the scene; the sim is held while it is open, as under the menu.
- Answers save to `sessionStorage` per pack and rev on every change, so a reload or a crash mid-pack keeps them (persisted data is untrusted: validated on load, dropped on mismatch).

## 6. Export block

One Copy button (`navigator.clipboard.writeText`, with a select-all textarea fallback when the clipboard refuses). Line-based text, not JSON: diffs line by line, survives chat apps, readable without tooling.

```
#lab t1-surfaces r3 v0.41.1 2026-11-14T20:12Z touch 390x844
#trial kaze-ice-pad kaze.3.0.2.1.0 +rear_grip*0.95 spec#3fa1c09e skidpad/ice laps3 done
 m lap=21.8,22.4,22.1 latg=0.31/0.27 ring=38 slip=19/11 held=14.2 spins=0 offs=1 resets=0 lock=0.22 thr=0.81 hb=0.04
 sim latg=0.33 0-100=- 100-0=-
 a grip=2 pred=4 fun=4 drift=4 vs=better
 n "slides early, catches fine, a bit slow to rotate back"
#trial muscle-drift8 muscle.1.5.0.3.1.0.7.0.0.0.2 spec#90b2e411 eight/asphalt time60 stopped
 ...
#end 3/7 trials
```

| Field | Why |
|---|---|
| pack id + `r<rev>` | the lead diffs only like against like |
| `v<version>` | `package.json` version, already stamped as `__HAREPIN_VERSION__` |
| `spec#` | 8-hex hash (`seed_of` from `src/rng.ts`) of the resolved `CarSpec` JSON: proves exactly which physics ran, even across deploys with the same version |
| device + input | touch / keys / pad, viewport: a twitchy rating on touch reads differently from one on a pad |
| trial line | id, build code or `lab:<car>`, mods in short form, station/lane, goal, done / stopped / skipped |
| `m` | metrics, fixed key order per station |
| `sim` | headless baseline (section 4.2) |
| `a` / `n` | answers, note quoted |

A short legend sits in `docs/plan/feel-lab.md` once built (keys and units), so a paste is self-explaining to any agent.

## 7. In-game flow

```
?lab=<id> -> boot: lab world, solo room, lab chunk -> Pack card -> Trial list
Trial list -> pick or Next -> car swap + reset to station spawn -> HUD strip (trial, goal, live key numbers)
Goal met or Stop -> Results card (numbers + questions) -> Retry | Next | List
List -> Copy (any time, holds whatever is done)
```

| Screen | Content | Controls |
|---|---|---|
| Pack card | title, brief, rev, trial count, "nothing here is saved to your records" | Start, Copy (when answers exist) |
| Trial list | rows: trial id, car name, station, goal, status (new / done / stopped) | tap or A to start; Copy; Leave lab |
| HUD strip | top of screen, one line: trial, goal progress (lap 2/3, 41 s left), one or two live numbers (lat g, slip); the rest of the HUD as normal | Stop (also the pad's Back), Retry (also Reset) |
| Results card | the trial's `m` line laid out as a small table, then the questions | Retry, Next, List |

Hidden from the game around it: the Play menu's world and mode pickers, career markers, goals toasts and the update card's reload are off while the lab runs (one `lab_active` check each, wired in `main.ts`; the update card already has a busy callback). No records, stars, season stars, ghosts, online.

## 8. Build phases

| Phase | What | Files (new unless noted) | Size |
|---|---|---|---|
| 0 | Spikes: a deck bowl over terrain ground renders and drives (physics already takes `max`, `world.ts:333`; terrain mesh plus deck layers in one scene is unverified); a `junction` outline renders as asphalt away from any road edge | scratch only | 0.5 day |
| 1 | `lab` kind: layout data, generator on the flat base, `WorldDef`, golden file; surface rows per D1 | `worldgen/lab.ts` (~350), `worldgen/kinds/lab.ts` (~30), `worlds/lab.ts` (~80), `types.ts` +1 value, `kinds.ts` +1 line, `worlds.ts` +1 line, `scripts/golden/lab.txt` | 1.5 days |
| 2 | Boot: `?lab` param per D2, solo room, lazy `lab/lab.ts`, pack registry, resolve trial to `CarSpec` per D3, `Driver.swap` takes an optional spec | `lab/lab.ts` (~200), `lab/pack.ts` (~150), `lab/packs.ts`, `lab/stations.ts` (~100), `world-pick.ts` +2 lines, `main.ts` ~6 lines, `driver.ts` 1 default param | 1 day |
| 3 | Recorder and metrics, headless-tested against the scripts' numbers on the same spec | `lab/recorder.ts` (~300), `lab/recorder.test.ts` | 1 day |
| 4 | UI: pack card, list, HUD strip, results + opinion card, export + Copy | `lab/LabOverlay.svelte`, `lab/TrialList.svelte`, `lab/ResultCard.svelte`, `lab/Scale.svelte` (~400 total), `lab/export.ts` (~120) + test | 1.5 days |
| 5 | First packs: `t1-surfaces` (one shipped car on every skidpad and runway lane), `t2-drift` (drift circle, eight, slalom with the Drift preset and two mods); lab cars `cars/tsumuji.ts` on a placeholder body | `lab/packs/*.ts`, `lab/cars/*.ts`, `lab/cars.test.ts` | 0.5 day |
| 6 | `scripts/lab.ts`: `--check`, sim baselines, `--promote <trial>` printer; scenario maths moved into a shared module (own `refactor:` commit, byte-identical) | `scripts/lab.ts` (~250), shared module under `scripts/` | 1 day |

Done when (quest): the owner opens a pack link on the live site, drives 3+ trials, presses Copy, pastes, and the lead reads every metric and answer from it. That is phases 1-5; phase 6 makes the loop faster and promotion mechanical.

Proof per phase, as AGENTS.md's table asks: phase 1 `golden.ts --check` (existing kinds unchanged) plus the new golden file; D1 option B also needs every existing kind golden-identical; phase 2 `driver` change `car.test.ts` bit-exact (nothing in physics moves); phase 3-4 `bun run test src/lab`, `check:svelte`; visual phases 4 shots at phone and desktop.

## 9. Owner decisions

### D1. Every surface in one world (dune sand next to grass)

| Option | What | Cost / what breaks |
|---|---|---|
| A. Lab uses `LAND_GRIP`; sand and winter roads are skipped | lightest | no dune sand, no winter road row: fails the addendum |
| B. Per-pack table: the lab kind gets a map option `table` (land / sand / winter); `World` asks `KINDS[kind].grip_of?.(levels)` before `grip` | one optional `KindSpec` hook, one line at `world.ts:246` | grass and dune sand never in the same world; switching table rebuilds the world (a reload between trial groups); covers the sand table's own dirt/hardpack rows exactly |
| **C. Append `SurfaceId.SAND = 10` (recommended)** | a laid "loose sand" surface with its row in every `GripTable` (`SAND_GRIP`'s own-ground values), `SURFACE_GROUND` gets `Ground.DUNE` | touches `types.ts` and `kind-def.ts`; no existing kind lays it, so generation output is identical (`golden.ts --check` proves it, no version bump). One world, every surface side by side, transitions sand to asphalt drivable. Later a kind can lay real sand patches (the desert's dune fields) with it. The sand table's dirt/hardpack variants are not shown (2-6% apart) |

Recommendation: C. It is a data change in the existing pattern (append-only id, row per table), it is the only option that gives the transition grid, and it costs no reloads mid-pack.

### D2. URL param and hiding

| Option | What | Cost / what breaks |
|---|---|---|
| A. `?world=lab` plus `?pack=<id>`, no special boot | lightest: unlisted kinds already load from `?world=` | not solo (a lab run would sit in the open lobby with peers seeing a lab car), no lazy-loaded lab UI unless `pack` is checked anyway; two params to type |
| **B. `?lab=<id>` (recommended)** | joins `URL_WORLD_PARAMS` (`world-pick.ts:30`) and returns `kind: lab`; joins `solo` (`main.ts:88`); `main.ts` lazy-imports `lab/lab.ts` like `?feel` (`main.ts:612`) | three small wiring edits. Ships in prod, hidden by obscurity like `?tune`: no menu entry, unlisted kind, solo room, its own chunk (the main bundle grows only by the kind def and the layout data the worker needs) |
| C. B plus inline packs: `?lab=~<base64url>` carries the pack itself | a pack testable without a deploy | the URL grows (a 7-trial pack is ~1-2 KB encoded, fine in a link); needs a runtime validator for the inline pack, since it is untrusted like any URL data; the committed file is still the source the lead diffs |

Recommendation: B now; C only if a deploy per pack turns out to slow the loop (it is additive: same `Pack` type, one more decoder).

Not recommended: gating on `REVIEW_BUILD` (`review/params.ts:3`): it drops from the production build, and the owner tests on the live site.

### D3. Override mechanism

| Option | What | Cost / what breaks |
|---|---|---|
| A. Build codes only | a trial is a build code; no spec edits | zero new code, but tests only what already ships: no grip tweak, no prototype car. Fails the brief |
| **B. `Mod`s on the build, plus full-spec lab cars (recommended)** | `spec = apply_mods(apply_build(base, build), trial.mods)`; `apply_build`'s fold is split out as `apply_mods(spec, mods)` in `build.ts` (same output, `build.test.ts` + `car.test.ts` prove it); lab cars give a whole `CarSpec`; `Driver.swap(build, timed, spec = build_spec(build))` | one function split in `build.ts`, one default param in `driver.ts`. Same scale-then-add semantics and `LIMITS` clamps as parts, so a winning mod is a part already |
| C. Deep partial `CarSpec` patch per trial (`{ wheel: { rest: 0.4 } }`) | free-form | a second override language beside `Mod`; deep merges of `mounts`/`torque` arrays are error-prone; a winner does not map onto a part. Only the lab-car case needs whole specs, and B covers it |
| D. Live sliders in the lab (feel panel style) | owner tunes himself | the owner's answer becomes a number he found, not a rating of the lead's options; numbers drift between trials. Could come later as a "free tune" trial goal on top of B |

Recommendation: B.

### Rejected outright

- A new state layer or store for the lab: the overlay holds its own `$state`; the pack and progress are one object owned by `lab/lab.ts`.
- Recording to `localStorage` or a server: there is no server, and the paste is the record.

## 10. Risks

- Deck over terrain (oval bowls) is unproven in rendering (phase 0). Fallback: the oval ends are flat asphalt hairpins and banked turns stay on `?world=velodrome`, named in the pack.
- The recorder's per-step work must not allocate (AGENTS.md performance rule): fixed fields, no arrays grown per step; lap lists capped.
- Owner inputs differ by device: touch drag steer vs keys vs pad. The export logs the device and input shares so ratings are read in that light.
- Goals and first-steps toasts read driving events; if a check is missed, a lab drive could tick a goal. Low harm, covered by the `lab_active` gate.
- Kickers sized for a stock car may be wrong for a buggy on long travel. Station sizes are data in `worldgen/lab.ts`, and the lab kind's records are keyed to nothing, so bumping `LAB_VERSION` is free.
