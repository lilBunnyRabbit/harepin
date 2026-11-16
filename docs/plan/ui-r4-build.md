# UI redesign, round 4: build plan

Task t334, quest 9b2c5e1, 2026-11-16, on master `12bc42c`. Plan only: no code changed.

Source of truth: the round 4 design in the session scratchpad
(`C:/Users/Andra/AppData/Local/Temp/claude/e1d87b4eb5de59d0/ccf992df-ff9c-447b-a79d-5b6da3c0a3e5/scratchpad/ui-r4/`, called `ui-r4/` below: `README.md`, `png/`, `menu/`, `road/`, `sheets/`), with the owner's corrections from the quest's "Decided (owner 2026-11-16, round 4)" section:

- Every round 4 recommendation stands. Season is 17 v1. A HUD size setting is added.
- The showroom is an overlay stage scene over the loaded map. Go on the same map does not reload.
- Map names read "Island · <biggest town>". Stations are Drive · Events · Garage · Online · Settings; "map" is the only place word.
- Button: the layered key cap in the round 2 room's colours (`ui-r2/A/screens/10-lobby-v1.html:93-105`, `ui-r2/A/screens/shared.css:134-146,193-205,645-671`). Not round 4's dark cap (`ui-r4/menu/showroom.css:202-217`).
- Car pick: both. The gate card's car row, plus a button on it that opens the full-screen showroom picker (07 v2).
- Pause in an event: round 2 B14 v1, not round 4's 10 v2. Free roam keeps 10 v1.

Background: `docs/plan/ui-redesign-research.md` (screen inventory, section 8), `docs/plan/svelte-ui.md` (scale, breakpoints), `AGENTS.md` (Svelte rules, registries).

## 1. Two layers in today's code

- **Road:** what shows while the car can move. Today it is vanilla TS and DOM in `index.html:404-494`, `src/hud/`, `src/career/marker-*.ts` and `src/modes/`.
- **Showroom:** the menu. Today it is one overlay `div.settings` with five tabs (`src/menu/page.ts:21-28`, `src/menu/settings.ts:99-112`), a brand and chip bar (`src/menu/settings.ts:273-300`) and a Back · Title · X head on child pages (`src/menu/settings.ts:312-325`). It is blurred over a 72 % wash (`src/menu/menu.css:1-5`). One layout already sits on the live world with no blur: `stage` (`src/menu/menu.css:108-136`), used by Series.
- **Sim hold:** the sim holds behind the menu only when no peers are present (`src/main.ts:832`). The held world redraws every 100 ms (`src/main.ts:761`, `src/main.ts:833-842`).

## 2. Screen map

Ids are `ui-r4/README.md` screen numbers. "Port" means a new Svelte component that replaces the vanilla DOM. "Rework" means an existing Svelte page whose layout changes.

