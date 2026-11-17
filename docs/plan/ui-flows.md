# UI flows and looks: one sweep

Task t366, 2026-11-16, on master `b48e01c` (v0.54.0 build, before t367 / t368 / t369 land). Outside-eye review of the whole player journey, not one page. No code changed.

How it was checked: `vite build` of `git archive HEAD` in the scratchpad, `vite preview`, Playwright on Chrome, keys at 1280x720 and 1920x1080, touch at 844x390, dark theme. Plus the owner's screenshots 80, 84-87 (2500x1340 and a tall window). Not checked: a real phone, a pad, light theme, a full race to the results card (results judged from owner shot 80).

Owner calls folded in: Events opens on the Harepin Series, career one step in (t367). A menu event start goes through the full car picker, then races (t369). A road flag keeps the gate card (t368). Settings shows no car (bare stage, full width).

The diagnosis in one line: every page was built by a different worker, so each picked its own column, back control, primary-action spot, card size and stage. Section 1 fixes that once. Every fix after it starts with "conform to the frame".

## 1. The page frame (every menu page follows it)

### 1.1 Grid

| Breakpoint | Query | Frame |
|---|---|---|
| Phone landscape | `(max-height: 500px)` | Inset `--space-3`. Station bar and chips share one 52 px row. Body scrolls as one; the primary action is fixed bottom-right over it, and the body gets bottom padding equal to its height, so it never covers content. |
| Desktop | default (1024-1599 wide) | Inset `--space-4`. Top row 64 px. Body = the content column. |
| Big desktop | `(min-width: 1600px)` | The whole frame (top row, body, primary action, secondary links) sits in ONE centred column, `max-width: 1600px`. Nothing pins to the viewport edge while the rest sits in the column. Today the panel caps at 1280 (`menu.css:16`), stage pages at none (`menu.css:91`), and the KeyButton pins to the viewport, so at 1920 the button and links sit 320 px outside the cards. |

Areas, top to bottom, the same on every page:

```
[ top row: brand | station bar (Q ... E) | chips ]        stations only
[ crumb pill: Esc  Parent > Here ]                         child pages only, top-left, same spot as the brand
[ body: hero / list / detail, per page ]
[ secondary links (bottom-left) ........ caption / PRIMARY (bottom-right) ]
```

### 1.2 Back

- Stations: no back control. Esc / B closes the menu to the road. Q / E (LB / RB) step stations.
- Child pages: one `Crumbs` pill top-left (`ui/Crumbs.svelte`, already on Next up and Maps). It is the only back control. It replaces `SeriesBack` ("< Events Esc"), `PageHead`'s Back button, the car picker's crumb without a key cap plus its "Esc Back" footer hint, and Every event's "Esc Tiers" pill bottom-left.
- Esc on a child goes to the page the player came from, not to the page's static `parent` (see F6).

### 1.3 Primary action

- Exactly one per page: `KeyButton`, bottom-right of the frame, with an optional one-line caption right-aligned above it ("Loads the map; First lap waits at its flag"). Same size, same spot, every page, both layers' menus.
- Its label names the result: a verb plus the thing ("Travel to Island · Harwar", "Race Opening race", "Take Hatch", "Ready"). Never a bare destination ("Series").
- Width hugs its label (`inline-size: max-content`, capped at the column). Results' stretched 450 px pill with a centred label (shot 80) is the counter-example.
- No second filled button on the page. A secondary action is a quiet `Button` or a link in the bottom-left row. Online's Ready + Start race, Copy invite link, the Series card's in-card "▷ Race" and Runs' row of Go buttons all break this.

### 1.4 Surfaces and size caps

