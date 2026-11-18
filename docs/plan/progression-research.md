# Harepin — Progression Research and Recommended Design

**Research date:** 18 November 2026  
**Audience:** Harepin owner and implementation agent (Claude Code)  
**Status:** Design recommendation, **not** an instruction to implement automatically. Final decisions belong to the owner.

## Executive decision

**Keep one-make loaner Series as a way to try and permanently unlock a frame. Do not make *every* Series one-make. Preserve Open Cups in the player's tuned cars, and do not require podium finishes to obtain the core frame.**

Recommended model:

- **Garage / collection:** Hatch, Coupe, Tsumuji are owned at the start. Six more *driving* frames are earned through short one-make Series: Rally, Muscle, Sajin, Sturm, Raijin and Formula. **Fujin stays the Career Legend reward.** The **Bus stays a novelty** outside competitive AI championships (suggestion: available from the start for free roam/party use).
- **Series / meaningful car rewards:** A one-make Series is a fixed-spec 3-round introduction to a frame, with loaner cars and a visible frame reward. **Complete all rounds → own the frame and its existing bodies.** Podium / first place → a cosmetic trophy or badge, **not a progression lock**.
- **Open Cups / meaningful tuning:** Short championships with the player's *owned, tuned* cars, subject to an upper PI cap; never force a loaner. Completing a cup earns its own visible first-clear cosmetic. Replays improve records/trophies, not an endlessly accruing currency.
- **Career / breadth and long-term prestige:** Retain Rookie → Club → Pro → Elite → Legend, mixed event types and stars that unlock subsequent Career tiers. Career is the cosmetic/mastery track; Fujin is its one exceptional gameplay reward. Do **not** require Career stars to unlock one-make Series cars.
- **One destination in the UI, two complementary activities:** The **Progress** screen shows Series (cars), Career (stars/cosmetics) and an optional Open Cup (tuning). No third XP level, no credit balance, no loot boxes.
- **Critical implementation constraint:** persist progress **per Series round** so a phone session can end after one race. Never require 15+ uninterrupted minutes for a reward.

This is a **design judgment** for Harepin, informed by the sourced comparisons below; the exact frame order and timing are proposals to playtest, not empirical findings.

---

## 1. Comparative research: what other driving games actually gate and reward

**Reading the last column:** These are *documented review criticisms or player comments*, **not** quantified community consensus. If no credible complaint was established, that is stated instead of inventing one. The game/version distinction matters: these systems changed over time.

