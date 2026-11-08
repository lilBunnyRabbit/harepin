# Handling: improvements that keep the feel

Status: research, 2026-11-08; no `src/` change. Numbers from a flagged scratchpad copy of `car.ts` (360 Hz, flat
ground unless noted; defaults reproduce `bun scripts/feel.ts` / `bun run telemetry` exactly). Owner brief: "realistic
but arcade, I like the feel now", so each item states its cost to the current feel.

## Do now (top 4, all S, autolap unchanged at 116.4 s / 0.0 s offroad / slowest 78 km/h)

1. **Ackermann front geometry.** This is the root cause of the wide low-speed circle, not the 2 m/s slip floor.
   Both fronts now steer to the same angle, so they fight each other. Fix: in the wheel loop, steer each front to
   `atan(L / (R ∓ half_track))` with `R = L / tan(steer)`. Inner and outer wheels come from the sign of `steer`:
   positive steer turns right, and `left` means +x.

   | rear-axle radius, full lock | 2 km/h | 10 km/h | 20 km/h | reverse 3 km/h |
   |---|---|---|---|---|
   | today | 4.02 m | 4.36 m | 4.63 m | 4.05 m |
   | Ackermann 100% | **3.66 m** | 3.68 m | 4.05 m | 3.65 m |
   | Ackermann 70% | 3.73 m | 3.79 m | 4.06 m | 3.72 m |

   Kinematic radius is 3.64 m. Step steer, lane change, lift-off, drift, braking and rest jitter stay the same,
   because lock at speed is under 0.1 rad. **The fix idea in the brief is refuted.** A slip floor of 0.5 m/s makes
   the circle *wider* (4.31 m), and the car rolls 45.7 m down a 20% slope (today: 0.09 m). A kinematic blend under
   1.5 m/s, 0.3 m/s floor: 4.31 m, same creep. The floor holds the car on hills; keep it. Risk: none measured.

2. **Auto gearbox: no upshift on wheelspin.** Upshifts read wheel rpm, but downshifts read road rpm. Spinning
   wheels trigger an upshift, road speed triggers a downshift, and the box hunts between gears. Each shift cuts drive
   for 0.18 s. Fix: block the upshift while a driven wheel slips more than 0.15, unless road rpm is within 200 of
   redline. The rev limiter handles the rest. Simpler variant: upshift on road rpm.

   | | today | fix |
   |---|---|---|
   | 0-100, TCS off | 6.49 s, 9 shifts (1>2>1 five times), 1.62 s without drive | 6.27 s, 1 shift, 0.18 s |
   | 0-100, TCS on | 5.29 s, 1 shift | 5.29 s, 1 shift |
   | 6 s held drift, TCS off | 11 upshifts, ends in 3rd | 1 upshift, stays in 2nd |

   Risk: none with TCS on. Feel: TCS-off drifts and launches stop stuttering.

3. **Speed-scaled keyboard steer ramp.** At speed the assisted lock is tiny (0.08 rad at 100 km/h), and the
   current rate is `max(1.6, lock·6)`. A key press reaches full lock in about 50 ms, so keyboard steering is
   bang-bang. Fix: filter `input.steer` as a virtual stick before the lock. Time to full is
   `0.03 + 0.2·min(1, v/30)` s, release and reversal run 2.5× faster, and the result is then treated like analog
   input. Pad and touch are untouched.

   | 100 km/h, keys | today | ramp 0.12 | ramp 0.2 | ramp 0.3 |
   |---|---|---|---|---|
   | yaw from a 150 ms tap | 0.385 rad/s | 0.341 | **0.267** | 0.199 |
   | step: t90 / overshoot | 0.11 s / 41% | 0.15 / 39% | 0.19 / 36% | 0.23 / 33% |

   Small corrections stop darting. Parking-speed response is unchanged. Risk: turn-in feels lazier if set too long,
   so start at 0.12-0.2 and tune by hand. Handbrake flick turns 17° today and 15° with ramp 0.2.

4. **Stability yaw-damper threshold 0.2 to 0.35 rad (A/B behind a flag; owner call).** TCS-off drift against a 28°
   target, with item 2: mean angle 20° to **27°**, time above 15° 4.7 s to **5.7 s**. Cost: a 70 km/h handbrake
   flick straightens in 2.02 s instead of 1.52 s, so the car catches itself less. Only this item touches the liked feel.

## Later, ranked

5. **Lift-off tuck via engine braking ×1.25 (S, risky).** At the limit, 90 km/h, assist on: lift slip 4.0° to 5.4°,
   yaw 0.36 to 0.49 rad/s, 100-0 40.0 to 39.8 m. **Cliff:** ×1.5 gives 13.8°, ×2 gives 18.7°. Rear brake bias on
   lift is probably the better lever (untested).
