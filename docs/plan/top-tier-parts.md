# Top-tier parts

Quest `top-tier-parts`: road cars stop at S1 (Sturm 710) or A. The goal is new parts past today's best so every road car has a path to at least S2, while Formula and Fujin keep X. Phase 1, this doc: the candidate parts as lab-only definitions (`src/lab/cars/top-tier.ts`), the packs that drive them (`?lab=t3a-sturm-power` to `t3e-muscle`), the ratings they reach, and what promoting them needs. Nothing here touches `car.ts` or `SLOTS`.

## Why it takes big parts

PI is `960 * ln(lap speed / 21 m/s)` on the reference lap (`src/car/pi.ts`). S1 to S2 is 100 PI: about 11% faster round the lap. Kaze from 644 to 800 needs 18%. Corner speed grows with the square root of grip, and power is traction-limited at low speed, so 18% of lap speed needs roughly double the torque, +24% tyre grip, -24% mass and well past the race kit's downforce, all at once.

Every part is a per-slot `Mod` that scales the same for every car, so the spread between cars stays: Sturm stays about 70-85 PI above Kaze at every tier. A full top build that lifts Kaze to 800 lifts the Sturm to 887. The numbers below are tuned to that window: the weakest of the four tested cars just into S2, the Sturm short of 900, so X stays Formula and Fujin's.

## The parts

Each replaces its slot's pick (it does not stack on Race or Semi-slick). The slot index is where it would land in `SLOTS`, appended.

| Part | Slot, index | Mod | Rating alone on Sturm (best 710) |
|---|---|---|---|
| Supercharger | engine 3 | torque x1.5, redline and upshift +600, +35 kg | 732 |
| Turbo | engine 4 | curve: no boost below 2500 rpm, smooth ramp to x1.7 at 4500; redline/upshift +700, +40 kg | 751 |
| Twin turbo (intercooler and ECU tune in it) | engine 5 | curve: from 2000 rpm, x2.0 at 3600; redline/upshift +800, +55 kg | 774 |
| Slicks | tyres 6 | mu x1.24, grip_dirt and grip_grass x0.8, offroad -1 (the limit) | 741 |
| GT kit | aero 5 | downforce x6, drag +0.26, rear_grip +0.08, aero_front +0.04, +18 kg | 748 |
| Carbon shell | weight 3 | mass and inertia x0.76, cog +0.04 | 742 |

Compared with today's top part: Race engine x1.3, Semi-slick mu x1.12, Race kit downforce x3.6 / drag +0.17, Stripped mass x0.9.

Turbo curves follow the lab rule (docs/lab.md, "Boost curves"): a lab car per car and stage carries the stock torque table resampled every 500 rpm and multiplied by the boost (`boosted` in `top-tier.ts`); the stage's mass and revs are its `Part` mod. The supercharger is a flat scale, so it is a plain mod.

## PI each car reaches

All columns keep today's best in the other slots (race suspension, race brakes, balanced bias, big nitro). "Full" is twin turbo, slicks, GT kit and carbon shell together; "SC full" the same with the supercharger in place of the twin turbo.

| Car | Best today | Supercharger | Turbo | Twin turbo | Slicks | GT kit | Carbon shell | SC full | Full |
|---|---|---|---|---|---|---|---|---|---|
| hatch | 529 B | 550 B | 567 B | 587 B | 550 B | 536 B | 556 B | 615 A | 667 A |
| coupe | 674 A | 696 A | 715 S1 | 738 S1 | 704 S1 | 709 S1 | 706 S1 | 802 S2 | 844 S2 |
| muscle | 668 A | 690 A | 709 S1 | 733 S1 | 696 A | 688 A | 697 A | 773 S1 | **814 S2** |
| rally | 645 A | 663 A | 681 A | 702 S1 | 673 A | 675 A | 674 A | 762 S1 | 796 S1 |
| kaze | 644 A | 665 A | 684 A | 707 S1 | 674 A | 673 A | 674 A | 765 S1 | **803 S2** |
| sturm | 710 S1 | 732 S1 | 751 S1 | 774 S1 | 741 S1 | 748 S1 | 742 S1 | 838 S2 | **887 S2** |
| raijin | 651 A | 673 A | 692 A | 715 S1 | 681 A | 679 A | 681 A | 769 S1 | **808 S2** |
| tsumuji | 535 B | 554 B | 572 B | 593 B | 562 B | 548 B | 559 B | 625 A | 674 A |
| sajin | 596 B | 617 A | 634 A | 654 A | 621 A | 605 A | 619 A | 678 A | 715 S1 |
| formula | 991 X | 999 X | | | | | | | 999 X |
| fujin | 999 X | | | | | | | | 999 X |
| bus | 255 D | 273 D | 225 D | 284 D | 275 D | 258 D | 277 D | 314 D | 327 D |