| Game / version | What gates progress | Main rewards | Why progression can feel good | Reported criticism / failure mode |
|---|---|---|---|---|
| **Gran Turismo 7** | Sequential Café Menu Books (car collections, race results, tasks); some licences and championships; collector progression | Specific prize cars, tracks, facilities, roulette tickets | Clear next task and named cars; collecting an actual car is tangible; new map facilities visibly appear | Café can feel prescriptive; roulette makes some rewards unpredictable. **Nuance:** licences do not universally gate everything in GT7 the way they did in earlier GTs. [S01] [S02] |
| **Gran Turismo 4 / older GT** | Licences, eligible-car requirements, league/championship wins, manufacturer one-make events | Credits, prize cars, access to harder events | The garage becomes a tool for choosing eligible races; a prize car can unlock another category | Some one-makes require **owning the eligible car first**, so obtaining an entry vehicle is itself friction. These are **not generally loaner-to-ownership** cups. [S03] |
| **Forza Motorsport (2023 launch → 2024 → 2025)** | Originally car-specific levelling before upgrade parts; Builders Cup tours; later Champions Cup themed tours and PI restrictions | Car Points/upgrades, credits, cars, suits, invitations | Driving an individual car teaches its character; one-make and open classes provide different challenges | Players disliked re-earning the right to upgrade each car. **Update 6 (March 2024)** removed upgrade-part level locks. **Update 21 (June 2025)** opened Builders Cup tours and awarded Champions Cup cars regardless of finishing position. Do not describe the 2023 system as its final state. [S04] [S05] [S06] |
| **Forza Horizon 4/5** | Accolades, festival unlocks/expeditions; seasonal Festival Playlist objectives; individual car mastery | Cars, wheelspins, XP, cosmetics, festival locations | You can progress from exploration, races and stunts; frequent rewards support experimentation | Some players say the flood of gifted/random cars makes ownership feel less earned; the map and overlapping progress tracks can overwhelm. [S07] [S08] [S09] |
| **Need for Speed: Unbound** | Story calendar, weekly qualifiers, class-eligible car and event buy-in; cash earned in between | Cars, cash, upgrade opportunities, advancement to The Grand | A **visible deadline and finale** gives mundane races purpose; rivalry/story creates stakes | Buy-ins and required funds/classes can turn an exciting qualifier into a compulsory earnings loop. [S10] |
| **Mario Kart Wii** | Winning particular cups, engine-class achievements, time trials (with alternative race-count unlock routes) | Characters, bikes/karts, additional cups | A gold cup is a clear, memorable *proof of play*; unlocks are legible and specific | Harder completion requirements can be opaque; some alternate unlock routes involve huge race counts. [S11] |
| **Mario Kart 8 Deluxe** | Most racing content and characters unlocked immediately; coins unlock ordinary vehicle parts; 200cc cup golds unlock Gold Mario | Kart parts and a small set of prestige gold items | Play-first accessibility; high-skill gold rewards remain aspirational | Coin-threshold part rewards are comparatively arbitrary. **Do not claim cups unlock most characters in Deluxe**—that describes earlier games. [S12] |
| **Trackmania (2020; evolving through 2026)** | Personal-best medals, medal thresholds for later campaign tracks, seasonal campaign; some content gated by access tier | New tracks, medals, rankings, prestige skins | Immediate measurable mastery: one better corner can earn a medal; no car economy required | Players criticized medal prerequisites for blocking favorite/harder maps. **January 2026** reduced certain later-track thresholds; do not treat 2023's numbers as current. [S13] [S14] [S15] |
| **Rocket League** | Match/season challenges and Rocket Pass tiers; no better-engine unlock ladder | Cosmetic bodies/items, banners, decals, titles; blueprints/item trade-ins | Skill is the long-term progression; cosmetics can demonstrate participation without making gameplay pay-to-win | Monetization/item economy and the **December 2023 removal of player trading** generated objections. Rocket Pass items themselves provide no gameplay advantage. [S16] [S17] |
| **DiRT Rally 2.0** | Increasing championship tiers, event completion, car purchase/maintenance, credits | Car collection, cash, team/upgrade capacity, harder rally championships | A tough stage finished cleanly feels like earned competence; damage matters | Career presentation can feel thin—one review described it as an event list with credits, staff and a podium screen. [S18] |
| **EA SPORTS WRC (2023)** | Career calendar, class selection, benefactor objectives, budget, team decisions | Cars, builder parts, team advancement and championship results | Calendar and changing venues give a believable season arc; meaningful planning | Budget/calendar restrictions and management systems risk getting between player and driving. [S19] [S20] |
| **GRID Legends** | Amateur → Semi-Pro → Pro career tiers; milestones and car ownership; some upgrades require mileage | Most cars awarded by career milestones, upgrades, sponsorship/cosmetics | Story and **Nemesis** opponents give races identity; earning a car through a milestone is concrete | Car mileage can delay upgrades; event grids may feel like checklists. **Loaning unowned cars is supported in custom/online races**, not evidence that each career one-make grants its own loaner. [S21] [S22] |
| **Assetto Corsa Competizione** | Career introduction / young-driver evaluation and championship entry, not a car-collection unlock loop | Competition results, ratings, racing mastery | Real motorsport structure and increasingly disciplined driving | Limited extrinsic unlock rewards can leave the career feeling bare for collection-oriented players. Cars are generally available from the outset. [S23] [S24] |
| **Initial D Arcade Stage** | Defeat named story rivals; earn Driver Points for tuning; further challenge levels | Tuning, titles, tachometers, character customization and status | Rivals have a face, place and identity; beating the next driver feels like moving up a social ladder | Progression can become repeating rival battles for tuning points. No verified evidence that a rival's car is automatically awarded when beaten. [S25] |
| **Tokyo Xtreme Racer (2025)** | Defeat team members and bosses, unlock next stage/sections; buy and upgrade cars | Rival progress, SP/battle results, money and upgrades | Named teams, rival silhouettes and boss encounters make a simple route feel like a campaign | Long rival checklists can become repetitive; that is a **design risk**, not a documented unanimous complaint in the cited developer material. [S26] |
| **Burnout Paradise** | Event wins advance licence ranks; wins also introduce cars into the city; vehicle-specific Burning Routes | New cars, licence levels, special versions, event records | Several event types count toward one simple licence; winning changes what appears on the map | The need to repeat events for later licence levels and the lack of traditional structure can be tiring for some. Burning Route typically **requires an owned car and awards a modified version**, not a loaner. [S27] [S28] |
| **CSR Racing 2 (mobile)** | Gang tiers, beat named bosses, have adequately upgraded car; fuel and upgrade economies | Cars/parts/currency; optional one-attempt opportunity to win a boss's unique car | Boss car is a **specific visible trophy** and a rival gives a reason to improve | Fuel timers, multiple currencies and one-chance boss-car attempts add pressure and can penalize a player who simply wants to race. [S29] [S30] |
| **Real Racing 3 (mobile)** | Series requirements, car ownership/upgrades, servicing timers | Cars, money, gold and new series | Authentic car collection and short race formats | Service waits and premium currency make short sessions end for artificial reasons. [S31] |
| **Asphalt 9 / Asphalt Legends Unite (mobile)** | Car-specific blueprint counts and ranks; event entry requirements | Blueprints, cars, import parts, currency | Named car as a target and regular short events | Unlocking a car can be only the start of more blueprint grinding before it is usable at the desired tier. [S32] [S33] |
| **The Crew Motorfest** | Finish themed playlists; first playthrough uses fixed loaner vehicles | Explicit exclusive **car at playlist completion**, plus currency/parts | Closest precedent for “try cars in a themed campaign, then earn one”; Porsche playlist ends by awarding the same 911 Carrera 4S used in its final race | Reviews and players criticize being forced into loaners for most main events, leaving personally owned/tuned cars underused. Replay/custom mode permits owned cars afterward. [S34] [S35] [S36] |
| **Driveclub (2014)** | Fame ranks, tour achievements/accolades; multiplayer loans if needed | Cars, cosmetics, badges and fame ranks | Clearly visible unlock goals plus contextual near-complete accolades; friends can still race together | Designers found initial reward balance too stingy and tuned it via simulation/user testing; without loaners, friend races could hit car-lock barriers. [S37] |

### Findings that are strongest across examples

