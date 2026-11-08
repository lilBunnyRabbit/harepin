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
