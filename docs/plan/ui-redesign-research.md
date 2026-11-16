# UI redesign research: how car games do it, and what Harepin has today

Task t324, quest 9b2c5e1, 2026-11-16. Code read from the integ worktree (`integ-review`, the 0.52.0 seasons and AI work). Research only: no code changed. Feeds t325 (3-5 complete variations).

Owner, 2026-11-16: "the current state is really not like a car game, it reads more like a normal web app with lists, buttons etc. Not immersive, confusing what to press where, how it all works."

Player text never names another game. This doc may.

Marks: a claim with a link is sourced; **(unverified)** means from general knowledge of the game, not checked against a source this session.

## 1. The field, 2026

| Game | Kind | Platforms | Why it is on this list |
|---|---|---|---|
| Forza Horizon 6 (Playground, 19 May 2026) | open world, arcade-sim | PC, Xbox; PS5 Jan 2027 | the year's reference racer: Metacritic 90, OpenCritic 100% recommend ([Wikipedia](https://en.wikipedia.org/wiki/Forza_Horizon_6), read 2026-11-16) |
| Mario Kart World (Nintendo, June 2025) | arcade, open world | Switch 2 | best-selling arcade racer of the period; the title screen *is* the world ([OpenCritic news, 2025-05-24](https://opencritic.com/news/17136/mario-kart-world-has-unique-title-screen)) |
| Gran Turismo 7 (Polyphony, 2022, still updated) | sim-lite | PS5 | the "menu is a place" hub (World Map, Café, Menu Books) ([GamesRadar](https://www.gamesradar.com/gran-turismo-7-menu-books-how-many)) |
| The Crew Motorfest (Ubisoft, 2023, live) | open world, playlists | PC, consoles | themed playlists as the career; a cautionary tale for icon-heavy menus ([Push Square](https://www.pushsquare.com/reviews/ps5/the-crew-motorfest)) |
| Rocket League (Psyonix, live; v2.66 Mar 2026) | car arena, online | all | the cleanest "car on a stage + Play button" lobby ([patch notes v2.66, 2026-03-10](https://www.rocketleague.com/news/rocket-league-patch-notes-v2-66)) |
| Asphalt Legends Unite (Gameloft, live) | mobile arcade | phone, PC, consoles | landscape-phone reference; auto-steer TouchDrive default ([Pocket Gamer](https://www.pocketgamer.com/asphalt-9-legends/asphalt-9s-stripped-back-controls-are-the-best-way-to-play-the-game-heres-five-r/)) |

Also on 2026 best-of lists: iRacing, Assetto Corsa Competizione, Le Mans Ultimate, F1 25, GRID Legends ([PCGamesN 2026](https://www.pcgamesn.com/10-best-racing-games-pc)). Pure sims are out of scope: their menus are web-app-like on purpose.

## 2. Screen by screen: what the field does

| Screen | Common pattern | Examples (source) | Take for Harepin |
|---|---|---|---|
| Boot / title | Title is a live shot of your last car driving the world; one press drops you into control with no load | Mario Kart World: + on the title starts Free Roam from the background video "seamless" ([OpenCritic](https://opencritic.com/news/17136/mario-kart-world-has-unique-title-screen)); praised as the best UI call even by critics of the rest ([TechRadar](https://www.techradar.com/gaming/nintendo/mario-kart-world-review)) | Boot shows the car already on the road; one key/tap = drive. No list first |
| Hub / main menu | Few big tiles over the 3D scene, grouped by intent (campaign, online, cars, me), bumpers switch groups | FH4/FH5/FH6 pause hub of tiles in tabs; tabs by Page Up/Down on keyboard (FH6 accessibility page, 403 on fetch; via [search summary](https://support.forza.net/hc/en-us/articles/51644264237075-Forza-Horizon-6-Accessibility-Support)); focus follows the visual tile layout ([XAG 112](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112), 2026-11-13). Asphalt: four nodes (garage, play, main menu, avatar), "simple but catchy", main menu "decluttered to make room for cars" ([Gameloft blog, 2021-12-07](https://www.gameloft.com/blog/players/modernizing-asphalt-8-airborne-uiux)) | 4-6 picture tiles max on the hub, car visible behind them |
| Hub as a place | The menu is a map you move a cursor over; locations = features | GT7 World Map: Café at the centre is the single-player hub; Garage, Brand Central, Used Cars, Tuning Shop are map sections ([GT Wiki](https://gran-turismo.fandom.com/wiki/World_Map)); critics still called the menus "convoluted" and "like an iOS app" ([VGC](https://www.videogameschronicle.com/review/gran-turismo-7-2/), [Jalopnik](https://jalopnik.com/gran-turismo-7-is-a-racing-sim-that-isnt-afraid-to-be-a-1848602261)) | A map hub is immersive but slow; works only with one obvious "next" marker |
| Event / world pick | World map with event pins **plus** "next event" recommendation after every finish | FH6: map so big that "even with filters on, finding specific events felt tedious"; saved by "smartly recommends events to take on after you finish one" ([FullCleared, 2026-05-27](https://fullcleared.com/reviews/forza-horizon-6-review/)). XAG: give a list alternative to a map ([XAG 112](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112)) | Map for wonder, rail/next card for choice. Never map-only |
| Career / season | Ladder of named tiers that gate car classes; each tier is a set of events with one gate event | FH6: 7 wristbands, each opens a higher class; first needs Qualifiers + Invitational; gold opens Legend Island ([forza.net, 2026-05-12](https://forza.net/news/forza-horizon-6-progression)). GT7: 39 Menu Books, each a short themed objective list handed in for a reward ([GamesRadar](https://www.gamesradar.com/gran-turismo-7-menu-books-how-many)). Motorfest: playlists, but "Main Stage" read "confusing" ([Game Informer](https://gameinformer.com/preview/2023/07/19/competent-and-familiar)) | Series = one card per event on a rail, the next one lit; tier gate visible |
| Parallel progress | 2-3 independent tracks so every activity counts | FH6: Wristbands (campaign), Stamps (exploring, collecting), Horizon Play (online, levels up to 25 feed wristbands) ([forza.net](https://forza.net/news/forza-horizon-6-progression)) | Series points, Runs season stars, goals: show all three as one "progress" strip, not three pages |
| Garage / tuning | Car centre stage in a 3D bay; categories as a strip; stats bar changes live on hover | Rocket League garage: body, decals, paint, wheels, boost, toppers ([ludo.guide](https://www.ludo.guide/guide/rocket-league/the-ultimate-guide/1-5-understanding-the-user-interface-ui)); Asphalt redesign started from the garage, "most important aspect after the races" ([Gameloft](https://www.gameloft.com/blog/players/modernizing-asphalt-8-airborne-uiux)); FH6 tuning "thinner than I'd like" but all settings present ([FullCleared](https://fullcleared.com/reviews/forza-horizon-6-review/)) | Keep Harepin's fixed 3D car; parts as a strip around it, the PI/class meter always in view |
| Car pick before an event | Filtered to eligible cars; the reason a car is out is shown | FH6 complaint: restrictions "feel bizarre" when a fitting car is excluded ([FullCleared](https://fullcleared.com/reviews/forza-horizon-6-review/)); after a first finish, Race Customizer lets any garage car rerun it ([forza.net](https://forza.net/news/forza-horizon-6-progression)) | Show the class cap on the car card; greyed cars say why |
| Online lobby | Big Play; modes as cards with live population; quick re-queue | Rocket League v2.66: Play menu shows population overall and per playlist; Freeplay loads the last map "immediately, with no confirmation" ([patch notes](https://www.rocketleague.com/news/rocket-league-patch-notes-v2-66)); removing Quick Play in 2020 was widely disliked ([Upcomer](https://upcomer.com/rocket-league-developer-responds-to-criticism-over-the-games-new-ui)). FH6 online = open world you drive in, Eliminator up to 72 ([Wikipedia](https://en.wikipedia.org/wiki/Forza_Horizon_6)) | Online = who is here (faces/cars) + one Join; the room is a world you drive in |
| Settings | Linear vertical lists, looped focus, tabs by bumpers; the one place a list is right | XAG: linear menus loop, grids do not; bumpers for tabs, A select, B back ([XAG 112](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112)) | Rows stay rows (owner rule); add bumper tabs + prompts |
| Pause | Overlay over the frozen drive: resume first, restart, next, map; car/world swap deeper | Mario Kart World 1.4.0 added Restart and Next Race to the pause menu and shows the track name ([The Shortcut](https://www.theshortcut.com/p/new-mario-kart-world-update-adds-a-long-awaited-fan-feature-and-track-changes?open=false)); FH6 pause holds the map + waypoint ([FH6 support, via search](https://support.forza.net/hc/en-us/articles/51644264237075-Forza-Horizon-6-Accessibility-Support)) | Pause = short vertical stack on the scene; Resume focused |
| Race HUD | Two lower corners (map, speed), position/lap top; everything else hidden | Lower corners keep the road clear ([asgamedesign](https://asgamedesign.blogspot.com/2020/12/racing-hud-layout.html)); Split/Second stripped to lap, position and one meter and reviewers "didn't miss it" ([Kotaku](https://kotaku.com/things-we-dont-need-to-see-such-as-our-speed-5458994)) | Already the owner's rule (mirrored corner cards). Position + gap top centre in races |
| Results / rewards | Staged: finish position big, then time/points, then reward reveal, then one Next | FH6 "recommends events after you finish one" ([FullCleared](https://fullcleared.com/reviews/forza-horizon-6-review/)); Asphalt notes the race-then-menu loop suits phone sessions, not PC ([Traxion, 2025-07-26](https://traxion.gg/why-adapting-asphalt-legends-for-multiple-platforms-is-a-constant-challenge/)) | Result card: one Next (next event), Retry small, Menu small |
| Onboarding | Drive first; teach in context; first hours unlock features one by one | FH6 first 3-4 hours introduce progression, homes, PR stunts, collectables step by step ([Red Bull](https://www.redbull.com/gb-en/forza-horizon-6-tips-for-beginners)); start without menu levels, quick start ([Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/allow-the-game-to-be-started-without-the-need-to-navigate-through-multiple-levels-of-menus/)) | Unlock menu tiles as the player meets them; no wall of 7 guide pages |

## 3. What makes it immersive

| Lever | How the field does it | Note |
|---|---|---|
| Car centre stage | Car or last car on screen in every menu; UI around it | Asphalt "decluttered to make room for cars and avatars" ([Gameloft](https://www.gameloft.com/blog/players/modernizing-asphalt-8-airborne-uiux)) |
| World as menu | Title is the world; menu fades, you are driving | Mario Kart World Free Roam from the title ([OpenCritic](https://opencritic.com/news/17136/mario-kart-world-has-unique-title-screen)); GT7 World Map ([GT Wiki](https://gran-turismo.fandom.com/wiki/World_Map)) |
| Camera moves as transitions | Each menu section has a camera framing; switching sections moves the camera, not the page | FH garage/hub camera orbits (unverified); Harepin already does this for the garage stage |
| Diegetic / spatial UI | Event markers in the world, start arches, gate beams; fiction x space model: diegetic, spatial, meta, non-diegetic | Fagerholt and Lorentzon, "Beyond the HUD", Chalmers 2009 ([DICE slides](https://www2.slideshare.net/DICEStudio/beyond-the-hud-user-interfaces-for-increased-player-immersion-in-fps-games)); racing speedos are contested between meta and non-diegetic ([Game Developer](https://gamedeveloper.com/design/user-interface-design-in-video-games)) |
| Zero-load swaps | Menu to car to world without a loading screen | Motorfest praised for moving between menu and vehicles "with little to no load time" ([Seasoned Gaming, 2023-09-15](https://seasonedgaming.com/2023/09/15/review-the-crew-motorfest-beyond-the-horizon/)) |

## 4. What makes it clear

| Rule | Source | Harepin translation |
|---|---|---|
| One primary action per screen, visually biggest, focused on open | Asphalt "most direct route, with no mistakes" ([Gameloft](https://www.gameloft.com/blog/players/modernizing-asphalt-8-airborne-uiux)); Rocket League Freeplay without confirm ([v2.66](https://www.rocketleague.com/news/rocket-league-patch-notes-v2-66)) | Every screen names its one action; secondary actions are small icons (owner rule) |
| Same prompts, same place, every screen | Sea of Thieves: select/back prompts always bottom-left ([XAG 112](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112)) | One prompt strip, fixed corner, glyphs for the live device |
| Prompts match the device in hand, switch on last input | Apple game guidance: show prompts for the connected controller, update on switch (Apple HIG "Designing for games"; page did not render, paraphrase **(unverified)**) | `Kbd` glyphs swap keyboard / pad / touch on last input |
| Focus follows the picture, not the DOM | FH4 hub: down from Settings lands on what is visually below ([XAG 112](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112)) | Spatial focus on rails and tile grids; linear lists loop |
| Always a way back to the hub | XAG 112 "persistent links back to the main menu" | B / Esc / system back = up one level, never a header x bar (owner rule) |
| Icons alone confuse | Motorfest: "half their time puzzling over what the little icons mean" ([Push Square](https://www.pushsquare.com/reviews/ps5/the-crew-motorfest)) | Icon + one word on tiles |
| Few levels to start | quick start ([GAG](https://gameaccessibilityguidelines.com/allow-the-game-to-be-started-without-the-need-to-navigate-through-multiple-levels-of-menus/)) | Boot to driving in one input |

## 5. Phone landscape

| Pattern | Source | Harepin today / take |
|---|---|---|
| Auto-steer default for newcomers; drift + nitro are the inputs; manual and tilt opt-in | Asphalt TouchDrive is the default ([Pocket Gamer](https://www.pocketgamer.com/asphalt-9-legends/asphalt-9s-stripped-back-controls-are-the-best-way-to-play-the-game-heres-five-r/)) | Out of scope for the UI pass; noted |
| Side tabs beat a bottom bar on wide phones (thumb reach) | Asphalt 8 modernisation: "vertical tabs on the sides" replaced horizontal bottom bars ([Gameloft](https://www.gameloft.com/blog/players/modernizing-asphalt-8-airborne-uiux)) | Thumb-zone nav: left/right edges at 844x390 |
| Touch menus port badly to pad; check pad from day one | Gameloft: same menus on controller felt "clumsy" ([Traxion](https://traxion.gg/why-adapting-asphalt-legends-for-multiple-platforms-is-a-constant-challenge/)) | Design every screen for pad and touch together |
| Safe areas: interactive UI inside, art edge to edge | Apple HIG (paraphrase, **(unverified)**); web: `env(safe-area-inset-*)` | Rails and prompts inside insets; scene full-bleed |
| Short sessions: race, result, next | Traxion on Asphalt's race-menu loop | Result card's Next is the main loop on phone |

## 6. Anti-patterns the field gets criticised for

| Anti-pattern | Where | Source |
|---|---|---|
| Map-only event finding | FH6 | [FullCleared](https://fullcleared.com/reviews/forza-horizon-6-review/) |
| Map shows no useful information | Mario Kart World Free Roam (fixed later by P-switch tracking, 1.3.0) | [The Shortcut](https://www.theshortcut.com/p/new-mario-kart-world-update-adds-a-long-awaited-fan-feature-and-track-changes?open=false) |
| Grid of near-identical slots (costumes as separate characters) | Mario Kart World character select | [VGC](https://www.videogameschronicle.com/review/mario-kart-world-review/) |
| Menu "like an iOS app", forced back to menus between challenges | GT7 | [Jalopnik](https://jalopnik.com/gran-turismo-7-is-a-racing-sim-that-isnt-afraid-to-be-a-1848602261), [VGC](https://www.videogameschronicle.com/review/gran-turismo-7-2/) |
| Icon soup, unclear hub | Motorfest Main Stage | [Push Square](https://www.pushsquare.com/reviews/ps5/the-crew-motorfest), [Game Informer](https://gameinformer.com/preview/2023/07/19/competent-and-familiar) |
| Removing a one-press re-queue | Rocket League 2020 | [Upcomer](https://upcomer.com/rocket-league-developer-responds-to-criticism-over-the-games-new-ui) |
| Cluttered redesign | Asphalt Unite UI | fan wiki, weak source ([Asphalt Wiki](https://asphalt.fandom.com/wiki/Asphalt_Legends)) |

## 7. Harepin today: how it is put together

Paths are under `src/` in the integ worktree unless noted.

| Fact | Where | Why it reads web-app |
|---|---|---|
| No title screen. Boot: `#loading` ("Building island…"), then the Guide on first visit, else the menu open on Play over the live world | `index.html:340`, `boot.ts:18-23`, `main.ts:606-615` | first screen is a dashboard, not the car |
| The whole game is one overlay `div.settings`: 5 pill tabs (Play, Garage, Online, Settings, Support) + 7 child pages = 12 pages | `menu/settings.ts:38`, `page_list` | the tab bar of a web app |
| Top bar: brand, name chip, update chip, room chip, Sponsor chip, X | `menu/settings.ts:273-300` | 6 equal chips; Sponsor weighs as much as Play |
| Child pages get a hand-built Back · Title · X bar ("Back to driving"); `ui/PageHead.svelte` is unused | `menu/settings.ts:312-325` | the exact "back and x on top" the owner rejected |
| Scene behind the menu: 72% darkest-colour wash + 8px blur; only the Series stage uses a 35% shade, no blur | `menu.css:1-9`, `menu.css:108-117` | the world is hidden exactly where it should sell the game |
| Picking a world, event or run sets `location.search` and reloads; loading screen every time | `menu/settings.ts:440`, `main.ts:526,551,572` | page navigation, not a camera move |
| Pause = the full menu (desktop Esc); touch has a second layer `#hud-sheet` (10 tiles + 6 aids) whose "Main menu" opens a third | `hud/input.ts:217`, `hud/hud-sheet.ts`, `index.html:375-401` | no pause screen; three menu layers on phone |
| Sim holds behind the menu or sheet only when alone in the room | `main.ts:832` | correct, keep |
| Pad: spatial focus by rect, A/B/LB/RB, prompts only when a pad is connected | `menu/pad-menu.ts:45-67,162-178` | good base; no per-device prompts for keys or touch |
| Garage arrows mean something else than elsewhere | `menu/settings.ts:476`, `main.ts:825` | inconsistent focus model (XAG 112) |
| Portrait blocked by a rotate screen; phone layout by `max-height:500px` and `pointer: coarse` | `index.html:344`, `menu.css:366-391`, `hud/phone.css:203` | fine; 844x390 is the design size |

## 8. Screen inventory

| Screen | Files | Reached by | Shows | Confusing / web-app-like |
|---|---|---|---|---|
| Loading | `index.html:340`, `boot.ts` | every load and reload | logo, "Building island…" | seen on every world change |
| Guide (7 steps) | `menu/guide/*`, `guide.svelte.ts:10-18` | first visit; Settings > Guide | step rail, copy + visual per step, Back/Next/Skip | a wizard before driving; theme pick reloads into it |
| Play tab | `menu/PlayPage.svelte` | default tab | 2D island map + legend; column of CareerHero, RunsCard, Free drive, mini-map tiles, Create world, Modes, GoalsCard | ~6 equal cards, no primary action; "Keep driving" is a small button in a card |
| Create world | `menu/WorldPage.svelte`, `world-map.svelte.ts` | Play tile, M | numbered steps: kind tiles, map-code field, knobs (Segmented/Slider), save name, saved list, 2D preview | a form; M is not a map |
| Modes | `menu/ModesPage.svelte` | Play tile, HUD | 7 mode nav tiles + a Tabs copy of them; RowList of levels with Go | same choice twice; rows of identical Go |
| Career | `menu/CareerPage.svelte`, `Career{Profile,Goals,Spine,Done}.svelte`, `TrophyCase.svelte` | CareerHero "All events", HUD shield | profile + Next up, tier spine, trophy case | dense; three entry points |
| Series (review only, `?series`) | `menu/Series*.svelte`, `series-view.ts`, `series-swipe.ts` | `?series`, Play | coverflow card strip on the live scene + standings | the one immersive page: the model to spread |
| Runs | `menu/runs/RunsPage.svelte`, `RunBuilder.svelte`, `SeasonBar.svelte`, `RunsCard.svelte` | Play RunsCard | Tabs Today / Build; daily, weekly, endless rows with Go; builder = 8 form rows | event builder is a settings form |
| Things to try | `menu/GoalsPage.svelte`, `GoalsCard.svelte`, `goals/goals.ts:44-58` | Play GoalsCard | progress bar + 14 rows with Go/Done | to-do list |
| Garage | `menu/GaragePage.svelte`, `Garage{Strip,Meters,Builds,Hint}.svelte`, `garage-stage.ts` | tab, V, car button | live 3D stand (orbit); Body/Performance/Paint/My builds Tabs; slot Tabs + slot tile list; meters; part strip | Tabs in Tabs; slots shown twice. The car stage is right, keep it |
| Car pick | `menu/CarPick.svelte`, `car-pick.ts`, `ui/Dialog.svelte` | class-capped event, Change car | modal of car shelves | a modal, against `menu/AGENTS.md` |
| Online | `menu/online/OnlinePage.svelte` + `Online{Room,Race,DailyBoard,Players,Games}.svelte` | tab, room chip | two columns of cards: room, lobby race (laps, routes, ready), daily board, players, games | many equal buttons; nobody's car is shown |
| New room | `menu/online/RoomPage.svelte` | Online > New room | 3 text fields + Create room | plain form |
| Settings | `menu/settings-tab/*` | tab, gear | section tiles, ~45 rows, help aside, Reset, version, Guide | OS-settings look; Guide and What's new hidden in its footer. Rows are right (owner rule) |
| Settings deep pages | `ThemeCreate`, `SavedThemes`, `KeyList`, `Bindings`, `PadAdvanced`, `ChangesList.svelte` | Display/Controls rows, H | theme maker, keys, rebinding, pad curves | deep; H = help is a key table |
| Support | `menu/SupportPage.svelte` | tab, Sponsor chip | 4 text cards, issue links | a top-level tab for non-play content |
| Update / What's new | `menu/update.ts`, `UpdateToast.svelte`, `Changelog.svelte`, `Release*.svelte`, `UpdatedCard.svelte` | auto, version pill | toast, release stories, notes | fine |
| Desktop HUD | `index.html:403-427`, `hud/hud.ts`, `top-bar.css`, `corner.css`, `dash.css` | driving | top action bar of 7 icons, lap strip, minimap card, speed card, aid chips | garage/settings/aids reachable 3-4 ways; icons unlabelled (titles only, `hud/key-hints.ts`) |
| Touch HUD + sheet | `hud/touch.ts`, `touch.css`, `phone.css`, `hud-sheet.ts` | coarse pointer | steer, pedals, handbrake, nitro, rewind, menu; sheet "Paused" | the sheet is a second menu |
| Event marker | `career/marker-card.ts`, `marker-view.ts`, `event-markers.ts` | drive to a 3D flag | name, stars, lock, Start | the only diegetic start; seed for "world as menu" |
| Career shield | `career/career-button.ts`, `badge.ts` | HUD | tier shield | meaning unclear without a word |
| Race start | `modes/race-lights.ts`, `#countdown` | race start | 3 lamps | fine |
| Mode status / hint | `index.html:456-458`, `modes/*-view.ts` | during a run | name, clock, turn arrow | fine |
| Result card | `index.html:459-474`, `modes/modes.ts:636`, `modes/result.ts`, `career/unlock-card.ts` | run end | title, stars, lines, standings, unlock, then **Retry · Change car · Next · Try it in the garage · Free drive** | five equal buttons, no main one |
| Lobby race panel | `modes/race-view.ts` | lobby race | status + results | separate from the result card |
| Stuck prompt | `hud/stuck-prompt.ts` | auto | Rewind / Reset car | fine |
| Chat, toast | `index.html:477-494`, `goals/toast-queue.ts` | T, auto | log, input, invite | fine |
| Car viewer | `viewer/*` | `?cars` | orbit viewer, export | dev tool, out of scope |

### The confusion, in one table

| Problem | Evidence |
|---|---|
| No "press this to drive" | Play has ~6 equal cards; Keep driving is small (`PlayPage.svelte`) |
| Same thing, many doors | Career: CareerHero, Career page, HUD shield, marker flags. Aids: 4 places. Garage: tab, V, car button, result card |
| Same choice shown twice | Modes nav + Tabs; Garage slot Tabs + slot list |
| Every choice is a list row with Go | Modes, Runs, Goals, Online games (`ui/RowList.svelte`) |
| Forms where a game would show pictures | Create world, Run builder, New room |
| World hidden behind blur | `menu.css:1-9` |
| Hard reloads between choices | `location.search =` in `main.ts`, `settings.ts` |
| Three menu layers on phone | HUD sheet > Main menu > tabs |
| Non-play in the top level | Support tab, Sponsor chip in the header |

## 9. Principles the redesign variations must follow

1. **Car and world first.** The 3D scene is never blurred out; menus are a thin layer over a framed shot of the car or the world, moved by the camera, not by pages.
2. **One primary action per screen**, biggest and focused on open; secondaries are small icons (owner rule). Boot reaches driving in one input.
3. **Picture tiles and card rails, never rows with Go.** Hub = 4-6 big tiles; choices = the coverflow rail from Series (centre flat, sides turned, no overlap). Rows only in Settings.
4. **No header bar with Back and X.** B / Esc / system back go up one level; a fixed prompt strip shows it.
5. **One door per feature**, at most one shortcut. Career, garage and aids each have one home.
6. **Same input model everywhere:** spatial focus, A select, B back, LB/RB groups, prompts in one corner with glyphs for the last-used device (keys, pad, touch).
7. **Phone landscape is the design size** (844x390): thumb-reach rails and buttons at the edges, one menu layer on touch (pause = the menu).
8. **Results end in one Next**: the next event or the recommended one; retry, change car and garage stay small.
9. **Teach by unlocking**, not a 7-step wizard: drive first, then tiles light up as the player meets them; every map has a "next" marker and a rail beside it.
10. **Keep what works:** the garage's fixed 3D car, filled solid HUD cards (no blur), mirrored corners, the Series rail, in-world event flags, settings rows, theme tokens, no player text naming other games.

Open question for t325, not decided here: the hard reload on a world change is architecture (`location.search`), so a variation that needs a seamless world swap names it as a cost.

## 10. Sources

All read 2026-11-16 unless noted. Fetch failures: GTPlanet FH6 review (403), FH6 accessibility page (403, search summary used), Apple HIG games page (no body), Game UI Database (403).

- Forza Horizon 6: [Wikipedia](https://en.wikipedia.org/wiki/Forza_Horizon_6); [forza.net progression, 2026-05-12](https://forza.net/news/forza-horizon-6-progression); [FullCleared review, 2026-05-27](https://fullcleared.com/reviews/forza-horizon-6-review/); [Red Bull beginner tips](https://www.redbull.com/gb-en/forza-horizon-6-tips-for-beginners); [FH6 accessibility support](https://support.forza.net/hc/en-us/articles/51644264237075-Forza-Horizon-6-Accessibility-Support)
- Mario Kart World: [OpenCritic, 2025-05-24](https://opencritic.com/news/17136/mario-kart-world-has-unique-title-screen); [TechRadar review](https://www.techradar.com/gaming/nintendo/mario-kart-world-review); [VGC review](https://www.videogameschronicle.com/review/mario-kart-world-review/); [The Shortcut, 1.3.0 / 1.4.0](https://www.theshortcut.com/p/new-mario-kart-world-update-adds-a-long-awaited-fan-feature-and-track-changes?open=false)
- Gran Turismo 7: [GamesRadar Menu Books](https://www.gamesradar.com/gran-turismo-7-menu-books-how-many); [GT Wiki World Map](https://gran-turismo.fandom.com/wiki/World_Map); [VGC review](https://www.videogameschronicle.com/review/gran-turismo-7-2/); [Jalopnik](https://jalopnik.com/gran-turismo-7-is-a-racing-sim-that-isnt-afraid-to-be-a-1848602261)
- The Crew Motorfest (2023): [Push Square](https://www.pushsquare.com/reviews/ps5/the-crew-motorfest); [Game Informer](https://gameinformer.com/preview/2023/07/19/competent-and-familiar); [Seasoned Gaming](https://seasonedgaming.com/2023/09/15/review-the-crew-motorfest-beyond-the-horizon/)
- Rocket League: [patch notes v2.66, 2026-03-10](https://www.rocketleague.com/news/rocket-league-patch-notes-v2-66); [Upcomer, 2020 UI](https://upcomer.com/rocket-league-developer-responds-to-criticism-over-the-games-new-ui); [ludo.guide UI](https://www.ludo.guide/guide/rocket-league/the-ultimate-guide/1-5-understanding-the-user-interface-ui)
- Asphalt: [Gameloft UI/UX blog, 2021-12-07](https://www.gameloft.com/blog/players/modernizing-asphalt-8-airborne-uiux); [Traxion, 2025-07-26](https://traxion.gg/why-adapting-asphalt-legends-for-multiple-platforms-is-a-constant-challenge/); [Pocket Gamer, TouchDrive](https://www.pocketgamer.com/asphalt-9-legends/asphalt-9s-stripped-back-controls-are-the-best-way-to-play-the-game-heres-five-r/)
- Guidelines: [Xbox Accessibility Guideline 112, 2026-11-13](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112); [Game Accessibility Guidelines, quick start](https://gameaccessibilityguidelines.com/allow-the-game-to-be-started-without-the-need-to-navigate-through-multiple-levels-of-menus/); [Fagerholt and Lorentzon 2009, DICE slides](https://www2.slideshare.net/DICEStudio/beyond-the-hud-user-interfaces-for-increased-player-immersion-in-fps-games); [Game Developer, UI in games](https://gamedeveloper.com/design/user-interface-design-in-video-games)
- HUD: [asgamedesign, racing HUD layout](https://asgamedesign.blogspot.com/2020/12/racing-hud-layout.html); [Kotaku, Split/Second](https://kotaku.com/things-we-dont-need-to-see-such-as-our-speed-5458994)
- Lists: [PCGamesN best racing 2026](https://www.pcgamesn.com/10-best-racing-games-pc)