| # | Screen (variant) | Layer | Today | Work | Reuses |
|---|---|---|---|---|---|
| 02 | Key-cap button | both | `ui/Button.svelte:1-99` (flat), `ui/Kbd.svelte:1-31` | new shared component + CSS, section 4 | Button tokens, `--on-primary` from `theme.ts:271-276` |
| 03 | Title (B01 v1) | showroom | none. Boot opens the Play page or the Guide (`main.ts:606-615`); `#loading` is the only splash (`index.html:340`) | new: the showroom at boot on Drive, with the wordmark and one Drive button | showroom stage (A1), `boot.ts` loading |
| 04 | First run (A15 v1 + strip) | road | 7-step Guide wizard (`menu/guide/*`, opened at `main.ts:614`) | new road piece: HOLD W painted ahead of the car, plus a three-step goal card. The Guide keeps only the name and theme steps behind Settings | `goals/` toasts, `hud/key-hints.ts` |
| 05 | Roam + Next up ticket (A02 v2, + elsewhere state) | road | none. Next up lives in CareerHero on Play | new HUD ticket: arrow and distance for "on this map", a globe and Hold Tab / RB to travel for "another map" | `career/career.ts:218` `next_event`, `career-model.ts:114` `goals`, the place data (A5) |
| 06 | Event gate (A03 v2 content, v1 footprint) | road | `career/marker-card.ts:14-57`: id, name, stars, lock, Start. Shown by `event-markers.ts:65-82` under 5 m/s | rework as a 600 px corner card: tier, title, star-time chips, car line, hold-to-start KeyButton | `EventMarkers` flags and `marker_open`, `start_event` (`main.ts:516-530`) |
| 07 v1 | Car row in the gate card | road | the CarPick modal (`menu/CarPick.svelte`, 370 lines; `car-pick.ts`), opened by `modes.change_car` (`modes/modes.ts:364`) | new: a five-car row in the gate card with class plates and the reason a car is greyed. One button opens 07 v2 | `car/pi.ts` class, `modes/event-car.ts` |
| 07 v2 | Car pick (B07 v2) | showroom | same modal | port the modal into a showroom page: class tabs and a car shelf on the stage | `CarPick.svelte` shelves, `CarStill.svelte` |
| 08 | Map (A04 v2) | road | the Create world page on M (`main.ts:701`) and a 2D map on Play (`WorldMap.svelte`, `world-map.svelte.ts`) | new road overlay: this map's flags, name corner, rail with Go | `world-map.svelte.ts:158,267-279` paints the map and towns; `host.map_markers()` (`menu/page.ts:106`) |
| 09 | Travel (v1) | load | `#loading` "Building island…" (`index.html:340`, `boot.ts:18-23`); every map change sets `location.search` (`main.ts:526,551,572`, `settings.ts:440`) | rework `#loading` into the destination card: from → to, event, star times, bar | `public/menu/<kind>.webp`, `KEPT_ON_EVENT` (`main.ts:117`) |
| 10 v1 | Pause, free roam (A11 v2 + B14 assist chips) | road | Esc opens the full menu (`hud/input.ts:217`, `main.ts:703`). Touch has `#hud-sheet` (`index.html:375`, `hud/hud-sheet.ts:7`) with "Main menu" as a third layer. Pad uses `menu/pad-menu.ts:123` | new pause: Resume bar, Reset, Settings, and four picture doors that open the showroom at a station. It replaces `#hud-sheet` and the Esc-opens-menu path | `ACTIONS` (`main.ts:683-705`), aid toggles, `menu_hold` |
| 10 v2 | Pause, in an event (B14 v1, owner) | road | same as above | new: run card (place, lap, time), Restart · Leave · Showroom · Settings with keys, assist chips, Resume as the KeyButton | `modes.active`, `modes.exit` |
| 11 | Drive station / hub (B03 v1) | showroom | `PlayPage.svelte` (242 lines): map, legend and ~6 equal cards | rework into the stage, car left, three tiles (Keep driving, Next up, Today's run) | `CareerHero` data, `RunsCard` data |
| 12 | Next up (B17 v1) | showroom | CareerHero / `CareerGoals.svelte` | new page: big ticket, three reasons, three other picks, Travel | `career-model.ts:114` `goals`, `career.ts:218` |
| 13 | Events (B09 v2, + v2 in a tier) | showroom | `CareerPage.svelte` (114 lines) with Profile, Goals, Spine, Done, TrophyCase | rework: tier coverflow with the tier's events grouped by map; v2 is the event coverflow inside a tier | `career-model.ts:68-89` `tier_view(s)`, `SeriesFlow.svelte:79` coverflow + `series-swipe.ts:7` |
| 14 | Maps / world pick (B04 v2) | showroom | Play's mini-map tiles + `WorldPage.svelte` | new page: the big map with its flags and events as tickets, a map rail ending in Make a map | `WorldMap.svelte`, `worlds/worlds.ts` `MINIS`, map names (A3) |
| 15 | Make a map (v1 roll first) | showroom | `WorldPage.svelte` (600 lines): steps, code field, knobs | rework: one preview, Roll as the main action, six type chips beside it (LT/RT), knobs behind Y | `world-map.svelte.ts`, `kinds/map-code.ts`, `land-knobs.ts` |
| 16 | Garage (B08 v1) | showroom | `GaragePage.svelte` (410 lines) on its own stage canvas (`garage.svelte.ts:94`, `garage-stage.ts:57-125`) | rework the layout: side profile, part pins, parts row, class card, KeyButton Fit | `GarageStage`, `GarageStrip`, `GarageMeters`, `garage-strip-key.ts` |
| 17 v1 | Season (A06 v1 + B10 v1, owner) | showroom | `menu/runs/RunsPage.svelte` (230 lines), `SeasonBar.svelte`, `RunBuilder.svelte` | rework: run coverflow, one reward bar, free-runs count | `runs/season.ts:3-42`, `runs/runs-store.ts`, `SeriesFlow` |
| 18 v1 | Online (B11 v1) | showroom | `online/OnlinePage.svelte` (85 lines) with Room, Race, DailyBoard, Players, Games | rework: one room tile with faces, New room, Daily board | `online/join.ts`, `net/` unchanged |
| 18 v2 | In a room while driving (A09 v1) | road | room chip in the top bar (`settings.ts:300`), chat (`index.html:478-494`) | new HUD room chip + meet card + Hold to join in the online tone | `net/` lobby state, `hud/presence.ts` |
| 19 v1 | Race meet (A10 v1 + B12 v1) | road | `modes/race-view.ts` (150 lines) lobby panel, `OnlineRace.svelte` | new grid of car cards at the pad, Ready as the KeyButton | `modes/lobby-start.ts`, `race-view.ts` state |
| 19 v2 | Race meet from the showroom (B12 v1) | showroom | `OnlineRace.svelte` | rework into a driver-card grid | same |
| 20 v1 | Settings + live theme (B13 v1) | showroom | `settings-tab/SettingsPage.svelte` (388 lines) + sections. A theme change saves and reloads (`DisplaySection.svelte:43-46`, `sections.ts:236-239`) | rework: rows stay; Theme preview on focus | `apply_theme` (`theme/theme.ts:271`), `choose_theme` (`theme.ts:261`) |
| 20 v2 | Settings from pause, HUD size | road | none | new: the sheet right, road left; HUD size previews live | A4 setting |
| 21 | Race HUD (A13 v1) | road | `hud/hud.ts` (316 lines), `top-bar.css`, `corner.css`, `dash.css`; 7-icon action bar (`index.html:404`) | rework: one top card (place, lap, gap, gates); minimap and speed as mirrored corners; the icon bar goes (pause owns those doors) | `hud.ts`, `minimap.ts`, `HudLayout` (`prefs.ts:47-53`) |
| 22 v1 | Results (A14 v2, upright) | road | `#mode-result` (`index.html:459-473`), `modes/modes.ts:636-700`: five equal buttons | rework: upright place stamp, facts and rewards bottom left, Next up card with a place chip and Travel / Go; Esc keeps driving | `show_result`, `show_event`, `show_play`, `career/unlock-card.ts` |
| — | Car viewer | dev | `viewer/*` on `?cars` | unchanged; its turntable floor feeds the showroom (A1) | `viewer/stage.ts:40` `stage_floor` |

Dropped by the design: the Support tab and Sponsor chip as top-level entries (`settings.ts:295-300`; Support moves under Settings), the Modes page (`ModesPage.svelte`; modes are reached through events and runs), and Things to try (`GoalsPage.svelte`; the first-run strip and Next up take over). Each removal needs its own owner nod before deletion, since none is named in "Decided".

## 3. Architecture items (owner calls before any code)

Each item lists options lightest first and ends with a recommendation. Items marked "decided" are settled in what; only the how is open.

### A1. Showroom as an overlay stage over the loaded map (decided: overlay)

Facts:

- The world renderer is one `WebGLRenderer` + composer (`render/render.ts:42-72`). It keeps drawing behind the menu at 100 ms (`main.ts:761,833`).
- The garage already draws a car on its own transparent canvas and second renderer over the world (`menu/garage-stage.ts:103`, `alpha: true`), with fitted framing and orbit (`garage-stage.ts:57-125,261-365`). The garage path skips the menu redraw throttle (`main.ts:834`, `!garage.is_open`).
- The car viewer has a turntable floor that fades into the backdrop (`viewer/stage.ts:40,115`). Its `Stage` owns a third renderer with `preserveDrawingBuffer` (`viewer/stage.ts:110`), so only its floor and lighting are reusable.

| Option | What | Breaks / costs |
|---|---|---|
| a. Grow `GarageStage` into the showroom stage | One transparent canvas under every showroom page; add the viewer's `stage_floor` as the turntable; stations move the camera pose (`aim`, `garage-stage.ts:191`) | Second GL context (it exists today whenever the garage is open). The car model is built twice (`build_view` in `driver.ts:53` and `garage-stage.ts`). Lighting does not match the world's time of day |
| b. Overlay scene in the game's renderer | `Render.draw` (`render.ts:123-126`) renders a second `THREE.Scene` after the composer, with depth cleared | One context and shared car geometry. New API in `render/` (render owner's area); bloom and output pass ordering need care; the world camera must not move |
| c. Turntable placed in the world scene | A pad beside the parked car; the chase camera frames it | No new scene. But streamed chunks, fog and world light decide how the car looks, and the car must leave the road |

