# Career and AI racers: answers

Round 1 · exported 2026-11-15 · 55 of 55 answered · questionnaire `harepin-career-ai-r1` · career-ai.html

Save this export as docs/plan/career-ai-r1.answers.md. Resolve every "You decide", read every note as an instruction, flag conflicts with docs/plan/career-redesign-research.md and docs/plan/ai-racers.md, list where the owner differed from the recommendations. Then write the decisions into both plan docs and quest 36cf211, draft the build order (B0 and AI phase 3 first), cut the first build quests, and ask round 2 only for blockers.

## 1. What we're fixing

**A1. Is the diagnosis right: the career lacks cars that race back, judged by position, in seasons that end?**
→ Yes, that's it _(recommended)_

**A2. What did you love most in GRID 2? Pick any.**
→ Racing a pack that fought back _(recommended)_
→ Seasons and the WSR finale _(recommended)_
→ LiveRoutes
→ Other: And honestly maps. Most cherished memory is from one of the japan races that has a steep road down that goes trough a tunnel where you feel like the car is almost lifting with the speed and decline and you have to handle the corners

**A3. What from DiRT 3 is worth taking?**
→ Bonus objectives inside an event _(recommended)_
→ Reward for not using rewind

## 2. Direction

**B1. Which direction?**
→ B, World Series, built from B0 _(recommended)_

**B2. What happens to today's 5 tiers and 45 events?**
→ Retire them
Note: maybe some legacy badge witht he level they achieved

**B3. Does the new career replace Career, or sit beside it?**
→ Replace it; old events move inside _(recommended)_

**B4. Name for the career unit (Runs already has a 28-day "season")**
→ Career "series", Runs keep "season" _(recommended)_

**B5. A name for the league / the career (player-facing)?**
→ Harepin Series

## 3. Season structure

**C1. How do events open within a season?**
→ Two or three open at once, final last _(recommended)_

**C2. Events per season, final included**
→ 6 events

**C3. The one progress number**
→ Other: i wouldnt add "fans" - fans is based that the whole game has a story. we dont have a story

**C4. What does losing the season final do?**
→ Retry the final; standings keep _(recommended)_

**C5. Can you replay a finished season?**
→ Yes, on a new seed with a stronger field _(recommended)_

**C6. Season order**
→ Island → Alpine → Dunes → Mainland → Sky final _(recommended)_

## 4. Racing and grading

**D1. How are races graded?**
→ Finish position; bonus fans for a clean race _(recommended)_

**D2. What counts as "winning" an event for progress?**
→ Podium opens the next event; win pays most fans _(recommended)_

**D3. Laps in a normal season race**
→ 3 laps

**D4. Target length of a race**
→ 4 min

**D5. Rewind in career races**
→ None, as today _(recommended)_

**D6. Contact penalty in a race with AI**
→ No time penalty; clean-race bonus instead _(recommended)_

**D7. Bonus objectives inside events (extra fans)**
→ Clean race (no contact) _(recommended)_
→ Lead a lap _(recommended)_
→ Fastest lap _(recommended)_
→ Win from the back of the grid

## 5. Event types

**E1. When does each event type arrive?**
- **First season:** Race; Knockout; Head to head vs the rival; Endurance
- **Later seasons:** Pass (mountain duel); Open road (live junctions)
- **Side event only:** Overtake rush (pass traffic); Today's solo modes (gymkhana, drift, jump…)

**E2. Open road: worth the route builder?**
→ Yes, after the first three seasons _(recommended)_

**E3. Pass (mountain duel): how strict on walls?**
→ No wall rule
→ Other: idk if i would want in ai races the adding time of any shape

## 6. Rivals, field and presentation

**F1. Rivals**
→ Whole field named; one rival per season _(recommended)_

**F2. Story and voice**
→ No narrator; one line per event in the standings _(recommended)_

**F3. Field size**
→ 6 AI + you _(recommended)_

**F4. Race presentation to build**
→ Grid start with lights _(recommended)_
→ Position and gap on the HUD _(recommended)_
→ Finish order card with fans earned _(recommended)_
→ Season table after each event _(recommended)_

## 7. Cars

**G1. Cars in main season events**
→ Your own car within a class cap
→ Other: only your own cars. if you cant compete yet since you dont have good enough class you need to grind for it

**G2. What the AI drives**
→ Your class, preset builds, no two alike _(recommended)_

**G3. Do season wins unlock cars?**
→ Yes: each season final unlocks a car or kit _(recommended)_

## 8. AI racers

**H1. Order: AI phase 3 and career B0**
→ AI in game first, then career
→ Other: yea definetly we need to prove we can build good ai for this . without it none of it is worth it

**H2. Race mode with an AI field: the dev ghost**
→ AI replaces the ghost when a field is on _(recommended)_

**H3. Catch-up (rubber-banding)**
→ Mild ±3%, off by default _(recommended)_

**H4. Difficulty**
→ Seasons get harder, plus one easy/normal/hard setting _(recommended)_

**H5. How aggressive should the field be?**
→ 3

**H6. How often should AI make mistakes?**
→ 3