1. **A known, named reward beats abstract XP as a reason to begin a short championship.** This is supported in different ways by GT7 car collections, *The Crew Motorfest*'s explicit playlist cars and CSR2's boss cars. [S01] [S34] [S29]
2. **Don't lock the player out of the part of the game they came to enjoy.** *Forza Motorsport* removed restrictive part levelling; *Driveclub* loaned locked cars to friends; *The Crew Motorfest* shows the opposite risk when loaners replace owned cars too often. [S05] [S37] [S35]
3. **A cup becomes compelling when it has a goal and a shape:** a name, an opponent, varied venues, an aggregate score and a known finale. *Unbound*, *Initial D*, *Tokyo Xtreme Racer* and *Burnout Paradise* achieve this with different amounts of story. [S10] [S25] [S26] [S27]
4. **One large meta-progression number is enough—or even too much.** *Trackmania* shows personal bests can sustain play, while *Rocket League* shows cosmetics can remain the rewards as mechanical skill improves. Harepin already has stars and seasons; adding XP/credits without an expenditure problem would be unnecessary. [S13] [S16]

---

## 2. Which rewards work for Harepin?

| Reward | Perceived value / best use | How it becomes grindy | Harepin decision |
|---|---|---|---|
| **New frame** | **Highest functional reward.** Different drivetrain, mass, wheelbase, gearing and physics; opens a genuinely new way to play | Locking desired driving styles behind too many prerequisite wins | **Main one-make Series first-clear reward**. Six frame cups; preview/test drive is free |
| **New body on an owned frame** | Visual identity and sound; meaningful for collectors, but **not new handling** | Selling identical physics as another new performance car | **All existing bodies arrive with the frame.** Optional future body variants can be cosmetics |
| **Performance part** | Useful only if player has a reason to choose between builds or fit a PI cap | Per-car level restrictions, duplicate parts, random quality tiers | **No part unlock grind.** Existing parts are available immediately on owned frames |
| **Paint/decal/underglow** | Good completion/milestone tokens; visible during actual play | Too many indistinguishable tints or random drops | Career stars and podium/first-place bonus cosmetics |
| **Title / badge** | Strong only if attached to a recognizable achievement (e.g. a difficult cup win) | Text labels nobody notices; repeat rewards that don't express skill | High-clear mastery; show on profile/result/garage, not as the sole basic cup reward |
| **Credits** | Work only with a coherent purchase economy and interesting choices | Racing solely to afford entry or previously available tools | **Do not add currency** just to create a reward layer |
| **Car or body selection freedom** | Not a reward; baseline autonomy. Players want to express a preference | Being compelled to drive a different car every event | Own cars in Open Cups, Career and custom races; loans mostly restricted to one-make introduction |

**Key distinction:** Harepin's **frame** is the gameplay object; a **body** is visual/audio identity on that frame. A new body is *not* a new car from a handling perspective. The value of the frame unlock comes from subsequently **owning, tuning, selecting and sharing builds**—not just seeing an unlock toast.

**Why this matters:** The 2006 video-game motivation research by Ryan, Rigby and Przybylski links perceived **competence and autonomy** to enjoyment. It does **not** establish an optimal number of unlocks or a universal 15-minute cadence; those values below are design hypotheses for playtesting. [S38]

---

## 3. Why start a Series? Goal, rivals, venues, ladder, near misses

A Series needs to answer four questions **before pressing Start**:

1. **What do I want?** Show the precise frame model/body on the card, its drivetrain and a simple description of how it differs from the player's cars. Example: **“Rally — AWD traction on loose ground. Finish 3 rounds to keep it.”** (Proposed player-facing copy.)
2. **What is the challenge?** Show **3 rounds**, 3 venues, event kinds, approximate total playtime, expected PI/difficulty and the trophy requirement.
3. **Who am I against?** Reuse existing AI racer identities/personality data. Give the strongest seeded opponent a name, car color and a **Rival** label; don't build dialogue trees or cinematic cutscenes.
4. **What have I achieved?** Show **Round 2 / 3**, championship points, the player's current place and the gap to podium. Once a round completes, show what will be saved, not just a trophy screen.

### Ranked hooks, by payoff for a solo developer

| Rank | Hook | Implementation | Effort | Expected gain (judgment) |
|---|---|---|---|---|
| 1 | **Named frame reward + visible 3-round progress** | Extend Series cards/results and save progress after each race | **Low–medium** | **Very high**: clarifies why the mode exists |
| 2 | **Named rival + final-round tension** | Label one existing AI personality; show rivalry and points gap in a results UI | **Low** | **High**: makes anonymous AI feel consequential |
| 3 | **Escalating 3-venue route on a simple ladder** | Curate existing seeded venues; list round markers on cards, no bespoke campaign map | **Low** | **High**: creates arc without new world geometry |

Additional hooks: a **one-time first-clear bonus** (not a repeatable farm), a **near miss** summary (“1 point off podium” for relevant mastery trophies), **stars** for optional Career mastery, and a clear **Next** option. Don't reward aggressive driving with arbitrary points when collision/track-limit rules are still in development.

A **named championship** is enough narrative for v1: e.g., *Rally Trial*, *Muscle Tour*, *Dune Challenge*, *Sturm Sprint*, *Raijin Challenge*, *Formula Cup*. Player-facing copy here deliberately contains no names of other games.

### Proposed first 30 minutes (target, not measured)

