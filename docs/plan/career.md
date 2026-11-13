# Career ladder

> **Status 2026-11-12 (next release after 0.33.2):** Public. Every load has the career: the Play card and the career page show for everyone; free play is unchanged. C0-C4 are in: 21 events, the store, the career page, `?event=` start, the Play card, finish line + Next event, the +2 s hit penalty, the car pick (the event's car is fitted unsaved and the player's car comes back on leaving), bot star times for race events, owner star marks for the 12 non-race events, and dev ghosts for race events (precached by the PWA, `vite.config.ts`); duel events have none, so the player's first run sets the ghost, as in free play. `?tune` (old links `?career&tune` still work) opens every tier and adds Copy my times. `scripts/career-check.ts` checks every event runs on its map; `scripts/career.ts [ids] [--write]` tunes (ids as plain arguments, not `--event`).
>
> **Round 3 (2026-11-12, `docs/brainstorm/2026-11-13_harepin-career-v3.answers.md`):** done before release (R1, R2): c7 on the Volcano `descent` (F1); r7 on Sky Track as **Skyline** (F2, N1); p7 on the Ice canyon `descent` (F3); every mode grades by an event's own `stars`, drift in points (§5); the owner's runs set the non-race stars (D2, §1.3). Still on stand-ins: Mainland c6 / p1 on Island until C7 (L1). Next, in order: C5 rewards, C6 markers, C7 Mainland (§7); C8 share link is dropped for now (round 4 S1).
>
> **Round 4 (2026-11-13, `docs/brainstorm/2026-11-13_harepin-career-v4.answers.md`):** planned in §10, not built: Elite and Legend tiers of 12 events each (3★ = owner +3%), new event kinds, a Runs view for daily / weekly / endless runs with a season track, rewards up to a Legend car. Build order V1-V10 (§10.7), Elite batch 1 first.
>
> **Known follow-ups:** c2's drift marks (287 / 230 points) were played before `e248368` (no automatic countersteer with the assist off): redo them if they prove off. Unlocks stay 12 / 14; the owner re-checks them now that he has played Rookie (D1).


Round 1, 2026-11-11, at `7c4f299` (v0.28.1). Plan only. Nothing was run. Every file:line comes from reading the code at `7c4f299`. Inputs: `docs/brainstorm/2026-11-11_harepin-career-v2.answers.md` (final), `docs/plan/special-maps.md`, `docs/plan/biomes.md`.

## TL;DR

- **An event is a mode level on a fixed map code, plus a car limit, rules and star thresholds.** No new mode. The career wraps `ModeDef.start` the way the Modes page does and keeps its own store.
- **3 tiers × (6 events + 1 final) = 21 events.** A tier opens on a star total in the tier before it. Events play in any order.
- **Rules are two:** no rewind (modes already block it, `main.ts:490`) and a time penalty per hit. No assist rules at all.
- **Finals run on Sky Track → Volcano → Ice canyon** (round 3: Rooftops is dropped for now). Until a map ships, its final runs on a stand-in (§2).
- **Version bump:** the event follows the new world. Stars stay. Best times and ghosts reset by key, because `world_key` already carries the version. A unit test fails on every bump until the thresholds are re-tuned.
- **Streamed worlds (C7, built):** race and duel run on Mainland (`ModeDef.streams`): the run is built, then the car goes down once the 3x3 chunks at its start are in (`tiles.ensure`), and its marks drape on the circuit's own height where a chunk is not in yet. Gymkhana, parking, hunt and drift still refuse streamed worlds: their sites and zones read terrain and solids far from the start. Mainland markers are still to come.

## 1. Data model

### 1.1 Types (new `src/career/career.ts`)

```ts
interface CareerEvent {
  id: string;                 // "r1".."r7", "c1".., "p1"..; stable forever (store + share link key)
  name: string;
  mode: string;               // ModeDef.id: race | gymkhana | parking | drift | hunt | duel
  level: string;              // the mode's level id: circuit, street-1, g4, d5, h3, v1, p7…
  map: string;                // map code, parse_map_code (map-code.ts:73); plain maps too ("1C0000003")
  car: { cap: CarClass } | { preset: string };   // CarClass from car/pi.ts:116; preset by PRESETS name (car/presets.ts:8)
  stars: { two: number; three: number };         // ms for timed modes, points for drift
  tuned: string;              // world_key the thresholds were tuned on; a test fails when it differs
  ghost: boolean;             // a dev ghost ships for this event and this `tuned` key
  final?: true;
  stand_in?: { map: string; level: string };     // used until the final's world is listed
}

interface Tier {
  id: "rookie" | "club" | "pro";
  name: string;
  opens_at: number;           // stars in the tier before; 0 for Rookie
  events: readonly CareerEvent[];   // 6 + final
  rewards: { paint: string; decal: Decal; badge: string };
}
```

| Field | Reuses | New |
|---|---|---|
| `mode` + `level` | `MODES` (`modes.ts:22`), level lists (`races.ts:25`, `gymkhana.ts:37`, `parking.ts:172`, `drift.ts:31`, `hunt.ts:31`, `duel.ts:15`) | - |
| `map` | `parse_map_code`, `read_pick` (`map-code.ts:73,113`), preset chars `C S D M A T V R` (`map-code.ts:15-24`), season field `W` (`land-knobs.ts:30`) | - |
| `car.cap` | `rating()`, `class_of()`, `CLASS_FLOORS` (`pi.ts:128-153`), `class_badge` (`class-badge.ts:6`) | Filter in the pick step (§4) |
| `car.preset` | `PRESETS` (`presets.ts:8`) | - |
| `stars` | `stars_for` shape (`track.ts:28`), `drift_stars` (`drift.ts:64`) | Per-event override of the mode's par |
| `tuned` | `world_key` (`kinds.ts:56`) | Test: `world_key(event map) === event.tuned` for every event |
| `ghost` | `Ghost` format: 8 floats per 100 ms, JSON (`ghost.ts:9-10`) | Static asset `public/career/<id>.<tuned>.json`, loaded on start |

### 1.2 Rules