**H7. Far AI on phones**
→ Cheap line follower when far and off screen _(recommended)_

**H8. How you test AI before it ships**
→ Lab trials on race worlds with a field _(recommended)_

**H9. Fix spins/resets and hard hits before AI goes in game?**
→ Yes, one tuning round first _(recommended)_

**H10. AI in Runs and online**
→ Career first; Runs later; online its own quest _(recommended)_

## 9. Performance: workers, WebAssembly

**J1. Performance plan for the AI field**
→ Whole sim in a worker, then ground-query wins _(recommended)_

**J2. One shared maths source so physics is identical in every browser?**
→ Yes, everywhere incl. worldgen

**J3. How far WebAssembly goes**
→ Also world generation

**J4. Cross-origin isolation (needed for SharedArrayBuffer)**
→ Avoid; post small messages instead _(recommended)_

**J5. If a sim worker is built, does solo driving use it too?**
→ Yes, one sim path for everything _(recommended)_

**J6. Target frame rate on your phone during a 6-car race**
→ 60 fps

**J7. Which phone should be the target device?**
→ samsung s24 plus - latest software

**J8. WebAssembly language**
→ Measure first: port the spike to Rust, compare with AssemblyScript _(recommended)_

**J9. Move the 3D rendering into a worker too (OffscreenCanvas)?**
→ Measure on phone after the sim worker, then decide _(recommended)_

**J10. Exact suspension raycast: ~30% off a car step, but physics moves by tiny amounts**
→ Yes, bundled with the shared-maths change (J2) so we re-record once _(recommended)_

## 10. How we build it

**I1. First playable milestone you want to hold**
→ One AI race in free play
→ Other: then season 1 island vs an ai field - as i said. first we need to prove that ai will work

**I2. How do you want to review it along the way?**
→ Lab packs + short builds after each step _(recommended)_
→ Other: but probably with bigger milestones - depending on if im there or not

**I3. Ship B0 to players before the AI arrives?**
→ No, ship career and AI together
→ Other: this needs to be bundled. we just might do the whole thing on worktree if i will do some other changes to the game in the meantime

**I4. What would make this redesign a failure for you?**
→ if it kills the performance of the game, ai looks too stupid

## Summary

- **Open:** none
- **Recommendation accepted in bulk (not individually reviewed):** B5, C2, D3, D4, H5, H6, J6
- **Differs from your recommendation:** 
  - A2: chose Racing a pack that fought back, Seasons and the WSR finale, LiveRoutes; recommended Racing a pack that fought back, Seasons and the WSR finale
  - A3: chose Bonus objectives inside an event, Reward for not using rewind; recommended Bonus objectives inside an event
  - B2: chose "Retire them", recommended "Become side events inside seasons"
  - D7: chose Clean race (no contact), Lead a lap, Fastest lap, Win from the back of the grid; recommended Clean race (no contact), Lead a lap, Fastest lap
  - E1: Endurance → First season (rec Later seasons)
  - E3: chose "No wall rule", recommended "Wall hits add time, as today's +2 s"
  - G1: chose "Your own car within a class cap", recommended "Lent per season; your own car in side events"
  - H1: chose "AI in game first, then career", recommended "Both in parallel"
  - J2: chose "Yes, everywhere incl. worldgen", recommended "Yes, for car physics (not worldgen yet)"
  - J3: chose "Also world generation", recommended "Car step + whole ground as the only physics, staged after the worker"
  - I1: chose "One AI race in free play", recommended "Season 1 Island vs an AI field"
  - I3: chose "No, ship career and AI together", recommended "Yes, as the new career frame on ghosts"

## Round 2 (2026-11-15, chat)

Owner answers relayed by the lead in chat, settling the round 1 opens.

- **Progress number (C3):** series points. Championship points per finish position, summed per series; bonus objectives add points. Standings plus a series rank. No currency.
- **Grind for class (G1):** credits from all events. Every race, side event and Run pays credits; cars and parts are bought in the garage. Each season final also unlocks a car or kit (G3).
- **Rewind reward (A3 vs D5):** side events only. Solo side events keep rewind, and finishing without it pays a bonus. Career races have no rewind.

## Round 3 (2026-11-15, chat)

Owner, verbatim: "Start with as in car? the base car" · "rewards stay if unlocked - think of it as bonus for legacy players" · "oh maybe we keep the wall hit for pass? idk i just dont like that when heavy racing with actual cars you need to watch that" · "i mean everythiing legacy will be depricated so no"

- **Credits start:** every player, new or existing, starts the career with the base car only. Legacy progress does not carry into credits or garage.
- **Old-tier rewards:** whatever a player already unlocked (tints, titles, kits) stays, as a legacy bonus. Nothing new is earned from the old tiers.
- **Pass win rule:** Pass is a 1v1 mountain duel, so wall hits add time there (today's +2 s). Pack races with an AI field keep no wall rule. Lead's reading of "maybe"; confirm when Pass is built.
- **Naming:** legacy is deprecated, so "Harepin Series" with career "series" and Runs "season" stays as decided in round 1. No rename.