Read off `resolve_pack` / `spec_pi`. The bus's turbo rates below stock: its revs never reach the spool and the 40 kg stays.

Not at S2 with every part: rally (796, 4 short), hatch, tsumuji and sajin (A to S1). Uniform parts cannot close that gap without lifting the Sturm into X. Options for the owner: accept S2 for the five strongest road cars only; give the weak cars their own top stage (a per-car field the part reads, data on the car, not an `if` in shared code); or move the class floors, which re-rates every car and every class-capped event.

## What the sim says

`scripts/pi.ts`' `measure` drove each distinct trial spec on flat ground (full throttle, a stop, skidpads at 60 and 140 km/h) and lapped the reference circuit on the measured pace:

| Trial | PI | Stat lap s | Sim lap s | Sim / stat | 0-100 s | Lat g 60/140 | Top km/h |
|---|---|---|---|---|---|---|---|
| sturm best | 710 | 69.7 | 77.6 | 1.113 | 3.46 | 0.66/1.27 | 288 |
| sturm slicks | 741 | 67.5 | 76.6 | 1.134 | 3.19 | 0.67/1.36 | 288 |
| sturm supercharger | 732 | 68.2 | 76.2 | 1.117 | 3.38 | 0.66/1.28 | 299 |
| sturm turbo | 751 | 66.8 | 75.0 | 1.122 | 3.32 | 0.67/1.28 | 306 |
| sturm twin turbo | 774 | 65.2 | 73.6 | 1.128 | 3.31 | 0.67/1.27 | 317 |
| sturm carbon shell | 742 | 67.4 | 75.4 | 1.119 | 3.28 | 0.67/1.34 | 295 |
| sturm GT kit | 748 | 67.0 | 76.2 | 1.137 | 3.38 | 0.67/1.44 | 256 |
| sturm full | 887 | 58.0 | 68.4 | 1.179 | 2.74 | 0.68/1.60 | 284 |
| raijin best / full | 651 / 808 | 74.1 / 63.0 | 80.7 / 72.3 | 1.088 / 1.147 | 3.48 / 2.54 | 0.66/1.20, 0.67/1.48 | 252 / 256 |
| kaze best / full | 644 / 803 | 74.7 / 63.3 | 82.4 / 74.1 | 1.103 / 1.171 | 4.55 / 3.82 | 0.65/1.21, 0.66/1.48 | 259 / 281 |
| muscle best / full | 668 / 814 | 72.8 / 62.6 | 79.6 / 71.9 | 1.093 / 1.149 | 4.23 / 3.66 | 0.68/1.16, 0.69/1.43 | 288 / 292 |

- The sim laps every build about 10% slower than the stat lap today, and the gap grows to 15-18% on full builds: the rating overrates the top tier by 5-7% of lap speed, 45-65 PI. On sim pace the full Kaze drives like a 745, the full Sturm like an 830. A full build that rates S2 drives like a high S1. Worth knowing before the lab session; the owner's "worth the class jump" answers are the check.
- Lateral g at 60 km/h barely moves with any part (0.65-0.69, slicks included): either the 60 km/h skidpad measure is limited by something other than tyre grip (the steer sweep tops at 0.45) or the sim's low-speed grip saturates. Check before trusting slicks' 31 PI: the lab skidpad's `latg` on `sturm-pad-slicks` against `sturm-pad-best` answers it.
- 0-100 stays traction-limited: twin turbo against best is 3.31 against 3.46 s on the Sturm. Slicks and the shell help the launch more than boost does.
- The GT kit's drag costs the full Sturm 30 km/h of top speed against the twin turbo alone; downforce wins it back in the 140 km/h sweeper.

## The pack

33 trials in five sessions under the lab caps, built in `src/lab/packs/top-tier.ts`: `t3a-sturm-power` (9), `t3b-sturm-grip` (6), `t3c-raijin`, `t3d-kaze`, `t3e-muscle` (6 each). The Sturm takes each part on its own where it shows: skidpad (best, slicks, full), runway (best, supercharger, turbo, twin turbo, full), hairpins (best, twin turbo, carbon shell, full), the r = 200 sweeper (best, GT kit, full). Raijin, Kaze and Muscle go best then full on the skidpad, the runway and the hairpins. Questions on every trial: grip, power, predictability, fun, vs last trial, worth the class jump, note. One list for all: per-trial lists put the pack past an inline code's 32 000 characters.