| Elapsed time | Player activity | Permanent result |
|---|---|---|
| 0–3 min | Pick Hatch/Coupe/Tsumuji. Short first race, minimal tutorial | First result; see garage and next goal |
| 3–6 min | One easy Rookie Career event | 1–3 stars and a cosmetic or visible progress toward one |
| 6–8 min | Show Rally/Muscle Series cards and **loaner preview** | Choose a desired next frame |
| 8–20 min | Play the first **3 x ~3-minute** one-make cup, with result screens and auto-save | **Earn frame**; optional podium/first-place trophy |
| 20–24 min | Own the earned frame; swap body/paint and try a tune | Player-created build, not a second duplicate unlock |
| 24–28 min | One round of an Open Cup with the newly owned car and a PI cap | Persist a championship round |
| 28–30 min | View new Series options and a small next target | Clear voluntary goal for another session |

**Do not make this a mandatory, unskippable 30-minute tutorial.** These are suggested paths. A player who wants to free roam or race a friend should be able to do so immediately.

---

## 4. Did any games actually do “one-make loaner cup → win that car”?

**The exact combination is less common than it first appears.** Do not conflate any one-make race, any loaner event or any prize car with that specific mechanic.

| Game | What demonstrably happens | Match to Harepin idea |
|---|---|---|
| **The Crew Motorfest, 911 Legacy playlist** | Themed events use loaner Porsches. In the final challenge, winning awards the **Porsche 911 Carrera 4S the player just raced**. General playlist completion grants an exclusive car. [S34] | **Closest confirmed direct example.** More of a multi-event themed playlist than a strict equal-car grid in every round |
| **Forza Motorsport, Champions Cup One-Make Tour (June 2025)** | Five one-make series (Ginetta, MX-5, X-Bow GT4, Ferrari, Lamborghini) lead to a **BMW M1 Procar**, not one copy of each entered car; tour reward does **not** require a winning position. [S06] | **One-make mastery → car reward**, but **not** same-car ownership |
| **Gran Turismo 4, Elise Trophy / manufacturer one-makes** | You must bring an eligible *owned* Lotus Elise; you can win a Lotus Elise Type 72 variant as a prize. [S03] | **One-make → related car**, but **not** loaner-to-car |
| **Burnout Paradise, Burning Routes** | Enter with a specific **owned** car; completing its route awards an improved variant. [S28] | **Master a specific car → variant**, but no loaner |
| **GRID Legends** | Career milestones award most cars. Unowned cars may be loaned in custom/online races. [S21] | Both mechanics exist, but **not proven** to be paired as “loan this car and win it” |
| **Driveclub** | Loan an unowned vehicle so friends can race without content locks. Fame/levels unlock owned cars. [S37] | Loaner access protects social play; not a direct cup award |
| **CSR Racing 2** | Defeat bosses and optionally win their specific car in a separate challenge, with a one-attempt restriction. [S29] | **Defeat named rival → visible car**, but not the loaner you drove |

### Failure modes to actively avoid

- **Repetition:** three races that feel interchangeable (same handling, setting and opponents) make the cup feel like padding. Use one short race, one format switch (Head-to-head or Knockout), one final with an identifiable rival. Reuse existing tracks with distinct seeds and environments.
- **Forced car dislike:** some players actively dislike FWD, Formula or slippery surfaces. **Never force every cup in sequence**, and never make cars earned in one-makes useless in the main campaign.
- **Difficulty spike / physics mismatch:** fast frames and dirt/snow events may be harder than a raw PI number suggests. Validate AI field behavior for the frame and surface; a misleading “C Class” label is worse than no difficulty label.
- **Loaner overload:** Motorfest reviews/player reports show how constant loaners undermine ownership. Restrict mandatory loans to the **three intro rounds for that frame**, then permit owned cars in Open Cups, Career, replay/custom events. [S35] [S36]
- **All-or-nothing cup:** don't discard rounds on app close; don't require a win to access a major vehicle handling style. **Completion unlocks ownership; podium/first place recognizes mastery.** The 2025 Forza Champions Cup explicitly decoupled car rewards from finishing position. [S06]

**One-make fairness:** fixed **frame + tune/parts + assists policy** is more useful than just requiring the same body. Keep body cosmetic choice where possible. A true spec cup should not silently apply the player's garage tune to the loaner.

---

## 5. How tuning stays meaningful

The garage is an existing Harepin strength: engine, tyres, aero, suspension, brakes, weight, bias and nitro; PI classes **D, C, B, A, S1, S2, X**; shareable build codes and presets. Avoid inventing a parts economy to “solve” progression.

| Event | Car used | Eligibility | Why the event exists |
|---|---|---|---|
| **One-Make Series** | Standard *loaner* of the featured frame; fixed build | All players; no owned car required | Equalize car performance, introduce a handling identity, earn frame |
| **Open Cup: C/B/A/S1/S2** | **Owned**, personally tuned frame + any owned body | Actual **PI <= class ceiling**, with a minimum PI/floor or eligibility rule if testing proves necessary | Make engineering tradeoffs matter: power vs tyres, aero, weight, suspension |
| **Career event** | Owned car unless a deliberate, clearly labelled challenge requires a loaner | Existing event constraints and stars | Let existing mixed modes and car preferences remain relevant |
| **Custom / P2P** | All frames allowed as session loaners even if not owned | Host choice | Do not create friendship/content locks; only Garage ownership and single-player rewards depend on progression |

**Recommended open classes:** start with just **C, B, A, S1** cups; add S2 only if there are enough **meaningfully competitive** cars and reliable AI on those routes. There is no need for an X-class cup just because PI supports X. Set *numeric* cutoffs using Harepin's real PI data and 50-run AI QA, not guesses from another game's classes.

**Important PI implementation subtleties:**