**Recommend a.** It is existing code that already ships this exact effect for the garage. It moves into the showroom shell (`src/menu/showroom/`) and the garage page uses it like every other station. Revisit b only if the perf proof (`docs/plan/perf-audit-2026-11.md` method) shows the second context costs frames on the phone tier. The menu wash goes from the 72 % blur to the `stage` layout's light shade (`menu.css:108-136`) for every showroom page.

### A2. Go on the same map without a reload (decided: yes)

Facts: an event on the loaded map already starts in place (`main.ts:514,527-528`: `settings.close(); modes.play_event(to)`). Only another map reloads (`main.ts:519-526`). Runs do the same (`main.ts:560-577`). The gate card shows itself when the car stops under 5 m/s at a flag (`career/event-markers.ts:13,79-81`). `Driver.place_road(index)` is public (`car/driver.ts:142-146`); `teleport` is private (`driver.ts:149`) and `reset` spawns near a point (`driver.ts:93-103`).

| Option | What | Breaks / costs |
|---|---|---|
| a. Go = start the event | Call today's `start_event` | Skips the gate card, so the 07 v1 car row and the star times on 06 never show |
| b. Go = place the car on the nearest road to the flag | `driver.place_road(world.road.indexOf(world.nearest_road(m.x, m.z)))`, all existing | Gymkhana and parking flags stand on open ground off the circuit, so the car can land far from the flag |
| c. Go = place the car at the flag | One public `Driver.place_near(x, z, fx, fz)` that wraps `teleport` + `world.spawn_near` (the pattern of `driver.ts:99-102`). `EventMarkers` exposes the marker spot by event id | One small new method; the area fade covers a chunk wait (`hud/area-fade.ts:3-6`) |