| Rule | Applies to | How | Status |
|---|---|---|---|
| No rewind | all | `input.rewind && … && !modes.active` (`main.ts:490`) | **Already true** for every mode run. Nothing to build |
| Hit penalty | race, hunt, duel | +2 s per new contact with any solid (rail, guard rail, wall, tree, building). Same 2 s as a cone (`HIT_MS`, `gymkhana.ts:7`). Debounce 1 s, so a scrape along a rail counts once | **New**: a contact counter in `World.hit` (`world.ts:600`), covering both `glide` and `resolve`. Exposed on `ModeCtx` |
| (penalty) | gymkhana | Its own cone and miss penalties (`gymkhana.ts:279`) | Exists |
| (penalty) | parking | Touches already cost a star (`parking.ts:251`) | Exists |
| (penalty) | drift | A wall loses the chain (`drift.ts:101`) | Exists |
| Fall on Sky / Rooftops | race | Drive back from the last checkpoint (`driver.ts:117-122`). No extra time | Exists (special-maps §7 default) |
| Assists | - | **None.** Owner, 2026-11-11 | - |

### 1.3 Stars and unlocks

| Thing | Rule |
|---|---|
| Event stars | 1 = finish. 2 = at or under `stars.two`. 3 = at or under `stars.three` (≥ for drift points). Penalties count |
| Thresholds | Race events: `three` = the median bot time over 5 autolap runs at the class cap (`scripts/races.ts` + `autolap.ts`); `two` = `three` × 1.25 (`SILVER_SHARE`, `track.ts:5`). Other modes (D2): no bot drives them, so the owner plays each one. `three` = the owner's best run, `two` = × 1.25 (drift: points ÷ 1.25). Until an event has its own, the mode's model marks grade it (`par_for`, `hunt_par`, park `par_ms`, drift `silver`/`gold`, duel `PAR_SPEED`) |
| Owner times | `?career&tune` shows **Copy my times** on the career page (`career-view.ts`). It copies JSON: for every non-race event with a best run, `{ stars: { two, three }, tuned }` (`owner_times`, `career-store.ts`; `owner_stars`, `career.ts`). Paste each into the event in `career.ts`. No new store: it reads the event's own best (§1.5), penalties counted. `tune` survives the `?event=` reload |
| Grading | Every mode asks `ModeCtx.thresholds(own)` (`mode.ts`): the event's `stars` when `tuned` matches the world, else the mode's own marks. Parking grades by faults, time over par one of them, so an event's `three` only moves the par |
| Tier stars | Sum of the best stars of its 7 events, max 21 |
| Opens | Rookie at 0. Club at **12** Rookie stars. Pro at **14** Club stars |
| Final | Opens with its tier. It counts toward the total like any event |
| Order | Any (A5). Every event of an open tier is open |

### 1.4 Rewards

Round 3 (W1): paint and badge follow a metal ladder, one metal per tier (Rookie bronze, Club silver, Pro gold), the same metal as the tier's start flags (§4). The decal comes from the world of the tier's final: Sky Track for Rookie, Volcano for Club, Ice canyon for Pro.

| Reward | Earned by | Where it lands | Notes |
|---|---|---|---|
| Paint | 10 stars in the tier | Garage paint row | **Not** in `car_paints` (`palette.ts:124`): `build.paint` wraps by that list's length (`livery.ts:300`), so appending a paint recolours saved builds with index ≥ 7. Use a separate `reward_paints` list from theme tokens, indexed past `MAX_PAINT` (`build.ts:188`) |
| Decal | 21/21 in the tier | Garage decal row | Append to `DECALS` (`build.ts:189`): the list is append-only (index in build codes). Locked = hidden in the garage only. A shared build code with it still loads |
| Badge | Finish the tier's final | Career page, own name label, players list | Online: optional `tier?: 1 \| 2 \| 3` on `Hello` (`net.ts:46`), like `country`. No `PROTOCOL` bump |
| Future unlocks (C3) | - | - | No field until a real unlock exists |

### 1.5 Storage

| Key | Value | Reset on world bump |
|---|---|---|
| `harepin:career` | `{ stars: { [event_id]: 1-3 } }` | **No** (F2) |
| `harepin:career:<event_id>:<world_key>` | best `StarRun` (`track.ts:7`) | Yes, by key |
| `harepin:ghost:career:<event_id>:<level>:<world_key>` | your best ghost (duel keys ghosts by `Track.scope` and level, so the level segment stays) | Yes, by key |

Career runs do not write the mode's `Track` (`track.ts:111`): the rules and thresholds differ, so a career time is not a free-play time.

## 2. Event roster (draft)

Seeds are placeholders from the golden range (`scripts/proof/golden-file.ts:7`). Phase C0 adds `scripts/career-check.ts`, which generates each map and fails when a level is missing: a seed without a canyon has no `offroad-*` route (`races.ts:24`), and gymkhana or parking can find no site (`NO_SITE`, `mode.ts:8`). Swap the seed when it fails.

Worlds: Island `C`, Winter island `C…-W1`, Dune sea `D`, Alpine `A`, Frozen lakes `T`, Sky Track `S`, Mainland `M`, Volcano `V`, Ice canyon `F`. Rooftops `R` is dropped for now: the Rookie final stays on Sky Track (F2).

### Rookie (class D-C)

| # | Event | World | Map code | Mode / level | Car |
|---|---|---|---|---|---|
| r1 | First lap | Island | `1C0000003` | race `circuit` | ≤ C |
| r2 | Cones | Island | `1C0000003` | gymkhana `g2` | ≤ C |
| r3 | Bay | Island | `1C0000003` | parking `p1` | Easy cruiser |
| r4 | Sand trail | Dune sea | `1D0000005` | race `circuit` (no Dune sea seed 5-125 has an `offroad-*` route, per `career-check`) | Dirt rally |
| r5 | Dune gates | Dune sea | `1D0000005` | hunt `h1` | ≤ C |
| r6 | Cloud sprint | Sky Track | `1S0000002` | duel `v1` | ≤ C |
| r7 | **Final: Skyline** | Sky Track | `1S0000002` | race `circuit` (the real final since round 3, F2; renamed from Downtown, N1) | ≤ C |

### Club (class B-A)