- **Upper bound alone may permit an extremely underpowered entry.** Show a warning when the build is below the recommended range; optionally set a simple lower bound, but do not restrict the player unnecessarily.
- **Don't normalize AI performance by adding unearned grip.** AI uses the same 360 Hz physics; match opponent build PI and verify their lap pace. Current AI is known to brake too early. If it is trivially beaten, championship mastery rewards become meaningless; fix AI pace before balancing podium thresholds.
- **Nitro is off in AI races today.** Keep it disabled for both player and AI until AI supports it; do not allow an Open Cup build to exploit a mechanic opponents cannot use.
- **Builds should be editable between Open Cup rounds**, but the car must be eligible at each race start. To prevent leaderboard ambiguity, save the per-round build signature/PI with results.
- **No per-physics-step progression logic.** Championship scoring happens at race completion; no allocations in the 360 Hz physics step.

---

## 6. Respect the player: no RNG, no paywalls, every short session counts

**Hard rules:**

1. **All car/frame unlocks are deterministic, permanent and shown in advance.** No random drops, paid boxes, timed rentals or loot tables.
2. **A completed round is permanent progress.** A 3-round Series can take three separate phone sessions. Player can *resume* or *restart* explicitly; restart must not silently erase previously earned frame ownership/trophies.
3. **First-clear rewards are earned once.** Replays can improve placement, PBs and trophies. Do not incentivize running the shortest race 50 times to farm credits.
4. **No loss on retry:** if an event has a bad finish, preserve the round result until the player opts to retry it; never punish a failed attempt by removing a previously granted frame.
5. **No expiring primary cars.** The 28-day Season reward track may provide fixed tints/titles, but core frames and their Series must always be available. Avoid FOMO as a substitute for content.
6. **No online account required.** Progress and rewards work offline in IndexedDB. Keep a path to export/import saves where feasible; if the browser clears storage, there is no backend to restore them.
7. **Don't gate P2P lobbies behind local garage progression.** Use loaners for locked frames in multiplayer, with the lobby choosing allowed frames. This is the precise social friction *Driveclub*'s designer wanted to avoid. [S37]
8. **On phone:** large Resume button; show round count and expected session length; no tiny mandatory tuning interactions; persist at end of every race. A race itself should usually fit 2–4 minutes. Actual time targets require testing on phone hardware.

**Suggested honest copy:** “Finish all three rounds to keep this frame. Place on the podium for the trophy.” Do not show “Win to unlock” and then award a car for simple completion; the UI must accurately state the rule.

### Reward cadence per ~15-minute session (design target)

| Moment | Reward / visible advancement | Frequency |
|---|---|---|
| Finish first 2–4 minute event | Race result, one Career star tier or saved Cup round, optional personal-best | Every race |
| ~5–8 minutes | Career star threshold or visible **2/3 Series** milestone | Usually once per session |
| ~10–15 minutes | **New frame** after a first-clear three-round Series; or first-clear Open Cup decal/badge | Usually once for a new player pursuing a cup |
| Subsequent sessions | Meaningful alternate cup, better placement/trophy, Career tier reward | No requirement to generate infinitely many new objects |

**Do not promise a new frame every 15 minutes forever.** Six frames would be exhausted in roughly 90 minutes. The sustainable reward is improved driving, PBs, custom builds and small curated Career goals; frame unlocks are concentrated early-to-mid progression.

---

## 7. Recommended progression structure and actual unlock order

### 7.1 One screen, two activities, no double-gated grind

**Progress** screen (or existing Career/Series entry with a combined overview):

- **Series — Earn Cars**: visually ordered one-make frames; always show the reward and how many rounds remain.
- **Career — Earn Stars**: retain the current five tiers and mixed modes. Stars unlock **only subsequent Career tiers**, not the right to try a frame Series.
- **Open Cups — Race Your Build**: visible when any owned car can meet the PI rules; not a third levelling tree.

These are **two complementary activities under one navigation spine**. There is intentionally **no requirement** such as “win three Career medals to access the Rally cup, then earn Series points to enter the next Career tier.” Keep separate progress dimensions legible and avoid circular prerequisites.

### 7.2 Frame order (recommended display order; not a forced linear lock)

Harepin currently has 11 frames. Show the six Series in this suggested order by driving difficulty/theme. **All six are visible; start with two featured and let players choose a later one if they prefer.** A stronger early-game steering option is to emphasize (not hard-gate) the first two.

| Display order | Reward frame | Thematic Series (proposed name) | Driving lesson / venues (reuse existing world presets) | Suggested stage types |
|---|---|---|---|---|
| Start | **Hatch (FWD)** | Owned | Easy car for Island/Rookie | — |
| Start | **Coupe (RWD; Kaze body)** | Owned | Road handling, tuning | — |
| Start | **Tsumuji (light RWD)** | Owned | Lightness and momentum | — |
| 1 | **Rally (AWD)** | **Rally Trial** | Island road → Alpine pass → gravel/dirt route | Race / Head-to-head / Race |
| 2 | **Muscle (RWD)** | **Muscle Tour** | Open road → Raceway → faster road course | Race / Knockout / Race |
| 3 | **Sajin (4WD buggy)** | **Dune Challenge** | Dune sea → Big dunes → off-road run | Race / Head-to-head / Race |
| 4 | **Sturm (rear-engine RWD)** | **Sturm Sprint** | Raceway → technical pass → Raceway finale | Race / Knockout / Race |
| 5 | **Raijin (AWD)** | **Raijin Challenge** | Fast road → Raceway → challenging technical venue | Race / Head-to-head / Race |
| 6 | **Formula (open wheel)** | **Formula Cup** | Raceway layouts; emphasize precision, avoid dangerous Sky Track gaps as required progression | Race / Qualifying-style Duel / Race |
| Career Legend | **Fujin (hybrid AWD)** | **Existing Career Legend final reward** | Preserve current prestige goal | Career completion |
| Novelty | **Bus** | No competitive one-make cup | Free roam/custom/party; exclude from AI fields | — |

