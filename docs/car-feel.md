# Car feel targets

Draft for owner sign-off (decision O1, `docs/plan/feel-lab-v2.md` 2). The handling twin of `docs/car-style.md`: one line of character per car and a band per trait of the handling golden (`scripts/golden/handling.txt`, row `<car>.stock asphalt`, keys as there). A number outside its band is a bug; a number inside it with a bad rating is a feel problem.

Status: **draft, not ticked**. Bands start from the measured stock numbers on 2a1bf3e and the 2026-11-09 spec in `docs/plan/handling.md`. `?` marks a number the draft doubts: today's value sits outside the band on purpose, for the owner or `t3-lineup` / `t4-throttle` to settle.

| car | character | t100 s | top km/h | stop m | g | turn ms | lift ° | pwr ° | must stand out |
|---|---|---|---|---|---|---|---|---|---|
| hatch | FWD, light, safe | 8.5-10 | 180-195 | 32-36 | 0.94-1.02 | 45-52 | 5-11 | 0-3 | sharpest road turn-in, never spins on lift |
| coupe | balanced RWD reference | 4.8-5.4 | 260-275 | 30-33 | 0.90-0.97 | 56-64 | 3-6 | 22-30 | none: every other car reads against it |
| muscle | heavy, lazy, wild on power | 5.0-5.8 | 275-290 | 31-35 | 0.86-0.93 | 65-75 | 2-6 | 28-38 | laziest turn-in, most roll, most power-on |
| rally | AWD gravel car | 4.3-4.8 | 228-242 | 31-35 | 0.88-0.95 | 52-60 | 10-16 | 14-22 | quickest B-class 0-100, rotates on lift, best on loose |
| kaze | easiest drifter | 5.4-6.0 | 245-260 | 30-33 | 0.90-0.96 | 52-60 | 3-7 | 24-32 | longest slide hold, forgiving catch |
| sturm | rear-engine, fast, traction out | 4.2-4.7 | 275-295 | 28-31 | 0.94-1.00 | 64-74 | 2-8 | 8-20 `?` (1.2) | top speed, brakes, rear bite on exit |
| raijin | AWD sedan, grip | 4.3-4.8 | 250-265 | 30-33 | 0.92-0.98 | 56-64 | 3-7 | 10-20 | high skidpad, neutral, stable at speed |
| formula | downforce car | 3.8-4.3 | 295-310 | 23-26 | 1.12-1.22 | 38-46 | 8-15 | 22-32 | grip rises with speed, nervous on lift, poor off road |
| fujin | prototype, most grip | 2.4-2.9 | 315-330 | 20-23 | 1.30-1.40 | 32-40 | 6-12 `?` (19.1) | 0-8 | highest g, stable at top speed |
| tsumuji | light pop-up roadster, momentum drifter | 8.8-9.8 | 172-185 | 32-35 | 0.92-0.99 | 46-54 | 12-18 | 16-24 | rotates on lift, carries speed through slides |
| sajin | sand buggy | 4.3-4.9 | 182-195 | 34-38 | 0.85-0.92 | 50-58 | 10-16 `?` (21.1) | 20-28 | best on sand and grass, soft, slow on tarmac |

Columns: `t100` 0-100 TCS on; `top` after 60 s flat out; `stop` 100-0 ABS on; `g` best steady skidpad g at 70 km/h; `turn` ms from full steer at 100 km/h to 0.2 rad/s; `lift` peak slip lifting mid corner at 90 km/h, assists on; `pwr` peak slip full throttle mid corner in 2nd, TCS off. Loose-ground rows (`<car>.stock dirt` and on) carry no bands yet: rally and sajin "best on loose" is read across cars on the same ground.

Sajin `g` and `pwr` follow its measured stock row (0.89, 24.4) since its centre of mass came down 0.25 m (t4); `lift` stays doubted until the owner drives `t5-bands`.

The bus is out (decision O6).

## Lab round 1 (2026-11-15)

This was the owner's first full session: nine packs on v0.44.1 (t3a on v0.43.1). The pastes are in `docs/lab/sessions/*.2026-11-1{4,5}.txt`, each with `bun scripts/lab.ts <pack>` run on 3775366 appended. Every `spec#` the sim resolved equals the one the owner drove, so the sim lines ran the same physics. The owner's framing: the ratings are soft, so read the numbers and the notes.

