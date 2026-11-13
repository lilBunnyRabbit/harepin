# Svelte menu port: UI audit and scale

Audit 2026-11-13 on master `a8e2a47` (v0.36.1). This is a plan only. No code changed.

The menus in `src/menu` move to Svelte 5 (runes only) tonight. The owner wants the same pass to fix "off spacings, inconsistent ui, etc". This doc is the punch list for that pass. It has three parts:

1. [Findings per page](#findings-per-page): what looks wrong, at which width and theme, measured in the DOM, with the CSS `file:line` to change.
2. [One scale](#one-scale): spacing, sizes, type, radius and breakpoints, mapped to the tokens already in `src/style.css` and `src/menu/settings.css`.
3. [Component inventory](#component-inventory): the components the port builds, each replacing a list of today's selectors.

Port these, not the pixels. The Svelte components should take the scale from part 2, so most rows in part 1 get fixed without extra work.

## How this was measured

- **Screens:** Playwright on Chrome with a vite dev server on port 5401. Widths were 1440x900, 1024x768, 844x390 (touch, `pointer: coarse`) and 390x844 (touch), each in Brand Dark and Brand Light. Career stars (`r1:3, r2:2, r3:1, r4:2`) and four done goals were seeded in localStorage. The guide used a fresh profile. What's new used `harepin:seen-version = 0.34.0`. The car pick and pause row used `?event=r1`. The result card was `modes.show_result()` with a fake finish.
- **Numbers:** a DOM walk over `.settings`, open dialogs, `#mode-result` and `.updated-card` recorded every visible element's computed size, padding, gap, radius, font size, weight, line height and letter spacing. The values below are CSS px from those computed styles, not guesses from screenshots.
- **Shots:** `C:/Users/Andra/AppData/Local/Temp/claude/7b7af39d18cf6668/bb083546-0056-4804-9143-4bb5fcb02143/scratchpad/t106/shots/<nn>-<state>-<width>-<theme>.png` (session scratchpad, not kept), about 290 files. The capture script is `capture.mjs`, the per-state measurements are `measures.json` and the aggregator is `analyze.mjs`, all in the same folder.

The owner rules from `src/menu/AGENTS.md` and the design index apply throughout. Everything stays in the main menu. Settings are rows. More room, never tighter. No native scrollbars. The garage car never moves between sections. Tokens only. Nothing invisible reserves space. No overflow at any width.

## Worst first

These are the twelve that a player notices. Fix them first, whatever else slips.

| # | Where | What is wrong | Width | Cause |
|---|---|---|---|---|
| 1 | Online | At phone portrait the cards keep fixed row heights and clip their content. Lobby race shows only its heading. Your room cuts Copy invite link in half. Players online cuts its third row. | 390 | `menu.css:557-566` sets `grid-template` rows plus `grid-auto-rows: 160px`, and `.menu-tile { overflow: hidden }` (`menu.css:313`) clips. The `overflow: visible` fix exists only under `max-height: 500px` (`menu.css:546`). |
| 2 | Guide | At phone portrait the guide keeps the desktop two-column grid. "Welcome" is cut off, the name input is 64 px wide and shows "Fuz", and the body text wraps every two words. | 390 | `guide.css:130` uses `"copy visual" / 0.9fr 1.1fr` with `column-gap: 40px`. No `max-width` rule restacks it: `guide.css:1005` only hides step labels. |
| 3 | Play (run) | The goal toast ("Drive through each lit gate…") draws over the open menu. It covers Restart Race at 844 and the tab bar at 390. | all | `#toast { z-index: 31 }` (`src/hud/overlays.css:13`) sits above `.settings { z-index: 30 }` (`settings.css:10`). |
| 4 | Car pick | The dialog list shows a native scrollbar, which breaks the "no native scrollbars" rule. | all | `car-pick.css:56` uses `scrollbar-width: thin`. |
| 5 | Settings | Below 1100 px the help column becomes one truncated line ("Balanced keeps traction and ABS…"). The text that explains the setting is unreadable at 1024, 844 and 390. | ≤1100 | `settings.css:1311-1317` sets `white-space: nowrap; text-overflow: ellipsis` on `.set-help-text`. |
| 6 | Play | At 1440x900 and 1024x768 the side column scrolls inside itself with no cue. Create world, Modes and Things to try sit below the fold, and the last row is cut at the edge. | 1440, 1024 | `.play-side { overflow-y: auto }` (`play.css:66-78`) with no fade or edge, under a fixed `.play-top`. |
| 7 | Garage, My builds | At 390 the builds sheet clips its preset cards while about 200 px of empty space sits under the meters. That space is the part strip's row, kept but hidden so the car does not move. | 390 | `garage.css:1063-1070` keeps the strip row on the builds tab, and `garage.css:1052-1058` caps the rail's `max-height`. |
| 8 | Play map | The "Drawing Mainland…" note renders under the legend pill, half hidden. At 844 the map pane shows mostly ocean, with the island off frame. | all; 844 | `.world-map-note` and `.play-legend` share the bottom inset (`world-map.css:36`, `play.css:51`). The map is not fitted to a short, wide pane. |
| 9 | Settings, keys | At 390 the key table squeezes the action names into four-line wraps ("Nitro / (hold, / when / fitted)"). Steer has about 180 px of empty row height, and the section title wraps to two lines. | 390 | `.settings-keys` keeps table layout inside the 76 px rail layout (`settings.css:335-376`, `settings.css:1324`). |
| 10 | Modes | At 390 the two-pane layout leaves level cards in a 170 px column. The left list then runs to the bottom with nothing in it, and the footer truncates ("Finish Ci…"). | 390 | The modes grid (`menu.css:640`, `menu.css:836-860`) has no single-column phone layout. |
| 11 | What's new | The release list is clipped mid-row at its bottom edge: a badge peeks out with no fade. | 844 | `.updated-notes` scrolls with a hard edge (`updated-card.css:23-60`). |
| 12 | Career / goals / room page view | The back and title row sits at the screen edge (x≈90), while the 720 px card is centred (x≈360), so the head and body do not line up. Career and goals also nest a card inside a card. | 1440, 1024 | `menu.css:36-49` sets the page head full width, and `.settings-page { max-width: 720px; margin: 0 auto }` (`menu.css:83`) centres only the body. `.career-tier` has its own panel (`career.css:6`) inside `.settings-page`. |

## Findings per page

Columns: **W** is the width (1440, 1024, 844 = 844x390 touch, 390 = 390x844 touch, all = every width). **T** is the theme (D dark, L light, both).

### Shell: top bar, tabs, page view

| # | W | T | Finding | Measured | Where |
|---|---|---|---|---|---|
| S1 | all | both | There are three tab-bar styles for one idea: menu tabs, garage tabs and modes tabs. A fourth, the settings segmented control, also selects. | `.menu-tab` 40h/14px/600/pill/pad 20. `.garage-tab` 32h/13px/600/pill/pad 16. `.modes-tab` 41h/13px/400/r12/pad 12. `.settings-choice button` 26h/13px/600/r6 | `menu.css:265`, `garage.css:78`, `menu.css:640`, `settings.css:144` |
| S2 | all | both | The page view (career, goals, room, world, modes) swaps the tab bar for Back + title. The back control is a 32 px text button. The top-bar chips beside it are 32 px pills with borders. | `.settings-back` 32h r8. `.menu-chip` 32h pill | `menu.css:53`, `menu.css:117` |
| S3 | 1440, 1024 | both | The page-view head is not aligned with the centred 720 px body (worst #12). | head x=80, body x=360 at 1440 | `menu.css:40-49`, `menu.css:83` |
| S4 | all | both | The page view nests panels: `.settings-page` is a bordered panel with 16 px padding, and the career tiers and goals list put their own panel inside it. The result is a double frame and a 32 px total inset. | page pad 16, tier pad 16/20 | `menu.css:83-90`, `career.css:6-12` |
| S5 | all | both | The settings title weighs 600 at 16 px. Every other page and card title is 700. | `h2.settings-title` 16/600, ls −0.011em | `settings.css:40`, `menu.css:49` |
| S6 | all | — | `--control-h` is set three times. It is 32 in `:root`, 40 under the first `pointer: coarse` block and 44 under the second. The 40 is dead. | | `style.css:43`, `style.css:75`, `style.css:221` |
| S7 | all | both | The body focus-ring room uses raw `padding: 6px; margin: -6px`. | | `menu.css:79-80` |

### Play (career hero, free drive, mini maps, more, goals card, pause row)

| # | W | T | Finding | Measured | Where |
|---|---|---|---|---|---|
| P1 | 1440, 1024 | both | The side column scrolls with no cue (worst #6). The page has six stacked blocks: career hero, free drive, mini maps (8), create/modes, goals card and pause row. | side 400 px wide, content about 1130 px tall at 900 high | `play.css:66-78` |
| P2 | all | both | There are three primary-ish button heights on one screen: Continue career 52, Restart/Quit 52 and Keep driving 44. The last two are both "drive" actions. | `.play-go` 52h/16/700/r12. `.play-quit` 52h/14/700/r12. `.play-drive .play-free` 44h/14/700/r12 | `play.css:142`, `play.css:81-96`, `play.css:138` |
| P3 | all | both | The "Free drive" eyebrow renders at 12 px while every other `.menu-eyebrow` is 10 px. `.play-words span` (12 px) wins over `.menu-eyebrow` on specificity. | `span.menu-eyebrow` 12/700/0.96 vs 10/700/0.8 | `play.css:220`, `menu.css:411` |
| P4 | all | both | The career hero tier name is a raw 28 px, the badge a raw 26 px, the next-event name 20 px and the stars count 20 px. That is four title sizes in one card. | `b` 28/700, 20/700, 20/700; `.career-badge` 26 | `career-hero.css:16`, `career-hero.css:27`, `career-hero.css:128` |
| P5 | all | both | The event chips (Cloud sprint, Skyline) are 32 px pills at 12/700. "All events ›" is a plain link at 13/600, and "See all ›" on the goals card is a 32 px pill at 13/600 with an asymmetric 12/8 padding. These are the same "more" affordance three ways. | `.career-hero-pick` 32h/12/700/pill. `.goals-all` 32h/13/600/pill/pad 12-8 | `career-hero.css:147`, `goals.css:44` |
| P6 | all | both | The goals card's Go is a 28 px pill. The goals page Go and the career Go are 32 px with r8. | `span.goals-go` 28h/pill. `.settings-action` 32h/r8 | `goals.css:127`, `settings.css:199` |
| P7 | all | both | Section head "Mini maps" is 14/700 with no eyebrow. On the same column, "CAREER", "FREE DRIVE" and "THINGS TO TRY" are uppercase eyebrows. | `h3.play-head` 14/700 | `play.css:151` |
| P8 | all | both | The mini-map tile and the create/modes link tile are different card shapes for the same "go somewhere" job. One is 46 h with a thumb, the other 72 h with an icon. Both have r12, with different paddings (4/8 vs 16/16). | `.play-mini` 46h pad 4/8. `.play-link` 72h pad 16 | `play.css:180`, `play.css:164`, `play.css:234` |
| P9 | all | both | "You are here" badge: `gap: 2px` and padding 8/12. The legend pill also has padding 8/12 but sits 16 px from the edge. These are fine, but they are raw `2px` gaps (also P-wide: `play.css:43`, `play.css:212`). | | `play.css:38-55` |
| P10 | all | both | Running a mode makes the map go blank for the whole run, showing "Drawing Mainland…" under the legend (worst #8). | | `world-map.css:36`, `play.css:51` |
| P11 | 844 | both | The Restart and Quit row is covered by the goal toast (worst #3). | | `overlays.css:13` |
| P12 | all | L | In light, Continue career is a filled brown primary while the guide's Next, Start and Got it use `.menu-go`, which light turns into a bordered raised button. The same "primary" reads two ways. | | `menu.css:436-440`, `play.css:142` |

### Career page

| # | W | T | Finding | Measured | Where |
|---|---|---|---|---|---|
| C1 | all | both | Card in card (S4). The tier panel has 16/20 padding inside the page's 16. | | `career.css:6-12` |
| C2 | all | both | Row height is 64 at the desktop, with `padding: 12px 0`. The row has no horizontal padding while settings rows have 16/12, so career rows read cramped against the panel edge. | `li.career-row` 64h pad 0 | `career.css:49-55` |
| C3 | all | both | The stars column stacks the stars over "- -" placeholders at 12 px dim. The best time is missing for unplayed events, so a two-line cell shows dashes. | | `career.css:89-108` |
| C4 | all | both | The "Final" tag is a raw `padding: 1px var(--space-2)` pill at 11 px. The NEW tag on mode levels is a different style, and the guide's "RECOMMENDED" is a third. | `.career-final` 11/pill/pad 1-8 | `career.css:67-73` |
| C5 | 390 | both | The class badge drops to its own line under the event text, so rows grow to 88 px. That is fine, but the Go button then centres on a three-line row. | | `career.css:114-140` |

### Goals ("Things to try") page and card

| # | W | T | Finding | Measured | Where |
|---|---|---|---|---|---|
| G1 | all | both | The page head "4 / 14" is a 28 px-ish bold number with a bar but no label. The card version says "THINGS TO TRY 4 / 14". | | `goals.css:5-60` |
| G2 | all | both | Done rows dim the title to weight 500. There are four weights in the menu (400/500/600/700), and 500 appears only here, in row labels and in chip `small`. | `b` 14/500 | `goals.css:213`, `settings.css:1003` |
| G3 | all | both | The goals row mark is a raw 22 px column with a 14 px check (`goals.css:194-210`). The career row id column is text. These are two list-row shapes for the same kind of list. | | `goals.css:189-212` |

### Garage (Body, Performance, Paint, My builds)

| # | W | T | Finding | Measured | Where |
|---|---|---|---|---|---|
| R1 | 844 | both | In short landscape the slots are bare label-over-value text in a 3x2 grid, and only the selected one gets a box. The part cards under them are filled boxes. These are two selection styles in one panel, and the slots do not read as tappable. | `.garage-slot` no fill unless current | `garage.css:591-630` |
| R2 | 390 | both | My builds clips its preset list while the empty strip row sits below (worst #7). This pits the "car never moves" rule against "nothing invisible reserves space". The fix is to let the builds sheet take the strip row while the car stays put, not to reserve it. | | `garage.css:1052-1070` |
| R3 | 1024 | both | The part card for Stock keeps a 52 px empty left gutter (reserved swatch or icon space). Tuned and Race start at 16 px, so the three cards in a row are misaligned. | `button.garage-card` pad 16/28 | `garage.css:349-360` |
| R4 | all | both | The garage's own sizes do not share the menu's. Slot rows are 47 h at 12 px, cards 72-77 h at 12/600, part labels are 11 px, and panel titles ("Against stock") are 12/600 sentence case where every other section title is an eyebrow. | `.garage-slot` 47h/12/600. `.garage-card` 72-77h. `h3.garage-panel-title` 12/600 | `garage.css:142`, `garage.css:173`, `garage.css:218` |
| R5 | all | both | My builds has four button sizes in one sheet. Save is 32 h at 13/600 r8, Copy and Load (form) are 32 h, the preset "Load" is a 23 h span at r8, and the preset card is a 92-122 h button. The friend's-code input is 32 h at 12 px, while the name input beside it is 13 px. | `span.garage-build-go` 23h. `input.garage-field` 13 vs 12 | `garage.css:900`, `garage.css:982`, `garage.css:866` |
| R6 | all | — | The garage uses raw paddings: `calc(var(--space-4) + 12px)`, `calc(var(--space-3) + 10px)`, `padding: 4px`, `6px` and `0 6px`. Its heads are `--control-h + 10px` and `+ 6px`. | | `garage.css:6`, `garage.css:72`, `garage.css:341`, `garage.css:358`, `garage.css:568`, `garage.css:594-598`, `garage.css:747` |
| R7 | 1440 | both | The car strip's last card is cut at the panel edge with no fade. The rail's preset list (My builds) is also cut at its bottom, "grass" half shown. | | `garage.css:300-360` |
| R8 | 390 | both | Body: the car sits in about 40% empty height. The slot row shows three slots across, and the part strip runs off the right edge. That is acceptable for a carousel, but no edge cue says so. | | `garage.css:1063-1110` |

### Online and new room

| # | W | T | Finding | Measured | Where |
|---|---|---|---|---|---|
| O1 | 390 | both | The tiles clip their content (worst #1). | | `menu.css:557-566`, `menu.css:313`, `menu.css:448` |
| O2 | all | both | Online buttons (Copy invite link, Ready, Start race) are 32 h at 13 px. They are the main actions of the tab, yet smaller than Play's 44-52 px buttons. | `.settings-action` 32h | `settings.css:199` |
| O3 | 1440, 1024 | both | "No other games found. Invite links still work." appears twice, in Players online and in Games running. | | `online-page.ts` |
| O4 | 1440, 1024 | both | Lobby race fills a full-height column with about 450 px of empty space under the Ready row. Your room has a large gap between Copy invite link and the footer caption. | mosaic `1fr 1fr` rows | `menu.css:309` |
| O5 | all | L | The New room tile in light is a saturated tan well, the heaviest surface on the page, while it is the least important action. | `--set-well` = `--background-dark` in light | `menu.css:313-327`, `style.css:69` |
| O6 | all | both | The room code "lobby" is a raw 28 px mono. | | `menu.css:473-479` |
| O7 | all | both | New room form: the labels sit 8 px above the inputs, the fields are 32 h, and the inputs are 14 px while the help text is 12 px. The form reads tight. It is the one page form with no row structure. | `.settings-row` gap 8. `input.settings-input` 32h/14 | `settings.css:101-131`, `room-page.ts` |
| O8 | all | both | The server rows are 50-51 h with padding 12, the settings rows 56 h with 16/12, and the support rows 69 h with 16. That is three list-row paddings. | | `settings.css:443`, `settings.css:972`, `support.css:91` |

### Settings (nav, rows, help, keys, theme maker)

| # | W | T | Finding | Measured | Where |
|---|---|---|---|---|---|
| T1 | ≤1100 | both | The help text is truncated to one line (worst #5). | | `settings.css:1311-1317` |
| T2 | all | both | There are three title styles on one screen. The section title is a 12/700 uppercase eyebrow, the nav item is 16/600 and the help title is 20/700 at −0.011em. The rows themselves are 14/500. The nav labels are bigger than the content they open. | `h3.set-title` 12/700/0.96. `.set-tab b` 16/600. `b.set-help-title` 20/700. `span.row-label` 14/500 | `settings.css:900`, `settings.css:832`, `settings.css:1211`, `settings.css:1003` |
| T3 | 390, 844 | both | In the rail layout, What's new moves into the section head as a dim link beside the reset icon. A release-notes link inside "DRIVING" reads as part of that section. Reset section also changes from a quiet text link (desktop) to a filled pill (844) or a bare icon (390). | | `settings.css:1360-1363` |
| T4 | 390, 844 | both | Rail labels are 10 px (`--text-2xs`), and at ≤420 px height they are hidden visually, leaving icons only. | `.set-tab b` 10/600 | `settings.css:1341`, `settings.css:1408-1415` |
| T5 | all | both | The segmented control is 32 h with a 3 px inner pad and 26 h buttons with r6, inside an r8 track. Its inner radius does not follow the outer one (r8 − 3 = 5). The garage and menu tab tracks use pill-in-pill. | `div.settings-choice` pad 3. `button` 26h/r6 | `settings.css:133-161` |
| T6 | all | both | The switch is 44x26 inside rows whose other controls are 32 (desktop) or 44 (touch). The knob uses raw 3 px and 18 px. | | `settings.css:163-197` |
| T7 | all | both | Key table rows are 32 h with 11 px mono kbd chips, inside a settings page whose rows are 56 h (worst #9 at 390). | `table.settings-keys`, `kbd` 11 | `settings.css:335-406` |
| T8 | all | both | The theme maker's "Light or dark" segmented control, the arrows stepper and the sliders all line up right, but each row's control column has its own width. The right edge is ragged: the steppers are 212 wide, the choices 190-340, the sliders 220. | | `settings.css:972-1052` |
| T9 | 390 | both | The first row ("Preset") renders as a raised, focused box on open, because the list focuses its first row. On a touch screen this reads as a selected card with no reason. | `.row:focus` | `settings.css:1003-1010`, `settings.ts` |
| T10 | all | — | Raw values: `gap: 2px` (×5), `padding: 3px`, `padding: 5px 2px`, `padding: 0 6px`, `margin-right: 2px`, `border-radius: 6px 6px 3px 3px` and `2px`. | | `settings.css:118`, `settings.css:137-139`, `settings.css:389`, `settings.css:517`, `settings.css:665`, `settings.css:775`, `settings.css:1330-1338` |

### Support

| # | W | T | Finding | Measured | Where |
|---|---|---|---|---|---|
| U1 | all | both | The two support cards have asymmetric padding (20/24/24/24). Other cards use 16/20 or 20 all round. | `div.support-about` pad 20/24/24/24 | `support.css:8-20` |
| U2 | 1440 | D | The first support row shows the raised hover/focus fill on open. It looks selected. | | `support.css:91-110` |
| U3 | all | both | The support title is 20/700. The settings help title is also 20/700, but with −0.011em tracking. The tracking differs. | | `support.css:36`, `settings.css:1211` |

### Create world, Modes (page views off Play)

| # | W | T | Finding | Measured | Where |
|---|---|---|---|---|---|
| W1 | 1440 | both | The map preview is square in a tall box, so about 100 px black bars sit above and below. | | `world-map.css:300-360` |
| W2 | 1440 | both | Step 3 "Tune it" shows an "Advanced / More settings ›" row with nothing under it but "This world has no settings yet." That is an empty step taking a numbered slot. | | `world-page.ts`, `world-map.css:425` |
| W3 | 390 | both | The order is map, then "You're on this map", then step 1 "Pick a world". The numbered steps start after the result. | | `world-map.css:491-510` |
| W4 | all | both | The disabled primary ("You're on this map") is 52 h at 16/700, the Save button 32 h and the share links are 32 h pills. | `.map-drive` 52h. `.map-save` 32h. `.map-share` 32h pill | `world-map.css:366`, `world-map.css:382` |
| M1 | 1440 | both | Level cards are about 190 px wide on a 1000 px pane, leaving the pane mostly empty. The NEW tag is green text with no pill. | `button.modes-level` 112h | `menu.css:640-700` (`.modes-level` at `menu.css:683`) |
| M2 | 390 | both | The layout stays two-pane at phone width (worst #10). | | `menu.css:836-860` |

### Guide (7 steps)

| # | W | T | Finding | Measured | Where |
|---|---|---|---|---|---|
| D1 | 390 | both | The layout stays two-column (worst #2). | | `guide.css:126-138`, `guide.css:1005` |
| D2 | all | both | The guide uses its own sizes. The panel padding is 32 px, the column gap 40 px, the title a raw 28 px at −0.015em, the eyebrow 10 px at 0.06em (the menu eyebrow is 0.08em), the Back and Next buttons 40 h and the step pills 40 h with 14 px labels. | `h2.guide-title` 28/700/−0.42. `.guide-eyebrow` 10/0.6 | `guide.css:131-134`, `guide.css:156`, `guide.css:180`, `guide.css:305`, `guide.css:323` |
| D3 | 844 | both | Car step: the card grid is clipped at the footer rule with no fade, and the third row is half visible. | | `guide.css:873-972` |
| D4 | all | both | "Skip guide" is a 32 h pill at 13/600 in the top bar. Next to the name chip it reads as a second chip, not as a way out. | | `guide.css:48-60` |
| D5 | all | — | Raw values: `margin: -3px; padding: 3px` (×2), `padding: 0 2px`, `border-radius: 7px` / `3px`, `font-size: 15px`, `min-width: 30px; height: 30px`. | | `guide.css:150-151`, `guide.css:436`, `guide.css:479-482`, `guide.css:534`, `guide.css:554-555`, `guide.css:675` |

### What's new card, release notes

| # | W | T | Finding | Measured | Where |
|---|---|---|---|---|---|
| N1 | 844 | both | The release list is clipped with a hard edge (worst #11). | | `updated-card.css:23-60` |
| N2 | all | both | The subtitle is mono ("4 releases since v0.34.0", "From an earlier version"). The car pick subtitle is mono too ("Class C or below"). Mono is otherwise for codes and numbers. | | `updated-card.css:37-50`, `car-pick.css:37-48` |
| N3 | all | both | Got it is 40 h at 14/700 with r12 and a focus ring that looks like a double border. Full notes is an underlined text button with 0 padding. | `button.updated-ok` 40h | `updated-card.css:90` |
| N4 | all | both | The kind badges (New, Improved) are a raw `padding: 1px var(--space-2)` / `2px var(--space-2)`. | | `update.css:74`, `update.css:139` |

### Car pick dialog

| # | W | T | Finding | Measured | Where |
|---|---|---|---|---|---|
| K1 | all | both | There is a native scrollbar (worst #4). | | `car-pick.css:56` |
| K2 | all | both | Back is the only action, at 40 h/14/600/r12, right-aligned. It reads as a primary while it means cancel. | `button.car-pick-back` 40h | `car-pick.css:145` |
| K3 | all | both | The shelf heads (YOUR CAR, PRESETS) are 11/700/0.08em. The menu eyebrow is 10 px. | | `car-pick.css:59` |
| K4 | all | both | Disabled cars dim the whole card, including the class badge. The "Over C" reason sits bottom right at the same dim, so the reason is as faint as the car. | | `car-pick.css:100-140` |

### Result card (`#mode-result`, outside `src/menu` but in scope)

| # | W | T | Finding | Measured | Where |
|---|---|---|---|---|---|
| X1 | 1440, 1024 | both | Retry, Next event and Free drive are three equal 32 h buttons at 12/600. Nothing marks the next step: Next event should be the primary. | `#mode-result button` 32h/12 | `modes.css:161-175` |
| X2 | all | both | The title is 16/600 centred. Every other card title is 700. The stars are a raw 32 px with letter-spacing `var(--space-1)`. | | `modes.css:109-119` |
| X3 | 844 | both | The card overlaps the touch aid chips (AUTO sits under its left edge). | | `modes.css:84-98` |
| X4 | 390 | — | Portrait shows "Turn your device sideways", so there is no result card to judge. | | |

## One scale

The scale reuses the existing tokens. Nothing new is added except where a raw value repeats and has no token. The rule for the port is that no component takes a px value; it takes a token or a component prop.

### Spacing

The tokens in `style.css:22-27` stay. Two are added for values that repeat today.

| Token | px | Use | Replaces |
|---|---|---|---|
| `--space-0` *(new)* | 2 | Title over subtitle inside one label. Nothing else. | `gap: 2px` ×16 (`play.css:43`, `settings.css:118`, `garage.css:110`, `goals.css:96`, …) |
| `--space-1` | 4 | Inner pad of a segmented track or tab bar; icon to text in a small chip | `padding: 3px`, `4px`, `5px 2px` |
| `--space-2` | 8 | Icon to label in a button; between chips in a row | `6px` gaps |
| `--space-3` | 12 | Between controls in one row; list item gap | `calc(var(--space-3) + 10px)` |
| `--space-4` | 16 | Row padding (start); between groups inside a card | `calc(var(--space-4) + 12px)` |
| `--space-5` | 20 | **Card padding** (all cards, one value); **page gap** between cards | 16/20, 20/24/24/24 and 24 mixes |
| `--space-6` | 24 | Dialog and guide panel padding | the guide's raw `32px` panel pad |
| `--space-8` *(new)* | 32 | Column gap in two-column panels (guide, settings help) | `column-gap: 40px`, `padding: 0 32px` |

Rhythm rules:

- **Page:** the gap between cards is `--space-5`, at every width. Online and support move up from 16 to 20.
- **Card:** padding is `--space-5`. At short or phone widths it is `--space-4`, never less. A card never sits inside another card: the page-view `.settings-page` loses its panel when its child is a panel.
- **Row:** min height 56 desktop and 64 touch (today's 50 on touch is tighter than desktop). Padding is `--space-2` vertical and `--space-4` start / `--space-3` end. All list rows share it: settings, server, support, career, goals and keys.
- **Label to control:** `--space-2`. **Label to help line:** `--space-0`.

### Sizes

| Token | Desktop | Touch | Use |
|---|---|---|---|
| `--control-h` | 32 | 44 | Every button, input, select, segmented track and chip. Delete the dead 40 (`style.css:75`). |
| `--control-h-lg` *(new)* | 44 | 52 | One primary action per surface: Continue career, Drive, Start/Next, Got it, Create room, Next event. |
| `--control-h-sm` *(new)* | 28 | 36 | An inline action inside a row or a card (Go, Load, Copy), when the row also has a primary. |
| `--icon-size` | 18 | 20 | Unchanged. |
| tab item | `--control-h` | `--control-h` | Inside a track padded by `--space-1`, so the main tab bar is 40 / 52. |
| switch | 40x24 | 48x28 | Hit area of `--control-h` through `::after` (unchanged idea). |

Today's 23, 26, 28, 40, 41, 46, 47, 48 and 52 heights map to one of these three.

### Type

The `--text-*` tokens stay. Each role gets one token, one weight and one tracking.

| Role | Token | px | Weight | Tracking | Line height | Today it is |
|---|---|---|---|---|---|---|
| Eyebrow (section label, uppercase) | `--text-xs` | 11 | 700 | 0.08em | 1.2 | 10/0.08 (`menu.css:411`), 10/0.06 (`guide.css:180`, `menu.css:420`), 11/0.08 (`car-pick.css:59`, `garage.css:845`), 12/0.08 (`settings.css:900`, `play.css:220`) |
| Meta, help line, caption | `--text-sm` | 12 | 400 | 0 | 1.4 | already mostly |
| Body | `--text-md` | 13 | 400 | 0 | 1.45 | `.settings` base |
| Label, control text, list title | `--text-lg` | 14 | 600 | 0 | 1.3 | row label 14/500, settings-label 14/600, play-words 14/700, garage 12-14/600 |
| Card title | `--text-xl` | 16 | 700 | 0 | 1.2 | settings-title 16/600, mode-result 16/600, career-head 16/700, set-tab 16/600 |
| Page and dialog title | `--text-2xl` | 20 | 700 | 0 | 1.2 | support, car pick, updated, set-help 20/700, the last at −0.011em |
| Display (one per screen) | `--text-3xl` *(new)* | 28 | 700 | 0 | 1.1 | raw 28 px in `career-hero.css:27`, `guide.css:156`, `guide.css:279`, `menu.css:475`; 26 in `career-hero.css:17` |

- **Drop:** `--text-2xs` (10 px) from the menu. It falls under phone readability, and its uses become `--text-xs`. The rail labels (T4) go to `--text-xs`.
- **Weights:** 400, 600 and 700 only. Remove 500 (`settings.css:1003`, `goals.css:213`, `menu.css:195`). 900 stays on the class badge letter only.
- **Tracking:** 0 on every title. The −0.011em and −0.015em go, following the owner's "~0 tracking for display" taste.
- **Line heights:** today there are 12 values (1 to 1.6). The table's four replace them.
- **Mono** (`--font-mono`) is for codes, times, versions and key caps only. Subtitles (N2) become sans `--text-sm` dim.

### Radius

| Token | px | Use |
|---|---|---|
| `--radius-xs` | 6 | Segment and tab item inside a non-pill track (track r8 − pad 4 ≈ 4; use 6 and pad 2) |
| `--radius-sm` | 8 | Button, input, select, class badge |
| `--radius-md` | 12 | Row (hover and focus fill), inner card, tile, thumbnail |
| `--radius-lg` | 16 | Card, panel, dialog |
| `--radius-full` | pill | Tab tracks and their items, chips, tags, switch, progress bar |

Rule: an action is never a pill. Go, See all and event picks become buttons (`--radius-sm`), and pills are reserved for selection (tabs, segments, chips that toggle) and status (tags). This removes the Go pill vs Go r8 split (P6) and the See all pill vs All events link split (P5).

Raw radii to remove: `1px` (×3, the legend diamonds can keep `rotate` with `--radius-xs`), `2px`, `3px`, `7px`, `6px 6px 3px 3px` (`settings.css:665`, `guide.css:482`, `guide.css:675`, `settings.css:775`).

### Breakpoints

Today there are 20 distinct media conditions across 14 files: `max-width` 380 / 400 / 480 / 600 / 700 / 760 / 1000 / 1100, `max-height` 400 / 420 / 480 / 500, plus orientation combos. The port uses four. Svelte components take them from one shared CSS file of `@custom-media`-style comments, or from repeated literal queries, never from JS (decision gate: layout in JS).

| Name | Query | What changes |
|---|---|---|
| narrow | `(max-width: 1100px)` | Settings help moves under the list, **wrapping, not truncated**. The play side column drops below the map. |
| phone | `(max-width: 600px)` | Single column everywhere: guide, modes, online, world, settings (rail stays). |
| short | `(max-height: 500px)` | Landscape phone: tabs share the top row, the page body scrolls as one, eyebrows hide. |
| coarse | `(pointer: coarse)` | Sizes only (`--control-h` 44, `--control-h-lg` 52, row 64). No layout change. |

## Component inventory

Each component owns its CSS in the Svelte file and reads only tokens. The "replaces" column is the list to delete as each lands.

| Component | Variants / props | Size and type | Replaces |
|---|---|---|---|
| `Button` | `primary` (filled `--primary`, one per surface), `secondary` (raised + `--set-line` border), `quiet` (text, `--set-dim`), `danger` (Quit). `size`: `sm` / `md` / `lg`. `icon` slot. | sm/md/lg = the three heights; label `--text-lg` 600 (sm: `--text-md`); `--radius-sm`, lg `--radius-md` | `.play-go`, `.play-quit`, `.play-free`, `.settings-action`, `.goals-row-go`, `.goals-go`, `.garage-action`, `.garage-build-go`, `.map-drive`, `.map-save`, `.updated-ok`, `.car-pick-back`, `.guide-go`, `.guide-back`, `.menu-go`, `#mode-result button` |
| `IconButton` | `round` (top bar close), `square` | `--control-h` square | `.menu-close`, `.settings-close`, `.row-arrow`, `.guide-dice` |
| `Link` | trailing chevron or external icon | `--text-md` 600 `--set-dim`, hover foreground | `.goals-all`, career-hero "All events", `.set-reset`, `.updated-more`, `.map-share`, `.row-link`, `.set-changes` |
| `Tabs` | `nav` (main menu, bigger track), `section` (garage, modes list), `steps` (guide, numbered) | Item `--control-h`, `--text-lg` 600, track pad `--space-1`, all pill | `.menu-tabs`/`.menu-tab`, `.garage-tabs`/`.garage-tab`, `.modes-tab`, `.guide-step` |
| `Segmented` | `options`, `value` | Track `--control-h`, pad `--space-1`, items `--radius-full` in a pill track (matches `Tabs`) | `.settings-choice`, `.race-laps`, `.guide-seg` |
| `Toggle` | `checked` | 40x24 / 48x28, knob = height − 6 | `.settings-switch`, `.settings-knob` |
| `Slider` | `value`, `min`, `max`, `format` | Track 6, thumb 18 / 24, value `--font-mono` `--text-md` 700, `min-width: 4ch` | `.settings-range`, `.row-slider`, `.settings-volume` |
| `Stepper` | `options`, `value` (the arrows plus dots row) | Arrows = `IconButton` sm, value `--text-md` 600 | `.row-step`, `.row-step-value`, `.row-dots` |
| `Select` / `TextField` | `label`, `help`, `mono` | `--control-h`, `--text-lg` 400 (mono for codes), `--radius-sm`, `--set-soft` fill | `.settings-input`, `.settings-select`, `.garage-field`, `.guide-name`, `.map-code`, `.map-name`, `.menu-name input` |
| `Row` | `label`, `help`, `control` slot, `href` (chevron), `custom` | min-h 56 / 64; pad `--space-2` `--space-3` `--space-2` `--space-4`; label `--text-lg` 600, help `--text-sm`; `--radius-md` hover fill; focus ring only on `:focus-visible` (T9) | `.row`, `.settings-row`, `.career-row`, `.goals-row`, `.servers-row`, `.support-row`, `.settings-keys tr` |
| `RowList` | `divided` (rule between rows) or `gap` | gap `--space-1` | `.set-rows`, `.career-list`, `.goals-list`, `.servers-list`, `.menu-scroll` |
| `Card` | `well` / `panel` / `raised`; `as="button"` makes a tile | pad `--space-5` (short: `--space-4`); `--radius-lg`; border `--set-line`. Never nested: a `Card` in a `Card` drops to `Section`. | `.menu-tile`, `.menu-info`, `.goals-card`, `.career-hero`, `.career-tier`, `.support-about`, `.support-sent`, `.set-help`, `.play-drive`, `.settings-page` (page view), `.guide-card`, `.updated-notes` |
| `Tile` | `thumb` (image), `icon`; `size`: `sm` (mini map) / `md` (link) | One height per size; title `--text-lg` 600, meta `--text-sm` | `.play-mini`, `.play-link`, `.guide-tile`, `.guide-world`, `.map-world`, `.modes-level`, `.car-pick-car`, `.garage-card`, `.garage-build-load` |
| `SectionHead` | `eyebrow`, `title`, `count`, `action` (`Link`) | Eyebrow role from the type table; title is the card-title role | `.menu-eyebrow`, `.guide-eyebrow`, `.set-title`, `.car-pick-shelf-head`, `.garage-build-head`, `.garage-panel-title`, `.play-head`, `.goals-head`, `.career-head` |
| `PageHead` | `title`, `back` | Back = `Button quiet` with chevron; the title is the page-title role; **aligned to the body column** (S3) | `.settings-head`, `.settings-back`, `.settings-title` |
| `Badge` | `tag` (Final, NEW, RECOMMENDED, New/Improved release kinds; filled pill), `count` (unread) | `--text-xs` 700, pad `--space-0` `--space-2`, `--radius-full`; kind colours fixed per meaning | `.career-final`, `.menu-tag`, modes NEW text, `.update-kind`, `.servers-tag`, guide recommended |
| `ClassBadge` | `cls`, `pi`, `cap` | Unchanged look (`class-badge.css`): `--text-sm` mono 700, `--radius-sm`. One size in lists, `lg` in the garage head only | `.class-badge` |
| `Chip` | `toggle` / `status` (dot) / `input` (name) | `--control-h`, pill, `--text-md` 600 | `.menu-chip`, `.menu-name`, `.menu-room`, `.career-hero-pick` |
| `Progress` | `value`, `max`, `marks` | Height 6 (bar) / 8 (hero), pill | `.career-hero-bar`, goals bar, career tier bar, `.garage-meter` |
| `Dialog` | `title`, `subtitle`, `actions` | Pad `--space-6`, `--radius-lg`, `--panel-shadow`; body scroll with fade edges, no scrollbar (`scrollbar-width: none`); actions right, one primary | `dialog.car-pick`, `dialog.updated`, `#mode-result` |
| `ScrollArea` | `fade` | `scrollbar-width: none`, a mask fade at a clipped edge, so cut-off content reads as "more" | `.play-side`, `.set-list`, `.car-pick-list`, `.updated-notes`, `.garage-rail`, `.guide-cars`, `.menu-scroll` |
| `Kbd` | `keys` | `--text-xs` mono, pad `--space-0` `--space-1`, `--radius-xs` | `.settings-keys kbd`, `.garage-hints` keys |

Tokens that stay as they are: the surface set (`--set-panel`, `--set-well`, `--set-raised`, `--set-soft`, `--set-line`, `--set-dim` in `settings.css:2-7`, over `--panel*` in `style.css:56-62`), `--line-strong`, `--primary` / `--on-primary` and the state colours. No new colour token is needed. O5 (the heavy tan well in light) is a choice of surface: `Card well` for the New room tile becomes `Card panel`.

## Notes for the port

- **Order:** Build `Button`, `Row`, `Card`, `SectionHead`, `Tabs` and `ScrollArea` first, since they cover most of the findings. Then do the pages in worst-first order: Online, Guide, Play, Settings.
- **Must-keeps checked in this audit:** Everything stays in the menu (no sheets). Settings stay rows. The car never moves between garage sections (R2 keeps that: the builds sheet takes the strip row, the car's box stays). The career-first Play page from v0.36.1 stays. Light mode stays a UI mode with the same layout.
- **Not checked:** a real phone (only Playwright touch emulation), a gamepad, focus order, screen readers. The first 844 dark pass lost its page to a vite reload (another agent edited files) and was re-shot. The result card at 390 does not exist (portrait shows the rotate screen).
- **Decision gate:** None of the scale needs JS layout or a new state layer. The breakpoints stay CSS. The `ScrollArea` fade is a CSS `mask-image` driven by scroll-state queries or a 2-line scroll listener; that choice is open and goes to the owner if it needs JS.