**Recommend c.** Then the gate card opens on its own because the car stands still at the flag. Travel (another map) keeps today's reload behind the 09 v1 loading card. A seamless map swap stays out of scope: `main.ts` builds one world at load (`main.ts:163`).

### A3. Map names "Island · <biggest town>" (decided: format)

Facts: kind names live in `WorldDef.name` (`worlds/world-def.ts:17`, e.g. `worlds/island.ts:11`). Town names are generated in the worker (`worldgen/towns.ts:30-34,125`; mainland `mainland-network.ts:74`) and reach the UI in map data (`world-map.svelte.ts:267-279`). The career uses five Island maps alone (`career/career.ts:73-136`: seeds 3, 6-W1, 8, 9-W1, 11), so the kind name does not tell maps apart. Sky, deck and indoor kinds have no towns.

| Option | What | Breaks / costs |
|---|---|---|
| a. Kind name + seed ("Island 3") | Pure, no data | Reads as a code; not the decided format |
| b. Live map: compute from the loaded world; fixed maps: a checked table | `map_name(kind, towns)` picks the town with the largest `radius`. A `MAP_NAMES` table holds names for every career, series and mainland map code, and a test generates each map and compares (the pattern of the `tuned` check, `career/career.ts:27`) | The table needs a regeneration step on a generator bump, as `tuned` does today |
| c. Generate every listed map in the map worker to read its towns | `worldgen/map-worker.ts:12-17` builds the whole world | Seconds per map on a phone just to print a name |