Reading the two lines:

- The owner's `latg` peak is not a g figure. Yaw rate x speed during a rotation reads 1.5-4.2 g (`sturm-sweep-top` 4.21). Use the mean.
- The owner's ring mean runs about 0.8-0.9 of the sim's steady skidpad g on every pad. Compare ratios between trials, not raw numbers.
- The export does not carry the aids the player had set: `src/lab/lab.ts:119` passes only `trial.aids`, and `src/lab/export.ts` writes none. Every trial without its own `aids` ran on unknown TCS, assist and stability. That blocks half of the driver-or-car reads below.

### Per pack

| pack | numbers (owner vs sim) | notes agree? | verdict |
|---|---|---|---|
| t1a-pads (coupe, 10 surfaces) | ring-mean g: asphalt .761, hardpack .758, dirt .733, packed snow .689, scree and wet .647, grass .574, sand .52, snow .454, ice .286. Sim steady g: asphalt .944, hardpack .823, dirt .786, packed snow .769, scree .76, wet .746, grass .666, sand .621, snow .541, ice .344. Same order except dirt and hardpack | yes: "dirt more grip, faster", sand "very slow", snow "bad grip". The owner's NOTE: "it kinda all behaved as expected" | promote the surface ladder as is. Drop ice from later packs (owner: "don't need to test this much") |
| t1b-brakes (coupe, 10 runways) | owner stops scaled to 60 km/h by v²: asphalt 11.5 m (sim 12.3), grass 14.8 (15.3), sand 13.6 (14.4), dirt 13.7 (14.5), hardpack 13.2 (14.0), scree 13.9 (14.7), wet 14.3 (15.1). The owner stops about 6% shorter on every lane, in the same order. Snow, packed snow and ice ended `stopped` with no `stop` key | yes: "predictable" everywhere | promote. Retest why the stop goal never closed on snow, packed snow and ice. Each run reached 62-72 km/h, above the 54 km/h gate. Cause unverified: either the car never dropped under 0.5 km/h or the owner pressed Stop |
| t2-drift (Drift preset, assists off) | The sim's `catch_drift` cannot see the three mods: lock*1.25 moves slip by -0.0002°, bar by +0.3°, loose by +2.3°. Owner, circle: held 20.7 s stock, 20.7 loose (3 spins, slip mean 45°), 30.7 bar (chain 7.28), 28.7 lock. Eight: 45-52 km/h, three of four runs stopped early. Hairpins: lock fastest, 34.4 s against 36.0, but `yawover` 6.05; bar held 15.0 s, chain 6.92 | Partly. Bar's "can hold more, more control" matches held +10 s. But hb share fell from 0.138 to 0.062 and `rev` doubled, so half of that gain is how it was driven. Lock's "still can't turn in more" matches the sim's zero delta (cause below) | drop all three mods as fixes: none touches the cause. Retest as r2 with the levers below |
| t3a-sturm-power | 0-100, owner: 3.40, 3.38, 3.29, 3.26, 2.75; sim: 3.46, 3.38, 3.32, 3.29, 2.75. Runway seg: 9.68, 9.38, 9.11, 8.87, 8.28 s, so supercharger -3%, turbo -6%, twin -8%, top -14% | yes: "difference between the 3 boosts is nothing crazy, just the pull when shifting". `worth` is no or unsure on every engine | tune: the three engine stages sit too close to tell apart. Space them out or ship fewer. Keep the carbon shell: 24.9 s on the pins against 25.6, "more stable" |
| t3b-sturm-grip | Pad ring-mean g: best 0.983, slicks 1.08 (+10%), top 1.20 (+22%). Sim: 1.15, 1.24 (+8%), 1.33 (+16%). `us`: 1.90, 1.62, 1.56. Sweep r200 seg: 8.65, 8.57, 7.54 s | yes: "way better grip". "How much more I can turn" is the `us` drop | promote the top bundle. Best-stock is not worse than before: the sim gives 1.15 g, above the Sturm's stock band of 0.94-1.00. The top tier is a bigger step than any tier under it, and that step is what the owner noticed. Best's grip 3 also includes a 21° slide on lap 1 (slip peak 21.3, held 0.79), which is the driver |
| t3c-raijin | g mean 1.03 to 1.23 (+19%), sim +18%. 0-100 3.48 to 2.55, sim 3.48 to 2.54 | yes: "noticeably faster and still preserving good grip". No sim shows the braking slide on pad-top (pred 3) | promote |
| t3d-kaze | g mean 0.962 to 1.20 (+25%), sim +16%. 0-100 4.55 to 3.83, sim 4.55 to 3.82. Pins-top `pwr` 9.74 against 7.02. Sim power-on (TCS on): 1.43 against 1.44 | yes: "more rotation, wants to slip when speeding out of corner, not a bad thing". The sim does not see the exit slip with TCS on, and the aids are unknown | promote. The Kaze is the drifter, so exit slip is its character |
| t3e-muscle | g mean 1.00 to 1.16, sim 1.07 to 1.24. 0-100 4.23 to 3.66, sim the same | yes: "def faster but preserves the character" | promote |
| t4-sajin (tall cog vs today) | Dirt hairpin seg: tall 28.8 s, today 26.6. Tall slip peak 57° and `yawover` 1.53; today 5.9° and 0.017. Pad: tall held 7.57 s, `lift` 25.6°; today 0.84 s, 10.7°. Sim lift-off: tall 24.1°, today 21.3°, both outside the 10-16 band. r120 lift: today is faster (seg 7.61 against 8.16, ring 94 against 91 km/h), but `us` 3.39 against 2.97 and `yawover` 1.41 against 0.10 | yes: today is "easier to turn but doesn't feel as soft as a buggy", and r120 "had to let go of gas, too stiff". The pad snap is mostly the car: the sim gives today 21° on a plain lift | keep today's cog. It is faster on every lane, and `pitch` on the kicker is 0.78 rad/s against 1.21. Tune: softer springs and dampers on today's cog for the buggy feel, and bring the lift-off snap toward the 10-16 band |

