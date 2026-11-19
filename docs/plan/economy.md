# Economy: credits, prices, payouts

One table for what credits buy and what races pay, before P1 (shop) and P2 (parts cost credits). Owner decisions are in the quest `2026-11-18-series-frame-cups-unlocks.md` ("Decided" 2026-11-18 and 2026-11-19). Credits are earn-only and never sold (`docs/plan/backend-vercel.md`). Frames come only from cups. Credits buy a frame's extra bodies, performance parts, and paints / decals / neon.

Note: `progression-research.md` said "do not add currency" and "no part unlock grind". The owner overrode that on 2026-11-19. This doc keeps the research's guard rails where they still fit: first clears pay most, no farmable short loop, nothing a session must grind to play.

Numbers marked *est.* are not measured. Race length is the research target (~3 min a race, ~4 min with menus), not a timing.

## 1. Earning

### Today

Only the Series pays (`src/career/credits.ts`, `series-store.ts`). Career, Runs, free race, P2P and the lab pay nothing.

- Race credits = series points x `CREDITS_PER_POINT` (100), x `FINAL_FACTOR` (2) on a final.
- Points by place (`POINTS`): 10, 8, 6, 5, 4, 3, 2 for P1-P7 in race, knockout, endurance; a duel pays 10 / 4.
- Bonuses (`BONUS_POINTS`): clean +2, led at halfway +1, fastest lap +1 (endurance only), won from the back +2.
- Every finish pays, a retry too (comment G1: a player short of class can grind).
- Season reward credits pay once, on round 0. A replay round pays race credits only.
- No class scaling: a C season race pays what an A season race pays.

| Result | Race | Final (x2) |
|---|---|---|
| P1 clean, led | 1,300 | 2,600 |
| P1 plain | 1,000 | 2,000 |
| P3 clean | 800 | 1,600 |
| P3 plain | 600 | 1,200 |
| P7 | 200 | 400 |
| Duel win clean, led / duel loss | 1,300 / 400 | - |

| Series | Class cap | Events | Race credits, all P1 clean+led | Reward |
|---|---|---|---|---|
| S1 Island | C | 6 | ~9,100 | Sajin + 5,000 |
| S2 Alpine | B | 6 | ~9,100 | Rally + 7,500 |
| S3 Dunes | B | 6 | ~9,100 | Sturm + 10,000 |
| S4 Mainland | A | 6 | ~9,100 | Formula + 15,000 |
| Rally Trial (cup) | B (loaner) | 3 | ~5,400 | Rally frame + 0 |

Per hour today, at 15 races an hour *est.*: an average driver (~8 points a race, a final one race in six) makes ~14,000 cr/h; a strong one (~13 points) ~22,700 cr/h. The same in every class. Rerunning the one shortest event pays the same rate forever.

### Proposed

Target: ~30 min a day buys one meaningful part (3-9k) every session and a body (15-25k) every 2-3 days.

| Change | Value | Why |
|---|---|---|
| Class factor on race credits, by the season's cap | C 1.0, B 1.2, A 1.5, S1 1.8 | Harder fields pay more; a cup uses its loaner's class |
| Rerun of an event you already podiumed (`progress.results` holds it) | 50% | Kills the one-event farm. Uses state that exists; no day counter. A retry before the first podium still pays full (keeps G1) |
| Replay rounds (`round > 0`) | race credits x(1 + 0.25 x round), max x2 | Replays are the intended repeat loop: new seeds, bolder field |
| Replay round finished | 25% of the season reward | A reason to run a round to its end |
| Cup first clear | 3,000 + the frame | Rally Trial pays 0 today |
| Cup rerun | race credits only, rerun rule above | Cups are short; no farm |
| Daily first podium | +2,000, once per UTC day, any series or cup | One per session, not a chore list |
| Runs | 150 per new season star (already capped by `FREE_CAP`) | Small; Runs stay about stars |
| Career, free race, P2P, lab | 0 | P2P can loop on BroadcastChannel; Career keeps its cosmetics |