**Qualification:** This order is a *content proposal*. Verify that each AI frame can complete its selected route, that buggy/dirt AI remains competitive, and that the nominal PI is appropriate. Formula and fast AWD may demand greater player skill, so provide assists and a clear difficulty indicator. If a route/type has poor AI QA, swap the existing venue, not the progression system.

**Why not strictly C → B → A → S?** Harepin PI already distinguishes **D/C/B/A/S1/S2/X**; a *frame* is not inherently a class because tuning changes PI. Also, an AWD Rally on dirt may be more approachable than an allegedly lower-class RWD car on ice. Use PI to cap **Open Cups**; use handling identity and verified race pace to organize **one-make** content.

### 7.3 Exactly what each cup awards

| Outcome | One-Make Series | Open Cup | Career |
|---|---|---|---|
| Each round complete | Persist result, standings and round count | Persist result and standings | Existing stars + records |
| **All rounds finished (any final place)** | **Permanently unlock frame + all currently defined bodies** | First-clear themed **paint/decal**, once | Existing tier rewards |
| **Podium** | Cup trophy + badge/one reusable **Series Champion** style decal variant | Cup podium trophy | Existing 2/3-star achievement rules |
| **1st overall / replay improvement** | Gold trophy; optional car-specific livery using existing color/decal system | Gold record/badge | Improve star/best score |
| Endgame | No additional vehicle-specific prerequisite | Open Cup completions are mastery goals | **Fujin** remains Legend reward |

**Avoid high-cost art commitments:** Six exclusive new bodies or six bespoke 3D trophies are not needed. A framed thumbnail of the existing car + reusable badge graphic + one UI color per tier is enough. The owner may prefer podium to unlock the frame; if so, at least provide adjustable AI difficulty and retain round progress, but **completion-to-own is the recommended default**.

### 7.4 Difficulty and rival fairness

- Set opponent class/PI from the **actual fixed loaner build**, not one hardcoded class for the entire frame.
- For one-makes use the **same fixed vehicle performance** for player and AI; personalities may vary behavior, **not hidden tyre grip**.
- Standard points table can remain whatever Series currently uses; if absent, use e.g. `10, 8, 6, 5, 4, 3, 2, 1` for up to eight finishers, with defined ties/short fields. The numbers are an implementation placeholder, not a source-derived standard.
- Show **distance to podium** and point implications in the final round; **never fabricate a close race via rubber-banding**.
- **Known Harepin QA issue:** current AI brakes significantly more cautiously than the player. Before adjusting rewards based on finish rank, address the AI braking envelope, early traffic overbraking and track-specific capability from `ai-and-physics.md`. A trophy won against noncompetitive AI undermines mastery.

### 7.5 Implementation sketch (data-first; no new dependency)

```ts
// Definition data, not special cases in event runner.
type SeriesDef = {
  id: string;
  type: 'oneMake' | 'open';
  displayOrder: number;
  title: string;
  rewardFrameId?: string;           // oneMake only
  loanerBuildId?: string;           // fixed spec
  maxPI?: number;                   // open only
  rounds: Array<{ worldCode: string; eventId: string; kind: EventKind }>;
  firstClearCosmeticId?: string;     // open only
  podiumBadgeId?: string;
};

type SeriesProgress = {
  seriesId: string;
  completedRoundIds: string[];
  roundResults: Record<string, { place: number; points: number; buildCode?: string }>;
  bestOverallPlace?: number;
  firstClearClaimed: boolean;
};

function finishRound(def: SeriesDef, state: Save, result: RaceResult): Save {
  // Called ONLY on the result transition, never during 360 Hz physics.
  const p = upsertRoundIdempotently(state.series[def.id], result);
  const allDone = def.rounds.every(r => p.roundResults[r.eventId] !== undefined);
  if (allDone && !p.firstClearClaimed) {
    p.firstClearClaimed = true;
    if (def.type === 'oneMake' && def.rewardFrameId) {
      state.ownedFrameIds.add(def.rewardFrameId);
    }
    if (def.type === 'open' && def.firstClearCosmeticId) {
      state.cosmeticIds.add(def.firstClearCosmeticId);
    }
  }
  if (allDone) grantOrUpgradePlacementBadge(def, p, state);
  return state; // caller commits once to IndexedDB
}
```

Practical constraints:

- Use **stable `roundId`**, not just event type, as the key: there can be two `Race` rounds; in production also store `seed/worldVersion` as necessary for reproducibility.
- `Set` in pseudo-code means the existing save format's deduplicated ownership representation; adapt to existing IndexedDB schema and migration versioning.
- **Never add save/award calculations inside physics frames.** Persist on discrete round-result transitions only; make grant idempotent to avoid duplicated unlocks after crash/restart.
- If an event is replayed, retain **best placement** separately from the active championship attempt; don't grant the frame twice or erase a better trophy.
- Build a single generic `SeriesDef` + existing AI race runner; reuse current Series kinds and Career result screens. **No backend, new render system, currencies or dependencies.**
- **Performance:** Series menu cards, map/ladder markers and result progress are DOM/Svelte state updates **on navigation/result only**—**zero added world draw calls**, **zero per-frame physics allocations**, **no post-process effects**. Reuse existing garage car view; no rotating 3D reward scene is required. A fixed 2D silhouette/thumbnail is cheaper.