**Recommend b.** Daily and random runs use the kind name until their map is loaded or previewed; the map data then has the towns. For kinds without towns, the fallback is a seeded syllable name from the same `town_name` generator, so a Sky map still reads "Sky Track · Vemora". Open sub-call: is that fallback fine for Sky, or "Sky Track 2"?

### A4. HUD size setting (decided: add)

Facts: a setting is a `SettingsState` field plus a `FIELDS` entry (`menu/prefs.ts:191-235`), then a row (AGENTS.md "Setting"). The HUD layout already keys CSS on `:root[data-hud]` (`prefs.ts:46`, `hud/aids.css:153-184`).

| Option | What | Breaks / costs |
|---|---|---|
| a. `hud_size` small / medium / large → `:root[data-hud-size]` → CSS `zoom` on the HUD docks | One field, one row, a few CSS lines | Touch controls must stay out of the zoomed docks (their own size) |
| b. A `--hud-scale` variable multiplied into every HUD size | Exact control | Touches every rule in `hud/*.css` |
| c. `transform: scale` on the docks | No layout change | Hit areas and anchored toasts (`menu.css:119-125` notes anchors) drift from what is drawn |

**Recommend a.** The owner targets the latest browser (AGENTS.md Rules), so standard `zoom` is fine. The 20 v2 preview is the same attribute set on focus.

### A5. Event "place" data (decided: chips "Here" / map name, "map" as the only place word)

Facts: "on this map" is a closure in `main.ts:514`, built from `event_map` (`career/career-store.ts:10-14`) and `map_code` (`worldgen/kinds/map-code.ts:40`). Runs have their own check (`main.ts:560`), and Series has `on_series_map`. The menu host already knows `seed`, `kind`, `levels` and `code` (`menu/page.ts:38-44`).

| Option | What | Breaks / costs |
|---|---|---|
| a. Derive in the view | A pure `place_of(spec, here)` → `{ here: true } \| { here: false; name; kind }` in a new `career/place.ts`. `main.ts:514` and `main.ts:560` call it; the host exposes `here` | Each page groups events itself |
| b. Add a `place` field to `CareerEvent` | Static | Duplicates `map`, and "Here" depends on the loaded map, so it cannot be static |
| c. A place model with travel-time estimates | Groups by map plus "about 5 s" | The load time per kind has no source in the code today (the round 4 "5 s" is unverified) |

**Recommend a**, plus a pure `by_map(events, here)` for 13 and 14, with tests beside it. Leave travel time out until the proof timings give a per-kind number.

### Also worth a nod (smaller, but "ask" by AGENTS.md)

- **Road pieces in Svelte.** The road cards (gate, ticket, pause, results, meet) are new UI. Option a: Svelte components mounted into the HUD with `mount`, fed from a `$state` the frame loop writes only on change. Option b: vanilla DOM like `marker-card.ts`. **Recommend a**: one component set for both layers, and the KeyButton stays one component. The per-frame HUD numbers (`hud.ts`) stay vanilla.
- **Device glyphs.** Today `data-pad` is set on the menu root only when a pad is connected (`settings.ts:453`). The design swaps keys / pad / touch on last input. Recommend `input.ts` writes `:root[data-input]` on change; glyphs switch in CSS.

## 4. Shared `src/menu/ui/` components first (phase 0)

Build these before any screen. Each comes with a `components.test.ts` render test and its `check:svelte` run.

**`KeyButton.svelte`** (the house button, built in t335 `0ff68b2`/`5fe94d6`). Owner's pick: round 2 B's showroom pill ("Enter Drive", "Enter Start Town sprint"), polished. NOT the room's filled dark cap, NOT round 4's cap:

- Full pill. Fill: `--primary`. Label: `--on-primary` (`theme.ts:275`).
- Cap: the key glyph OUTLINED in the label colour, no fill; the pad's round cap and the touch play mark use the same outline.
- A `--background-darkest` ring around the pill plus a soft drop shadow separate it from the scene. No same-hue stacked rings.
- Props: `keys` (key, pad and touch glyph), `hold?: number` (ms; a `--held` fill in `--cottontail` as in `shared.css:651-666`), `tone?: "primary" | "online"` (the online meet colour), `size`.
- Second action: the same shape with no fill (`.btn.quiet`, `shared.css:147-151`).
- One CSS file, `ui/key-cap.css`. It is imported by the component and by any vanilla road module that still renders a button, so the look has one source.
- `Button.svelte` stays for plain controls. Do not grow it a hold mode (AGENTS.md: no mode flags).

**`Glyph.svelte`.** It replaces `Kbd` inside prompts. It renders the key, pad (round / bumper) and touch variants, and CSS shows one by `:root[data-input]`. The prompt strip is built from it.

**`PlaceChip.svelte`.** Props: the `place_of` result (A5). It renders "Here" or `short_name_of` (t336 `6182f04`: label · town, at most 2 option words then "+N") with the kind's tone dot. It is used on tickets, tiles, results and the travel card.

**`Ticket.svelte`.** The Next up / event ticket: a tier edge, title, PlaceChip, star chips and up to three reason lines, in `docked` (road corner) and `big` (showroom 12) sizes. The road gate card (06) is a Ticket plus a car row and a KeyButton.

**Later shared pieces (built in their phases):** `Coverflow.svelte`, pulled out of `SeriesFlow.svelte` + `series-swipe.ts`, for 13, 17 and 18; `Stage` for A1.

## 5. Phases

Each phase ships playable on its own, smallest risk first. A phase has up to three lanes with no file overlap. `main.ts` and `settings.ts` `page_list` get one line per lane (AGENTS.md "Working in parallel"). Every lane runs `typecheck`, `check:svelte` and `bun run test <folders>`; screenshots follow the "Visual" row of AGENTS.md "Tests".

### P0. Shared pieces (no owner call needed)

- **Lane 1** (`src/menu/ui/`): `KeyButton`, `Glyph`, `Ticket`, `key-cap.css`, and tests.
- **Lane 2** (`src/career/place.ts`, `src/worlds/map-name.ts` + tests): `place_of` and `by_map` (A5), and `map_name` with the `MAP_NAMES` table and its generate-and-compare test (A3). `main.ts:514,560` switch to `place_of`.
- **Lane 3** (`src/hud/input.ts`): write `:root[data-input]` on the last input.
- **Done when:** the components render in `components.test.ts`, `place_of` and `map_name` tests pass, and the Play page's Keep driving and the room's Ready use KeyButton with no other change. The game still plays as before.

### P1. Road layer (needs A2 and the road-in-Svelte nod)