### Themes

| theme | packs | metric that backs it | car or driver |
|---|---|---|---|
| drift: "can't turn in more" | t2, every trial | lock*1.25 moves the owner's `us` from 2.58 to 2.85 and moves the sim not at all | car: slip caps how far the fronts reach into a drift, `lock` does not (below) |
| drift: "auto-corrects me out", "losing speed", rear not pushing | t2 circle-loose, eight-loose, eight-bar, hairpins-loose | The eight tops out at 45-52 km/h with `thr` at 0.86-0.92. Circle-loose spins 3 times, then grips. Owner: "most of the time it oversteered right away, but one time I got it and it felt like arcade drifting" | car: two regimes, below |
| "arcade drift mode" | t2 NOTE | Held drifts sit at one angle: circle slip mean 21.6-26.7° at `thr` 0.9+, with `rev` 0.3-0.7/s | car: the held-drift helpers |
| lift-off snap into a drift on pads | t1a asphalt (`lift` 24.4, band 3-6), t4 pad-tall (25.6) | Probe at the pad's speed, 50 km/h. Plain lift, steer 0.8-1, assists on: coupe 2.7-3.1°, sajin tall 21°, today 19°. Lift, then full gas at full lock, TCS on: coupe 3.2°, sajin 3.6-4.9°. The same with TCS off: coupe 26.4°, sajin tall 24.8°, today 31.6°, kaze 27-28°, muscle 33-34° | Sajin: the car, since a plain lift already gives 19-21°. Coupe: the owner's slide reproduces only with TCS off and the gas back on at full lock. That is how keys drive a pad: lock share 0.73, binary throttle. TCS was probably on, though: the owner's 0-100 matches the TCS-on sim within 0.06 s on all 13 runway runs (TCS-off 0-100 not run). If it was on, the coupe's pad slide comes from input the sim does not play (hb share 0.04). Unverified until the export carries the aids |
| launch wheelspin on every top tier | t3a-e straights: "only slipped on initial start", "the initial slip like they all have" | `spin` share/peak, best against top: Sturm 0.012/2.9 vs 0.041/8.3, Raijin 0.015/4.1 vs 0.027/7.8, Kaze 0.048/8.1 vs 0.086/12.8, Muscle 0.057/11.1 vs 0.086/18.1. 0-100 still drops by 0.6-0.9 s, so the spin costs no time | car: traction control acts only above 1 m/s (`src/car/car.ts:487`) and then cuts at 9/s (`:506`). The first ~0.1 s runs at full torque, and the twin turbo's extra torque makes a bigger flare |
| Sajin tall loses the buggy feel, today too stiff on the long turn | t4 | see t4 above | car: tune today's setup, do not go back to the tall one |
| top tiers clearly better, best-stock grips worse | t3b NOTE | +16-22% ring g, `us` 1.9 to 1.56 | as designed: the gap is the slicks (mu*1.24) plus downforce*6. Best-stock sits above its band, not under it |

