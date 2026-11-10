# FH5 handling vs Harepin

Owner ask: "Forza Horizon 5 handles keyboard+mouse really well, find out how." Scope then widened to every part of FH5 car handling that could help us. This doc covers keyboard steering in depth first, then the rest, and ends with a ranked top 10.

Research date 2026-11-11. Repo state: `main` working tree, car physics as of `b930d2e`.

## Read this first: what is actually known about FH5

Playground has never published how its steering or tyres work. No GDC talk on Horizon physics turned up (the only GDC vehicle talk found is Just Cause 4's). Most of the official support pages (support.forza.net) answer 403 to fetches, and the old forums.forza.net threads now 301 to a landing page. So the evidence is in three tiers. Every FH5 cell below is tagged with one:

| Tag | Meaning |
|---|---|
| **[off]** | Official Forza / Playground text (quoted through search snippets where the page itself refused the fetch) |
| **[comm]** | A community guide or forum post, named in Sources. Anecdotal. |
| **[spec]** | Our inference or general player knowledge with no checked source. Treat it as a hypothesis to measure. |

Mods that copy the "Forza feel" in other games are useful here, because their authors had to write it down: BeamNG Advanced Steering, AC Advanced Gamepad Assist, and LoSboccacc's "Forza steering" for BeamNG.

---

## Part 1: keyboard steering

### 1.1 What the genre does

| Behaviour | FH5 / Forza | Other games and mods | Tag |
|---|---|---|---|
| Assist levels | FH5 "Steering": Auto-steer / Assisted / Standard / Simulation. Forza support says Normal (Standard) steering is "multiple systems layered together"; Simulation "turns these systems off" | — | [off] FH4 wheel guide, difficulty-assists article |
| Filter on keys and pad | One player reports an input filter in Standard that stays partly on in Simulation, for pad and keyboard alike. "Simulation steering removes the centering filters, making keyboard inputs violently twitchy; Standard … smoothens out rapid key taps" | BeamNG: per-binding filter (Automatic / Direct / Keyboard grip / Keyboard drift); Automatic sets the rate per vehicle type | [comm] |
| Speed-limited lock | "Above 30 mph I can't use more than 30% of the wheel's turning radius." A reply calls it "normal speed sensitivity plus friction checking; every Forza has it" | AC: "speed sensitivity" slider. BeamNG: "Slower steering at high speed" and "Limit steering at high speed", the newer one keeping full countersteer range by slide angle | [comm] |
| Lock that follows tyre peak | FM7: Normal steering "influences the yaw inertia of the car" | BeamNG Advanced Steering and AC Advanced Gamepad Assist cap steer at the front tyres' optimal slip angle. LoSboccacc's mod "reduces steering as the car nears the grip limit" and maps 0-100% input onto the tolerable range | [off] FM7 / [comm] mods |
| Countersteer | "In Horizon, counter steering is highly automated" | Advanced Steering: caster-like "self-steer" toward the direction of travel, plus an "input authority" that sets how much the player can overrule it (Key-smooth filter = 70%). LoSboccacc: "countersteer fully when oversteering" | [comm] |
| Ramp rates | Not published | AC keyboard menu: Steering speed, **Opposite-lock speed** (a separate, much faster rate), Return rate. A guide's values: 0.80 / 7.50 / 1.50, so reversal is about 9× the attack. Units unpublished | [comm] |
| Taps | Not published. Consensus is "taps nudge, they don't flick" | AC filter %, BeamNG smoothing | [comm] |
| Throttle / brake keys | Not published. Keys are binary; TCS / STM / ABS do the work | Dedoimedo: the BeamNG filter can also ramp throttle and brake | [spec] / [comm] |
| Mouse steering | **None native.** There is a standing forum request for "native mouse steering support / option to bind mouse axis as analog steering". Mouse = menus and camera | BeamNG: mouse steering with a linearity curve. AC: through scripts | [comm] |
| Deadzones and linearity | Pad: inside / outside deadzone and linearity per axis. Outside deadzone also sets the steering ratio | — | [off] FH5 wheel setup / [comm] |

**Why FH5 keys feel good, as a model.** This combines the sources above and is [spec] until measured:

1. The key is a virtual stick with a short attack, a slower release, and a very fast reversal.
2. Whatever that stick asks for is a share of the grip-limited lock, not of the full mechanical lock. Full key = "corner at the limit", so the player cannot over-ask at speed.
3. Countersteer and the self-centring toward the direction of travel are automatic. The player never has to catch a slide with a binary key.
4. TCS and STM catch the rest.

Taps stay small for three reasons: the attack ramp, a lock window of a few degrees at speed, and yaw damping.

### 1.2 Ours today, exactly

Inputs: keys give `steer ∈ {-1, 0, 1}`, or ±0.5 with the precision key (`src/hud/input.ts:262-264`, `PRECISION_STEER = 0.5` at :9). The precision key only works when the setting is on (`input.ts:255`, `main.ts:272`). Throttle, brake and handbrake are binary (`input.ts:265-267`). A pad stick only counts when no steer key is held. Pad stick: 0.08 deadzone, then exponent 1.4 (`input.ts:291-293`). Mouse is camera only (`MouseLook`, `input.ts:47`).

Shipped defaults: SMOOTH steering, assist on, TCS / ABS / auto box on, precision off (`src/car/fresh-drive.test.ts:43`). **The `Car` class itself defaults to SNAP (`src/car/car.ts:228`), and `scripts/feel.ts` never sets the mode, so feel.ts measures Classic, not what players drive.**

Notation: `v` = speed in m/s, `ramp(v) = min(1, v/30)` (30 m/s = 108 km/h).

| Mode | Attack | Release | Reversal | Ref |
|---|---|---|---|---|
| SNAP "Classic" | Linear, 0→1 in `0.03 + 0.2·ramp(v)` s (0.23 s at ≥108 km/h) | Linear, `KEY_RETURN` = 2.5× faster | 2.5× faster | car.ts:378-383, consts :52-56 |
| SMOOTH (default) | Jumps to `SMOOTH_TAP` = 0.15 at once, then grows exponentially with τ = `0.03 + 0.21·ramp(v)` s. Tap to full = 1.9 τ ≈ 0.46 s at speed | Exponential τ `SMOOTH_RELEASE` = 0.12 s plus 1/s linear. Same at every speed | Unwinds at the release rate down to 0, then restarts from the 0.15 tap share | car.ts:366-377, consts :58-63 |
| HOLD | Linear, 1/0.4 s, 2.5× when reversing | Centres by distance rolled: full in 14 m (`HOLD_CENTRE_DISTANCE`) | 2.5× | car.ts:357-365, :57, :65 |
| Analog (pad / touch drag) | Passes straight through | — | — | car.ts:356 |

After `key_steer`, every mode shares the same path:

| Stage | Assist on | Assist off | Ref |
|---|---|---|---|
| Lock | `grip_lock = L·g·1.05/v² + 0.45·peak_angle`. Kinematic lock for a 1.05 g corner plus a slip margin, capped at `spec.lock`. Opens to full lock in a walking-pace power slide | `lock/(1 + v/45)`, blending back to full lock over 0.1-0.2 rad of countersteer slip | car.ts:354, :391, :157-162 |
| Auto countersteer | `target += sign(β)·max(0, abs(β) − 0.1)·0.8` above 4 m/s | none | car.ts:393 |
| Course clamp (caster-like) | Fronts held within `1.1·peak_angle` (+ lock that fades in below 6 m/s and out above 12-16 m/s) of the front axle's course | none | car.ts:394-405 |
| Wheel slew | `max(1.6, 6·lock)` rad/s, ×1.6 with keys released. Analog 9 rad/s | same | car.ts:408-409 |
| Stability (STM-like) | Yaw torque damps only the yaw that grows the slide, past 0.2 rad body slip. Handbrake bypasses it | none | car.ts:617-622 |

Grip-limited lock in numbers (from `scripts` maths, both cars, assist on vs off):

| km/h | 20 | 40 | 60 | 80 | 100 | 130 | 160 | 200 |
|---|---|---|---|---|---|---|---|---|
| hatch, assist (deg / % of lock) | 37.8 / 100 | 13.8 / 36 | 7.3 / 19 | 5.0 / 13 | 3.9 / 10 | 3.2 / 8 | 2.8 / 7 | 2.5 / 7 |
| hatch, assist off | 33.7 | 30.3 | 27.6 | 25.3 | 23.4 | 21.0 | 19.0 | 16.9 |
| coupe, assist (deg / %) | 35.5 / 100 | 15.0 / 42 | 8.1 / 23 | 5.7 / 16 | 4.6 / 13 | 3.8 / 11 | 3.4 / 9 | 3.1 / 9 |

Assisted lock is already "Forza-shaped": past 40 km/h we use less than the forum's ~30%. Assist off still gives a 23° lock at 100 km/h, which is the flick machine Simulation steering is known for.

### 1.3 Measured: the three modes on the default hatch

Scratch probe (same sim, flat ground, cruise controller holding the speed). The coupe numbers are within about 15%.

| Scenario | SNAP | SMOOTH (default) | HOLD |
|---|---|---|---|
| key → 90% at 30 / 100 km/h | 0.08 / 0.19 s | 0.16 / 0.41 s | 0.36 / 0.36 s |
| release → 10% at 100 km/h | 0.08 s | 0.20 s | 0.46 s |
| step steer at 100: yaw 90% / overshoot | 0.19 s / 28% | 0.36 s / 21% | 0.29 s / 22% |
| 17 ms tap at 100: peak yaw / heading change | 0.008 / 0.04° | 0.046 / 0.37° | 0.006 / 0.03° |
| 50 ms tap | 0.060 / 0.37° | 0.077 / 0.71° | 0.042 / 0.32° |
| 150 ms tap | 0.294 / 2.97° | 0.157 / 2.04° | 0.193 / 2.71° |
| lane change at 100 (0.4 s right, 0.4 s left, release): heading error / lateral | 1.2° / 4.4 m | **7.7° / 13.5 m** | 3.9° / 8.2 m |
| slalom at 100 (0.5 s alternating): max yaw / slip | 0.59 / 2.7° | 0.46 / 1.6° | 0.47 / 1.9° |
| handbrake flick at 70, 0.45 s: turned / straightens in | 17° / 1.35 s | 13° / 1.41 s | 12° / 1.38 s |
| lift-off at 90 with the key held: max slip | 2.7° | 2.7° | 2.7° |

What this says:

- **SMOOTH tap gain is flat.** A 17 ms tap gives 0.37°, a 150 ms tap 2.0°: about 5× the heading for 9× the press. A tap always means something (good), but the player can't make a tiny correction: 0.15 of a 100 km/h lock arrives instantly.
- **SMOOTH reversal is slow.** The opposite key first unwinds at the release rate, then restarts from the 0.15 tap share. The second half of a symmetric lane change does a fraction of the first, so the car leaves 7.7° off heading. FH-style (and AC's "opposite lock speed") reversal is the fastest rate, not the slowest. This is the biggest gap.
- **SNAP is crisp, but taps under 50 ms vanish,** and the 150 ms tap is the biggest of the three.
- Lift-off and handbrake recovery are the same across modes: the assists, not the key filter, own those.

### 1.4 Keyboard gaps vs FH5

| Behaviour | FH5 | Ours | Status |
|---|---|---|---|
| Speed-limited, grip-aware lock | yes [comm] | `grip_lock` + course clamp | **have** |
| Auto countersteer / self-steer | heavy [comm] | gain 0.8 past 5.7° + caster-like clamp | **have** |
| Yaw damping (STM) | yes [off] | slide-growing yaw only, past 11.5° | **have** |
| Speed-scaled attack | yes [spec] | SNAP and SMOOTH both scale to 108 km/h | **have** |
| Fast reversal through centre | yes [spec] / AC ~9× [comm] | SNAP 2.5×; SMOOTH *slower* than attack | **partial** |
| Speed-scaled release | [spec] | SNAP yes; SMOOTH fixed 0.12 s | **partial** |
| Tap proportional to press length | yes [spec] | SNAP drops short taps; SMOOTH flat | **partial** |
| Throttle / brake key ramp | not known [spec] | binary; TCS ramps the cut 9/s down, 2.5/s up (car.ts:442-443) | **missing** (maybe fine) |
| Mouse steering | **no** [comm] | no | equal. Not an FH5 feature to copy |
| Feel scripts on the shipped mode | n/a | feel.ts runs SNAP | **missing** |

### 1.5 Proposal: a "Forza" key profile as data

Root cause: SMOOTH chains release, then attack, when the key reverses, and its first frame is a fixed share. Both make corrections slow and coarse. This is not a new mode. It replaces the SMOOTH branch with a table-driven filter (same `SteerMode.SMOOTH` value, same setting row), keeping data over branches (`AGENTS.md` "Code shape").

```ts
interface KeyProfile {
  /** Seconds from 0 to full key, by speed (km/h), linear between rows. */
  attack: readonly (readonly [kmh: number, s: number])[];
  /** Seconds from full to 0 with no key, by speed. */
  release: readonly (readonly [kmh: number, s: number])[];
  /** Rate multiplier while the key opposes the wheel (through centre and on to the other side). */
  reverse: number;
  /** Share of full key applied on the first frame of a press. */
  tap: number;
}
```

Starting numbers (to tune, [spec]):

| km/h | 0 | 30 | 60 | 100 | 150 | 200 |
|---|---|---|---|---|---|---|
| attack 0→1 (s) | 0.05 | 0.10 | 0.18 | 0.26 | 0.32 | 0.36 |
| release 1→0 (s) | 0.04 | 0.07 | 0.10 | 0.14 | 0.16 | 0.18 |

`reverse = 3` (the opposite key crosses centre 3× faster than attack). `tap = 0.05` (was 0.15), with a linear attack after it, so press length sets the result. Keep the speed cut-off at walking pace so donuts and power slides still get lock at once (the donut tests in car.test.ts:552 pin that).

Why linear and not exponential: with a linear attack, heading change grows with press time squared, so taps scale. The exponential growth from a fixed share is what flattened SMOOTH.

Lock vs speed stays physical (`grip_lock`). A lock table would fight the tyre model and every car's `peak_angle`. Only revisit it if a car feels darty, and then use handling.md item 10.

Countersteer stays as it is. One optional knob: an "input authority" (Advanced Steering's name), meaning how much a held inward key can override the auto countersteer. Today the auto term just adds to the key. Only add it if drift players complain.

Throttle / brake ramp: **don't, by default.** Keys are binary in FH5 as far as anyone documents, and our TCS already ramps. If the TCS-off RWD power-on test (feel.ts "power on mid corner 2nd (TCS off)" = 26.5° on the coupe) bothers the owner, try a throttle attack of 0.15 s below 3rd gear, keys only, and keep the release instant so lift-off stays crisp.

### 1.6 How to prove it

The repo's own scripts only (AGENTS.md "Tests": physics changes need `car.test.ts` + `feel.ts` numbers in the commit body).

| Step | What |
|---|---|
| 0 | Fix the harness first: feel.ts sets `steer_mode` explicitly and prints the key rows for SMOOTH (shipped) and SNAP. Separate commit. Its output changes by design, so say so in the body. |
| 1 | Move the probe scenarios into `scripts/keys.ts` (it already owns lane change, arc, hairpin and tap, and car.test.ts imports it): lane change at 100 km/h (0.4 / 0.4 s), taps of 17 / 50 / 100 / 150 ms at 100, slalom at 100 with 0.5 s alternation, lift-off at 90 with the key held, handbrake flick at 70. |
| 2 | Add a **closed-loop key driver**: a bang-bang lane keeper with 80 ms reaction and hysteresis tracking a lane centre at 60 / 100 / 160 km/h. Metric: RMS lateral error and presses per second. That is the closest headless proxy for "easy on keys". |
| 3 | Targets for the new profile vs SMOOTH today: lane-change heading error < 2° (7.7°); tap ratio 150 ms / 17 ms ≥ 10 (5.5); step yaw90 ≤ 0.30 s (0.36); slalom max slip ≤ 2°; lift-off and flick within ±10% of today; donut and hairpin tests unchanged. |
| 4 | Ground truth from FH5 itself: turn on Data Out (UDP), steer by keyboard, log the `Steer` field (s8, ±127 [off] FH6 doc). If it is the filtered value, this gives FH5's real attack / release / reverse per speed in an afternoon. If it is raw input, it shows a square wave, and we know in 5 minutes. |
| 5 | Owner drives it. Numbers prove "not worse"; feel is the owner's call. |

---

## Part 2: everything else in FH5 handling

Status: **have** / **partial** / **missing**. The pick column says whether to take it (value ÷ effort): ★★★ = take it now, ★ = skip unless asked.

### 2.1 Assists

| Item | FH5 | Ours | Status | Pick |
|---|---|---|---|---|
| TCS | On / off. Cuts drive on wheelspin; off gives a performance bonus [comm] | Engine cut on axle slip > 0.14, plus per-wheel brake TCS below 15 m/s with lateral slip counted (car.ts:426-444, :193-198) | have | — |
| STM (stability) | On / off. "Keeps the car pointed where you steer"; separate from TCS [comm] | Folded into `assist` (yaw damper car.ts:617-622). Not separable from steering assist | partial | ★★ Split `assist` into steering and stability toggles: two booleans, no physics change. Lets players drift with grip lock on |
| ABS | On / off. FH5 remodelled ABS so "brake pressure eases off instead of simply modulating" [comm, Playground via RacingGames.gg 2021-09] | Factor −25/s while locking (floor 0.2), +12/s recovery (car.ts:575-577) | have | — |
| Braking assist | FH5: "Braking: Assisted (auto) / ABS on / ABS off" [off accessibility, via snippet] | none | missing | ★ Auto-brake is a lot of code for players who already have ABS |
| Racing / braking line | Full / braking only / off, coloured by the speed needed [off] | none (routes exist, no ideal-speed solver) | missing | ★★ Needs a speed profile per route: `autolap.ts` already finds the pace. Medium effort, big help in races |
| Auto-steer | "The car will automatically steer for you" [off accessibility] | none | missing | ★ Accessibility only. Autopilot exists in scripts |

### 2.2 Tyres and grip

| Item | FH5 | Ours | Status | Pick |
|---|---|---|---|---|
| Tyre model | Not published. FM 2023 moved to 8 contact points per tyre at 360 Hz [comm GTPlanet]. Horizon's use of it is unconfirmed (Esaki quote, forum) | Normalised magic formula, slide floor 0.76, load fade, combined slip (car.ts:76-82, :164-176, :543-550) | have | — |
| Grass penalty | FH5 penalises "dipping a wheel onto grass" more than FH4 [comm, Playground summary] | grass 0.72 grip + roll 12; shoulder 0.85 (kind-def.ts:68-71) | have | — |
| Road vs off-road tyre split | The compound sets the chassis type: road (stock … slick, snow) vs off-road (off-road, rally …) vs drift vs drag [comm] | Tyre slot with `offroad` shift and per-surface multipliers: rally dirt ×1.07, mud grass ×1.18 (build.ts:73-84) | have | — |
| Softer post-peak curve on loose ground | [spec] | One curve everywhere | missing | ★★ handling.md item 6 already measured it: MF C 1.3 off-road takes skidpad on grass from 0.57 to 0.68 g |
| Tyre pressure | Tuning slider, per-compound baselines (off-road 18.5 psi … slick 29.5) [comm] | none | missing | ★ Adds tuning noise for little feel |

### 2.3 Weight and suspension feel

| Item | FH5 | Ours | Status | Pick |
|---|---|---|---|---|
| Weight transfer | Grip "affected by the suspension at each corner"; "better sense of the load on each wheel" [comm, Playground summary] | Per-wheel springs, dampers, bump stops, ARBs on a rigid body (car.ts:523-524; cars.ts:40-46), so dive and roll are physical | have | — |
| Showing it | Chassis roll / pitch visible; telemetry screen shows suspension and g [spec] | The body rolls physically. Camera "pull" grows with acceleration (camera.ts:186-188). No pitch or roll in the camera, no g display | partial | ★★ handling.md item 9: 1-2° camera pitch on braking and upshifts, small roll with lateral g. Cheap and sells weight |

### 2.4 Throttle oversteer and drift

| Item | FH5 | Ours | Status | Pick |
|---|---|---|---|---|
| Drift setup | Drift tyre compound, drift suspension, community "drift tune" (soft front, stiff rear ARB, wide lock, high diff accel) [comm] | Drift suspension: rear ARB ×3, lock ×1.15, assist yaw 0.6 (build.ts:112-117) | have | — |
| Diff tuning | Accel / decel lock sliders [comm] | none (open diff + brake TCS) | missing | ★★ One `diff_lock` field on a part. Locked diff = predictable power oversteer. Medium physics work |
| Drift scoring | Skill chain: angle × speed × chain length; the speed multiplier caps around 70 mph per one forum; crash breaks the chain [comm] | angle × speed × 0.1 × dt × mult. Mult +1 per 2 s up to ×5, 700 ms grace, wall hit drops the chain (drift.ts:9-16, :82-130) | have | — |
| Skill chains outside drift (near miss, air, speed) | Core FH loop [spec, player knowledge] | Jump "Clean!" toast only (main.ts:484-487) | partial | ★★ Free-roam skill chain from metrics we already have (drift, air time, near miss on remotes). Pure game layer, no physics |

### 2.5 Off-road and jumps

| Item | FH5 | Ours | Status | Pick |
|---|---|---|---|---|
| Landing | Cars land on their wheels almost always; air pitch is levelled [spec, player knowledge] | `air_settle` levels pitch and roll and keeps yaw. It is 0 on the coupe, 3-5 on the rally / formula / bus / sturm / raijin (car.ts:623-630; cars.ts) | partial | ★★ Give every car a small air_settle (1-2). Coupe 0 means road cars tumble off crests |
| Recover after landing | Instant grip, no wobble [spec] | Jumps: BOUNCE 0.3, SCRUB 0.55, SETTLE 0.6 (jumps.ts:12-18) | have | — |
| Auto-recover | Flipped car reset prompt / auto [spec] | Auto reset when upright < 0.3 and speed < 2 for 1.5 s; fall reset to checkpoint (main.ts:492-503) | have | — |

### 2.6 Camera

| Item | FH5 | Ours | Status | Pick |
|---|---|---|---|---|
| Speed FOV | Widens with speed [spec]. PC FOV slider (official PC page; support says only in the Hot Wheels park [off], conflicting) | `64 + min(24, 0.3·v)` + boost 6, eased at 3/s (camera.ts:33, :221) | have | — |
| Chase lag | Spring lag on position and yaw [spec] | yaw rate 5, height 6, position 14; leads yaw into a slide (×0.55, ±0.6 rad) (camera.ts:180-195) | have | — |
| Pitch / roll with g | [spec] | none | missing | ★★ see 2.3 |
| Look back | Button [spec] | none | missing | ★ One binding, one camera offset |
| FOV slider | yes (PC) | none | missing | ★ |

### 2.7 Speed sense

| Item | FH5 | Ours | Status | Pick |
|---|---|---|---|---|
| Motion blur | Video setting, PC toggle [off / comm] | none (postfx is bloom only, postfx.ts:14) | missing | ★ Costs GPU on our quality tiers. Speed lines are cheaper |
| Camera shake | Speed and surface shake [spec] | bump shake + off-road rumble + speed rumble above 50 m/s (camera.ts:111, :169-170, :216-220) | have | — |
| Audio | Wind, tyre, surface, engine [spec] | squeal by scrub, wind by speed², gravel rumble (audio.ts:193-197) | have | — |
| Pad rumble by surface and slip | yes [spec] | impact rumble only (main.ts:477-482) | partial | ★★ Rumble from `scrub` and off-road, using the same numbers as the audio. A few lines in main.ts |

### 2.8 Tuning and classes

| Item | FH5 | Ours | Status | Pick |
|---|---|---|---|---|
| Upgrade parts | Engine, drivetrain, tyres, aero, platform [comm] | 8 slots: engine, tyres, aero, suspension, brakes, weight, bias, nitro (build.ts:63-157) | have | — |
| Tuning sliders | Pressure, gearing, alignment, ARB, springs, damping, aero, brake, diff [comm] | Parts only, no sliders | missing | ★ Sliders invite mush. Parts with clear trade-offs suit Harepin better. Only the diff (2.4) is worth a part |
| PI / classes | PI 100-999 from a simulated lap time, classes D … S2 / X. Upgrades change PI, tuning doesn't [off FH3 support / comm] | `stats()` + per-stat 0-100 meters (build.ts:282-296; garage-meters.ts) | partial | ★★★ A single PI from `stats()` (or a headless autolap time, as Forza does) + class letters. Gives lobby races fair buckets and a goal in the garage |

### 2.9 Rewind, collisions, ghosting

| Item | FH5 | Ours | Status | Pick |
|---|---|---|---|---|
| Rewind | Unlimited in solo; not in online races [comm] | Hold to rewind, 10 s buffer; blocked in lobbies and modes (rewind.ts:1-2; main.ts:454) | have | — |
| Car to world | Breakable fences / scenery, solid trees and walls [spec] | Hull penalty contacts + circle grid, restitution 1.25, rail glide (car.ts:601-615; world.ts:42-49, :476-494) | have | — |
| Car to car / ghosting | Collisions on, with situational ghosting (race starts, imminent high-speed hits) and anti-griefing [off FH5 notes 2026-02 / comm] | Remote cars are ghosts, no collision (remotes.ts:175-176) | partial | ★ Real P2P car collisions mean authority and desync problems (FH5 itself has "ramming" desync reports). Stay ghosted |

### 2.10 Pad and mouse

| Item | FH5 | Ours | Status | Pick |
|---|---|---|---|---|
| Pad deadzones / linearity | Inside / outside deadzone and linearity per axis, triggers too [off FH5 wheel setup / comm] | Stick 0.08 deadzone, exponent 1.4 fixed (input.ts:291-293); triggers raw (input.ts:294-303) | partial | ★★ One "stick linearity" and one "inside deadzone" setting. Copy the existing `steer_sensitivity` row pattern |
| Mouse steering | none native [comm] | none | equal | ★ Only if the owner wants it (Q4) |
| Telemetry out | UDP Data Out: Sled / Dash formats, fixed format on FH6, `Steer` s8 ±127 [off FH6 / FM docs] | none (headless scripts instead) | n/a | Use FH's Data Out as the reference for 1.6 step 4 |

---

## Open questions for the owner

| # | Question | Recommendation |
|---|---|---|
| Q1 | Replace SMOOTH's maths with the table profile (same name, same setting), or add a fourth "Forza" mode? | **Replace.** Three modes is already one too many to explain. If the numbers win, SMOOTH just gets better. |
| Q2 | Fix feel.ts to run the shipped mode (output changes by design)? | **Yes, first, in its own commit.** Every handling number since SMOOTH became the default was measured on Classic. |
| Q3 | Split "Steering assist" into steering + stability toggles? | **Yes.** Small, no physics change, and it lets players drift with the grip-limited lock on. |
| Q4 | Mouse steering? | **No for now.** FH5 doesn't have it either. The mouse stays on camera. |
| Q5 | Throttle / brake key ramps? | **No** unless the TCS-off power-on oversteer gets complaints. TCS is the ramp. |
| Q6 | Spend an hour logging FH5 Data Out `Steer` by keyboard? | **Yes.** It is the only route to real FH5 numbers. Everything else in Part 1 is inferred. |
| Q7 | PI + classes: from `stats()` (instant) or from a headless autolap time (Forza's way, slower, more honest)? | **`stats()` first,** then calibrate the weights against autolap times once. |

## Top 10 to steal, ranked by value for effort

| # | What | Why | Effort |
|---|---|---|---|
| 1 | Fast reversal + linear speed-scaled attack / release for SMOOTH (1.5) | Fixes the 7.7° lane-change error and flat taps: the keyboard ask | S |
| 2 | feel.ts / keys.ts on the shipped mode + the closed-loop key driver (1.6) | Without it, 1 can't be proven | S |
| 3 | PI + class letters (2.8) | Fair lobbies, a garage goal | S-M |
| 4 | Split steering and stability assists (2.1) | Drift with grip lock on; mirrors FH's STM | S |
| 5 | Camera pitch / roll with g (2.3, 2.6) | Sells weight transfer for free | S |
| 6 | Rumble from scrub and surface (2.7) | Pad players feel the limit | S |
| 7 | Small air_settle on every car (2.5) | Road cars stop tumbling off crests | S |
| 8 | Pad inside deadzone + linearity settings (2.10) | Twitchy-stick complaints die | S |
| 9 | Loose-surface tyre curve (2.2, handling.md item 6) | Off-road gets progressive, FH-like | M |
| 10 | Free-roam skill chain (2.4) | FH's core loop, from data we already compute | M |

Next tier: diff lock part, braking line, look back.

## Sources

| Source | Date / version | Used for |
|---|---|---|
| [Forza support: FH4 Wheel Setup and Tuning](https://support.forza.net/hc/en-us/articles/360002007867-FH4-Wheel-Setup-and-Tuning) (403, read via search snippet) | FH4 | "Multiple systems layered… Simulation turns these off" |
| [Forza support: FM7 Wheel Setup](https://support.forza.net/hc/en-us/articles/360012736414-FM7-Wheel-Setup-and-Tuning) (snippet) | FM7 | Normal steering affects yaw inertia |
| [Forza support: Difficulty, Assists and Drivatars](https://support.forza.net/hc/en-us/articles/360005363194-Difficulty-Assists-and-Drivatars) (snippet) | — | Steering assist levels |
| [Forza support: FH5 Wheel Setup](https://support.forza.net/hc/en-us/articles/4409761195923-FH5-Wheel-Setup-and-Tuning) (snippet) | FH5 | Deadzone definitions |
| [Forza support: FH6 Data Out](https://support.forza.net/hc/en-us/articles/51744149102611-Forza-Horizon-6-Data-Out-Documentation) (snippet) | FH6, 2026 | Fixed packet, `Steer` ±127, UDP out only |
| [Forza support: FH3 PI and Classes](https://support.forza.net/hc/en-us/articles/360005372033-FH3-Performance-Index-and-Classes) (snippet) | FH3 | PI from a simulated lap time |
| [Family Gaming Database: FH5 accessibility](https://www.familygamingdatabase.com/accessibility/Forza+Horizon+5) | fetched 2026-11-11 | Auto / assisted steering, braking assist |
| [RacingGames.gg: FH5 handling upgrades](https://racinggames.gg/article/forza-horizon-5-major-handling-upgrades-revealed) | 2021-09-09, upd. 2022-03-22 | ABS remodel, grass penalty, per-corner grip |
| [forums.forza.net: Keyboard Normal vs Simulation](https://forums.forza.net/t/keyboard-gameplay-help-to-decide-between-normal-or-simulation-steering-for-a-more-realistic-driving/73664), [driving assistance and FWD](https://forums.forza.net/t/question-about-driving-assistance-and-fwd-cars/536873), [native mouse steering request](https://forums.forza.net/t/native-mouse-steering-support-option-to-bind-mouse-axis-movement-as-analog-steering/747910), [inside deadzones](https://forums.forza.net/t/adjusting-the-inside-deadzones-made-cars-in-fh5-handle-a-lot-better/548807) | forums now 301; snippets only | Filter, 30%-lock claim, auto countersteer, no mouse steering |
| [FH5 release notes, Feb 2026](https://forums.forza.net/t/fh5-release-notes-and-fixed-issues-february-2026/587047/11) | 2026-02 | Ghosting replication |
| [BeamNG Advanced Steering](https://github.com/adam10603/BeamNG-Advanced-Steering) + [ConfigGuide](https://raw.githubusercontent.com/adam10603/BeamNG-Advanced-Steering/release/ConfigGuide.md) | v2.6.1, game 28.1.0 | Peak-slip limit, self-steer, input authority, Key-smooth = 70% |
| [AC Advanced Gamepad Assist](https://github.com/adam10603/AC-Advanced-Gamepad-Assist) | v1.5.5 | Optimal-slip limit, keyboard combine |
| [BeamNG "Forza" steering thread (LoSboccacc)](https://www.beamng.com/goto/post?id=1342496) | 2021-03-12 … 08-03 | Understeer-limiting steer, full countersteer |
| [Dedoimedo: BeamNG keyboard and mouse](https://www.dedoimedo.com/games/beamng-keyboard-mouse-driving.html) | 2021-05-10 | Speed-proportional damping, throttle filter, mouse linearity |
| [GameSkinny: AC mouse and keyboard](https://www.gameskinny.com/tips/best-assetto-corsa-mouse-and-keyboard-controls/) (403, snippet) | — | Steering 0.80 / opposite lock 7.50 / return 1.50 |
| [GTPlanet: FM new tyre model](https://www.gtplanet.net/?p=109850) (snippet) | FM 2023 | 8 contact points at 360 Hz |
| [drifted.com FH5 drift tune](https://www.drifted.com/forza-horizon-5-drift-tune/), [forums: drift zone score](https://forums.forza.net/t/what-makes-up-the-drift-score-for-drift-zones/84508) | 2021-2025 | TCS / STM roles, drift score inputs |
| [Forza forum: in-depth FH5 tuning guide](https://forums.forza.net/t/in-depth-horizon-5-tuning-guide-update-dampers/544736) (snippet) | — | Chassis type by compound, pressures |

Repo measurements: `bun scripts/feel.ts coupe|hatch` (2026-11-11) and a scratch probe on the same `Car` (not committed); all numbers in 1.2-1.3 come from those runs.
