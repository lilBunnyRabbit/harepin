# Career redesign: what GRID 2 did, and what Harepin should take

Status: research for t185, base master `6f9e8b2`, 2026-11-14. No code changed. Owner picks in §6 before any edit.

Owner, 2026-11-14: FH5 "never really kept me" (events felt repetitive fast); GRID 2 is the most-played racer (played almost twice), DiRT 3 second. "Don't be bothered if we need to redesign the whole career." Follow-ups the same day: GRID 2 is the main subject, DiRT 3 a side note, FH5 the contrast; the owner never really played multiplayer, so online stays off the core loop.

Player-facing text never names another game. This doc may.

## TL;DR

- **Harepin's career today is an FH5-shaped checklist with GRID's event list.** 45 hand-made events across five tiers, any order, every one graded by stars against a clock, ghost or owner mark. You drive alone in every race. What GRID 2 had that FH5 lacks: **other cars to beat, in a season that builds to a final, with one growing number that says how far you've come.**
- **GRID 2's hook was the field.** Reviews split on its story and fan count, but agree the racing against an aggressive AI that makes mistakes is what carried it (PC Gamer, Destructoid, Indian Videogamer). The career's weak spot, per reviews, was repetition: the same tracks again and a league that "doesn't pay off" (Game Informer). Harepin can beat GRID 2 there: worlds and routes are procedural.
- **Recommend direction B, "World Series"** (§5): seasons per region (world kind), each a short run of events against a named AI field, standings and a season final, fans as the one progress number, the non-race modes kept as one-off promos. It needs AI racers phase 3 (in game on circuits) for its first season. Ship direction A's pieces (season order, standings, fans) first on ghosts and the clock, so the structure is proven before the field lands.

## 1. What GRID 2 did

GRID 2, Codemasters, May 2013 (Metacritic PC 80 / PS3 82 / X360 78). Facts below come from the Wikipedia article and 2013 reviews (§7). Lines marked (unverified) are from memory of the game and found in no source fetched for this doc.

### 1.1 Structure

