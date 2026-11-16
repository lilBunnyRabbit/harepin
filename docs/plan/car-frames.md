# Car frames and bodies

Quest: `car-roster-frames-bodies-gpt` (owner decided 2026-11-16). A car splits into a calibrated **frame** (everything the sim, the AI and the collider read) and cosmetic **bodies** on a frame (everything the eye and ear read). First merge: Kaze becomes a body on the Coupe frame; the Coupe's physics stay, Kaze's own tuning is dropped.

No real players yet: saves, records, ghosts and old peers get no migration. Loads keep validating and fall back to defaults; `PROTOCOL` bumps.

## What is frame, what is body

Split by who reads the field today:

| Frame (`FrameSpec`) | Body (`BodySpec`) |
|---|---|
| mass, inertia, drive, awd_split, wheel (radius, rest, mounts), wheelbase, lock, springs, dampers, bars, tyres (mu, rear_grip, load_fade, peak_*), engine (idle, launch, redline, shifts, gears, final, torque, inertia), brakes, assists, drag, downforce, aero_front, ground_effect, offroad, air_settle, band, circles, radius, corners, hull, nitro, grip_dirt/grass, drift_* / tcs_*, `ai`, `ai_field` | `id`, `name`, `frame`, `size` (today's `body.length/width/height`), `sound` (`EngineSound`), and by registry key: design (`DESIGNS`), kit, wings, fronts, lamps, tuner details (`DETAILS`) |

Checked: `car.ts`, `rigid-body.ts`, `axles.ts`, `tyre.ts`, `steering.ts`, `capability.ts` read no body field (`spec.id` only in error text). Body fields are read by `models.ts` (`DESIGNS[spec.body.style]`, `DETAILS[...]`, `stock_of` by id), `driver.ts` (lamp mount at `body.length / 2`), `modes/mode.ts:226` (footprint length/width), `cars.ts` `oversize` / `car_sized`, audio via `main.ts` (`spec.sound`), and names in menus and lab.

The engine voice moves to the body; the limiter still cuts at the frame's `redline`. A body's `size` must keep the frame's `car_sized` answer (jump lines and bays are planned on it): a test checks that.

## Where `CarSpec` is read today

About 140 files: `car/` 29, `career/` 13, `menu/` 16, `lab/` 12, `viewer/` 7, `ai/` 5, `modes/` 5, `sim/` 3, `world/` 3, `worldgen/` 2, `net/`, `audio/`, `review/`, plus 40 scripts. The ways in:

- `CARS[id]` / `car_spec(id)` / `build_spec(build)` → a `CarSpec` that `Car`, `Driver`, the sim host, the AI field and the viewer take whole.
- `Build.car: CarId` (= `BodyStyle`): build codes (`kaze.12.3.2.3.1`), saved builds, presets, wallet-owned cars, career/series rewards, `excludes` / `only` limits, field picks, peers' `b` code.
- `Record<BodyStyle, …>` registries: `DESIGNS`, `DETAILS`, showcase tiers, viewer presets.
- `spec_hash(spec)`: AI capability table keys (`ai/capability-table.ts`), lab results, `scripts/lab/handling-golden.ts` lines.
- Lab packs already split the two: `LabCar { name, spec, look: BodyStyle }`.

## Options

### A. Split the source, keep the resolved `CarSpec` (recommended)

The data in `cars.ts` splits; everything downstream keeps reading a `CarSpec` built from frame + body.

```ts
export type FrameId = "hatch" | "coupe" | "muscle" | "rally" | "formula" | "fujin" | "sturm" | "raijin" | "bus" | "tsumuji" | "sajin";
export type BodyId = FrameId | "kaze";
export type CarId = BodyId;

export interface FrameSpec { mass: number; inertia: Triple; drive: Drive; /* … every physics, collider and AI field above */ }
export interface BodySpec { id: BodyId; name: string; frame: FrameId; size: Size; sound: EngineSound }
export interface CarSpec extends FrameSpec { id: string; name: string; body: { length: number; width: number; height: number; style: BodyStyle }; sound: EngineSound }

export const FRAMES: Record<FrameId, FrameSpec> = { coupe: COUPE_FRAME, … };
export const BODIES: Record<BodyId, BodySpec> = { coupe: { id: "coupe", name: "Coupe", frame: "coupe", … }, kaze: { id: "kaze", name: "Kaze", frame: "coupe", … }, … };
export const CARS: Record<CarId, CarSpec> = map_values(BODIES, (body) => car_of(FRAMES[body.frame], body));
```

- A frame id is its reference body's id, so no frame renames today. The F1-F10 names stay design vocabulary until a second body lands on another frame.
- `Build` keeps `car: BodyId`; the frame comes from `BODIES[car].frame`. Build codes, presets, wallet and rewards keep their format.
- Parts fold over the frame's numbers as today (`apply_build`), so every body on a frame gets the same mods.
- `spec_hash` hashes the frame fields only (sorted keys, no `ai`), so Coupe and Kaze builds share one capability entry and a body never needs an AI refit. Every hash string changes once; the table's values must not.
- Adding a body = a `BodySpec` line + a design (`Record<BodyId, Design>` makes a missing one a type error). Adding a frame = a `FrameSpec` + at least one body.
- Edits outside `car/`: none to consumers. The kaze-specific expectations move: `car.test.ts` (kaze rows), `pi.test.ts`, `assists.test.ts`, lab `t3d-kaze` and `top-tier` (`Tested` keeps kaze as a body: retarget to coupe or retire, owner/lab call), `scripts/drift.ts` / `scripts/pi.ts` / `scripts/lab/setups.ts` lists (both ids stay valid; kaze rows duplicate coupe's), AGENTS.md "Adding things: Car".

Cost: `CarSpec` still mixes the two at runtime, so a consumer can read a body field where it means a frame one. A test pins the split: every key of `CarSpec` is either a `FrameSpec` key or a named body key.

### B. Pass frame and body separately through the game

`Car` takes a `FrameSpec`, views take a `BodySpec`, `Build` gains `frame` beside `body`, `CarSpec` goes away.

- Type-safe split: physics cannot see a name or a mesh.
- Touches about 140 files and every lab pack's `spec`, in one pass with physics identity on the line. Build codes gain a frame field nobody needs while a body has exactly one frame.
- Reachable later from A without redoing the data: A already holds `FRAMES` and `BODIES`.

**Recommendation: A.** It delivers the decided split, makes the merge a one-line `frame: "coupe"`, and keeps the identity proof small. B pays off only if a body ever moves between frames or the runtime mixing causes a real bug.

## Kaze on the Coupe frame

What changes for the Kaze: physics, gearing, collider and AI become the Coupe's. It keeps name, design, kit, details and engine voice.

- Wheels: arches are cut from the frame's mounts (`Design.outline` doc). Kaze mounts were z 1.245 / -1.405, r 0.35; the Coupe's are ±1.3, r 0.34. The Kaze shell's arches move forward, 0.055 m at the front and 0.105 m at the rear; its tail and nose overhangs need a look, maybe an outline nudge in `kaze-design.ts`.
- Collider: the Coupe's corners reach ±2.25 m, the Kaze shell -2.17..2.0, so hits land up to 0.25 m ahead of the nose and 0.08 m behind the tail before the paint touches. Accept, or shorten the Coupe frame's corners (changes Coupe physics: out of scope).
- Kaze records, ghosts, lab results and its capability entry are dropped. Its `CarAi` was the Coupe's already (no own `ai`).

## Net

Peers send the build code (`b`), whose car id is a body id: format unchanged, `parse_build` still refuses unknown ids. Bump `PROTOCOL` once: an old peer would drive a Kaze on the old physics against the new one.

## Saves

No migration. Every load path already validates: `parse_build` returns null on a bad code and callers fall back to `DEFAULT_BUILD`; `wallet.ts` filters owned cars with `is_car`; `view-state.ts`, `release-story.ts`, `pack-code.ts` check ids. `kaze` stays a valid id, so saved Kaze builds load and now drive on the Coupe frame. Nothing new to validate.

## Proof of identical output

Captured before the first code edit, compared after:

1. `car.test.ts`: every test that does not name kaze passes unchanged. Kaze rows are rewritten to the Coupe's numbers, never to new ones.
2. `scripts/telemetry.ts <id>` and `scripts/feel.ts <id>` for every frame id: byte-identical (`cmp`). For kaze: after = Coupe's output, byte for byte.
3. `scripts/ai-capability.ts` regenerates `ai/capability-table.ts`: every value identical with hash keys stripped; the kaze row is gone (it shares the Coupe's key).
4. `scripts/lab/handling-golden.ts` → `scripts/golden/handling.txt`: identical with the `spec#` column stripped, except kaze lines, which equal the Coupe's.
5. `bun scripts/golden.ts --check`: untouched (worldgen reads no car spec; `gap.ts` / `sky.ts` only name the kaze in comments, which get reworded).
6. `bun scripts/races.ts`: moves only where a field carries a Kaze; rebaseline with that diff in the commit.
7. Visual: Kaze at desktop width on the Coupe frame, arches and overhangs (garage stand + one in-world shot).

## Build order (after the owner's OK)

1. `refactor:` split `cars.ts` into `FRAMES` + `BODIES` with Kaze still its own frame; `spec_hash` over frame fields. Proof 1-5 all identical (hash keys aside).
2. `feat:` Kaze onto the Coupe frame: delete the Kaze frame, rewrite kaze expectations, regenerate tables, `PROTOCOL` bump, design nudge if the shots ask for it. Proof 2-4 for kaze = coupe, 6, 7.