### 7.6 Shipping order (ranked)

| Priority | Smallest viable slice | Effort | Gain |
|---|---|---|---|
| **P0** | One curated **Rally Trial** 3-round loaner Series, frame unlock on completion, save/resume, clear reward UI | **Medium** | **Very high**: proves the core motivation loop |
| **P1** | One **C or B Open Cup** with PI cap, owned car, first-clear badge/decal, return to Garage | **Low–medium** | **High**: demonstrates why the unlocked frame matters |
| **P2** | Add the other five data-driven frame Series; small rival labels and trophy UI | **Medium**, mostly content/QA | **High**: full roster without new infrastructure |

Do **not** start by authoring six unique mini-stories, building a new map UI, inventing a credit shop or adding daily tasks. Run a small playtest with 3–5 people first, watching the first **15–30 minutes**. The design is unvalidated until outsiders can explain why they would start a second Series.

### 7.7 Acceptance tests for the agent

- Fresh save has **Hatch, Coupe, Tsumuji**; **Bus** is available in its intended novelty modes; Fujin is not owned.
- The reward and number of rounds are legible **before** entering each one-make Series.
- Every Series round can be resumed after reload; result and standings are stable with the same seeded event.
- Completing all rounds in any place grants exactly one copy of the frame; associated bodies are now selectable. Podium/gold upgrades the mastery marker without being required for ownership.
- Locked frames remain usable as **loaners in their cup and in P2P/custom**; they are not selectable as an owned Garage build.
- Open Cup accepts an owned frame within PI limit; rejects/flags over-cap builds; edits between races are validated; nitro remains off for both sides in AI races.
- Career stars and tier unlocks remain unchanged; Fujin still comes from Career Legend; cup progression does not create circular Career/Series prerequisites.
- A save with all frames previously unlocked under the older design is **migrated without taking cars away** (if current saves are considered disposable, the owner can explicitly choose a fresh progression reset instead).
- Repeat completion cannot duplicate grants. Replaying can update best finish/trophy.
- Works offline on phone landscape, desktop and gamepad; all feedback readable without hover.
- No added recurring world draw calls, no new update polling, no physics-step allocation, no forced blur, no server/dependency requirement.

---

## Decision points for the owner

1. **Frame on completion (recommended) or podium?** Evidence leans toward core accessibility and optionally demanding trophies; this is still a taste decision. A podium gate would make the trophy higher stakes but amplifies AI-balance and accessibility risks.
2. **All Series selectable immediately (recommended) or two-step unlock tiers?** I recommend **all visible and enterable**, highlighting Rally/Muscle as beginner choices. If a ladder must physically unlock, allow **either of two cups** to advance, never a single forced handling type.
3. **Fujin:** preserve as Career Legend, rather than moving the only aspirational hypercar into a loaner cup. This leaves a genuinely long-term goal.
4. **Bus:** keep novelty available without an AI cup; hiding the party vehicle behind competitive progression gives little value.

**Bottom line:** A Series should be a **short promise with a specific payoff**: *“Try this car in three different challenges; finish the championship and it's yours; place well for a trophy; then make it your own.”* Career remains the broad skills-and-cosmetics journey; Open Cups provide the reason to tune a newly earned frame.

---

## Sources and evidence quality

References are dated where a publication date is given. **Primary** = developer/platform publication; **review** = editorial critique; **player** = anecdotal community discussion; **guide/wiki** = mechanics reference; **research** = academic study. Source claims and Harepin-specific design judgments are explicitly separated above.