| # | Event | World | Map code | Mode / level | Car |
|---|---|---|---|---|---|
| c1 | Pass streets | Alpine | `1A0000004` | race `street-1` | ≤ B |
| c2 | Mountain S | Alpine | `1A0000004` | drift `d2` | Drift |
| c3 | Ice box | Frozen lakes | `1T0000006` | gymkhana `g4` | ≤ B |
| c4 | Lake search | Frozen lakes | `1T0000006` | hunt `h3` | Mud basher |
| c5 | Winter reverse | Winter island | `1C0000006-W1` (seed 3 in winter has no `circuit-rev`) | race `circuit-rev` | ≤ A |
| c6 | Mainland sprint | Mainland | `1M<MAINLAND_SEED>` | race `sprint` (round 4 M1: a ~4 min slice of the circuit at the owner's pace, 7.1 km; level id `sprint` since the 4.07 km `circuit-sprint`, so its records do not carry over; was the ~9.7 min lap; provisional stars from his 4.07 km run, no dev ghost: the bots take 7.4 min, until his ?tune run sets them) | ≤ A |
| c7 | **Final: Rim to sea** | Volcano | `1V0000001` | race `descent` (on the real map since round 3, F1) | ≤ A |

### Pro (class S1-X)

| # | Event | World | Map code | Mode / level | Car |
|---|---|---|---|---|---|
| p1 | Marathon | Mainland | `1M<MAINLAND_SEED>` | duel `v5` | ≤ S2 |
| p2 | Exposed | Sky Track | `1S0000007-F2` (open sections Exposed) | race `circuit` | ≤ X |
| p3 | Touge | Alpine | `1A0000009` | drift `d5` | ≤ S1 |
| p4 | Island sweep | Island | `1C0000008` | hunt `h5` | ≤ S1 |
| p5 | Ice parallel | Frozen lakes | `1T0000006` | parking `p7` | Drift |
| p6 | Precision | Winter island | `1C0000009-W1` (seed 8 in winter has no gymkhana site) | gymkhana `g7` | ≤ S2 |
| p7 | **Final: Riverbed** | Ice canyon | `1F0000001` | race `descent` (on the real map since 0.32.0, F3) | ≤ S1 |

Mix: race 7, gymkhana 3, parking 3, drift 2, hunt 3, duel 2 (the 3 finals are races). Sky Track has no open ground (`open_ground: false`, `kinds/sky.ts:32`), so only race, drift and duel run there.

### Stand-ins until each world ships

Round 3: the finals need none now (r7 Sky Track, c7 Volcano, p7 Ice canyon). C7: c6 and p1 left their Island stand-ins (`1C0000008` race `street-2` / duel `v5`) for Mainland. c6 runs the `sprint` slice of the mainland circuit (round 4 M1), re-tuned on it; p1 has no owner marks there yet: until the owner's run sets them, `three` is the best bot finish and `two` is 10% over it (`scripts/career.ts`). No event is on a stand-in now.

A stand-in swap is a data change. Stars earned on a stand-in are kept. Its best time and ghost reset, the same as a version bump.

## 3. Version policy (F2)

| Step | What happens | Code |
|---|---|---|
| A generator bumps (`version` in a kind, e.g. `WORLD_VERSION` 8, `types.ts:33`) | `world_key` changes (`kind-def.ts:67`) | Exists |
| Best time and ghost | Keys carry `world_key`, so the old ones are simply not read | Exists (same as `Track`, `track.ts:120`) |
| Stars | `harepin:career` has no version in its key: kept | New store, by design |
| Thresholds | `career.test.ts` fails: `world_key(event.map) !== event.tuned` | New test |
| Re-tune | `scripts/career.ts --event <id>` runs the bot, prints `stars` + `tuned`, and records a new dev ghost | New script on top of `autolap.ts` |
| Dev ghost | The asset name carries `tuned`: a stale ghost does not load, so the event runs without one until re-recorded | New |
| Map code | Carries no generator version (biomes §3.2), so an event's code never changes on a bump | Exists |

## 4. Where it lives

| Place | What | Reuse | New |
|---|---|---|---|
| Play strip (D1) | Card beside Things to try: current tier, stars `n/21`, next 2 open events | `goals_card` slot on the Play side (`play-page.ts:102`), `star_row` (`result.ts:4`) | `career_card` |
| Career page | 3 tiers, 7 rows each: name, world, mode, car limit badge, best stars, best time. Locked tiers show "12 ★ in Rookie" | Modes page list pattern (`ModesPage`, `modes-page.ts:11`; `ModeEntry`, `modes.ts:42`), `class_badge` | Page + `MenuTab` entry (`page.ts:16`) |
| Start an event | Same map: start now. Other map: reload with `?event=<id>` | World switch by `location.replace` (`settings.ts:143`), `pick_world` (`world-pick.ts:36`) | `event` joins `URL_WORLD_PARAMS` (`world-pick.ts:27`); boot reads the event's map, `start_early` warms it (`boot.ts:12`) |
| World markers (F1, round 3 M1-M3) | A start flag at each event's start, built like the challenge start flags, in the tier's metal (§1.4) and carrying the event id (M1). Drive into it: card "r1 First lap · Start". Shown on the minimap and the world map too; events of a locked tier show greyed, 3-star events still show (M2). Shown only when the loaded map code equals the event's exact code, options included (M3) | Gate/post meshes in `cottontail` ("only on markers", `art-direction.md` #3), `world-map.ts` player markers (`:221`) for the map icon | Proximity trigger, marker list per map, map icons |
| Pick your car (F6) | Before start: your car, saved builds, presets. Over the cap = greyed with its class badge. A fixed preset skips the step | `rating()`, `build_badge` (`class-badge.ts:14`), saved builds (`garage-builds.ts:112`), `PRESETS` | The step itself (decided earlier, not built). One step for modes and events |
| Finish card (D2) | Existing card + a line "Rookie 9/21 ★ · Club at 12" + **Next event** button | `show_result` (`modes.ts:306`), `line()` (`result.ts:17`), Next button (`mode-next`) | Career hook in `show_result`; Next = next unfinished event of the tier |
| Things to try (D3) | Kept. "Play every mode" also counts career runs via `on_finish` (`modes.ts:319`, `goals.ts:113`) | All | - |

## 5. Drift scoring (F7)

Already built as asked. `Combo.step` (`drift.ts:100`) adds `angle° × speed × 0.1 × dt × mult`:

| Term | Value | Line |
|---|---|---|
| Angle | 10°-60° counts, clipped at 60°, over 100° = spin (no score) | `drift.ts:10-12` |
| Speed | ≥ 7 m/s | `drift.ts:9` |
| Multiplier | +1 per 2 s of unbroken slide, max ×5 | `drift.ts:14-15` |
| Bank | Straight for 0.7 s banks the chain. A wall loses it | `drift.ts:13,101-116` |
| Stars | `silver`/`gold` per metre of zone (`drift.ts:31-37`) | Career overrides with `stars.two/three` in points |

Round 3 (R2): drift events take their own point marks. `DRIFT_MODE` grades through `ModeCtx.thresholds({ two: zone.silver, three: zone.gold })` (`drift-mode.ts`), so an event's `stars` (points, higher is better) replace the zone's per-metre marks. The values come from the owner's runs (Copy my times, §1.3): `three` = the owner's best score, `two` = that ÷ 1.25. `scripts/drift.ts` is a physics bench, not a zone bot, so no bot tunes them.

## 6. Share link (E3)

`?event=<id>&t=<ms or pts>&v=<world_key>`, built like `invite_link` (`page.ts:122`) and copied the same way (`main.ts:616-618`).

| Case | Shows |
|---|---|
| `v` equals the event's current `world_key` | "Beat 1:23.4", plus a ghost-free target line on the HUD |
| `v` differs | "Set on an older map" and no target |
| Unknown event id (newer build) | Like a newer map code: "made in a newer Harepin" (`map-code.ts:6`) |

The link carries no ghost (too big for a URL: 8 floats per 100 ms).

## 7. Build phases

Each phase ships on its own. S ≈ a day, M ≈ 2-4 days.

**Order since round 3 (R1, R2, L1, S1):** C0-C4 (built) → pre-release items → **release** → C5 → C6 → C7. C8 share link is dropped for now (round 4 S1: "no share link for now").

| Step | What | Status |
|---|---|---|
| Pre-release: c7 on Volcano | `descent` on `1V0000001`, re-tuned (`1:v5`), new dev ghost | Built |
| Pre-release: p7 on Ice canyon | `descent` on `1F0000001`, re-tuned (`1:ic5`), new dev ghost | Built |
| Pre-release: r7 on Sky Track | Stays on `1S0000002`, named Skyline | Built |
| Pre-release: drift point marks | Every mode grades through `ModeCtx.thresholds(own)`; drift in points (§5) | Built |
| Pre-release: owner stars (D2) | Copy my times under `?tune` (§1.3); the owner's marks are in `career.ts` | Done |
| Release | C0-C4 on for everyone: `?career` gate gone, dev ghosts precached | Next release after 0.33.2 |
| Re-check (D1) | Unlocks 12 / 14 after the owner plays Rookie | Owner to confirm |

| Phase | Ships | Reuse | New | Size |
|---|---|---|---|---|
| **C0** | Data + store + career page + `?event=` start. Island / Dune / Alpine / Frozen lakes / Sky events, stand-ins for finals and Mainland. Mode thresholds as they are | `MODES`, mode levels, `parse_map_code`, `Track` helpers (`record`, `better`, `parse_runs`), Modes page list | `career.ts`, `career-store.ts`, page, URL param, `scripts/career-check.ts`, `career.test.ts` (ids unique, levels known, `tuned` matches) | M |
| **C1** | Finish card line + Next event; Play strip card | `show_result`, `goals_card` slot | Hook + card | S |
| **C2** | Rules: hit penalty; event star overrides | `HIT_MS`, `stars_for` | Contact counter in `World.hit`, `ModeCtx.hits()` | S |
| **C3** | Pick-your-car step, class filter | `rating`, badges, builds, presets | The step | M |
| **C4** | Bot thresholds + dev ghosts + version test | `autolap.ts`, `races.ts`, `Ghost` | `scripts/career.ts`, ghost assets, ghost playback in race/duel events | M |
| **C5** | Rewards + online tier badge: paint and badge on the metal ladder, decal from the final's world (W1, §1.4) | Garage rows, `Hello` optional field pattern (`country`) | `reward_paints`, three decals, badge art, `tier` on hello; unlock card on the result screen with "Try it in the garage" in the actions (paint or decal only) | M |
| **C6** | Markers on compact worlds: tier-metal start flags with the event id, on minimap and world map, locked greyed, exact map code only (M1-M3, §4) | Challenge start flags, world map | Proximity trigger, marker icons | M |
| **C7** | Modes on streamed worlds, then Mainland events + markers (L1: after C5 and C6) | `world.tiles.whole()` wait (`modes.ts:193`) | Lift the `STREAMED` block (`modes.ts:190`); sites near the start on a streamed world. Round 4 M1: c6 is the Mainland `sprint`, a point-to-point slice of the circuit (`circuit_sprint`, `worldgen/routes.ts`): the run of circuit gates whose autopilot time is nearest 4 min, from the gate where it is slowest, so the most cornering; start line, gates and finish are the circuit's own gates on the slice. On `1M0E5M3PK`: road 3265 to 551 (through the lap's start), 4.1 km, 7 gates, bot stars 258.7 s / 323.4 s | M-L (*est.*, unverified) |
| ~~**C8**~~ | Share link: dropped for now (round 4 S1: "no share link for now") | `invite_link` | Params + HUD target line | S |
| **Data** | Done: c7 on Volcano, p7 on Ice canyon (round 3); Rooftops dropped | - | Edit `map`, re-tune | S each |