6. **Loose-surface tyre curve on grass (M).** Give `Ground` a surface curve shape: MF C = 1.3 offroad instead of 1.55,
   so sliding keeps about 89% of peak instead of 65%. This is the usual "progressive on gravel and grass" trick. On
   grip 0.72 ground: skidpad 0.57 g becomes 0.68 g, and a flick straightens in 1.67 s instead of 2.29 s. Braking at
   160 km/h on grass after a yaw kick goes from 26° to 22°. Pair it with height noise on grass. Today grass bumps
   only slightly more than road, and `scripts/offroad.ts` cannot show it (see the bottom of this doc).
7. **Grass braking stability (S, diagnose first).** A 0.3 rad/s yaw kick at 160 km/h under full ABS costs ≤4° on
   road but 26° on grass (grip 0.72, roll ×12), and can swap ends; grip alone (roll ×1) costs 8°. Cause: roll drag
   `-v_long·roll_resist·12` sits outside the friction circle and loads the fronts. Fix with body drag, or accept it.
8. **Relax TCS during a deliberate slide (M, owner call).** With TCS on, which is the default, a handbrake-started
   drift lasts 0.69 s: TCS cuts throttle at 0.14 slip. One option is to let slip reach about 0.3 for 1 s after the
   handbrake, or while body slip is above 15°. This lets assist-on players drift. It changes what "TCS on" means.
9. **Shift and camera feedback (S, unmeasured, cosmetic).** Drop rpm over `shift_time` instead of in about 33 ms.
   Blip the throttle on auto downshifts, in audio only. Nudge camera pitch 1-2° on upshift and hard braking: `pull`
   moves the camera but never pitches it. Add a small camera roll with lateral g. Give the 2.5 m shoulder band
   (grip 0.85) its own gentle buzz; today it uses the same shake as grass.
10. **Speed-scaled grip-lock margin (S, only if "darty" is reported).** Full-lock yaw overshoot is mostly chassis:
    41% at 100 km/h, 75% at 160; ramp 0.5 still leaves 26% / 44%. Cutting the `peak_angle·0.45` term to 0.2 gives
    53% at 160 but steady grip falls 1.10 g to 0.98 g, which trades away grip the owner likes.

## Checked, not worth it

- **Tyre load sensitivity** (`1 - load/32000`, to 20000): skidpad drops from 0.91 g to 0.83 g, lift-off gets
  *less* lively, and `mu` would need a retune. No feel gain.
- **Handbrake torque:** 2000 Nm already locks the rears (slip -1.00). At 3000 and 4500 Nm the flick is identical
  (17° in 0.45 s, 55° total), so torque is not the lever.
- **Clutch kick:** no clutch model; auto box plus handbrake already start drifts. Large cost for a niche.
- **Braking on road:** stable. 100-0 is 40.0 m with ABS (0.98 g), trail braking reaches at most 7.1°, and a kick
  costs at most 4°.

## Reference practice (unverified, general knowledge, no source checked)

FH- and GT-style arcade-sim handling usually combines: a steering assist holding the fronts near peak slip ("normal"
steering, which `grip_lock` already is), digital steering through a speed-dependent ramp, real Ackermann geometry,
a softer post-peak tyre curve on loose surfaces, and an auto box that holds gear while sliding.

## Check gaps found

- `scripts/offroad.ts` "road" run drives straight off the road (prints `grip 0.72` for both), so its road baseline
  (1.68 m/s² vertical rms) is really grass. It should steer along `world.road`.
- No script covers a held drift, a 150 ms tap, gear hunting or reverse radius; the probes could join `scripts/feel.ts`.

## Per-car character (2026-11-09)

Owner: "all cars kinda look the same now... all should have their special characteristics". The coupe is the
baseline and keeps the liked feel unchanged; the Kaze stays as tuned. Hatch, muscle and rally move away from the
coupe, each on a few clear axes. Handling fields in `src/cars.ts` only: no body, wheel mount or collision changes.

### Feel spec

| car | one line | targets |
|---|---|---|
| hatch | FWD, light, nimble, safe | 0-100 9-10 s, top ~190, **shortest stop** (< coupe), **sharpest turn-in**, lift-off tuck 5-9° and never spins, power-on ~0° (understeer), no drift |
| coupe | baseline balanced RWD | unchanged: 5.3 s, 271 km/h, 40.0 m |
| muscle | heavy, torquey, soft, lazy | **highest top** (≥ 280), **longest stop** (46-50 m), **laziest turn-in**, **most body roll and dive**, lowest skidpad, most power-on oversteer (TCS off, > 35°), slides wilder than the Kaze (hold < Kaze) |
| rally | AWD, gravel car | **quickest 0-100** (< 4.8 s), short gears (top ~235), soft (roll and dive > coupe), **rotates on lift** (10-15°), throttle rotation from a rear-biased split, **best on grass** by far |
| kaze | easiest drifter | unchanged: 5.92 s, 251 km/h (telemetry), **longest slide hold** |

### Levers used

- **Turn-in:** `peak_angle` (tyre slip angle at peak). Lower is a stiffer tyre and a quicker yaw build. Hatch 0.08,
  coupe/Kaze 0.10, rally 0.12, muscle 0.13. Lower yaw inertia (hatch 1600, rally 2100) adds to it.