Turbo trials drive lab cars `lab:<car>-twin` and `lab:sturm-turbo`: stock engine, tyres, aero and weight plus race suspension, race brakes and big nitro, with the trial's mods supplying the rest. Their bodies draw without the race kit or slicks, since a lab car draws its `parts`, not its mods.

## Promotion

| Need | Where | Notes |
|---|---|---|
| Six parts appended | `SLOTS` in `src/car/build.ts` | engine 3-5, tyres 6, aero 5, weight 3: every slot stays under 10, codes stay one digit per slot, old codes read as before. `build.test.ts`, `pi.test.ts` |
| Turbo curves as a part | `build.ts` `Derived` + `apply_mods` | a `Mod` scales the whole curve only. Needs a boost shape on the mod (for example derived fields `boost` peak, `lag`, `spool` rpm that `apply_mods` uses to reshape `torque`). Default boost 1 keeps every existing spec bit-exact; `car.ts` is untouched. A schema change on `Mod`: the owner's call. Otherwise ship turbos as flat scales and lose the lag |
| Looks | `Look` in `build.ts`, `models.ts` | slicks: tyre width 1.45 (Semi-slick is 1.32); GT kit: the race kit's wing 3 for now, a bigger wing is design work |
| Garage bars | `stat_range` | the bars' ends are the best and worst parts over every car, so new top parts move the high end and every car's bars shrink |
| Older peers | `net/car-packet.ts` | a code with a part index an older build does not have fails its `parse_build`; the peer gets no build (`b` undefined) and draws a default car. No crash; a `PROTOCOL` bump is not needed, but the look is wrong until they update |
| Release | `package.json`, `src/changelog.ts` | `feat:` minor bump, lead only |

Parts that need `car.ts`, a car-physics task with its own `car.test.ts` proof:

- **Race diff.** The sim has no differential: each driven wheel gets `drive * drive_share / wheels` and spins on its own, an open diff that splits torque evenly. A limited-slip or locking diff needs a coupling torque between left and right wheel speeds (and for AWD a centre coupling, today a fixed `awd_split`). Lock 0 must stay bit-exact. PI would not see it either: `stats()` has no traction term for it, so it rates 0 PI unless the lap model learns it. Not in the pack: no honest stand-in exists (t2-drift used a stiffer rear bar, which is a different thing).
- **Separate ECU and intercooler slots.** Folded into the twin turbo here. Each as its own slot would be one more tail digit in every build code that sets it; nothing in the sim makes them more than a torque scale, so as slots they would only split one part into three.

## Risks

- **Bots and career medians.** `scripts/career.ts` tunes each race event from bots built "as close under the class cap as one part swap at a time gets it", walking every part in `SLOTS`. Promoting the parts and re-running it changes the bot fields in S1, S2 and X caps (road cars reach S2 and crowd under 900): their medians move, so promotion re-tunes those events, or the bot search excludes the new parts. Until re-run, nothing moves: medians are committed numbers.
- **Class caps.** Under an A or S1 cap more cars come up close to the cap (a Kaze on the supercharger and slicks rates 694 where its best was 644), so a player's best time in a capped event can drop: those medians are the ones a re-tune moves most. An X-capped event now has road cars at 887 against Formula at 991: they still lose, which is the intent.
- **PI overrating** (above): S2 by rating, high S1 by sim pace. If the lab says the full builds feel S1, either the parts grow further (and the Sturm reaches X), or the rating learns the top tier (`scripts/pi.ts` fit with these builds in `EXTRA`).
- **Turbo lag is invisible to PI.** `stats()` reads peak power only, so the Turbo rates 19 PI over the Supercharger on the Sturm though it is softer below 3000 rpm. The hairpins trials are where that shows.
- **Off road.** Slicks sit at the `offroad` floor of -1 and lose 20% more on dirt and grass: a full build on a mixed-surface map is worse than today's best. Intended, but say so in the blurb.
- **Formula and Fujin** stay at 991-999; nothing here touches them.

## Next

1. Owner drives `?lab=t3a-sturm-power` to `?lab=t3e-muscle`, pastes each export.
2. Retune the part numbers from it (rev 2), decide the weak cars' path and the turbo-curve field.
3. Promote: parts into `SLOTS`, the boost field if chosen, looks, bot re-tune with `scripts/career.ts`, `bun scripts/races.ts --changed`, release.