| Piece | How it worked | Source |
|---|---|---|
| Frame | You are the first driver of a new league, World Series Racing (WSR), set up by investor Patrick Callahan. You grow it by beating established clubs | Wikipedia |
| Regions | North America, Europe, Asia: beating a region's clubs wins their fans, and their drivers join the WSR | Wikipedia, Game Informer |
| Seasons | Races grouped into seasons; the first three are linear (win one discipline's series to open the next) | Destructoid |
| Season end | Each season ends in a WSR event that needs a fan total to enter | review via search (Team VVV, unfetched) |
| Season mix | A season combines several types: elimination, Touge, one-on-one Face-offs, checkpoint | Game Informer |
| Progress | **Fans only.** No money, no credits. "Beyond four million fans" by late career | Destructoid; search summary of reviews |
| Promo events | Fans also come from promo events, e.g. Overtake (pass slow trucks) | Game Informer |
| Cars | Some given before certain events; others unlocked through vehicle challenges. No upgrades in single player | Wikipedia, Game Informer |
| Garage | "A garage that grows with you", sponsorship requirements | Game Informer |
| Presentation | ESPN-style studio segments for WSR events, a race engineer on the radio who flags past trouble spots, dramatic music on the last lap | Game Informer, Destructoid |
| Number of seasons, fan totals per season (unverified) | about five seasons, ending in the WSR world championship | memory |

### 1.2 Event types

| Type | Rule | Reception |
|---|---|---|
| Race | Grid start, laps, finish position | the core |
| LiveRoutes | The circuit builds itself as you drive: junctions fill in on the fly, no map | the most praised feature: "elevates the heart rate" with no minimap (Game Informer); "where this game shines" (search summary); but "rarely used in the career mode" |
| Eliminator | Last place drops out at intervals | listed in all sources |
| Touge | Two cars on a mountain road; wall hits cost | split: "completely infuriating" vs the career picking up "once you reach Asia with Touge, Drift and Checkpoint" (search summary of reviews); Destructoid: first Touge a difficulty spike |
| Face-off | One on one against a rival | Game Informer |
| Checkpoint | Point to point, beat the clock through gates | listed |
| Time Attack, Drift | Solo | listed |
| Overtake (promo) | Pass as many slow trucks as you can | Game Informer |
| Endurance (unverified) | Race for a set time, most distance | memory; in no fetched source |

### 1.3 What reviews praised and what they faulted

| Praised | Faulted |
|---|---|
| AI: aggressive, "pushes you toward cliff edges even on medium", **makes realistic mistakes** (PC Gamer); "more intelligent and human-like", **falters under pressure, trades paint** (Indian Videogamer, via search); "generally strong" (Destructoid) | Same AI read as unfair: cheap take-outs (Destructoid), its aggression "the biggest problem" (Game Revolution) |
| LiveRoutes | Repetition: "few tracks, the same ones again and again"; the career "repetitive" (search summary) |
| A "well-thought out career" (IGN, via Wikipedia); Game Informer liked the WSR mode itself | The league hype "doesn't pay off", opponent clubs "don't really matter" (Game Informer); fans are "superficial", no way to interact with them (search summary) |
| "Exciting head-to-head racing" (Destructoid) | Narrator and ESPN segments "bizarrely irritating" (Destructoid) |

### 1.4 The mechanisms behind "kept me playing"

Features are not the hook. These are the mechanisms behind them, inferred from the structure above and the reviews:

| # | Mechanism | GRID 2 carrier | Why it holds a player |
|---|---|---|---|
| M1 | **An opponent who can lose to you, and you to them** | a full AI field that makes mistakes and fights back | Every lap has a story: a pass, a defence, a mistake. A clock or a ghost can't react, so a solo run is only you vs a number |
| M2 | **Position over time** | finish order | P1 by 0.1 s is a win; a clock run 0.1 s over a mark is a fail. A close race feels good either way. Stars on a clock feel bad nine runs in ten |
| M3 | **A season that ends somewhere** | series of events, WSR final | Each event is a step toward a named final with standings, not one of 45 boxes |
| M4 | **One number that only goes up** | fans | Every event adds, even a loss. Simpler than stars (capped per event, three-per-box) |
| M5 | **The game hands out the car** | cars given per event, others by challenge | No grinding, no tuning homework; the event's car is the event's puzzle |
| M6 | **New rules arrive with new places** | Touge, Drift, Checkpoint open in Asia | The loop changes before it wears thin, and each region reads as a chapter |
| M7 | **The road can surprise you** | LiveRoutes | Memorising goes away; reading the road is the skill |
| M8 | **Short sessions with a hard stop** | short races, one season | "One more race" is cheap; a season finale is a natural pause |

Where GRID 2 fell short (and Harepin should not copy): opponents without names or memory (M1 stops at the race), too few tracks (M7 underused), fans with no meaning past a gate (M4 stays a number).

## 2. DiRT 3 (side note)

DiRT 3, Codemasters, May 2011. DiRT Tour: **four seasons, each of four tours** across disciplines (rally, rallycross, trailblazer, head-to-head, landrush, gymkhana); events open on **reputation points** from finishing position, bonus objectives (e.g. a top speed) and unused rewinds (VideoGamer, GamingBolt via search). Gymkhana was the praised new thing; landrush felt "at odds with the rest of the game" (VideoGamer).

Take-aways for Harepin: the season-of-tours shape is the same as GRID 2's (M3); rewarding **unused rewinds** is a good fit if rewind ever comes to events (rules today: no rewind in any mode). Harepin already has gymkhana.

## 3. FH5, the contrast

Forza Horizon 5, Playground Games, Nov 2021.

| FH5 trait | Source | Mechanism lost |
|---|---|---|
| Every activity earns Adventure points; every chapter open from the start; story optional | GamingBolt | M3: no season to finish, nothing ends |
| Rewards "on a near-constant basis", cars "at a pretty regular clip" | GamingBolt | M4/M5 inflate: a car means nothing when they rain |
| Questline races "not particularly interesting", repetitive; after ~15 h "feels same-y" | GamingBolt, GGRecon | M6: new places, same rules |
| Drivatars: rubber-banding complaints, unbeatable on top difficulty, no driving style or weakness to read | player forums, GamePressure 2021 (§7; forum posts, not reviews) | M1: the field is noise, not rivals |

FH5 is a map of boxes. Harepin's career page is a ladder of boxes (shield ladder, next up three goals, stars per event). That is the shape the owner tires of.

## 4. Harepin as it is

| Piece | Today | Source |
|---|---|---|
| Career | 5 tiers: Rookie, Club, Pro (7 each), Elite, Legend (12 each), 45 events. A tier opens on stars in the tier before; events in any order | `src/career/career.ts`, `docs/plan/career.md` §1, §10 |
| Event | a mode level on a fixed map code, a car cap or preset, star marks; `stars` 1-3 | `career.ts` `CareerEvent` |
| Race events | **alone**: against the clock and a dev ghost (bot run picked near 3★) | `modes/race-mode.ts:46-51`, `career/dev-ghost.ts` |
| Duel | **against your own ghost** ("Set a time, then beat your ghost") | `modes/duel.ts:18-24` |
| Other modes | gymkhana, parking, drift, hunt, jump, speed trap: solo, scored | `modes/modes.ts:44` |
| Championship | 3-5 stages on one map, points by stars (10/6/3), total graded | `modes/championship.ts` |
| Laps | closed routes run `ctx.laps` laps; career races are one lap | `race-mode.ts:45` |
| Rules | no rewind in modes; +2 s per hit | `career.md` §1.2 |
| Rewards | paints, decals, badge per tier, Fujin car on Legend | `career/rewards.ts` |
| Runs | daily, weekly cup, endless random, event builder; season of 28 UTC days, season stars, title/tint track | `src/runs/` |
| Worlds | procedural kinds: Island, Alpine, Volcano, Ice canyon, Dune sea, Frozen lakes, Sky Track, Velodrome, Big dunes, Mainland (streamed road graph with towns) | `worlds/`, `worldgen/kinds/` |
| Route kinds | circuit, circuit-rev, sprint, banked, street-1/2, offroad-1/2, descent, trip, crossing, trap | `modes/races.ts:29-44` |
| AI racers | plan: phases 0-6. **Phase 0 (contact pass, `2055f45`) and phase 1 (race line + driver, solo headless lap, `2f0dba2`) are on a worktree branch, not on master.** Phase 2 (headless field) next; phase 3 (in game, compact circuits) is the first that lets a player race them | `docs/plan/ai-racers.md` §6, `git log --all` |

**Mapping GRID 2's mechanisms to what exists:**

| Mechanism | Harepin has | Gap |
|---|---|---|
| M1 opponent | ghost (no reaction, no contact) | AI field, phase 3 |
| M2 position | none: all grading is time / points | position grading (ai-racers O9) |
| M3 season → final | tier → final event, but any order and 7-12 boxes | ordered season, standings across events |
| M4 one number | stars per event, per tier; season stars in Runs | one career number that every event adds to |
| M5 car handed out | yes: event car cap or preset, fitted unsaved | keep; drop cap picks where a given car is clearer |
| M6 new rules per place | partly: tiers mix all modes from the start | introduce kinds by season |
| M7 surprising road | **strong**: every world procedural, seeds per event, Runs daily seeds | a live route (junctions picked during the race) on Mainland or street worlds |
| M8 short sessions | yes: one lap, 1-3 min events | laps go up in a pack race; keep races under ~5 min |

Harepin's unfair advantage over GRID 2: GRID 2's career ran out of tracks; Harepin can't. A season can land on a new seed.

## 5. Directions, lightest first

### A. Seasons over the ladder (no AI)

**Loop:** Career = a run of seasons. A season is 5-6 events in order on one or two worlds, then a final. Each event adds fans; standings show you against a field of named ghosts (bot drives the tune script already records). The final is a championship cup.

| | |
|---|---|
| Reuse | events, maps, marks, `Cup` runner, dev ghosts, `scripts/career.ts` bot drives (up to 5 per event), rewards, career page shell |
| New | season order (event N opens on finishing N-1, not on stars); fans = sum over events of a curve on stars; standings card vs 5 named ghosts (points by where your time falls among theirs); multi-ghost race (career.md §10.3 "elimination vs ghosts", M) |
| Dropped | any-order tiers; the shield ladder's star gates |
| Depends on | nothing in AI |
| Gets | M3, M4, M6, part of M2 (finish order vs ghosts) |
| Misses | M1: ghosts don't fight back, no contact, no passing drama. The thing the owner played GRID 2 for is not here |
| Size | M (1-2 weeks) |

### B. World Series (recommended)

**Loop:** You start a new series and grow it by beating the established field, region by region, as GRID 2 does, with Harepin's worlds as regions.

1. **Season = a region** (a world kind or two): Island, Alpine, Volcano / Ice canyon, Mainland, Sky Track / Velodrome. 5-7 events in order, then the region final.
2. **Main events race a field** of 5-7 AI with names, car, personality (`pace`, `aggression`, `mistakes` from ai-racers §3). Graded by finish position; points to a season table.
3. **Event types** in our words: Race (laps, grid start), Knockout (last place out each lap: GRID's Eliminator), Head to head (one rival, the duel route, AI instead of your ghost: Face-off), Pass (Mountain duel on a `descent` route, wall hits count, lead after two legs: Touge), Open road (Mainland or street worlds, junctions picked as you drive, no map: LiveRoutes), Endurance later (time limit, most laps; no tyre wear).
4. **Promos between race events:** the solo modes (gymkhana, drift, parking, jump, speed trap, hunt) stay as one-offs that add fans, never block the season. This keeps every built mode.
5. **Rivals:** one named rival per season who is the region's champion; Head to head and the final are against them. They carry into later seasons as a field member. Memory beyond that is direction C.
6. **Fans** is the one number: race events add by position, promos by stars. A season final needs a fan total (GRID 2's gate).
7. **Cars are handed out:** each season lends a car class or a preset; earning cars stays rewards (paints, decals, Fujin).
8. **New rules per region:** Island = Race and Knockout; Alpine adds Pass; Mainland adds Open road; Sky / Velodrome finals add banked racing.

| | |
|---|---|
| Reuse | race / duel / championship modes, route kinds (`descent` for Pass, `street-*`, `trip` for Open road), `Cup` standings, laps, hit penalty, event car fitting, worlds, rewards, `?event=`, career store (new keys), the 45 events' maps and marks as promo seeds |
| New | season model (order, standings, fans) S-M; position grading and points S; Knockout rule on the race mode S; AI rival names and personalities as data S; Open road route (junction pick per lap from the road graph) M-L; season final presentation (standings card, rival line) S-M |
| Dropped | tiers as star gates; star marks on race events (position replaces them); dev ghosts for career races (ai-racers O3: AI replaces the ghost when a field is on) |
| Kept | every non-race event as a promo, with its stars and records |
| Depends on | AI phase 2 (headless field: overtake, defend, recovery) and phase 3 (in game on compact circuits, kinematic far AI on phone) for season 1. Pass needs AI on `descent` (narrow, one way); Open road needs AI on street / Mainland routes (ai-racers §5: "later", junctions and narrow streets). Each later season waits on its world's AI |
| Gets | M1-M8 |
| Risks | AI fairness: GRID 2's AI read as both "human-like" and "cheap" from the same code. Contact tuning and the lab ratings (ai-racers phase 4) decide whether this works. Phone frame budget with 6 AI (ai-racers §4) |
| Size | L over months, shipped season by season |

**Phases:**

| Phase | Ships | Needs |
|---|---|---|
| B0 | Season model on today's events: order, fans, standings vs ghosts, promos (direction A's pieces) | none |
| B1 | Season 1 (Island circuits): Race + Knockout with an AI field, position grading | AI phase 3 |
| B2 | Head to head vs the region rival on duel routes | B1 |
| B3 | Season 2 (Alpine / Volcano): Pass on `descent` | AI on one-way narrow routes |
| B4 | Season 3 (Mainland): Open road | AI on the road graph, streamed; new route builder |
| B5 | Sky / Velodrome finals: banked pack racing | AI bowl aim (ai-racers §5) |
| B6 | Endurance (maybe) | B1; no wear model |

### C. Endless World Series (heaviest)

**Loop:** B's structure, but every season after the hand-made opening is **generated**: a seed picks the region, routes, event types and field; rivals persist with memory (who wrecked you, who you beat, grudges that change their `aggression` against you); fans unlock bigger fields and harder classes. The Runs season merges into it: daily and weekly become events inside the current season.

| | |
|---|---|
| Reuse | everything B uses; the Runs picker (`runs.ts`) and `runs-check` vetting for generated seasons |
| New | season generator + vetting over every world kind M-L; rival memory store and the rules that read it M; Runs merged into career L (store migration, season stars vs fans) |
| Dropped | Runs as its own view; hand-made tiers past the opening |
| Depends on | AI on every world kind (phase 5 for all routes), plus B |
| Gets | M1-M8, and fixes GRID 2's own faults: tracks never run out (M7), rivals matter past one race |
| Risks | generated seasons feel generic without hand-picked finals; rival memory is easy to make noisy; biggest scope; replaces a Runs view shipped days ago |
| Size | XL |

### Comparison

| | A | B | C |
|---|---|---|---|
| Racing against a field | no | yes | yes |
| Needs AI | no | phase 3 for season 1 | phase 5, every world |
| Keeps the 45 events | reordered | as promos and seeds | as seeds |
| Keeps Runs as is | yes | yes | merged |
| Fixes the checklist feel | partly | yes | yes |
| First playable change | ~1-2 weeks | B0 in ~1-2 weeks, B1 after AI phase 3 | months |

### Recommendation

**B, built from B0.** A alone skips the reason GRID 2 held the owner: cars that race back (M1, M2), and reviews of GRID 2 itself name the AI field as what carried the game. C fixes GRID 2's real faults, but it stacks a generator and rival memory on an AI that has not raced a player yet; it can grow out of B once seasons and the field are proven. B0 ships now on ghosts and makes the career a season run the day it lands; each later phase arrives with the AI phase it needs, so nothing waits on the whole AI plan.

Lightest-first check: B0 is existing code reshaped (career store keys stay, events stay). The new state is one season progress record and a fans total, both derived from stored results where possible (like `unlocks(stars)` today). No new dependency.

## 6. Owner questions

| # | Question | Recommendation |
|---|---|---|
| Q1 | Direction A, B or C? | B, starting with B0 |
| Q2 | Strict season order (event N opens on finishing N-1), or a small set open at once (GRID 2 opened a discipline series at a time)? | Two or three open at once, final last |
| Q3 | What happens to the five tiers and 45 events? Reframed as promos inside seasons, or kept as a separate "Challenges" list beside the series? | Promos inside seasons; their stars and records keep their keys |
| Q4 | Fans or stars as the career number? Stars stay for promos either way | Fans for the career; stars on promos feed fans |
| Q5 | Race grading: finish position only, or position plus a margin (win by X s for a bonus)? | Position; fans bonus for clean race (no hits) |
| Q6 | Named rivals: one per season (region champion) or a whole named field? Any story text, or none (GRID 2's narrator was its most disliked part)? | Whole field named, one rival per season, no narrator; a one-line standings note per event at most |
| Q7 | Cars: lent per season (GRID 2) or the player's own car within a class cap (today)? | Lent per season for main events, own car on promos |
| Q8 | Laps: how long should a pack race run? | 2-3 laps, under 5 min |
| Q9 | Rewind in career races: none (today), or limited with fans for unused ones (DiRT 3)? | None, as today |
| Q10 | Name clash: Runs already has a 28-day "season". Call the career unit a season and rename Runs', or name the career unit something else ("series", "year")? | Career: "season"; Runs: "month" or keep and pick "series" for career, owner's ear |
| Q11 | Open road (live junctions): worth the M-L route builder for Mainland, or keep fixed routes and lean on new seeds per season? | Yes, it is Harepin's best answer to GRID 2's track shortage, but after B1-B3 |
| Q12 | Difficulty: one setting (ai-racers O5) or seasons set it (later seasons = harder field)? | Seasons set it, plus the one setting |

## 7. Sources

Fetched or searched 2026-11-14. Several review sites refused automated fetches (403); lines marked "via search" rest on the search engine's summary of that page, not the page read in full.

| Source | Date | Used for |
|---|---|---|
| [Grid 2, Wikipedia](https://en.wikipedia.org/wiki/Grid_2) | read 2026-11-14 | WSR frame, regions, event list, cars, Metacritic, release 28-31 May 2013, review quotes (IGN, PC Gamer, Destructoid, Push Square) |
| [Game Informer, GRID 2 review](https://www.gameinformer.com/games/grid_2/b/xbox360/archive/2013/05/28/can-codemasters-invigorate-the-genre-once-again.aspx) | 2013-05-28 | season mix, promos, garage, engineer, LiveRoutes praise, "doesn't pay off", 8.25 |
| [Destructoid, Review: Grid 2](https://destructoid.com/?p=153603) | 2013 | linear seasons, fans, Touge spike, AI cheap/strong, narrator, 6.0 |
| [PC Gamer, Grid 2 review](https://www.pcgamer.com/review/255-grid-2-review/) | 2013 | verdict via search: AI aggressive, realistic mistakes |
| [Indian Videogamer](https://www.indianvideogamer.com/?p=20347), [Game Revolution](https://www.gamerevolution.com/?p=60421), [Softpedia](https://www.softpedia.com/reviews/games/pc/Grid-2-Review-357471.shtml) | 2013 | AI human-like / too aggressive / erratic, via search |
| [Team VVV](https://www.teamvvv.com/?p=32414), [GameGrin](https://www.gamegrin.com/reviews/grid-2-review), [Giant Bomb user review](https://giantbomb.com/user-reviews/id/39887/grid-2-might-satisfy-fans-of-the-original-but-it-n), [Push Square](https://www.pushsquare.com/reviews/ps3/grid_2) | 2013 | fans, WSR gate, repetition, LiveRoutes underused, Touge in Asia, via search |
| [VideoGamer, DiRT 3 review](https://www.videogamer.com/reviews/dirt-3-review) | 2011 | four seasons, reputation, event types, gymkhana |
| [GamingBolt, DiRT 3 review](https://gamingbolt.com/?p=30948) | 2011 | four seasons × four tours, via search |
| [GamingBolt, FH5 review](https://gamingbolt.com/forza-horizon-5-review-fast-and-festive) | 2021-11 | Adventure points, open chapters, constant rewards, repetitive questlines |
| [GGRecon, FH5 review](https://ggrecon.com/reviews/forza-horizon-5-review) | 2021-11 | accolades, "same-y" after ~15 h |
| [GamePressure, aggressive Drivatars](https://www.gamepressure.com/newsroom/aggressive-drivatars-enrage-players-in-forza-horizon-5/z23cff), [Forza forums: Drivatar difficulty](https://forums.forza.net/t/drivatar-difficulty-and-behavior-discussion/534854?page=2), [Rubberbanding and penalties](https://forums.forza.net/t/rubberbanding-and-penalties/656048) | 2021-2024 | Drivatar complaints, via search; player opinion, not review |
| Repo: `docs/plan/career.md`, `docs/plan/ai-racers.md`, `src/career/`, `src/modes/`, `src/runs/` | master `6f9e8b2`; AI branch `2f0dba2` | §4 |