- **Lift-off tuck:** `rear_grip` plus roll stiffness shifted rearward. It is a cliff: hatch `rear_grip` 1.02 gives 10.5°,
  1.03 gives 6-7°, 1.00 gives 18°. Hatch ARB 8000 front / 15000 rear (was 11000 / 9000), `rear_grip` 1.14 to 1.03.
- **Soft/floaty:** springs, low damping ratio, low ARBs. Muscle 24000 N/m, damper 2000 (ζ ≈ 0.32, coupe 0.40),
  ARB 8000 / 2000. Rally 25000 / 2300, ARB 9000 / 10000 (rear-biased, so it still rotates).
- **Brakes:** muscle brake torque cut to 1900 / 700 Nm, so it is torque-limited, not grip-limited: long stop, ABS rarely
  triggers. Everyone else stays grip-limited.
- **Top speed / gearing:** muscle `drag` 0.5 to 0.44 and `final` 3.45 to 3.2; rally `final` 3.9 to 4.5.
- **AWD rotation:** rally `awd_split` 0.4 to 0.3 (70% rear), so throttle pushes the tail out (power-on 2° to 19°).
- **Grass:** rally `offroad` 0.55 to 0.7.

### Measured (`bun scripts/handling.ts`, flat ground, 360 Hz, stock build)

| car | 0-100 s | top km/h | 100-0 m | dive ° | skidpad g | turn-in ms | roll ° | lift-off ° | power-on ° | flick slip ° | slide hold s | grass km/h @12 s | grass g |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hatch | 9.22 | 191 | **38.7** | 2.4 | 0.97 | **50** | 2.2 | 7.1 | 0.6 | 25 | 0.3 | 84 | 0.65 |
| coupe | 5.29 | 271 | 40.0 | 2.3 | 0.89 | 61 | 2.3 | 4.1 | 28.4 | 24 | 1.2 | 117 | 0.64 |
| muscle | 6.05 | **281** | **49.7** | 2.9 | **0.81** | **69** | **3.9** | 4.6 | **37.8** | 24 | 1.3 | 109 | 0.57 |
| rally | **4.69** | 236 | 41.0 | **3.1** | 0.87 | 56 | 3.1 | **14.2** | 19.3 | 26 | 2.2 | **158** | **0.79** |
| kaze | 5.92 | 257 | 40.9 | 2.2 | 0.90 | 56 | 1.9 | 4.8 | 29.5 | 26 | **3.2** | 110 | 0.63 |

Before (same script on HEAD 4d920e0 specs): hatch 9.28 s / 38.2 m / 56 ms / roll 2.3° / lift 2.1°; muscle 5.69 s /
273 km/h / 42.2 m / 67 ms / roll 2.4° / power-on 30.9° / hold 4.1 s; rally 4.58 s / 251 km/h / 64 ms / roll 2.6° /
lift 10.5° / power-on 2.0° / hold 0 s / grass 156 km/h, 0.75 g. Top speed, stop and roll sat within a few percent of
the coupe on every car, and the muscle out-held the Kaze in a slide.

Columns: 0-100 with TCS on; top after 60 s full throttle; 100-0 with ABS; dive is peak nose-down pitch braking from
100; skidpad is the best steady g at 70 km/h, assist off; turn-in is ms from an analog full-lock step at 100 km/h to
0.2 rad/s yaw (assist on); roll is peak body roll in that step; lift-off is peak slip lifting mid-corner at 90 km/h,
assist on (feel.ts test); power-on is peak slip with full throttle mid-corner in 2nd, TCS off; flick slip is peak slip
after a 0.45 s handbrake flick at 70 km/h; slide hold is seconds within 15-45° in a 6 s window, TCS and assist off,
mean of 9 driver gains of one countersteer-and-throttle controller (the best gain holds the Kaze for 6.0 s); grass is
grip 0.72 / roll 12 ground.

### Not distinct, and why

- **Handbrake flick** is the same for all cars (24-26°): 2000+ Nm already locks the rears, and locked-tyre grip is the
  same curve everywhere. Making the rally flick harder needs a per-car post-peak tyre shape (item 6 above).
- **Muscle 0-100** is slower than the coupe (6.05 s) because it is traction-limited with TCS on; TCS off it is 7.4 s
  with long wheelspin. That reads as "too much torque", which is on brief, but it is not a quick car off the line.
- **Hatch skidpad** is above the coupe (0.97 g): light car, low load sensitivity loss. It still understeers on power.
- Full-lock steps at 100 km/h oscillate slowly (about 1.4 s period) in every car, the coupe included: the cruise throttle
  loop. Muscle and rally swing more (feel.ts overshoot 82% / 53%, coupe about 40%). Floaty is on brief for both.

### Known issue found, not fixed

On grass with TCS on, a road-tyre car at 130+ km/h loses speed to a stop-start loop: roll drag holds the driven
wheels near 0.14 slip, TCS cuts to 0.25, the car slows. Coupe peaks at 136 km/h on grass after 16 s, then falls to
49 km/h by 30 s. Hence the 12 s grass speed column instead of a grass top speed.
