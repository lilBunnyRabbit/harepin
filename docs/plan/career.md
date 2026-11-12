# Career ladder

Round 1, 2026-11-11, at `7c4f299` (v0.28.1). Plan only. Nothing was run. Every file:line comes from reading the code at `7c4f299`. Inputs: `docs/brainstorm/2026-11-11_harepin-career-v2.answers.md` (final), `docs/plan/special-maps.md`, `docs/plan/biomes.md`.

## TL;DR

- **An event is a mode level on a fixed map code, plus a car limit, rules and star thresholds.** No new mode. The career wraps `ModeDef.start` the way the Modes page does and keeps its own store.
- **3 tiers × (6 events + 1 final) = 21 events.** A tier opens on a star total in the tier before it. Events play in any order.
- **Rules are two:** no rewind (modes already block it, `main.ts:490`) and a time penalty per hit. No assist rules at all.
- **Finals run on Rooftops → Volcano → Ice canyon**, in the order they ship. Until a map ships, its final runs on a stand-in (§3).
- **Version bump:** the event follows the new world. Stars stay. Best times and ghosts reset by key, because `world_key` already carries the version. A unit test fails on every bump until the thresholds are re-tuned.
- **Biggest blocker:** modes refuse to start on streamed worlds (`modes.ts:30,190`), and Mainland is streamed. Mainland events and markers wait for that (phase C7).

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
| Thresholds | Race events: `three` = the median bot time over 5 autolap runs at the class cap (`scripts/races.ts` + `autolap.ts`); `two` = `three` × 1.25 (`SILVER_SHARE`, `track.ts:5`). Other modes: no bot drives them, so `three` = the mode's model par (`par_for`, `hunt_par`, park `par_ms`, drift `gold`, duel `PAR_SPEED`), then hand-tuned |
| Tier stars | Sum of the best stars of its 7 events, max 21 |
| Opens | Rookie at 0. Club at **12** Rookie stars. Pro at **14** Club stars |
| Final | Opens with its tier. It counts toward the total like any event |
| Order | Any (A5). Every event of an open tier is open |

### 1.4 Rewards

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

Worlds: Island `C`, Winter island `C…-W1`, Dune sea `D`, Alpine `A`, Frozen lakes `T`, Sky Track `S`, Mainland `M`. Rooftops `R`, Volcano `V`, Ice canyon (no char yet) host finals only.

### Rookie (class D-C)

| # | Event | World | Map code | Mode / level | Car |
|---|---|---|---|---|---|
| r1 | First lap | Island | `1C0000003` | race `circuit` | ≤ C |
| r2 | Cones | Island | `1C0000003` | gymkhana `g2` | ≤ C |
| r3 | Bay | Island | `1C0000003` | parking `p1` | Easy cruiser |
| r4 | Sand trail | Dune sea | `1D0000005` | race `circuit` (no Dune sea seed 5-125 has an `offroad-*` route, per `career-check`) | Dirt rally |
| r5 | Dune gates | Dune sea | `1D0000005` | hunt `h1` | ≤ C |
| r6 | Cloud sprint | Sky Track | `1S0000002` | duel `v1` | ≤ C |
| r7 | **Final: Downtown** | Rooftops | `1R0000001` | race `circuit` | ≤ C |

### Club (class B-A)

| # | Event | World | Map code | Mode / level | Car |
|---|---|---|---|---|---|
| c1 | Pass streets | Alpine | `1A0000004` | race `street-1` | ≤ B |
| c2 | Mountain S | Alpine | `1A0000004` | drift `d2` | Drift |
| c3 | Ice box | Frozen lakes | `1T0000006` | gymkhana `g4` | ≤ B |
| c4 | Lake search | Frozen lakes | `1T0000006` | hunt `h3` | Mud basher |
| c5 | Winter reverse | Winter island | `1C0000006-W1` (seed 3 in winter has no `circuit-rev`) | race `circuit-rev` | ≤ A |
| c6 | Mainland lap | Mainland | `1M<MAINLAND_SEED>` | race `circuit` | ≤ A |
| c7 | **Final: Rim to sea** | Volcano | `1V0000001` | race (descent route) | ≤ A |

### Pro (class S1-X)