[S01]: https://blog.playstation.com/2022/02/02/gran-turismo-7-state-of-play-recap-and-your-first-few-hours-with-the-game/ "PlayStation Blog, GT7 State of Play and first hours, 2022 (primary)"
[S02]: https://www.gamesradar.com/gran-turismo-7-menu-books-how-many/ "GamesRadar, GT7 Menu Books guide, 2022 (guide)"
[S03]: https://gran-turismo.fandom.com/wiki/Elise_Trophy_%28GT4%29 "GT Wiki, GT4 Elise Trophy; see also https://home.hccnet.nl/paul.schuurmans/gt/gt4.html (mechanics reference)"
[S04]: https://support.forza.net/hc/en-us/articles/17466893801619-Forza-Motorsport-June-2023-Update "Turn 10, original Forza Motorsport progression design, 2023 (primary)"
[S05]: https://support.forza.net/hc/en-us/articles/27283008634515-Forza-Motorsport-Update-6-0-Release-Notes-March-11-2024 "Turn 10, Update 6 progression revisions, 2024 (primary)"
[S06]: https://forza.net/news/forza-motorsport-update-21?pubDate=20250617 "Turn 10, Champions Cup and progression changes, 2025 (primary)"
[S07]: https://forza.net/news/forza-horizon-celebrating-a-decade-of-festivals "Playground/Forza, history of open-ended Horizon progression, 2022 (primary)"
[S08]: https://support.forza.net/hc/en-us/articles/4410404129811-Forza-Horizon-5-gameplay-FAQ "Forza Support, FH5 accolades and festival progression (primary)"
[S09]: https://forums.forza.net/t/fh5-10-day-review-from-a-veteran-player/536486 "Official Forza Community Forums, player complaint on random rewards, 2021 (player)"
[S10]: https://www.gamespot.com/reviews/need-for-speed-unbound-review-comic-book-racing/1900-6418010/ "GameSpot, NFS Unbound review, 2022 (review)"
[S11]: https://www.mariowiki.com/Mario_Kart_Wii "Super Mario Wiki, Mario Kart Wii cup/character/kart unlocks (mechanics reference)"
[S12]: https://www.mariowiki.com/Mario_Kart_8_Deluxe "Super Mario Wiki, Mario Kart 8 Deluxe unlocks (mechanics reference)"
[S13]: https://www.trackmania.com/news/7590?lang=en "Ubisoft Nadeo, Summer 2023 medal locks (primary)"
[S14]: https://www.trackmania.com/news/8952 "Ubisoft Nadeo, January 2026 track medal-threshold changes (primary)"
[S15]: https://www.reddit.com/r/TrackMania/comments/14oyu22/new_locked_campaign_progression_is_really_annoying/ "Reddit Trackmania, casual-player complaints about campaign locks, 2023 (player)"
[S16]: https://www.epicgames.com/help/c-37599050/c-32343914/a22907429?lang=en-US "Epic, Rocket Pass cosmetic-only FAQ (primary)"
[S17]: https://www.rocketleague.com/news/removing-playertoplayer-trading-in-december "Psyonix/Rocket League, removal of player trading, 2023 (primary)"
[S18]: https://twinfinite.net/reviews/dirt-rally-2-0-review/ "Twinfinite, DiRT Rally 2.0 review, 2019 (review)"
[S19]: https://forums.ea.com/discussions/wrc-general-discussion-en/ea-sports%E2%84%A2-wrc-modes--features-deep-dive---discuss/8336082/replies/8336089 "EA/Codemasters WRC career overview (primary)"
[S20]: https://traxion.gg/ea-sports-wrc-review-if-in-doubt-flat-out/ "Traxion, EA SPORTS WRC review, 2023 (review)"
[S21]: https://forums.ea.com/discussions/other-ea-racing-games-en/grid-legends-car-list-hub-cars--classes-revealed/8494781 "EA/Codemasters, GRID Legends progression/loaner announcement (primary)"
[S22]: https://www.gamesradar.com/grid-legends-review/ "GamesRadar, GRID Legends review, 2022 (review)"
[S23]: https://www.thesixthaxis.com/2020/06/23/assetto-corsa-competizione-review-ps4-xbox-one/ "TheSixthAxis, ACC career review, 2020 (review)"
[S24]: https://steamcommunity.com/app/805550/discussions/0/2646361245003701084/ "Steam, ACC no-car-unlock discussion (player)"
[S25]: https://initiald.sega.com/howto04.html "Sega, Initial D Arcade Stage 8 Legends of the Street/rivals/points (primary)"
[S26]: https://www.predygames.com/en/media/games/tokyo-xtreme-racer/ "Genki/Predy official Tokyo Xtreme Racer 2025 overview (primary)"
[S27]: https://gropingtheelephant.com/blog/?p=4413 "Groping the Elephant, detailed Burnout Paradise licence analysis, 2019 (design analysis)"
[S28]: https://www.videogamer.com/reviews/burnout-paradise-review/ "VideoGamer, Burnout Paradise review incl. Burning Routes (review)"
[S29]: https://www.pocketgamer.com/csr-racing-2/times-to-beat-for-boss-car-unlocks/ "Pocket Gamer, CSR2 boss-car unlocks, 2024 (guide)"
[S30]: https://www.148apps.com/csr-racing-2/csr-racing-2-review/ "148Apps, CSR2 fuel/currency review, 2016 (review)"
[S31]: https://www.droidgamers.com/reviews/real-racing-3-review-they-key-to-enjoying-the-best-sim-racer-on-mobile-is-perseverance/ "Droid Gamers, Real Racing 3 wait-timer critique (review)"
[S32]: https://asphaltlegendsunite.com/news/the-showroom-feature "Gameloft, Asphalt showroom car progression (primary)"
[S33]: https://gamingonphone.com/reviews/asphalt-legends-unite-game-review/ "GamingonPhone, Asphalt Legends Unite blueprint economy critique, 2024 (review)"
[S34]: https://news.ubisoft.com/en-us/article/LvR7FeHcrqrzVw0CzispA/the-crew-motorfest-reveals-new-porsche-playlist-electric-supercars-and-a-tour-of-hawaii "Ubisoft, Motorfest playlists/loaner/Porsche car awarded, July 2023 (primary)"
[S35]: https://worthplaying.com/article/2023/9/29/reviews/139178-pc-review-the-crew-motorfest/ "Worthplaying, Motorfest loaner criticism, Sept 2023 (review)"
[S36]: https://www.reddit.com/r/The_Crew/comments/1b64alj "Reddit, Motorfest wanting to race owned cars, 2024 (player)"
[S37]: https://mcvuk.com/development-news/interview-driveclub-designer-simon-barlow-talks-progression-ui-and-meta-gaming/ "MCV/DEVELOP interview with Simon Barlow, Driveclub progression and loaners, Oct 2014 (developer interview)"
[S38]: https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf "Ryan, Rigby & Przybylski, The Motivational Pull of Video Games, Motivation and Emotion, 2006 (research)"

**Note on evidence quality:** This is an applied comparative review, **not** controlled experimental proof that any particular cup design maximizes retention. Player-discussion examples are anecdotes, and specific complaints can differ by game version and audience. Design targets (session length, unlock cadence, frame ordering and reward thresholds) should be validated with Harepin playtests.