## 8. Conflicts

| # | With | Conflict | Proposal |
|---|---|---|---|
| 1 | `modes.ts:30,190` | Every mode refuses streamed worlds; Mainland is streamed (`tiles.ts:72`). F1 wants markers on Mainland, F3 wants Mainland events | Mainland events used Island stand-ins until C7. C7: race and duel run on streamed worlds, c6 and p1 are on Mainland |
| 2 | special-maps §6 | Volcano and Rooftops are unlisted; Ice canyon not started; the Volcano final needs a one-way route and checkpoint respawn (V3) | Stand-ins (§2). Round 3: Volcano listed first and Rooftops is dropped, so r7 stays on Sky Track and c7 runs on Volcano; p7 runs on Ice canyon |
| 3 | Answers B3/F5 vs questionnaire | The questionnaire planned assist and manual-gear rules | Dropped. No assist field in `CareerEvent` |
| 4 | `palette.ts:124`, `livery.ts:300` | Paint index wraps by the paint list length: a reward paint appended to `car_paints` recolours saved builds | Separate reward list (§1.4) |
| 5 | `drift.ts`, `gymkhana.ts`, `parking.ts`, `hunt.ts`, `duel.ts` | B5 wants bot-tuned stars; only race routes have a bot (`autolap.ts`) | Model par + hand tune for non-race events. A bot per mode is out of scope |
| 6 | `world.ts:607` | `rails` is true only on Sky and Rooftops; on land, guard rails are plain solids. "Rail hit" means nothing on land | The penalty counts any solid contact (§1.2) |
| 7 | `track.ts:120` | Career and the Modes page play the same mode levels on the same map | Career keeps its own store. Free play keeps its own records |
| 8 | `main.ts:63` | A world URL with no `room` drops into `LOBBY_ROOM`. An `?event=` link may land the player in the online lobby on a different map (unverified: whether lobby is online by default) | Checked in C0: yes, and a peer's race call ends the run. An event link without a room runs solo, in an unlisted room. An explicit room keeps the event non-solo, and `car` carries over |
| 9 | `build.ts:189` | `DECALS` is append-only, and build codes carry its index. A reward decal can travel in a shared build code | Load it. Lock only hides it in the garage |