- **Lane 1** (`src/career/marker-card.ts` → a `GateCard.svelte` beside it, `markers.css`, `event-markers.ts`): 06 v1 corner card, 07 v1 car row (its showroom button opens today's CarPick until P3), and A2 `place_near` + Go hook. `car/driver.ts` gets one method; the car owner is told.
- **Lane 2** (`src/hud/`: new `Pause*.svelte`, `hud-sheet.ts` removed, `input.ts` Esc path): 10 v1 and 10 v2. Doors call `settings.open(<page>)` until P3 has stations. The Next up ticket 05 v1/v2 is driven from `next_event` + `place_of`.
- **Lane 3** (`src/modes/result.ts`, `modes.ts:636-700` only, `index.html:459-473`): 22 v1 results with Next up and a single Next.
- **Done when:** a fresh profile drives to the first flag, stops, sees the corner card, holds to start, finishes, and gets the upright stamp with one Next. Esc and the touch menu open the new pause in both states. `bun scripts/races.ts --changed` shows no new failures. Shots at desktop and phone.

### P2. HUD and settings (needs A4)

- **Lane 1** (`src/hud/*.css`, `hud.ts`, `index.html:404-427`): 21 race HUD top card and mirrored corners. The 7-icon bar goes, since pause owns those doors (P1).
- **Lane 2** (`src/menu/prefs.ts`, `settings-tab/`): `hud_size` field + row; theme preview on focus via `apply_theme`, restore on blur, Keep = `choose_theme` + reload as today. The 3D scene keeps the old colours until the reload: palette colours are read at load (`theme/palette.ts:6` `brand = read_tokens()`). The row says so.
- **Lane 3** (`src/hud/` pause sheet only): 20 v2 settings over the road from pause, with the HUD size preview.
- **Done when:** HUD size changes the docks live and persists across a reload; the focused theme row recolours menu and HUD and restores on blur. Shots of both themes, since this change is about themes.

### P3. Showroom shell (needs A1)

- **Lane 1** (`src/menu/showroom/`: the stage grown from `garage-stage.ts`, the station bar, the shell CSS; `settings.ts` top bar and head `:273-325`): stations Drive · Events · Garage · Online · Settings replace the tabs. No Back / X head; B / Esc go up a level (`system-back.ts` unchanged). 03 title at boot replaces `main.ts:612-614`.
- **Lane 2** (`PlayPage.svelte` → `DrivePage.svelte`, `CareerGoals`, a new `NextUpPage.svelte`): 11 and 12.
- **Lane 3** (`GaragePage.svelte`, `garage.svelte.ts`, `CarPick.svelte` → a page): 16 on the shared stage and 07 v2 as a full-screen page. The gate card's button switches to it.
- **Done when:** boot shows the car on the turntable with one Drive. Drive returns to the road with no reload. Every station opens on the stage with the world visible behind it. Pause doors land on stations. The perf check runs on the phone quality tier with the menu open (A1 risk).

### P4. Finding events (needs A3, A5)

- **Lane 1** (`CareerPage.svelte` and its parts; `Coverflow.svelte` pulled out of `SeriesFlow`): 13 v1/v2.
- **Lane 2** (new `MapsPage.svelte`, `WorldMap.svelte`; road `MapOverlay` in `src/hud/`): 14 and 08 with Go (A2).
- **Lane 3** (`index.html:340` `#loading`, `boot.ts`, `KEPT_ON_EVENT` carry): 09 v1 travel card, so the next load knows the destination (a `?event=` / `?run=` param it already has).
- **Done when:** a stranger can follow the `ui-r4/png/00-eventflow-v1` sheet. Next up → Travel → loading card → the gate card is already open on arrival. Map → Go → flag → card with no reload.

### P5. The rest

- **Lane 1** (`menu/runs/`): 17 v1 season.
- **Lane 2** (`menu/online/`, road meet card in `src/modes/race-view.ts`): 18 v1/v2, 19 v1/v2, Ready as a KeyButton in the online tone.
- **Lane 3** (`WorldPage.svelte`, `menu/guide/`, first-run road piece in `src/goals/`): 15 v1 and 04 v1. The Guide shrinks to name + theme.
- **Done when:** every screen in the recommended set matches its `ui-r4/png` at desktop and phone. The removed pages (Modes, Things to try, Support tab) are gone only after the owner's nod.

## 6. Risks

- **Second GL context (A1a).** It can cost frames on phones. Measure it in P3 before porting more stations onto the stage.
- **`modes.ts` is 765 lines and shared.** P1 lane 3 owns only `show_result` and the code after it. Any other edit there goes through the lead.
- **Theme preview fidelity.** The 3D scene does not recolour without a reload (P2). The design's full-stage preview (`ui-r4` 20 v1) was mocked with a tint (`ui-r4/README.md`, "Not checked").
- **Removing `#hud-sheet` and the action bar** removes doors players know. The pause doors must cover every action they had (`main.ts:683-705`) before deletion.
- **`MAP_NAMES` drift** on a generator bump, caught by its test, as `tuned` is.
- **Untested in the design:** a real phone and pad, the hold fill in motion, and the camera move between layers (`ui-r4/README.md` "Not checked").