Per hour, proposed, average driver *est.* (fresh events; reruns at 50% cut it by up to half):

| Class | Per race avg | Per hour | 30 min + daily bonus |
|---|---|---|---|
| C | ~930 | ~14,000 | ~9,000 |
| B | ~1,120 | ~16,800 | ~10,400 |
| A | ~1,400 | ~21,000 | ~12,500 |
| S1 | ~1,680 | ~25,200 | ~14,600 |

## 2. Prices

### Parts

Flat per part, the same on every car (recommended; see decision D2). A part is bought once per car and used everywhere you drive that car. Stock parts are free. Brake bias is a setting, not a part: all three free. Soft suspension is a sidegrade of stock Sport: free.

| Slot | Part (index) and price |
|---|---|
| Engine | Stock (0) free, Tuned (1) 2,000, Race (2) 4,000, Supercharger (3) 7,000, Turbo (4) 9,000, Twin turbo (5) 14,000 |
| Tyres | Street (0) free, Sport (1) 1,500, Semi-slick (2) 3,500, Rally (3) 2,000, All-terrain (4) 1,500, Mud-terrain (5) 2,000, Slicks (6) 6,000 |
| Aero | None (0) free, Lip (1) 1,000, Wing (2) 2,000, Street kit (3) 3,500, Race kit (4) 5,000, GT kit (5) 8,000 |
| Suspension | Soft (0) free, Sport (1) free, Race (2) 2,500, Drift (3) 2,500, Lifted (4) 1,500 |
| Brakes | Stock (0) free, Sport (1) 1,500, Race (2) 3,500 |
| Weight | Stock (0) free, Light (1) 2,000, Stripped (2) 4,000, Carbon shell (3) 9,000 |
| Brake bias | all free |
| Nitro | None (0) free, Small tank (1) 3,000, Big tank (2) 6,000 |

Every part on one car: 107,500. The top-PI build (Twin turbo, Slicks, GT kit, Race brakes, Carbon, Big tank): 46,500. Higher parts don't need lower ones first: buying Twin turbo straight is fine.

### Bodies

Only three extra bodies exist today: Kaze (coupe frame), Orkan (muscle), Hagel (rally). Priced by frame tier so later bodies slot in.

| Frame tier | Frames | Extra body price |
|---|---|---|
| Starter | hatch, coupe, tsumuji | 15,000 (Kaze, buyable from the start) |
| Cup | rally, muscle, sajin | 25,000 (Hagel, Orkan) |
| Top cup | sturm, raijin | 35,000 |
| Formula | formula | 50,000 |
| Legend / free | fujin, bus | not for sale: Fujin is the Legend reward, Bus is free |

The cup gives the frame and its first body. A body is buyable only when its frame is owned.

### Cosmetics

Bought once, account-wide (any car).

| Item | Free | For sale | Not for sale |
|---|---|---|---|
| Paint | the 7 `car_paints` brand colours | finishes over any base colour: Satin 3,000, Metallic 5,000, Pearl 8,000 (new, see P1b) | the 5 tier metals (Career) |
| Decal | none, centre, twin, side, number | flames, slash, checker, rabbit: 2,000 each | sky, volcano, ice, dunes, velodrome (Career) |
| Neon | none | Pool 4,000, Ring 6,000; a style opens all `NEON_TONES` | - |
| Ink, number | all | - | - |

Totals: bodies today 65,000; cosmetics 34,000 (finishes 16,000, decals 8,000, neon 10,000).

## 3. Progression curve

PI numbers below are from `rating()` on master 4b7424a, cheapest build at the class ceiling with the prices above (brute force over every part combination, bias and Soft excluded).