## 9. Open questions

1. **Unlock numbers:** Club at 12 and Pro at 14 stars (of 21). OK, or another split?
2. **Finals:** one long race (planned), or a mixed final of 2-3 stages back to back (A4 "longer mixed")? Stages need a stage runner: about M more.
3. **Hit penalty:** +2 s per hit (gymkhana's cone value), or another number?

**Owner picks (2026-11-11):** unlock 12 Club / 14 Pro stars · finals = one long race · hit penalty +2 s.

## 10. v4: Elite, Legend and Runs (round 4)

Round 4, 2026-11-13, at `9b585db`. Plan only. Nothing was run: no `career-check`, no tune, no golden. Every file:line comes from reading the code at `9b585db`. Inputs: `docs/brainstorm/2026-11-13_harepin-career-v4.answers.md` (owner answers plus "Claude's picks") and §1-§9 above. Seeds in the rosters are placeholders until `scripts/career-check.ts` passes them. Sizes: S ≈ a day, M ≈ 2-4 days, L ≈ a week or more.

### 10.1 TL;DR

- **Two hand-made tiers after Pro: Elite and Legend, 12 events each** (A2, A3). Elite ships in two batches (E1, Claude's pick): batch 1 = 7 events on worlds and modes that exist today; batch 2 = 5 events on the new kinds, ending in a special-map final (C2).
- **3★ = the owner's run +3%** (A4) for every Elite and Legend event, races included. Bots stop setting race stars in these tiers; they only record ghosts.
- **Endless events live in their own "Runs" view** (B1 note): daily, weekly championship, endless random, plus the season track. They earn season stars, never career stars (B2). Online, the lobby shows a daily board carried peer to peer in the hello (B3), no `PROTOCOL` bump.
- **New kinds** (C1): drift chain (S), speed trap (S-M), jump distance (M), championship (M), Mainland road trip (M), banked run (M), wall-ride (L). Maybe: elimination vs ghosts (M), endurance (L).
- **Rewards** (D1, D2): platinum (Elite) and carbon (Legend) paint, a decal from each final's world, titles and name tags online, one special car for Legend (L). Car parts: own brainstorm later; unlocks are a pure function of stars, so old players get them retroactively for free.
- **The UI already counts from data** (`tier_max` in `career-view.ts:86`, `career-hero.ts:28`). What hard-codes three tiers or 21 stars: `TierBadge = 1 | 2 | 3` (`net.ts:48,50`), the three-entry metal lists (`palette.ts:172`, `rewards.ts:32`, `review/showcase-tiles.ts:50`), `REWARD_PAINTS = 3` (`build.ts:190`) and the tests (`career.test.ts:38,83`, `rewards.test.ts:20-47`). §10.8.

### 10.2 Structure

| Tier | Events | Opens at | Classes | 3★ / 2★ | Final |
|---|---|---|---|---|---|
| Rookie | 7 | 0 | D-C | as today (§1.3) | Sky Track |
| Club | 7 | 12 Rookie ★ | B-A | as today | Volcano |
| Pro | 7 | 14 Club ★ | S1-X | as today | Ice canyon |
| **Elite** | 12 (7 + 5) | **16 Pro ★** of 21 (*proposed*) | mixed: S1-X plus down-class events | owner × 1.03; 2★ = 3★ × 1.25 | Big dunes (batch 2) |
| **Legend** | 12 | **27 Elite ★** of 36 (*proposed*) | mixed: X and the Legend car | owner × 1.03; 2★ = 3★ × 1.25 | new special map (owner pick, §10.4) |

| Rule | Change | Code |
|---|---|---|
| Tier ids | `TierId` gains `ELITE: "elite"`, `LEGEND: "legend"` | `career.ts:33` |
| Event ids | `e1`-`e12`, `l1`-`l12`; batch 2 adds `e8`-`e12`, the final is `e12`. Stable forever (store key) | `career.ts:16` |
| Star margin | New `Tier.margin`: 1 for Rookie-Pro, `1.03` for Elite and Legend. `owner_stars`: `three = round(ms × margin)`, `two = round(three × SILVER_SHARE)`; drift `three = round(points / margin)` | `career.ts:172` |
| Copy my times | `owner_times` skips race events today. For a tier with `margin > 1`, race events go in too | `career-store.ts:47-50` |
| Tune script | `scripts/career.ts` still drives Elite / Legend races, but only for the ghost (`--write`); it stops printing their `stars`. The shipped ghost becomes the bot drive nearest the owner's 3★. Tune flow for a race event: the owner plays it, Copy my times, the stars go into `career.ts`, **then rerun `bun scripts/career.ts <id> --write`** so the ghost is picked against those 3★, not the old ones | `scripts/career.ts:184-189` |
| Paint unlock | `PAINT_STARS = 10` is absolute: 10 of 36 is cheap. New `Tier.rewards.paint_at`: 10 for the old tiers, 18 for Elite and Legend | `rewards.ts:5,15` |
| Unlock while Elite grows | Legend opens at 27, which batch 1 (21 max) cannot reach: harmless, Legend ships after batch 2 | `tier_open`, `career.ts:121` |

#### Elite batch 1 (7 events, existing worlds and modes)

Uses levels the career does not use yet (`offroad-2`, `g6`, `p8`, `d4`, `h4`, `v4`) and the rim circuits of Volcano and Ice canyon, which host only finals now.

| id | Name | World | Map code (placeholder) | Mode / level | Car |
|---|---|---|---|---|---|
| e1 | Crater ring | Volcano | `1V0000002` | race `circuit` | ≤ S1 |
| e2 | Long trail | Island | `1C0000011` (needs a canyon: `offroad-*` exists only on such seeds, `races.ts:24`) | race `offroad-2` | Dirt rally |
| e3 | Tight garage | Dune sea | `1D0000007` | parking `p8` (Tight garage, `parking.ts:180`) | ≤ S1 (*verify* every capped body passes `car_sized_only`) |
| e4 | Rim drift | Ice canyon | `1F0000002` | drift `d4` | Drift |
| e5 | Ash gates | Volcano | `1V0000002` | hunt `h4` | ≤ S2 |
| e6 | Down-class duel | Sky Track | `1S0000011` | duel `v4` | ≤ B (a slow car on a long duel) |
| e7 | Frozen slalom | Frozen lakes | `1T0000008` | gymkhana `g6` | ≤ S1 |

Mix: race 2, parking, drift, hunt, duel, gymkhana. No Mainland: the road trip covers it in Legend. No final in batch 1, so no decal and no badge until batch 2 (risk 4).

#### Elite batch 2 (5 events, new kinds)

| id | Name | World | Mode / level | Car | Needs |
|---|---|---|---|---|---|
| e8 | Drift chain | Alpine `1A0000009` | drift `d6` One chain (shipped; planned as `d5` with `chain`) | Drift | Drift chain (S) |
| e9 | Speed traps | Sky Track `1S0000002` | race `circuit` + traps | ≤ X | Speed trap (S-M) |
| e10 | Long jump | Island `1C0000003` | jump `j2` | ≤ S2 | Jump distance (M) |
| e11 | Island cup | Island `1C0000008` | championship: race `circuit` + jump `j1` + duel `v3` (shipped; planned as 3 races) | ≤ S1 | Championship (M) |
| e12 | **Final: Dune crossing** | Big dunes `1B…` | race `crossing` | ≤ X | Big dunes route (M-L, §10.4) |

As shipped: **e8 runs `d6`**, because the chain is its own level (`drift.ts:40`, a 200-point zone) and `d5` Touge stays the banked free-play run unchanged. **e11 runs race + jump + duel**, not three races: the stage runner takes any mode, and three kinds on one map make each stage a different skill instead of three laps of similar routes.

Legend's 12 get drafted once batch 2 ships: road trip, banked run, the reused kinds at harder levels and caps, the maybes if built, and the Legend final. No roster now.

### 10.3 New event kinds

Each kind is a `ModeDef` (`mode.ts:88`) or a level flag on one, so the career, `?event=`, markers and the Modes page pick it up the usual way. A new mode also needs a start pose in `STARTS` (`markers.ts:30`) for its world marker.

| Kind | Reuse | New mode code | Worldgen | HUD | Size |
|---|---|---|---|---|---|
| **Drift chain** | Drift zone + `Combo.step` (`drift.ts:100`), `best_chain` (`drift.ts:123`), chain-lost cue | `DriftLevel.chain?: true`: the score is the one chain; a bank (`drift.ts:117`) or a wall ends the run | none | "Chain lost: run over" | **S** |
| **Speed trap** | Race route + `RaceRun` (`races.ts`), car speed (`pose_of`, `mode.ts:106`), the points-higher-better grading drift uses (§5) | Trap gates on the route's longest straights (inverse of `bendiest`, `route.ts:31`); score = sum of km/h through each trap; the finish is still required | none: picked at run start | Trap flash "214 km/h", running total | **S-M** |
| **Jump distance** | Ramps `KICKER` / `BIG` / `ROAD_KICKER` (`worldgen/jumps.ts:36-41`), the wheel-contact airborne test (`world/jumps.ts:256`, `car.ts:775-781`), Island and Dune sea ramp sets | `JUMP_MODE`: the ramp nearest the start, distance from lip to first wheel contact, best of N tries in a time window; levels `j1`-`j3` by ramp kind; graded in metres, higher is better | none on compact worlds; Big dunes crests carry no ramp records (later) | Distance readout, landing mark (`marks.ts`) | **M** |
| **Championship** | Race and duel defs, the `next_event` flow, finish card + Next (`modes.ts`), a `Track` per stage | Stage runner: 3-5 runs back to back on one map, points per stage from its stars (3★ = 10, 2★ = 6, 1★ = 3, *proposed*), total graded by marks. One map only: a cross-map stage would reload (`?event=`) mid-run | none | "Stage 2/3 · 16 pts", standings on the card | **M** |
| **Mainland road trip** | Race `streams` (`mode.ts:99`), mainland graph + towns (`mainland.ts:39`), `trace` over a graph (`routes.ts:265`), the `circuit_sprint` gate pattern (`routes.ts:122`), chunk stream-in (`scripts/career.ts:108`) | none: race level `trip` | `trip_route`: the farthest town pair over the graph, gates every `GATE_SPACING`. Adds a route to Mainland: **kind version bump m6 → m7** (risk 8) | Route on the map (`RouteRun.later`) exists | **M** |
| **Banked run** | Sky deck bank per sample (`sky.ts:103,371`), helices (`sky.ts:255`), the `circuit_sprint` slice idea | none: race level `banked` | The slice of the sky circuit with the most bank (sum of abs bank), as the Mainland sprint picks the most cornering. Sky version bump (risk 8) | none new | **M** |
| **Wall-ride** | Deck renderer and rails (`kinds/sky.ts`, `rails: true`) | none | Sky banks stop near 0.52 rad (`sky.ts:221`); a wall needs past-vertical pieces and physics checked on them: a new deck piece, or the Legend final map | none | **L** |
| Elimination vs ghosts (maybe) | `Ghost` playback (`ghost.ts:70`); `scripts/career.ts` already drives up to 5 cars per event (`RUNS`, `:34`) | Ship every finished bot drive as a ghost, not only the 3★ one; a multi-lap race (the lobby-lap path, `race-mode.ts:56`) drops the last ghost each lap | none | Position, "out" call | **M** |
| Endurance (maybe) | Race laps | **No tyre or grip wear model exists** (no wear state in `src/car`): new car state, its feel tuned, pit or no pit | none | Wear meter | **L** |

### 10.4 Finals (C2)

| Tier | Final map | State today | Work |
|---|---|---|---|
| Elite | **Big dunes** (`B`, kind `dunes` v15) | Listed, streamed, no roads, routes or gates (`big-dunes.md` status) | A `crossing` route: gates crest to crest across the dune sea, laid by the generator; race already streams. Kind bump bd15 → bd16, records reset. Decal "dunes" |
| Legend | **Owner pick** | - | (a) Rooftops revived: the R1 code exists unlisted (`worlds/rooftops.ts:23`), dropped 2026-11-12 (`special-maps.md` status). (b) A new banked / wall-ride map, which gives wall-ride (L) its home. Recommended: (b) |

### 10.5 Rewards

| Reward | Elite | Legend | Reuse | New |
|---|---|---|---|---|
| Paint (at `paint_at`) | Platinum metallic | Carbon | `reward_paints` past `MAX_PAINT` (`paint.ts:18-25`), `tier_metals` (`palette.ts:172`) | Platinum is one more Lab metal: S. **Carbon is a weave, not a colour**: `paint_lab` returns one Lab plus a `METAL` flag, so carbon needs a finish in `livery.ts`: M |
| Decal (36/36) | "dunes" | the Legend final's world | `DECALS`, append-only (`build.ts:192`); `REWARD_DECALS` (`rewards.ts:28`) | Two decal designs |
| Badge / title | "Elite champion" | "Legend champion" | `badge_text` (`rewards.ts:30`), `tier` on `Hello` (`net.ts:46`), shield (`badge.ts:8`) | `TierBadge` 1-5, two shield metals |
| Name tag online | Platinum frame | Carbon frame | Name label + roster `tier` (`net.ts:70,402`) | Tag style per tier; no new hello field (the tier carries it) |
| Special car | - | One car (D2) | table below | L |
| Car parts | later | later | `unlocks(stars)` is pure on stars (`rewards.ts:19`) | Own brainstorm. Retroactive is free: a player past a tier already holds its stars |

**What a new car costs** (the Legend car):

| Piece | Where | Size |
|---|---|---|
| Spec: mass, inertia, drive, gears, grip, engine `sound` | `cars.ts` (one spec, e.g. `FORMULA` at `cars.ts:386`), `BodyStyle` (`cars.ts:2`), `CARS` (`cars.ts:630`) | M |
| Model | One style entry in `designs.ts` (e.g. `formula` at `designs.ts:431`), `models.ts` | M |
| Build code | The `CODE` regex reads `Object.keys(CARS)` (`build.ts:206`): nothing to add. An older build cannot read the new code (risk 14) | - |
| PI and class | `rating()` (`pi.ts`), sample builds in `scripts/pi.ts` | S |
| Handling pass | `scripts/feel.ts`, `handling.ts`, `drift.ts` (`DRIFT_CARS`, `scripts/drift.ts:105`), autolap | S-M |
| Preset | `PRESETS` (`presets.ts:9-14`) | S |
| Lock | Hidden in the garage and the car pick until earned, like reward decals (`garage-items.ts:75`) | S |
| Bot field | `cars_for` takes every body in `CARS` (`scripts/career.ts:68`): exclude locked cars, or every race median drifts | S |

### 10.6 Runs view: endless events

| Stream | Seed | Picks | Stars | Board |
|---|---|---|---|---|
| Daily | UTC date (`YYYY-MM-DD`), so every peer agrees | One (kind, mode, level, cap) from a vetted combo list, map seed from the date. On `NO_SITE` (`mode.ts:8`) or a missing level, fall back to that seed's `circuit` race, which every compact land kind has | 1-3 by the mode's own marks (`ModeCtx.thresholds(own)` with no event stars): no owner run exists | Yes (below) |
| Weekly championship | ISO week (UTC, `weekly:2026-W46`) | 3-5 daily-style picks on one map, run by the championship runner: a compact kind and seed from the week, then distinct types that run on that kind (each its levels shuffled), one class cap all of them allow. A stage with no level on the map becomes its circuit race; `runs-check --weeks N` vets coming weeks | Points → 0-5 season stars (**decided**): any points 1★, then 2★ at 45%, 3★ at 60%, 4★ at 75%, 5★ at 90% of the most (every stage on 3★, 10 pts each). A finished cup holds at least 30% (every stage 1★). Earned once per week by its best total, `weeks: {week: ★}`; an old week's link draws on the free cap | No (later) |
| Endless random | Random per run | Same picker | 1-3 by mode marks; **season stars capped at 10 a day** against farming | No |

| Piece | Reuse | New | Size |
|---|---|---|---|
| Runs view | Career page list pattern (`career-view.ts`), `MenuTab` | Tab "Runs": today's daily, this week's cup, an Endless button, the season bar | M |
| Picker | `parse_map_code`, mode `levels(world)`, the `STREAMED` refusal (`modes.ts:49,382`) | `runs.ts`: `daily(date)`, `weekly(week)`, `random()`; the combo list vetted by `scripts/runs-check.ts`, like `career-check` | S-M |
| Start | The `?event=` reload path | `?run=daily:2026-11-13` (or `weekly:2026-W46`, `random:<seed>`), same flow as `EVENT_PARAM` | S |
| Store | `read_json` / `write_json`, a `Track` per key | `harepin:runs` = `{ season, stars, days: {date: ★}, weeks: {week: ★} }`; best times `harepin:run:<date>:<world_key>` | S |
| Season | - | 4-week seasons (*proposed*); a step every 15 stars; rewards: season title and name tag tint from a fixed set. No decal per season: `DECALS` is append-only forever | M |

**Daily board, peer to peer (B3)**

| Item | Plan |
|---|---|
| Carrier | Optional `daily?: { k: string; ms: number }` on `Hello`, built like `country` / `tier` (`net.ts:46-56`); `k` = date + map code + level + `world_key`. Re-sent on a new best, the `set_tier` pattern (`net.ts:388`) |
| Validation | `sanitize_hello` gains a `clean_daily` (`net.ts:228-240`). Older peers rebuild the hello field by field, so they drop it |
| `PROTOCOL` | **No bump** (stays 2, `net.ts:157`): an optional field, same as `tier` |
| Board | The lobby room (`LOBBY_ROOM`, `room-name.ts:3`) roster plus a local cache of entries seen today; rows whose `k` differs (other build, other pick) are hidden |
| Limits | Only peers seen this session or cached; no server, so a time can be spoofed. Fine for a casual board |

### 10.7 Build phases

Ordered by E1 (Elite batch 1 first), then by what unblocks the most.

| Phase | Ships | Reuse | New | Size |
|---|---|---|---|---|
| **V1** | Elite batch 1: tier plumbing, 7 events, platinum paint | `TIERS`, `owner_stars`, `owner_times`, markers, career page | `TierId` + 2, `Tier.margin`, `paint_at`, `TierBadge` 1-5, platinum in `tier_metals` / `METALS` / `REWARD_PAINTS`, races in Copy my times, tests off 7 / 21, `career-check` on the 7 seeds, owner tune | M |
| **V2** | Drift chain, speed trap | `Combo`, race routes, points grading | Level flag, trap run, HUD flash | S + S-M |
| **V3** | Jump distance | Ramps, airborne test, marks | `JUMP_MODE`, levels, readout | M |
| **V4** | Championship runner; Elite final on Big dunes; Elite batch 2 (e8-e12); dunes decal, Elite badge and title | Race streaming, stage flow | Runner, `crossing` route (bd16), decal art, shield | M-L |
| **V5** | Runs view: daily, endless, weekly cup | Mode marks, the `?event=` flow, the championship runner | `runs.ts`, `?run=`, `harepin:runs`, Runs tab, `runs-check` | M |
| **V6** | Season track + daily board in the lobby | The optional hello field pattern | Season bar and rewards, `daily` on the hello, board UI | M |
| **V7** | Mainland road trip, banked run | Race streams, graph `trace`, sky bank data | `trip` (m7), `banked` (sky bump), re-tune c6 / p1 / r6 / r7 / p2 | M + M |
| **V8** | Legend tier: 12 events, final map, carbon finish, Legend title | Everything above | Final map (owner pick), carbon finish in `livery.ts`, roster | L |
| **V9** | Legend car | The car pipeline | §10.5 table | L |
| **V10** (maybe) | Elimination vs ghosts; endurance | Ghosts, bot drives | Multi-ghost assets; wear model | M; L |
| Later | Car parts brainstorm, unlocked retroactively by stars | `unlocks(stars)` | Parts | - |

### 10.8 Conflicts and risks

| # | With | Conflict | Proposal |
|---|---|---|---|
| 1 | `net.ts:48,50` | `TierBadge = 1 \| 2 \| 3`; `clean_tier` drops 4 and 5 | Widen to 1-5. Older peers drop the field and show no badge; nothing breaks. No `PROTOCOL` bump |
| 2 | `build.ts:190,224` | `parse_build` rejects `paint > MAX_PAINT + REWARD_PAINTS` and `decal > MAX_DECAL`: a platinum build code fails on an older build, in a shared code and in `CarState.b` | Accept: a newer code reads as newer, like map codes. Set `REWARD_PAINTS` to 5 in V1 so Legend's slot exists early |
| 3 | `palette.ts:172`, `rewards.ts:32`, `review/showcase-tiles.ts:50`, `markers.ts:71`, `badge.css` | Three-entry metal lists indexed by tier | One five-entry list in `palette.ts`, metal names beside it, used by every caller |
| 4 | `rewards.ts:15-16` | Rewards are derived, never stored: `decal_open` = stars ≥ `tier_max`. A tier that grows from 21 to 36 would re-lock a decal already shown | Elite has no decal and no badge until batch 2 (`rewards` fields optional); after that a tier never grows |
| 5 | `career.test.ts:38,83`, `rewards.test.ts:20-47` | Assert 7 events per tier and "21 of 21" | Assert each tier against its own `events.length` / `tier_max` |
| 6 | `changelog.ts:58,71` | Text says 21 events, three tiers | History: leave it; new entries say the new numbers |
| 7 | `career-store.ts:50` | Copy my times skips races | Include races when `tier.margin > 1` |
| 8 | Kind versions, `career.test.ts:54` | Road trip (Mainland), banked (Sky) and crossing (Big dunes) add routes: kind versions bump, `world_key` moves, the `tuned` of c6, p1, r6, r7, p2 fails the test, free-play records and ghosts reset by key | One bump per kind per release; re-tune the same day (`scripts/career.ts`, Copy my times) |
| 9 | `scripts/career.ts:68` | A new car joins every bot field and shifts race medians | Exclude locked cars from `cars_for` |
| 10 | `modes.ts:382,593` | Only race and duel stream: jump distance and speed trap stay off Mainland until they set `streams` | Batch 2 keeps them on compact worlds |
| 11 | `harepin:career` (`career-store.ts:7`) | Save format | No change: new ids are new keys; `parse_stars` takes any id (`career.ts:162`) |
| 12 | Daily seed | Local midnight differs per peer | UTC date |
| 13 | Daily picks across builds | Two builds may pick different events for one date | The board key carries `world_key` + level (§10.6) |
| 14 | `CARS` + build codes | An older build cannot read the Legend car's code | As 2: the peer on the older build gets a bad `b` |

### 10.9 Open questions

1. **Unlocks:** Elite at 16 Pro stars, Legend at 27 Elite stars?
2. **Legend final map:** Rooftops revived, or a new banked / wall-ride map (recommended)?
3. **Season:** 4 weeks, title and name tag tint only?
4. **Championship points:** 10 / 6 / 3 per stage by stars, or by time against the stage marks? Decided: by stars. A 0★ stage cannot advance: the result card offers Retry stage ("A stage needs 1★ to go on"), so a finished championship has a star on every stage.

### 10.10 Event builder (owner ask, 11-14)

Owner: "the user picks the type, some options for each event, then the map and the event is generated". Decided 11-14: it ships inside V5, as a tab of the Runs view, and V5 moves ahead of V4.

| Step | Plan |
|---|---|
| Type | race (circuit, sprint), drift, drift chain, speed trap, jump, hunt, gymkhana, parking, duel: every mode with levels on compact worlds |
| Options | World kind or random; length (short / medium / long, races); laps (circuits); difficulty (star marks scaled: relaxed / normal / hard); car: class cap or a preset; ramp kind (jump) |
| Generate | Seeded: a random map seed of the picked kind; the mode's `levels(world)` filtered by the options; reroll the seed (bounded tries) on `NO_SITE` or no matching level. Same picker as Endless random (`runs.ts`), with the choices in place of dice |
| Stars | The mode's own marks (`thresholds`), scaled by difficulty. Season stars, never career stars |
| Share | `?run=custom:<code>`: the code packs type, options and seed, so a friend gets the same map and event |
| Store | Best per `world_key` + level, as other runs |