| # | Event | World | Map code | Mode / level | Car |
|---|---|---|---|---|---|
| p1 | Marathon | Mainland | `1M<MAINLAND_SEED>` | duel `v5` | ≤ S2 |
| p2 | Exposed | Sky Track | `1S0000007-F2` (open sections Exposed) | race `circuit` | ≤ X |
| p3 | Touge | Alpine | `1A0000009` | drift `d5` | ≤ S1 |
| p4 | Island sweep | Island | `1C0000008` | hunt `h5` | ≤ S1 |
| p5 | Ice parallel | Frozen lakes | `1T0000006` | parking `p7` | Drift |
| p6 | Precision | Winter island | `1C0000009-W1` (seed 8 in winter has no gymkhana site) | gymkhana `g7` | ≤ S2 |
| p7 | **Final: Riverbed** | Ice canyon | (new preset char) | race (riverbed route) | ≤ S1 |

Mix: race 7, gymkhana 3, parking 3, drift 2, hunt 3, duel 2 (the 3 finals are races). Sky Track and Rooftops have no open ground (`open_ground: false`, `kinds/sky.ts:32`, `kinds/rooftops.ts:17`), so only race, drift and duel run there.

### Stand-ins until each world ships

| Final | Real | Blocked by | Stand-in |
|---|---|---|---|
| r7 | Rooftops `circuit` | `listed: false` (`worlds/rooftops.ts:22`), R1-R4 | Sky Track `1S0000002` race `circuit` |
| c7 | Volcano rim-to-sea | `listed: false` (`worlds/volcano.ts:10`), one-way route + checkpoint respawn (special-maps V3; `descent.ts` in flight) | Alpine `1A0000004` race `street-2` (Alpine has no canyon, so never an `offroad-*` route) |
| p7 | Ice canyon riverbed | Not started (I1-I2, after V3) | Frozen lakes `1T0000006` race `circuit` |
| c6, p1 | Mainland | Modes off on streamed worlds | Island `1C0000008` race `street-2` / duel `v5` |

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
| World markers (F1) | A post at each event's start on the map it belongs to. Drive into it: card "r1 First lap · Start". Shown only when the loaded map code equals the event's | Gate/post meshes in `cottontail` ("only on markers", `art-direction.md` #3), `world-map.ts` player markers (`:221`) for the map icon | Proximity trigger, marker list per map, map icons |
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

Nothing new for drift events. They only need thresholds (hand-tuned: `scripts/drift.ts` is a physics bench, not a zone bot).

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

| Phase | Ships | Reuse | New | Size |
|---|---|---|---|---|
| **C0** | Data + store + career page + `?event=` start. Island / Dune / Alpine / Frozen lakes / Sky events, stand-ins for finals and Mainland. Mode thresholds as they are | `MODES`, mode levels, `parse_map_code`, `Track` helpers (`record`, `better`, `parse_runs`), Modes page list | `career.ts`, `career-store.ts`, page, URL param, `scripts/career-check.ts`, `career.test.ts` (ids unique, levels known, `tuned` matches) | M |
| **C1** | Finish card line + Next event; Play strip card | `show_result`, `goals_card` slot | Hook + card | S |
| **C2** | Rules: hit penalty; event star overrides | `HIT_MS`, `stars_for` | Contact counter in `World.hit`, `ModeCtx.hits()` | S |
| **C3** | Pick-your-car step, class filter | `rating`, badges, builds, presets | The step | M |
| **C4** | Bot thresholds + dev ghosts + version test | `autolap.ts`, `races.ts`, `Ghost` | `scripts/career.ts`, ghost assets, ghost playback in race/duel events | M |
| **C5** | Rewards + online tier badge | Garage rows, `Hello` optional field pattern (`country`) | `reward_paints`, new decal, badge art, `tier` on hello | M |
| **C6** | Island markers (compact world) | Posts, world map | Proximity trigger, marker icons | M |
| **C7** | Modes on streamed worlds, then Mainland events + markers | `world.tiles.whole()` wait (`modes.ts:193`) | Lift the `STREAMED` block (`modes.ts:190`); sites near the start on a streamed world | M-L (*est.*, unverified) |
| **C8** | Share link | `invite_link` | Params + HUD target line | S |
| **Data** | Finals move to Rooftops, Volcano, Ice canyon as each is listed | - | Edit `map`, re-tune | S each |

## 8. Conflicts

| # | With | Conflict | Proposal |
|---|---|---|---|
| 1 | `modes.ts:30,190` | Every mode refuses streamed worlds; Mainland is streamed (`tiles.ts:72`). F1 wants markers on Mainland, F3 wants Mainland events | Mainland events use Island stand-ins until C7 |
| 2 | special-maps §6 | Volcano and Rooftops are unlisted; Ice canyon not started; the Volcano final needs a one-way route and checkpoint respawn (V3) | Stand-ins (§2). The order assumes Rooftops ships first, as special-maps plans. If Volcano lists first, swap r7/c7 maps (data only) |
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