| Goal | Cost | Hours at B rate *est.* | Days at 30 min |
|---|---|---|---|
| Rally (510 B) to 599, top of B: Race engine + Slicks | 10,000 | 0.6 | 1 |
| Coupe (538 B) to 599 | 8,000 | 0.5 | 1 |
| Hatch (406 C) to 499, top of C | 12,000 | 0.7 | 1-2 |
| Hatch to 599 (B) | 25,000 | 1.5 | 2-3 |
| Rally to 699 (A) | 25,000 | 1.5 | 2-3 |
| Sturm (571 B) to 799 (S1) | 29,500 | 1.8 | 3 |
| Any B car to its top PI (Rally 799) | 46,500 | 2.8 | 5 |
| Every part on one car | 107,500 | 6.4 | 11 |
| All 3 extra bodies | 65,000 | 3.9 | 7 |
| All cosmetics | 34,000 | 2.0 | 4 |
| Top-PI build on all 14 bodies | 651,000 | ~39 | long tail |

Frames: six cups, 3 rounds each, finish any place. ~12-15 min a cup *est.*, so every frame in ~1.5 h of racing. Fujin needs the Legend Career tier.

So frames come first and fast (the research's "frame unlocks concentrated early"), a class-ready build costs one or two sessions, a body costs a few days, and maxing every car is the long tail nobody has to finish. Open Cups need one car tuned to the cap, which is 8-25k: one to three sessions. That's the pace: the first Open Cup entry is reachable on day 1-3, not gated behind a week.

## 4. Sinks vs faucets

| Faucet (per average hour, B) | cr | Sink | cr |
|---|---|---|---|
| Fresh series events | ~16,800 | Class-ready build per car | 8-25k |
| Reruns of podiumed events | ~8,400 | Top-PI build per car | 46,500 |
| Daily first podium | 2,000/day | Bodies | 65,000 |
| Season / cup first clears | 3k-15k once each | Cosmetics | 34,000 |
| Runs stars | ~1-2k/day | | |

Lifetime one-off faucets (season rewards 37,500 + four cups at 3,000) cover about one top-PI build. The rest comes from racing.

Anti-grind:

- **Rerun at 50% once podiumed.** Cuts the shortest-event loop in half and steers players to replay rounds, which pay more.
- **Daily first podium, not daily tasks.** One bonus, no checklist (research: no chore lists).
- **No pay for P2P or free race.** Two tabs on BroadcastChannel would print money.
- **No per-day cap.** Caps punish the one long weekend session; the rerun cut already bounds the farm.
- **Replay rounds scale up to x2,** so the repeat loop with the hardest field is the best-paying one.

If playtests show money piling up unspent, the lever is part prices (one table), not payouts.

## 5. Existing garages and PI caps

No real players yet (owner), so no migration worth code. Two options:

- **A: grant what's fitted (recommended).** On the first P2 load, every part fitted on a saved garage build of an owned car is granted once, then the flag is set. One pass, a few lines, and the owner's own test garage keeps working.
- **B: reset.** Owned = stock only, credits kept. Simplest, but every saved build and preset reads as locked.

Either way: `DEFAULT_BUILD` fits the Wing (`aero: 2`) on the hatch while `DEFAULT_PARTS` has `aero: 0`. A new player's hatch then has a part they never bought. Grant the starter Wing on the hatch in `fresh_wallet`, or drop it from `DEFAULT_BUILD`.

PI caps and where ownership is checked:

| Build source | Ownership checked |
|---|---|
| Player's own garage build in a season or Open Cup under a cap | yes: every fitted part must be owned |
| Cup loaner (`loaner_code`), lab (`?lab=`), run built pick, P2P room loaner, `?event=` dev | no |
| Preset or a pasted build code on an owned car | shows the missing parts and their total, with a Buy all |
| Free race / P2P with own car | yes, same as garage |

Put the exemption on the source, not in shared code: a mode or run that hands a build marks it a loaner. An `if (mode === …)` in the garage would break the "data over special cases" rule.

## 6. Data shape and slices

### Data

- **`src/career/prices.ts`**, one pure module: `PART_PRICES: { [S in Slot]: readonly number[] }`, `FRAME_TIER: Record<FrameId, FrameTier>` and `BODY_PRICE: Record<FrameTier, number | null>`, `DECAL_PRICE`, `NEON_PRICE`, `FINISH_PRICE`, and the payout constants (class factor, rerun share, round bonus, daily bonus). A test asserts each `PART_PRICES[slot]` has the length of `SLOTS[slot].parts` and stock is 0. The `Record` over `FrameId` makes a new frame without a tier a type error.
- Alternative: a `price` field on `Part` in `SLOTS`. The compiler then catches a missing price, but it puts the economy in the physics module. Prefer one module.
- **Wallet** (`wallet.ts`): `cars` already holds owned bodies (`CarId`), so bodies need no new field; a frame is owned when any of its bodies is. New fields, all parsed as untrusted:
  - `parts: Partial<Record<CarId, Partial<Record<Slot, number>>>>`: a bitmask per slot, bit i = part i owned, stock implied.
  - `cosmetics: readonly string[]`: `decal.flames`, `neon.ring`, `finish.metallic`; unknown ids drop on load.
  - `bonus_day: string`: the UTC day the daily bonus last paid.
  - `buy(item, price)`: checks credits, then deducts and adds in one `set`. Never two writes.
- `event_credits` takes the class factor, rerun share and round from `prices.ts`; `series-store.ts` passes "already podiumed" and the round.
- Backend later mirrors the same shape (`backend-vercel.md` row "Owned frames, bodies, parts, cosmetics").

### Slices

| Slice | What | Effort *est.* |
|---|---|---|
| P1a payouts | `prices.ts` payout half, class factor, rerun 50%, round bonus, cup 3,000, daily bonus, Runs stars; tests on `event_credits` | 0.5 day |
| P1 shop | wallet `cosmetics` + `buy`; garage body picker shows locked bodies with price and Buy (frame owned); decal and neon pickers lock paid items; buy confirm sheet; `ui/` component for a price chip | 1.5-2 days |
| P1b finishes | paint finish as new build field or paint index range, model material per finish, build code append; skip if P1 lands without it | 1-1.5 days |
| P2 parts cost | wallet `parts`; garage part cards show price / Owned / Buy; ownership check on cap entry; loaner flag on mode/run/lab/room builds; preset Buy all; migration A | 2-3 days |

P1a can land before P0's cup ships; P1 needs P0's frame grant to make "frame owned" real.

## 7. Open decisions

| # | Decision | Options | Pick |
|---|---|---|---|
| D1 | Parts owned per body or per frame | per `CarId` (owner's words) / per frame (Orkan shares Muscle's parts) | **Per body.** Matches "per car" and the build's `car` field. Per frame is kinder but cuts the biggest sink |
| D2 | Part prices flat or scaled by car class | flat / x stock class | **Flat.** One table, readable; better cars are already gated by cups |
| D3 | Seasons still hand out frames (Sajin, Rally, Sturm, Formula) | keep both paths / seasons pay credits instead once that frame's cup ships | **Credits instead** (S1 8k, S2 12k, S3 15k, S4 20k): "frames only from cups" |
| D4 | Rerun pay | 50% once podiumed / per-day decay / full | **50% once podiumed.** Uses stored results, no new state |
| D5 | Daily bonus | first podium +2,000 / none | **+2,000.** One a day, no task list |
| D6 | Existing garages at P2 | A grant fitted / B reset | **A**, plus grant the hatch's starter Wing |
| D7 | Paint finishes in P1 | ship in P1 / P1b / no paint sales | **P1b.** Decals and neon carry P1; finishes need a build code change |
| D8 | Free decals | keep all 9 current free / sell 4 | **Sell flames, slash, checker, rabbit.** No players lose anything today |
| D9 | Runs pay credits | 150 per star / none | **150 per star.** Small, already capped |