| Piece | Look | Cap |
|---|---|---|
| Panel | `--panel`, 1 px `--line`, `--radius-lg`, padding `--space-5` (`--space-4` on phone) | never nested in another panel |
| Hero card (Drive's Keep driving, Next up ticket, the coverflow centre) | picture on top at 16:9, text block under it at its content height | max height 60 % of the body; never stretched to fill (shot 84: a 650 px dark slab under the text) |
| Tile (Drive's small cards, Or pick, the map rail) | picture 16:9 + eyebrow + title, one height per row | `aspect-ratio`, never `1fr` of the leftover height |
| List row | `Row` / `RowList`, min 72 desktop and 80 touch, padding `--space-4` | text measure about 65ch |
| Detail panel | right column, `--panel`, title `--text-2xl`, facts as label/value rows | width 360-480 |
| Chip / tag | `--radius-full`, sans `--text-sm` 600. Mono only for times, codes and key caps | sizes to content; truncates with an ellipsis, never spills (F9) |

Spacing, type, radius and breakpoints follow `docs/plan/svelte-ui.md` "One scale" and nothing else: page gap `--space-5`, display `--text-3xl` once per screen, page title `--text-2xl`, card title `--text-xl` 700, eyebrow `--text-xs` 700 0.08em.

### 1.5 Stage per page

The car shows only where the car is the subject. Everything else is bare (world behind, light shade), full width.

| Car on the turntable | Bare |
|---|---|
| Title, Drive, Garage, Car picker | Next up, Events, Series, Maps, Make a map, Runs, Online, Room, Settings (owner), Support |

The world's own car must hide whenever the turntable car shows (F14: Garage shows both).

### 1.6 Top row chips

Name, Room, Update, Sponsor, Skip guide sit in `.menu-chips`, built in vanilla DOM (`settings.ts:273-300`). Port them to one `TopChips.svelte`. Each chip sizes to its content. Under 1400 px wide, Room drops its "· N here" and Name truncates at 16ch with an ellipsis. Sponsor leaves the top row for the Settings footer (as the plan's Support move already says). That also fixes F9.

### 1.7 Shared pieces to build or fix (batch 0)

| Piece | Status | Does |
|---|---|---|
| `ui/PageFrame.svelte` | new | Areas of 1.1 as snippets: `crumb`, `body`, `aside`, `links`, `primary`, plus `caption`. The breakpoint CSS lives here once. Every page renders inside it. |
| `ui/PrimaryAction.svelte` | new, wraps `KeyButton` | Bottom-right spot, caption, hug width, fixed over a scrolling phone body |
| `ui/Crumbs.svelte` | fix | The only back control; takes the `from` page (F6) |
| `ui/Card.svelte` + `ui/PictureTile.svelte` | fix | `hero` and `tile` sizes with the caps in 1.4; no fill-height stretch |
| `ui/TopChips.svelte` | new (port) | 1.6 |
| `STAGE_ROOMS` in `settings.ts` | fix | the 1.5 table as data: car / bare per page id |
| `menu.css` | fix | one column rule (1600 cap) for station and stage layouts alike |

## 2. Flow map (HEAD)

| Screen | Reached from | Back (Esc / B) goes to | Primary action |
|---|---|---|---|
| First-run guide (7 steps) | first boot | step back; Skip guide to Drive | Start / Next |
| Title | boot once the guide is seen | Drive station ("Esc Showroom") | Drive: closes to the road |
| Drive station | Title Esc, Skip guide, pause Showroom (H), Esc on any station child | road | Drive <map> (no reload) |
| Next up | Drive's Next up tile | Drive | Travel to <map> (event waits at its flag; t369 makes it car picker, then race) |
| Runs | Drive's Today's run tile | Drive | none (a Go per row) |
| Maps | Drive's Maps link, road map's Other maps | Drive | Go to <event> here / Travel to <map> |
| Make a map | Maps' tile (G) | Drive, not Maps (F6) | Drive / "You're on this map" |
| Modes, Things to try | Drive's bottom links | Drive | per row |
| Events (career tiers) | station, pause E | road | Travel to <map> (t367: Series first) |
| Every event | Events button | Events (via "Esc Tiers") | Travel to <map> |
| Harepin Series | Events button | Events | in-card "▷ Race": reloads onto the series map, grid starts, no car picker |
| Garage | station, Drive's Car link, pause G | road | Fit <part> |
| Car picker | Garage's tiny "All cars" icon; an event start (t369); gate card's car button | the page it came from | Take <car> |
| Online | station, pause O | road | none (Copy invite link, Ready, Start race, Run today's daily, New room all compete) |
| Settings | station, pause S | section, then road | none (rows) |
| Road (roam) | Drive, Esc from stations | Esc: pause | drive; Next up ticket "Hold Tab Travel" |
| Pause (roam / event) | Esc, the pause button | road | Resume |
| Road map | M, pause Map | road | Go to flag / Other maps |
| Gate card | stop at a flag | drive off | Hold to start in <car> |
| Travel card | any map change | — | — |
| Results | event end | Esc keeps driving | Enter: Next / Series |

## 3. Problems, worst first

Tags: **bug** (broken behaviour), **flow**, **look**, **odd** (out of place, duplicate, leftover). Each ends with keep / cut / move where it is an element question. **0.55** = blocks the 0.55 release. **owner call** = changes a decided screen or adds structure.

### Bugs

- **F1 bug 0.55 — Pause door keys leak into the car.** On the roam pause, E (Events) runs, then the same keydown reaches the menu's station keys and steps Events to Garage: E lands on Garage. Q (Leave event) and E also reach the driving input as shift down / up, and `shift()` turns the auto gearbox off: after Leave the HUD shows "N M" and `auto` is saved false. Likely cause (not traced line by line): the pause closes on keydown before `input.ts:216`'s window listener reads `blocked()`, and the menu's own `keydown` listener (attached during the same dispatch) sees the event too. Fix: the pause handles its keys in the capture phase and stops propagation. Test in `pause-keys.test.ts`.
- **F2 bug 0.55 — Leaving a Series race leaves its run card on the road.** After Leave event, the frozen "0:11.033 · P7/7 · 1/12" card stays, overlapping the free-roam lap card (two top cards, 3 s later still there). Fix: the series host's exit clears its top card, as `modes.exit` does for career events.
- **F3 bug 0.55 — The gate card covers the pause button.** At 1920 the card (top-right, 600 px) sits over "II". Fix: conform the road corners: gate card docks under the pause button's row, or left of it, never over it.
- **F4 bug 0.55 — Settings labels overlap their controls** (1280 and owner shot 86): "Qu" cut under the Quality segments, "Running now" over its value, and a third help column floats half empty. Fix in batch 2 (20 v1 single column).
- **F5 bug — The gate card preselects a car that is not the one you drive.** Hatch (C 418, "Driving now") fits First lap, yet the card says "Hold to start in Sajin". Fix: preselect the driven car when it fits; the best fit only when it does not.
- **F6 flow — Back follows the static parent, not where you came from.** Make a map (opened from Maps) goes back to Drive. Garage opened from Drive's Car link goes back to the road. Fix: `Crumbs` and `settings.back()` take the opener (one `from` the frame stores on `show`), falling back to `parent`.

### Flow

- **F7 flow 0.55 — Drive station: no clear choice** (owner 84: "idk what I select here"). Three pictures, one giant, with only an eyebrow each and nothing on them saying what a click does; the hero stretches to fill the height; the KeyButton duplicates the hero ("Drive Mainland" + "Keep driving Mainland" + "Back on the road where you left it · no loading" say one thing three times). Fix: conform to frame (hero capped, tiles at 16:9). Each tile gets its action as its last line ("Drive on", "Travel · First lap", "Run · +3 ★"), and the focused tile drives the primary action's label, so the button always says what the selection does. Caption: cut (the tile says it).
- **F8 flow 0.55 — Three ways to start an event, three results.** Events / Next up: Travel, then gate card (t369 turns it into car picker, then race). Maps: Travel / Go, then the gate card. Series: race at once, no car picker. Road ticket: Hold Tab Travel. After t369 lands, the rule to state everywhere: from a menu, "Race <event>" = car picker, then race; from Maps or the road, "Go to flag" = drive there and see the gate card. Maps' button must then read "Go to <event>'s flag", never "Travel to <map>" while an event row is focused. Series: owner call whether it also opens the car picker (its own-car rule makes that a "check your car" step).
- **F9 look 0.55 — Top row chips spill** (owner 87, and 1920 here): "Room lobby · 1 here" runs under Sponsor, Sponsor's text is clipped, the name chip reads "Lucky Bunn". Fix: 1.6.
- **F10 flow 0.55 — Online is five cramped cards with no main action** (owner 85). Your room, Lobby race, Daily board, Players online, Games running, New room in two narrow columns right of the car. Duplicates: Games running lists your own room again; Players online lists only you. Two filled buttons (Copy invite link, Ready) plus Start race. Fix: conform to frame, bare stage (1.5), 18 v1: one room tile with faces, Ready as the primary action (online tone), race pick as a row of tiles, Daily board as one tile, New room as a link. Players / Games running: fold into the room tile's faces and a "Rooms" link; cut as top-level cards.
- **F11 flow 0.55 — Results card (owner 80).** Tiny stamp in the middle of a huge screen, eight fact chips in a row bottom-left, standings under them, Enter "Series" stretched at the far right, Esc "Keep driving here" bottom centre, a lone 24 px restart icon. Fix: 22 v1 as decided: upright stamp with facts and rewards as one panel bottom-left, standings in the same panel, primary bottom-right ("Next: Harbour knockout" / "Back to Series"), Restart and Keep driving as quiet links bottom-left. Facts: cut "laps 1" and "race Opening race" (the stamp says it).
- **F12 flow — Two back keys in Events.** Events → Every event shows "Esc Tiers" bottom-left; Series shows "< Events Esc" top-left; Next up and Maps show the crumb pill. Fix: 1.2. Overlaps t367: apply after it lands.
- **F13 flow — The road map opens during an event** and says "this map · 0 flags", "No flags out on this map right now", plus "Other maps" (travel away mid-race with no confirm). Fix: in a run, M shows the route only (no flag list, no Other maps), or M stays off in a run. Owner call which.
- **F14 look — Garage shows two cars.** The turntable car and the world car's rear under it (1280). Fix: hide the world car whenever the stage car is on (`Settings.staged`), garage included.
- **F15 flow — Pause in an event: Showroom (H) lands on Drive, whose hero says "Back to race Island · Harwar" while its button says "Drive Island", and the Next up tile is the event already running.** Fix: in a run the hero and the primary say "Resume First lap"; Next up skips the running event.
- **F16 flow — The car picker is hard to reach for your own car.** Its only door is the 24 px "All cars" icon beside the car name in Garage. Drive's "Car" link opens Garage, not the picker. Fix: Drive's "Car" link opens the picker (it is called Car); Garage keeps its icon. Picker class keys are 1 / 2; everywhere else tabs step on Q / E (LB / RB). Make them Q / E (stations are hidden on that page, so they're free).
- **F17 flow — Maps opens with a locked event selected** and the primary greyed ("Go to Mainland sprint", disabled; all three flags here are locked). Fix: select the first open event; with none open here, select the next map with open events and make the primary "Travel to <map>".
- **F18 flow — Today's run tile opens Runs, an old list page** with the station bar showing (no crumb), a Go per row and the season grid beside it. Fix: conform to frame (crumb, bare, one primary) until 17 v1 lands; the tile's run is the focused row.
- **F19 flow — Make a map is the old 3-column WorldPage** with the station bar, "Pick a world" and a map named by code ("Mainland · 1M0E5M3PK"). Fix: conform to frame (crumb "Maps > Make a map", bare); "Pick a map type"; map name via `map_name`. Rework 15 v1 later (P5).
- **F20 flow — The Next up ticket and the gate card show the same event at once** at a flag ("First lap 0 m" top-left and the card top-right). Fix: the ticket hides while a gate card is open.

### Odd, out of place, leftovers (picky list)

| # | Where | What | Verdict |
|---|---|---|---|
| O1 | Drive, bottom-left | "Modes" and "Things to try" links: old menu pages the owner said go (content moves) | owner: move both under Events as one "Free modes" door (batch 1) |
| O2 | Drive, phone | "Things to try" wraps alone onto a second line; the KeyButton overlaps Today's run tile's corner | fix by frame (links in one row, primary over a padded body) |
| O3 | Top row | Sponsor chip | move to Settings footer (plan) |
| O4 | Top row | "Downloading update" chip in the top row of every page | keep, but only in the chip row with truncation (1.6) |
| O5 | Title | Tagline "Drive the island" (the default map is Mainland; "map" is the only place word) | fix copy: "Drive the map, race your friends" |
| O6 | Title | "Esc Showroom" leads to the Drive station; pause also says "Showroom" | owner: "Home" everywhere, done in batch 0 (`76e6ceb`) |
| O7 | Next up page | "Or pick" repeats Drive's Keep driving and Today's run tiles | cut those two; keep only other events |
| O8 | Next up page | turntable car on a page about an event | cut (bare, 1.5) |
| O9 | Drive tile | "NEXT UP · ON ANOTHER MAP" eyebrow plus the place chip "Island · Harwar" say "elsewhere" twice | cut "· on another map" |
| O10 | Pause | chips in mono ("Rookie 0/21 ★", "next: First lap on Island · Harwar", lower-case "next:") | fix: sans chips; mono only for times |
| O11 | HUD assist chips | "1 TC · 2 ABS · 3 STEER · 5 STM": the 4 is missing (ghost is on 4, not shown) | fix: label the chips without numbers on desktop, keys in the key list; or show 4 |
| O12 | Garage | "Arrows Slot / part · Enter Fit" hint row under the strip plus the KeyButton "Enter Fit Tuned" | cut the hint row; the KeyButton carries Enter |
| O13 | Car picker | crumb "Garage > Car" has no Esc cap, while "Esc Back" sits in the footer | fix by 1.2 |
| O14 | Car picker | the world car shows through between the shelf cards | fix by 1.5 (the picker's stage hides the world car) |
| O15 | Online | "Ready starts the race when you're alone" under Ready + Start race | cut Start race when alone; one button |
| O16 | Online | room "lobby" lower-case as a title | fix: "Room lobby" eyebrow + room code |
| O17 | Settings | car on the turntable to the right (owner: none) | cut (1.5) |
| O18 | Settings | "Guide" button and version chip in the rail footer | keep; add Support there (O3) |
| O19 | Series | top-right stats strip (Place, Points, Rival, Credits) with "–" and "Level" before any race | keep after the first race; before it, show "Season starts here" only |
| O20 | Race HUD (Series) | the top card's right half is empty ("1 OPENING RACE · P7/7" then blank) | fix: card hugs its cells |
| O21 | Road map | at 1920 the list column ends at 1570, a dead third to its right | fix: list column grows to the edge inset |
| O22 | Road map | "Drawing island…" for about a second on open | keep for now (the 2D map paints in a worker); look again if it shows on phones |
| O23 | Gate card | the car row's cars sit at different heights (Hatch and Dirt rally text lower before thumbnails load) | fix: fixed thumb box per car |
| O24 | Arrival at a flag | the car parks in the start arch's pillar, camera inside it | t368 (car placement) |
| O25 | Phone garage | part strip cut at the right edge, no edge fade, the Fit button off-screen | fix by frame (primary fixed bottom-right on phone) |
| O26 | Phone online | page cut at the bottom (Lobby race header half shown) | fix by frame (one scroll body) |
| O27 | Guide | "Skip guide" sits in the top chip row, away from Start | move to the bottom-left links row |

## 4. Batches

Batch 0 blocks the others. A batch touches only its files; `settings.ts` gets the lines its page needs.

| Batch | Scope | Files | Blocks 0.55 |
|---|---|---|---|
| **0. Frame** (one designer, first) | 1.1-1.7: `PageFrame`, `PrimaryAction`, `Crumbs` with `from` (F6), `Card` / `PictureTile` sizes, `TopChips` (F9, O3, O4, O27), stage table (1.5, F14, O14, O17), one column rule in `menu.css` | `src/menu/ui/`, `src/menu/menu.css`, `src/menu/settings.ts` (top row, `back`, `STAGE_ROOMS`), `src/menu/showroom/` | yes |
| **1. Drive and events** (after batch 0, and after t367 / t369 land) | Conform Title, Drive, Next up, Maps, Make a map, Runs, Events, Series, Every event to the frame. F7, F8 labels, F12, F15, F17, F18, F19, O1, O2, O5, O7, O8, O9, O19 | `DrivePage`, `NextUpPage`, `drive-picks.ts`, `MapsPage`, `WorldPage`, `runs/RunsPage`, `CareerPage`, `Series*.svelte`, `showroom/Title*` | Drive, Next up, Events, Series: yes. Make a map, Runs: no |
| **2. Online, Settings, Garage, car picker** (after batch 0) | F4, F10, F16, O12, O13, O15, O16, O18, O25, O26 | `menu/online/`, `menu/settings-tab/`, `GaragePage` + garage parts, `CarPickPage`, `car-pick.svelte.ts` | Online, Settings: yes. Garage, picker: no |
| **3. Road** (can start now, no frame dependency; after t368 for the gate card) | F1, F2, F3, F5, F11, F13, F20, O10, O11, O20, O21, O23 | `src/hud/` (pause keys, map overlay, next up, run card), `career/marker-*` + gate card, `modes/` results and the series host | F1, F2, F3, F11: yes |

## 5. Owner calls (answered 2026-11-16)

| Item | Decision | Batch |
|---|---|---|
| F8 | A Series start also opens the car picker (t369, `c3c5ba9`) | done |
| F13 | In a run the road map shows the route only: the route, your spot, rivals. No flags, no travel. Free roam keeps the full map | 3 |
| O1 | Modes and Things to try move under Events as one small "Free modes" door | 1 |
| O6 | The Drive station is named "Home" everywhere (station bar, pause door, title, crumbs). "Drive" stays only as the verb on the go-to-road button | 0 |

## 6. Batch 0 status

Built on master: `661c5b9` (Back returns to the opener, `Menu.back` / `up_of`), `053723c` (`PageFrame`, `PrimaryAction`, PictureTile hugs its content), `239318c` (one 1600 px column, bare stations full width, chips fit, Support in the Settings footer), `76e6ceb` (Home). The car / bare table and the opener tracking in `settings.ts` landed inside t367's `1fd11f2`.

Not done in batch 0, on purpose:

- `TopChips.svelte`: the chips stay vanilla DOM. The overflow was CSS (`flex: none` chips, a shrinking name), so a port changes nothing on screen. It can happen with the first page that needs the chips reactive.
- Moving pages onto `PageFrame` / `PrimaryAction`: that is batches 1 and 2, "conform to frame" first. Until then each page keeps its own `.go`. They already land on the frame column, because the column rule widens `--inset-left` / `--inset-right`.
- Next up keeps its half-width body (`showroom.css` next-up rule) until batch 1 rebuilds it on the frame.
- `PageFrame` has no `aside` snippet and `Card.svelte` has no hero / tile size yet: each lands with the first page that needs it (batch 1), so the API follows a real use.
- Back from a station still closes the menu (1.2 wins over F6's "Garage from Home's Car link goes back to Home"); F16 makes that link open the car picker, a child page, which then returns to Home.
- Chips under 1400 px: the existing rule already hides the Room chip there; the name keeps 13ch and truncates.

## 7. Batch 2 status

Built on master (t371): `da79475` (Online), `8e4b50a` (Settings), `95caa0f` (review fixes), `a3cae31` (Garage and car picker).

What the shared pieces gained, for the pages still to come:

- **`PageFrame` `aside`**: a detail column at the frame's right edge, 360-480 px (`clamp(22.5rem, 30%, 30rem)`). Under 1200 px wide and on a phone (`max-height: 500px`) it folds away: the page shows a short form in its body instead (Settings: a two-line help strip in the panel). Never squeeze it below 360.
- **`PageFrame` on a phone**: the body scrolls as one and the links row ends it (static, not pinned), so links never sit over a card at rest. Only `PrimaryAction` stays pinned; its caption hides on a phone. A page that must fill the screen (Settings' panel, the Garage) caps its own height with `100dvh` minus the top row and the links row, since a percent height has nothing to resolve against there.
- **`PageFrame` keeps its height** (`min-height: 0`) when a page's content runs long, so a fixed-height panel scrolls inside instead of pushing the frame.
- **`PictureTile` without `onclick`** renders as a still card (`section`), not a button: same picture, eyebrow, title and lead border as Home's tiles. `badge` replaces the place chip over the picture's corner, and `children` adds a block under the text (Online's faces, the Daily board's top times). Use it for a hero that holds its own controls.

Decisions taken here:

- Online: Ready is the one primary (online tone), "Race <route>" when alone, "Hold to leave race" while racing (a stray Enter never leaves). Games running and Players online live on a child page, Other rooms.
- Garage: All cars moved from the icon beside the car name to the links row (one door, always in the same spot); Fit and Choose a car are the primary.
- Car picker: the crumb names where Back goes (`CarAsk.back`: the asking page's label, or Road from the gate card); classes step on Q / E.

## 8. Rebuild to approved mockups

Task t372, 2026-11-17. Plan only, no code. The owner approved every screen of the r5 mockups (`docs/plan/ux-mockups/`, README first; tweaks in the quest `2026-11-16-ui-redesign.md`, "UX r5 v3: APPROVED").

**Base: the released code, `origin/master` `77c828c` (0.55.0).** The unreleased UI work on local master (sections 1-7 above: batches 0-3, showroom, Events, picker, travel card, map merge; 87 commits) is parked on `ui-old`, for reference only. Nothing below builds on it. Where a piece of it is worth taking, the table says "port from ui-old `<sha>`": copy the logic and its tests, rebuild the markup and CSS to the mockup. Sections 1-7 stay as the record of why; where they disagree with this section, this section wins.

This file and `docs/plan/ux-mockups/` are not on `origin/master` (they came in with `0a1a612` and `701a935`). The rebuild branch must pick up `docs/plan/ui-flows.md` and `docs/plan/ux-mockups/` before batch 0 starts.

Every mockup frame is built by one function `F` in `screens.js`. That function is the page frame: the build has one component that does the same.

### 8.1 Gap table: mockup vs `origin/master`

Verdicts: **keep** (logic and look hold, restyle through tokens only), **adjust** (same structure, new pieces or layout), **rebuild** (new structure), **new** (no such screen in the release).

Menu screens:

| Screen (`screens.js`) | Mockup | `origin/master` today | Verdict | Port from ui-old |
|---|---|---|---|---|
| Shell: stations, frame | Five stations Home · Events · Garage · Online · Settings with Q / E caps, title top-left, chips top-right, Back pill + links bottom-left, note + one primary bottom-right, world or stage behind | `menu/settings.ts`, `menu/page.ts`, `menu/menu.css`: a panel with tabs Play · Garage · Online · Settings · Support, per-page layouts (`column`, `wide`, `fill`, `stage`), `ui/PageHead.svelte` with its own Back | rebuild | `661c5b9` (Back returns to the opener, `Menu.back` / `up_of`), `d807b67` (a page can take Back itself), `76e6ceb` (Home naming), station keys from `36de713` |
| Showroom stage | The car on a turntable behind Title, Home, Garage, the final podium | `menu/garage-stage.ts`: a stage for the Garage only | rebuild | `47cf97d` + `36de713` (`showroom/car-stage.ts`, `showroom.ts`, `turntable.ts`), `eaa0b8e` (GL context given back), `2f50b96`, `be1753d` |
| Title (`S.title`) | Wordmark, car, one Continue card, primary "Race Round 3", links Drive / Home | none: boot goes to the road, first boot to the guide | new | `36de713` (boot title), `98e6b09`, `2352108` |
| Home (`S.home`) | Car bay with name + class badge, one ticket (picture, eyebrow, title, place line, three reasons), three small cards (Career, Today's run, Free roam), links Car / Maps | `menu/PlayPage.svelte` + `CareerHero`, `RunsCard`, `GoalsCard`, `WorldMap` | rebuild | `ff1b997` + `f407668` (`drive-picks.ts` + test: which pick leads), `0f203ff` (the button follows the focused tile) |
| Events (`S.events`) | Series card (rounds bar, top 4 standings) + two doors, Career (tier strip) and Runs (daily / weekly / random); link Free modes | `CareerPage.svelte` (+ `CareerSpine`, `CareerProfile`, `CareerGoals`, `TrophyCase`), `SeriesPage.svelte` behind `REVIEW_BUILD`, `runs/RunsCard.svelte` on Play | rebuild | `1fd11f2` (Series first, `events-view.ts`), `3ee894a` (Free modes door), `9683274` + `b48e01c` (Series in production builds) |
| Career (`S.career`) | Five tier cards in a row (one open, four locked) over event chips grouped by map with a place line per group | `CareerSpine.svelte`: a vertical spine | rebuild | `4bad060` (events grouped by map), `9271a47`, `7389c2d`, `career-page.test.ts` |
| Start sheet (`S.sheet`) | One card: picture, event, place line, star times, route facts, car row with Change car; primary "Travel to <map>" | none (an event starts from its row) | new | `c3c5ba9` + `fde0114` + `88ba017` (menu start, refusal reasons), `2935a05` |
| Car picker (`S.picker`) | Grid of car cards that fit their card, class badge each, over-class cars dimmed; detail card with meters; Q / E step class | `menu/CarPick.svelte`: a `Dialog` | rebuild | `bcb9faa`, `8afdbb6`, `0f3b448`, `a3cae31` (`CarAsk.back`, Q / E classes), `car-pick.test.ts` |
| Garage (`S.garage`) | Slot chips on top, one card: part cards (icon, name, blurb, state chip), class badge before and after, meters with the gain; credits chip; links Change car / Builds | `GaragePage.svelte` + `GarageStrip`, `GarageMeters`, `GarageBuilds`, `GarageHint`: `Tabs` + a strip | adjust (the flow holds, parts become cards) | `bcb9faa` (Garage on the stage), `a3cae31` (All cars as a link, Fit as the primary) |
| Maps (`S.maps`) | Big map card with pins and the map's event rows; rail of map cards + Make a map; primary "Travel to <map>" | none (`WorldMap.svelte` inside Play, Create world page) | new | `2eecd91` + `832cf33` (`maps.ts` + test, `MapsPage`), `f8fd7f5` (`MapEventRow`, `MapPins`), `4efc976`, `ff44be4` (opens where something can start) |
| Make a map (`S.make`) | Preview card with name, facts, map code + Copy, four custom knobs; Roll card (R); six kind cards | `WorldPage.svelte` (600 lines, three columns, `Slider`, `Segmented`) | rebuild | `65782db` (names via `map_name`) |
| Runs (`S.runs`) | Season bar (stars, reward track, next reward), three run cards + Build a run; one primary | `runs/RunsPage.svelte` (`Tabs`, rows, a Go per row), `SeasonBar.svelte`, `RunBuilder.svelte` | rebuild (SeasonBar adjust) | `65782db` |
| Online (`S.onA`) | Room tile (picture, room, map, race setup) + Players online grouped by room: status, count, flag per player, Join; links Copy invite / New room; primary in the online tone | `online/OnlinePage.svelte` + `OnlineRoom`, `OnlineRace`, `OnlinePlayers`, `OnlineGames`, `DailyBoard`: five cards | rebuild | `da79475` (one room tile, `faces.ts`, Ready as the one primary), `95caa0f` (hold to leave a race) |
| Settings list (`S.setA1`) | Ten section cards in two columns: icon, name, current values, chevron; link Reset all | `settings-tab/SettingsPage.svelte`: a section rail + rows + help column; `sections.ts` already writes a summary per section | rebuild | none (`8e4b50a` went another way) |
| Settings section (`S.setA2`) | One card of rows (label, one-line help, control) + a help card with a preview picture; link Reset <section> | the right side of `SettingsPage.svelte`, `SettingRow.svelte`, `rows/*.svelte`, the `*Section.svelte` files | adjust (rows keep, the page splits in two steps) | `3d3d910` |
| Guide (`S.guide`) | First-steps bar (2 of 14, next step) + six topic cards | `menu/guide/*` (a 7-step first-run tour), `GoalsPage.svelte`, `GoalsCard.svelte` | rebuild | none |

Road screens:

| Screen | Mockup | `origin/master` today | Verdict | Port from ui-old |
|---|---|---|---|---|
| Race HUD (`S.hud`) | Top card (event, place, lap, gap, time), pause button top-right, map card bottom-left with "Next gate", speed card bottom-right (speed, gear, rev bar, aid chips) | `hud/hud.ts`, `dash.css`, `corner.css`, `top-bar.css`, `run-card.css`, `aids.css`; four layouts (`HudLayout`), `DashPlace`, `MapCorner` | rebuild the CSS, keep `hud.ts`'s per-frame writes | `24e1b36` (aid chips without key caps), `ad78750` (a run's card leaves with the run) |
| Minimap and speedometer variants | See 8.4 | `minimap.ts` (`full`, `close`), `pace-card.ts`, `SpeedoStyle` ring / bar | adjust | none |
| Free roam (`S.roam`) | Next up ticket top-left (arrow, eyebrow, title, place line with distance), online chip + pause, map and speed cards | `hud/NextUp.svelte`, `next-up.ts`, `ui/Ticket.svelte` | adjust | `98b628b`, `926dbaf`, `52b7e89` (the ticket hides while a gate card is open) |
| Phone touch (`touchHud`) | Steer pads left, Brake and Gas right, speed card bottom centre, map top-left | `hud/touch.ts`, `touch.css`, `phone.css`, `index.html` `#touch` | adjust, see 8.4 | none |
| Gate (`S.gate`) | One card: eyebrow, title, place line, star times, car row with class badge; link Enter Change car, primary Hold Enter "Start in <car>" | `career/GateCard.svelte`, `gate-card.svelte.ts` | adjust | `ecf54a6` (preselects the driven car), `234b57a` (docks clear of pause), `a16b485`, `b246196`, `06a98ca` |
| Road map (`S.rmap`) | The map with a callout card per flag, each tied to its pin by a line; link Other maps; primary "Go to flag", no loading | none | new | `2eecd91` (`MapOverlay.svelte`, `map-overlay.svelte.ts`), `1ebe67f` (`MapRun`: route only in a run), `7f8da73`, `9a47520`, `12b096b` + `54fef7e` + `3ab3c91` (Go puts the car before the flag), `974adcf` |
| Pause (`S.pause`) | One panel: run row + Restart / Leave, Assists chips, Go to doors (five stations + Road map); primary Resume | `hud/Pause.svelte`, `PauseSheet.svelte`, `PauseAids.svelte`, `pause-keys.ts` | adjust (rows a step lighter, no blue) | `9a346e8` (keys stop at the pause, with its test), `e749033`, `97e077f` |
| Results (`S.resB`) | Stamp card (place, stars, gap, series bar, four facts), standings card with gains, Next card; links Restart / View Series; primary "Next: Round 4" | `modes/ResultNext.svelte`, `result-next.svelte.ts`, `modes.css` | rebuild | `ffa41e1` (one sheet), `1afe6aa` (Next starts the next open event), `34256a8` |
| Final (`S.final`) | Stage car, "Champion" display line, final standings card, rewards card | none (the series ends on a result card) | new | none; needs the showroom stage |
| Travel (`S.travel`) | Briefing over the loading map: event, star times, route / class / best, car row, map card, load bar; primary Start lights when ready | `#loading` in `index.html`: logo + "Building island…" | new | `9020c95` + `bbb8b07` + `e3c2148` (`world/travel.ts` + test, `travel-card.ts`) |
| First run (`S.first`) | On the road: painted "HOLD W", steps strip (Drive, Steer, Reach the flag), goal ticket | `menu/guide/GuideTour.svelte` and the other guide steps (a modal tour before driving), `goals/` toasts | rebuild | none |
| Meet (`S.meet`) | Top card (room, route, countdown), a card per driver (car, ready state, flag) + an open slot; link Change car; primary Ready in the online tone | lobby race inside `online/OnlineRace.svelte`, in the menu | new | `da79475` (Ready logic) |

Not in the mockups, so they follow the frame and the shared pieces with no design of their own: Series full view ("View Series"), Free modes, Builds, Build a run, Other rooms, New room, race setup "Change", What's new, Support, the theme creator, key bindings, the name field, the room unlock form, the leave-race confirm, the update toast and card, a Guide topic's own page. Each lane lists the ones in its files and shows them in its batch review.

### 8.2 Shared pieces first (batch 0)

Values come from `frames.css` (`.fr` desktop, `.fr.p` phone). Colours are the theme's own tokens; the mockup adds no colour.

| Piece | Mockup | `origin/master` | Build |
|---|---|---|---|
| Scale tokens (`style.css`) | Edge 32 / 16 phone, pad 20 / 12, gaps 16 / 12 / 8 / 4; top row 44 / 32, primary 52 / 44, chip 32 / 26, row 36 / 28; radii 16 / 10 / 6; type 32 / 20 / 16 / 14 / 12 / 11, primary label 18; display 48 / 64 / 96 / 144 | `--space-*` matches; `--inset` 16; `--text-3xl` 28; radii 6 / 8 / 12 / 16; no display sizes | adjust: `--inset` 32 on desktop, page title 32, add the four display sizes and a row height; rows use `--radius-sm`. Phone values in the one `(max-height: 500px)` block |
| Surface ladder | Surfaces sit darker than the page: `--deep` (darkest, 0.06 lower) → `--surface` 96 % of it; card border `--line-strong`, one shadow; rows `--row`, focused row `--row-on`, inner chips and quiet buttons `--fill` | `--surface` 92 % of darkest; `--panel` = `--background-light` (lighter than the page), `--panel-well`, `--panel-raised` | rebuild the ladder: `--deep`, `--surface`; rows one step lighter than the mockup per the owner (`--row` = `--background-darker`, `--row-on` = `--background-dark`, `--fill` = `--background`), checked by eye against the garage part cards, which are the right level. `--panel*` go when the last old page is gone. Must hold in light and in three random themes |
| Key cap | Outlined, `currentColor`, border 0.13em, bottom 0.24em, mono 700 at 0.8em, no fill; hidden on touch | `ui/key-cap.css` `.ui-glyph-cap`: filled `--background-lighter`, 1 px border | adjust `key-cap.css`, `Kbd.svelte`; `Glyph` keeps `:root[data-input]` |
| Key button | Cottontail pill, height 52, 800 weight, dark ring + shadow. Variants: quiet (surface, inset ring: the Back pill), online tone (`--secondary`), off (mixed down), hold (fill sweeps) | `ui/KeyButton.svelte` + `key-cap.css` (cottontail pill, hold) | adjust: add `quiet`, `tone="online"`, `off` |
| Back | Variant B: a quiet key button bottom-left, "Esc ‹ <where it goes>", the first item of the links row. One control on every screen, road screens too | `ui/PageHead.svelte` Back, `SeriesBack.svelte` | rebuild into the frame; delete both |
| Class badge | A plate: letter on a class-coloured block, PI beside it, mono. D `--tertiary`, C `--primary`, B `--accent`, A `--error` (lead call), S1 `--secondary` | `ui/ClassBadge.svelte`: one `--dim` edge, only X coloured | adjust; S2 and X need a colour (8.5) |
| Place line | An icon and bold text inline, no pill: flag + "Here" in `--primary`, or globe + map name; a dim tail ("340 m ahead", "another map") | `ui/PlaceChip.svelte`: a dashed pill | rebuild as `PlaceLine.svelte`; delete `PlaceChip` |
| Card | `--surface`, `--line-strong`, radius 16, shadow; padding 20 as an option; focus = 3 px cottontail outline, offset 2. Picture cards: picture on top, caption block under | `ui/Card.svelte` (`panel` / `well` / `raised`), `ui/Tile.svelte` | rebuild `Card` (props `pad`, `focused`, `picture`); `Tile` goes when its last user is rebuilt. Port `PictureTile` from ui-old `ff1b997` only if the picture card needs more than `Card` gives |
| List row | Height 36 / 28, radius 10 → `--radius-sm`, fill `--row`; focused `--row-on` + inset outline; trailing value or chevron | `ui/Row.svelte`, `RowList.svelte` | adjust |
| Chip | Pill 32 high on `--surface`; inner chip 24 high on `--fill` | `ui/Chip.svelte`, `Badge.svelte` | adjust; one `inner` prop |
| Stations bar | Text tabs, the current one bold with a 3 px underline, Q and E caps at the ends | tab buttons in `settings.ts` | rebuild as `Stations.svelte` |
| Page frame | `F` in `screens.js`: top row (title block left: eyebrow + title, left-aligned; stations centre; chips right), body, bottom row (Back + links left; note + primary right), optional veil, floor fade, stage car spot | none | new `ui/PageFrame.svelte` + `PrimaryAction.svelte`. Port the behaviour notes from ui-old `053723c` and section 7 (phone body scrolls as one, only the primary pins, `min-height: 0`, aside 360-480), not the markup. Road cards (gate, pause, results, road map, meet) use the same frame over the road |

Done when: a `?showcase` sheet (`src/review/`) shows every piece in every state, desktop and phone, and no page-level CSS sets a colour, radius or font size of its own.

### 8.3 Batches

Rules for all lanes: branch from the rebuild base; a lane touches only its files; `main.ts`, `index.html`, `menu/settings.ts` `page_list` and `prefs.ts` `FIELDS` get one line per change; no version bump. Proof per lane: `bun run typecheck`, `bun run check:svelte`, `bun run test <its folders>`, and about four screenshots (1280x720 and 844x390 touch, dark, the screen plus one zoomed control) set beside the mockup frame. A measured check of one control per screen (computed size, weight, colour) before sign-off. One browser at a time, against `vite preview`.

**Batch 0: foundation.** Blocks everything else.

| Lane | Scope | Files | Done when |
|---|---|---|---|
| 0a designer | 8.2: tokens, ladder, every shared piece, the frame, the showcase sheet. Tokens land as the first commit so 0b can read them | `src/style.css`, `src/menu/ui/`, `src/review/` (one sheet) | the sheet matches `frames.css` by measurement; light theme and three random themes hold contrast |
| 0b coder | Shell: five stations, Q / E, Back to the opener, pages mount in the frame; the showroom stage behind Title, Home, Garage | `src/menu/settings.ts`, `page.ts`, `menu.css`, `src/menu/showroom/` (replaces `garage-stage.ts`), `system-back.ts`, `pad-menu.ts` | each station opens an empty framed page; Esc, B and Q / E work on keys and pad; `system-back.test.ts` and a ported `showroom.test.ts` pass; the stage frees its GL context on close |
| 0c coder | Engine ports with no look: travel (`world/travel.ts`), Go to a flag with no reload, Series out of `REVIEW_BUILD`, the pause key fix | `src/world/`, `src/career/gate.ts`, `series*.ts`, `src/hud/pause-keys.ts`, `src/modes/modes.ts`, `src/boot.ts` | ported tests pass (`travel.test.ts`, `gate.test.ts`, `pause-keys.test.ts`, `series.test.ts`); `bun scripts/races.ts --changed` clean; one drive to a flag by hand |

**Batch 1: the spine** (after batch 0).

| Lane | Scope | Files | Done when |
|---|---|---|---|
| 1a | Title, Home, Maps, Make a map | `menu/showroom/Title*.svelte`, `menu/HomePage.svelte` (replaces `PlayPage`, `CareerHero`, `GoalsCard`), `drive-picks.ts`, `MapsPage.svelte`, `maps.ts`, `WorldPage.svelte`, `WorldMap.svelte`, `ui/MapPins.svelte` | boot lands on Title with a Continue card; the primary always names what the focused card does; Travel loads a map; a custom knob rolls the map again |
| 1b | Events, Career, Runs, start sheet, Series view, Free modes | `CareerPage.svelte`, `Series*.svelte`, `events-view.ts`, `career-text.ts`, `menu/runs/`, `StartSheet.svelte`, `ModesPage.svelte`, `GoalsPage.svelte` | Events opens on the Series card; an event from any list opens the sheet; no tabs anywhere; `career-page.test.ts`, `series-page.test.ts` pass |
| 1c | Garage, car picker | `GaragePage.svelte`, `Garage*.svelte`, `garage*.ts`, `CarPickPage.svelte` (replaces `CarPick.svelte`), `car-pick.svelte.ts`, `CarStill.svelte` | part cards at the approved level; phone shows the blurb on the focused part only; no car picture is cut by its card; over-class cars read as off |
| 1d | Driving HUD and its settings (8.4) | `src/hud/` except the pause, map overlay and Next up files; `index.html` `#touch` and HUD blocks; `prefs.ts` fields; the HUD rows in `settings-tab/DisplaySection.svelte` and `sections.ts` | 8.4's list; no allocation added to the frame loop; the DOM is written only on change |

**Batch 2: the rest** (after batch 0; may overlap batch 1, no shared files).

| Lane | Scope | Files | Done when |
|---|---|---|---|
| 2a | Online, Other rooms, New room, Meet | `src/menu/online/`; `src/net/` only for a field the lead approves (8.5) | players grouped by room with status and count; Join names the player; one primary in the online tone; `online.test.ts` passes |
| 2b | Settings list, section pages, Guide page, What's new, Support | `src/menu/settings-tab/` (after 1d's rows land), `SupportPage.svelte`, `Changelog.svelte`, `Release*.svelte`, `GuidePage.svelte` | two steps, no tabs, no car; every section card shows live values; `sections.test.ts` passes |
| 2c | Road cards: Next up ticket, gate, pause, road map, travel briefing | `career/GateCard.svelte`, `gate-card.svelte.ts`, `markers.css`, `hud/Pause*.svelte`, `pause-*.ts`, `hud/NextUp.svelte`, `next-up*.ts`, `hud/MapOverlay.svelte`, `map-overlay.svelte.ts`, `world/travel-card.ts` | every card sits on the frame with the one Back pill; each road map callout is tied to its flag and no outline is cut; pause rows a step lighter and no blue; `pause.test.ts`, `next-up.test.ts` pass |
| 2d | Results, final podium, first run on the road | `modes/ResultNext.svelte`, `result-next.svelte.ts`, `modes.css`, `modes/FinalCard.svelte`, `src/goals/`, `src/menu/guide/` (the tour goes) | results fill the screen as three cards; the final shows the stage car; the first run teaches on the road in three steps; `result.test.ts`, `goals.test.ts` pass |

**Batch 3: sweep** (one designer, after 1 and 2). Every screen at 1280x720, 1920x1080 and 844x390 touch, dark; light theme once per screen; delete what no page uses (`PageHead`, `Tile`, `PlaceChip`, `Tabs` if unused, `--panel*`, old layouts in `menu.css`, `settings.css`); `scripts/shots.ts` sheets refreshed. Then the lead releases, with the Series live and the AI tuning (t338).

### 8.4 HUD settings, the phone speedometer, the phone handbrake

All in lane 1d. Today `origin/master` has four HUD layouts (`HudLayout`: minimal, classic, racing, compact) plus `DashPlace`, `SpeedoStyle` (ring, bar), `MapView` (full, close, pace, off) and `MapCorner`. The mockup is one layout with two choices. What happens to the other layouts is a lead decision (8.5 D9).

**Minimap, three variants as one setting** (`map` in `prefs.ts`, label "Minimap"):

| Variant | Mockup | Code today | Work |
|---|---|---|---|
| Realistic (default, A) | The map's own picture, zoomed, north up, your marker a diamond with a dark ring | `Minimap.full()`: roads and the route on a blank canvas, no terrain | the terrain picture drawn once into the cached layer under the roads (8.5 D10 for where the picture comes from); the per-frame draw stays as it is |
| Race line | The route only: cased line, finish mark, next gate ring, rivals as dots, you as a diamond | none; `full()` in a run is the closest | a new `MapView.LINE` and one `line()` draw that reuses `show_route`'s cached layer without the road network; with no route (free roam) it shows Realistic |
| Close-up | Turns with you: road sides, the road ahead lit, the gate as a bar, rivals, you as an arrow | `Minimap.close()` | restyle only |

`off` stays. `pace` (rally notes) is not in the mockups: 8.5 D9.

**Speedometer, two variants as one setting** (`speedo`, label "Speedometer"):

| Variant | Mockup | Code today | Work |
|---|---|---|---|
| Bar card (default, A) | Card 216x152: speed in mono 48, gear and km/h beside it, a rev bar, aid chips under | `data-speedo="bar"`, Classic layout only (`dash.css:525-610`) | becomes the base rule, no layout condition |
| Round dial | Card 216x216: a 270° arc (track, red zone, fill), speed in the middle, gear at the foot, aid chips under | `data-speedo="ring"` (`.dial` in `dash.css`) | restyle into the card |

Both are CSS over the same elements (`#speed`, `#gear`, `#rpm-fill`), so `hud.ts` writes nothing new.

**Phone: the speedometer must not cover the car.** The mockup puts the phone speed card bottom centre (`.fr.p .hud-spd`, 136x68; the dial 108x108), and `origin/master` does the same (`phone.css:311-325`). On an 844x390 screen with the chase camera the car sits in the centre third of the lower half, so both cover it. Rule for the build: on a phone nothing sits in the centre third below the top row. Plan:

- Bar: speed and gear move into the top row as one chip-high readout (number + gear, the rev bar as its bottom edge), left of the pause button. In a run it joins the top card as its last cell.
- Dial: 92 px, top-right under the pause button, above the Gas pad.
- `#recenter`, which hangs off the speed card today (`phone.css:333`), moves with it.

Checked by a phone screenshot in each camera view with the car on screen, bar and dial both. This is a designer pass with the owner's eye on it (8.5 D11), since no mockup frame shows the fix.

**Phone: the handbrake.** The game has it. `index.html:532` holds `<div class="touch-key" data-touch="handbrake">Handbrake</div>` above the brake pad; `touch.ts:168-180` reads a press in the brake column above the line between the two as the handbrake; no CSS rule hides it on a phone. Two causes for the owner's "missing":

1. The mockup never drew it. `touchHud` in `screens.js:70` is two steer pads, Brake and Gas. That is what the owner reviewed.
2. In the game it is the weakest control on the screen: a 40 px ghost pill (`--phone-hand-h: 40px`, `phone.css:82`) with a 22 % fill (`--ghost-fill`), the word "Handbrake" at `--text-2xs` (10 px) and no icon, wedged between the rewind button and the brake pad. It reads as a label.

Read from the code and the mockup source only; not checked on a real phone.

Fix in lane 1d: the handbrake becomes a real pad, the same round ghost pad as the brake, at least 44 px, with an icon (a new `icon-handbrake` in the sprite) or "HB" in bold, lit `--accent` while held (the rule exists). It stays above the brake pad, because `touch.ts` already reads a slide from the brake up to it. The Guide's Driving topic names it. `phone-gas-h` follows from the new height, so the Gas pad stays as tall as brake + handbrake.

Done when (lane 1d): the Display section has Minimap (Realistic / Race line / Close-up / Off) and Speedometer (Bar / Dial); each variant matches its mockup frame at 1280x720; on 844x390 the car is clear in every variant; the handbrake pad shows and holds the car in a slide; `prefs.test.ts` covers the new value and a save with an old one.

### 8.5 Lead decisions

Things in the mockups that need a new state layer, new data or engine work. The rest of each screen is built regardless; these parts wait for the call.

| # | Where | What the mockup needs | Options, lightest first | Recommend |
|---|---|---|---|---|
| D1 | Shell, Title, Home, Garage, Final | A showroom stage over the loaded map (a second scene, its own GL use) | port `showroom/car-stage.ts`, `showroom.ts`, `turntable.ts` from ui-old with new markup; write it again | port (lane 0b); it had three leak and shadow fixes already |
| D2 | Travel | A briefing loader that holds on "Start" when the map is ready: travel state that outlives the map load. The sheet says "Starts on arrival", the travel frame shows an Enter Start that lights up: the two disagree | auto-start on arrival; hold for Enter; hold for Enter only when the load took over about 5 s | hold for Enter (the player may have looked away); port `world/travel.ts` from ui-old `9020c95`, `bbb8b07` |
| D3 | Road map | "Go to flag. No loading": moving the car on the same map, with its arrival pose | port ui-old `12b096b`, `54fef7e`, `3ab3c91`, `06a98ca`, `974adcf` | port (lane 0c) |
| D4 | Road map | Callout cards tied to pins by lines. The mockup works the lines out in JS from pixel sizes | fixed CSS slots (two per side) with an SVG in percent units from slot anchor to pin, no measuring; measure and lay out in JS | fixed slots. Open: a map with more flags than slots (the island has more than four). Suggest the nearest four by default and the rest behind "More flags" |
| D5 | Start sheet, picker, gate | One "launch" in progress (event, car, who opened it) shared by the sheet, the picker and travel | extend ui-old's `CarAsk` (`car-pick.svelte.ts`) to carry the event; a new `menu/launch.svelte.ts` rune module | extend `CarAsk`: one small module, already tested |
| D6 | Meet | Pads on the road ("drive onto the pad"), a per-driver ready and picking state, a countdown, open slots | the meet as a card over the road on today's lobby Ready data, no pads; pads as world objects plus a net message | card only for this rebuild; pads as their own quest |
| D7 | Online | Per room: count of 8, state "Roaming / In lobby / Racing · lap 2/3"; per player: flag, room, Join. `Announce` (`net/directory.ts`) has `players` and `racing?` only | show Roaming / Racing from what exists; add optional `lap`, `laps`, `lobby` fields (append-only, no `PROTOCOL` bump) | first option now; the fields with the Meet quest. Check in lane 2a whether the directory lists players of other rooms at all; if not, that is the real gap |
| D8 | Home | Reasons line "About 4 min": no duration on events | derive from the three-star time and laps; add a field per event; drop the line | derive |
| D9 | HUD | One layout. The release has four layouts, dash place, map corner and the rally notes map | keep all, restyle each; keep only the mockup layout + Minimap, Speedometer, HUD size, and drop `hud`, `dash`, `map_corner` and `pace` | drop (no real players yet, prefs are validated on load). Owner call on rally notes: it is a feature, not a look |
| D10 | Minimap Realistic | A terrain picture of the loaded map under the roads | reuse the menu's `map-thumb.ts` render once at load; a worker render like ui-old's road map | reuse `map-thumb.ts`; measure the load cost on the mainland (streamed) before it becomes the default |
| D11 | Phone HUD | Where the speedometer goes so the car is clear (8.4); no mockup shows it | top-row readout (bar) and top-right dial; a slim strip above the pads | the first; the owner sees phone shots before lane 1d closes |
| D12 | Garage | Part states "Owned", "1 200 cr", "A · 4 800 cr" and a credits chip: buying parts. The release has credits (`career/credits.ts`) but no part prices or ownership | show Fitted / Fits / Over class only; add prices and an owned set (a save format and a balance pass) | first option in this rebuild; the part economy is its own quest and owner call |
| D13 | First run, Guide | Teaching on the road replaces the 7-step tour (`menu/guide/*`); first run, first-steps goals and the Guide become one path. The tour also holds the touch steering pick and the name | delete the tour, move its two picks to Settings, drive the steps strip from `goals/`; keep the tour and add the strip | delete the tour. The Guide's six topics need new copy and pictures, and a topic's own page is not in the mockups: build it as a section page (text beside one picture) |
| D14 | Cards with pictures | A picture per Series round, tier and run (`ser_s1_reverse` and the like). The release has one picture per map kind (`public/menu/<kind>.webp`) | the kind picture of the event's map; a shot per event from `scripts/menu-shots.ts` | kind pictures now; per-event shots as a follow-up once the layout is in |
| D15 | Final | "Next series: Alpine", a season car, a title as rewards | show what `series-seasons.ts` already awards; add missing rewards | show what exists; lane 2d lists what the mockup shows that the data lacks |
| D16 | Class badge | Colours for S2 and X (the mockup stops at S1) | S2 `--info`, X `--cottontail` on a dark letter | as listed; class A stays `--error` (lead call) |
| D17 | Old work | The bug fixes inside the parked commits that are not UI: `974adcf` (far teleport hang), `2935a05` (`?car=` on travel), `ad78750`, `9a346e8`, `ecf54a6` | port each with its test in lane 0c or 2c; leave them on `ui-old` | port; they fix released behaviour or code this rebuild ports anyway |

### 8.6 Owner calls (2026-11-17)
- D9: drop the HUD layouts and `dash` / `map_corner`; keep one HUD with Minimap, Speedometer and HUD size settings.
- D12: no part prices. Garage shows Fitted / Fits / Over class only.
- D13: drop the 7-step guide tour, teach on the road. The owner still wants a guided pass through the key settings, so the first run gets one skippable "Set up" step after the name: theme, handling (assists / steering feel), controls. Each choice previews live. The first-steps goals then include "Try a theme" and "Tune your handling", which point into Settings.

### 8.7 Batch 0 notes (2026-11-17)
- 0a done d3cf15a..53d82f3 (`?showcase=ui`). Lanes size from the frame tokens (`--pad`, `--gap*`, `--row-h`, `--type-*`), never raw `--space-*`. KeyButton `size` and Card `variant`, plus PlaceChip, stay only until 2c/2d move their callers; delete them in batch 3.
- 0c done 1c37564..e42b1ab: travel, Series always on, gate preselect, pause door. Left for the UI lanes: travel-card.ts + its boot hook (2c), the result card lines in modes.ts (2d), the Series door (1b), the AI difficulty row (2b).
- D2 decided: no "start on arrival". Lane 2c drops `GO_PARAM` / `travel.go`; Enter (hold) starts.
- D5: `travel_query(…, taken)` passes `false` until the launch work (1b) passes `true` after the picker.
- 1d done 65fae17..8bcb4f6: one HUD; Minimap Realistic / Race line / Close-up / Notes / Off; Speedometer Bar / Dial; phone keeps the centre third clear; round 52 px handbrake pad. Left for later lanes: AI rivals on the minimap (only net cars today) and close-up lighting only the route ahead (needs `RouteRun` progress), both in 2c; top card restyle to `hud-top` in batch 3. Every lane builds its preview into its own scratch folder (`scratchpad/<task>/dist`), never a shared `dist`.