### The drift theme in the code

With assists off and TCS on, a rear-drive drift runs in one of two regimes, and each matches a note. (t2 turns assist and stability off; TCS comes from the player's settings.)

1. **No hold (most entries).** A hold starts only from a launch from rest, or from a handbrake tap at full key with the gas past 0.9 (`src/car/steering.ts:256`, `:263`, `:273`).
   - A drift thrown by lift, power or a flick has `hold_side` 0, so `drift_steer` is 0 (`steering.ts:285`).
   - Traction control then runs its road limit of 0.14 slip. Under 54 km/h it also counts the driven rears' sideways slip (`car.ts:491-499`, `TCS_LATERAL` `:43`).
   - Past about 0.9 of the peak slip angle at the rear, TCS cuts the gas toward its 0.15 floor (`car.ts:505-508`).
   - The rear stops pushing, so the car loses speed and grips up. That is "losing speed", "auto-corrects me out" and "the baseline just slid out". It also explains why circle-loose spun three times, then gripped.
2. **Held drift (handbrake-tap entries).** Four helpers switch on:
   - A 4/s damper on the swing of the slip angle (`DRIFT_DAMP`, `car.ts:58`, applied at `:642-648`).
   - Rear side grip pulled 80% of the way back to peak while sliding (`DRIFT_REAR_BITE`, `tyre.ts:11`, `:222`).
   - Wheelspin past 2x peak stops costing rear side grip (`DRIFT_SIDE_SX`, `car.ts:69`, capped at `:582-583` and `tyre.ts:170`).
   - The fronts held to 1.1 peak angles past their course (`USEFUL_SLIP`, `steering.ts:37`).

   The damper holds the angle where it is, and the side-grip cap stops more gas from swinging the tail wider. Together they are the "arcade drift mode".

In both regimes the steering also caps how far the fronts turn into the slide:

- Below 57.6 km/h, `aim` clamps the wheel to the front axle's course ± `USEFUL_SLIP * peak_angle + lock * fade` (`steering.ts:300-313`). On the 20 m ring at 42-45 km/h (12 m/s), `fade` is about 0-0.1, so the `lock * fade` part adds almost nothing.
- Above that speed, `drift_bite` makes a front held past useful slip act as if it sat at useful slip (`tyre.ts:173-178`).

At every speed, then, the fronts reach about 1.1 peak angles past their course into a drift, whatever `lock` is. That is why lock*1.25 moved nothing, in the sim or for the owner. Turning in more has to come from the rear, and the side-grip cap and the damper take exactly that away.

Candidate changes, lightest first:

| # | change | weight | lab test |
|---|---|---|---|
| A | No code. Drive t2 again with `aids: { assist: false, stability: false, tcs: false }` beside today's TCS on. TCS off sets `drift_steer` to 0 (`steering.ts:285`), so both the TCS cut and the hold helpers drop out and the car runs on its tyres | a pack revision only | t2 r2 on the circle and the hairpins: stock with TCS on against TCS off, asking turn-in, hold and exit (`trait_asks`). Read `held`, `chain`, ring speed, `top` (no speed loss means the gas gets through) and `rev`. If TCS off is the drift the owner wants, the fix belongs in traction control, not in the tyres |
| B | Make the hold helpers `CarSpec` fields, defaulting to today's values: `drift_damp` (4), `drift_rear_bite` (0.8), `drift_side_sx` (2) and `drift_reach` (`USEFUL_SLIP` in a held drift, 1.1). This is a car-physics task first: handling golden, `car.test.ts`, telemetry and feel all byte-identical | four fields, no behaviour change | t2 r3, 3-4 trials on the circle and the eight: `drift_damp*0.5`, `drift_side_sx*2` (gas swings the tail again), `drift_reach*1.6` (turn in more). It needs a new sim scenario, "turn in mid drift": hold a 30° drift at 50 km/h, step the key further into the turn, and measure the yaw-rate gain and the radius change over 1 s, plus the speed lost over 5 s of held drift. `catch_drift` cannot see any of this today |
| C | Start the hold on any rear-drive slide past about 15° with the gas held, not only on a launch or a handbrake tap. TCS then opens to `HELD_TCS_SLIP` (`car.ts:50`) in every drift | changes when the drift code engages for every RWD car, so it reaches career and races | after B: t2 hairpins and eight with lift and power entries, no handbrake. Then `lab.ts gate muscle` and `races.ts --changed`, because every RWD car's drift behaviour moves |

Other levers this round points at:

- **Launch.** `launch_rpm` is a `CarSpec` field, so `add: { launch_rpm: -n }` on the top-tier cars is a pack, not code. If that is not enough, let TCS act from rest (`car.ts:487`). Check that against the launch power slide (`launch_side`, `steering.ts:259-263`), which relies on wheelspin from rest.
- **Sajin.** One t4 r2 on today's cog: `spring*0.85 damper*0.85`, then `rear_grip+0.03` for the lift snap. Run it on the kicker, dirt hairpins, pad and r120. Read `lift` (band 10-16), `pitch`, and `us` on r120.
- **Engines.** Respace the supercharger, turbo and twin so their runway segs sit about 4% apart; today they are 3%, 6% and 8% under best.

### Lab text: what to cut

The owner's note: "maybe just the info on what it is and what I need to do is just too much text and hard to decipher". Today a drift-circle results card shows three lead lines, six questions and about 21 numbers.

- **Numbers on the card** (`shown_metrics`, `src/lab/lab-text.ts:100`): keep 3-5 per station and leave the rest to the export. Replace the `at` station lists with one short `CARD` list per station:

  | station | numbers on the card |
  |---|---|
  | skidpad | laps, average g, ring speed, slide peak/average, time drifting |
  | drift, eight | time drifting, longest drift, spins, ring speed |
  | hairpin, slalom | start to finish, times off the lane, slide peak |
  | sweeper | start to finish, average g |
  | runway | 0-100, start to finish, top |
  | kicker | airtime, bounces, landing |

- **Off the card for good:**
  - the input shares (`lock`, `thr`, `hb`, `rev`): they are the lead's check on the driver, not something the driver needs
  - every scenario-derived key: `yawover`, `us`, `pwr`, `lift`, `trail`, `entry`, `lag`, `xslip`, `bdev`, `pitch`, `yawsd`
  - `spin`: "4% / 8.25x" means nothing to a driver
- **`latg`:** show only the average, labelled "Cornering g". The peak reads 2-4 g in a slide and invites the wrong question.
- **Lead block** (`ResultCard.svelte`):
  - drop the question line, since the brief already showed it
  - shorten "Compared with #3 circle-stock" to "vs #3"
  - cut the default baseline question (`default_question` in `brief.ts`) to "As it ships"
- **Questions:**
  - drop t3's `worth` (no or unsure on every trial that answered it) and t4's `char` (unsure on every trial that answered it): neither gave a signal
  - use `trait_asks` (2-3 scales plus the note) instead of the grip/pred/fun/drift/vs set, which runs to six rows on a drift station
- **Brief changes:** cap the list at three rows plus "and n more". A mod that matches no part spells out every field, and on a top-tier lab car that runs past a dozen lines.

### Next

1. Put the player's effective aids on the `#trial` line: TCS, assist, stability and steer mode. Until then no pad or exit slide can be split into driver and car.
2. Run t2 r2 with TCS on against TCS off (lever A). It costs no code and shows whether the drift fix belongs in traction control or in the hold helpers.
3. Make the lab-text cuts above before the next session.
