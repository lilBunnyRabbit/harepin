# IndexedDB plan

> Status 2026-11-15: steps 0-6 built (0.51.0 has 0-3). `HAREPIN_DB` is v3 (`series`, `ghosts`, `kv`). Step 5's restore is `restore_records` in `src/store/records.ts`, called by nothing: a rollback build calls it in place of `load_records`.
> Changed from the plan: the records wait (1.5 s) counts from the world's generation, not the boot start, and the open gives up after 10 s, not 3 s; both fell back on a working but slow open in the browser runs.

## Verdict

| Store | Keys | Verdict | Why |
|---|---|---|---|
| Ghosts | `harepin:ghost:*` | **Move first**, own object store, async per key | 50-500 KB each, one per world and duel level: the only thing that can actually fill the origin's localStorage quota |
| Records | `harepin:best:*`, `splits:*`, `<mode>:*`, `career:*`, `career`, `runs`, `goals`, `lobby:*` | **Move**, through a sync cache hydrated at boot | Grow by one key per world × mode; every reader already goes through the sync `Store` seam (`local_store()`), so the cache keeps every call site sync |
| Saved builds | `harepin:builds` | **Move** with the records (same cache) | Small, read in menus after boot; moves for free once the cache exists |
| Settings, theme, saved themes, build, rolled name, seen version | `harepin:settings`, `theme`, `themes`, `build`, `rolled-name`, `seen-version` | **Stay** | Read synchronously before first paint or before the world pick (`boot.ts`, `palette.ts`, top of `main.ts`); all under ~5 KB |
| Car viewer notes | `harepin.cars.notes` | **Stay** for now | Owner-only dev tool; takes a `Storage` param, can move later on its own |
| Session keys | `harepin:drive`, `harepin:room-password`, `harepin.lab.*` | **Stay** in sessionStorage | Per-tab lifetime is the feature; a room password must never land on disk |

Lightest route: platform IndexedDB (already the plan's `idb.ts`, no dependency), plus one in-memory `Store` that `local_store()` returns. No call site outside `main.ts`, `boot.ts`, `ghost.ts`, `race.ts`, `car/builds.ts` and `goals/catch-up.ts` changes.

## 1. Inventory

Sizes are estimates from the code, not measured on a real profile. Ghost: 10 Hz × 8 floats (`STRIDE`, `EVERY_MS` in `car/ghost.ts`), JSON with 3 decimals ≈ 8 chars per value, so ≈ 640 chars per recorded second; a 2 min lap ≈ 77 k chars, the 10 min cap (`MIN_CAP_MS`) ≈ 380 k chars. localStorage counts UTF-16 chars.

### localStorage

| Key | Owner file | Holds | Size | Read when | Validation on load |
|---|---|---|---|---|---|
| `harepin:settings` | `menu/saved-pick.ts`, `menu/prefs-store.ts` | `SettingsState` JSON, incl. `last_world/seed/map` | ~1 KB | **boot-sync**: `boot.ts:18` `read_saved_pick()` before the worker starts; `main.ts:97,102` before the first await; written on every setting change and by `pin_pick` | `parse_settings`, `parse_last_*` |
| `harepin:theme` | `theme/theme.ts` | preset or saved-theme name | <50 B | **boot-sync**: `boot.ts:10` `apply_theme(current_theme())`, `palette.ts:4` at module eval; menus | `resolve_theme_name`, falls back to `DEFAULT_THEME` |
| `harepin:themes` | `theme/theme.ts` | `{ name, theme }[]` | 1-10 KB | **boot-sync** (inside `current_theme()`), menus (`DisplaySection`, `SavedThemes`, `ThemeCreate`, `GuideLook`) | `parse_saved_themes` + `CSS.supports("color")` per token |
| `harepin:build` | `menu/garage-builds.ts` | build code | ~40 B | `main.ts:201` sync (after `await opening`); presence read in `prefs-store.ts:10` for the `played` heuristic, before any await | `parse_build` |
| `harepin:rolled-name` | `menu/guide-rules.ts` | `"Swift Bunny"` | <30 B | `main.ts:103` sync, writes on first boot | **none**: any truthy string is used as the name (flag: should go through `clean_name`) |
| `harepin:seen-version` | `menu/updated-card.ts` | version string; also scans `Object.keys(localStorage)` for any `harepin:` key (`returning`) | <20 B | module eval of `updated-card.ts` | string compare in `releases_on_boot` |
| `harepin:builds` | `car/builds.ts` | `SavedBuild[]`, max 40 | ≤3 KB | menus: `garage.svelte.ts:43,112`, car pick `main.ts:432`; key scan in `catch-up.ts` | `parse_builds` |
| `harepin:best:<world_key>`, `harepin:splits:<world_key>` | `race.ts` | lap ms, split ms[] | ~100 B per world | `Race` ctor, `main.ts:207` (after `await opening`); write per improved lap | `is_time`, `is_splits` |
| `harepin:ghost:<world_key>` | `car/ghost.ts` | lap frames `number[]` | 50-400 k chars | `Ghost` ctor `main.ts:243` at boot; written by `finish(improved)` | `is_lap` |
| `harepin:ghost:<scope>:<level>:<world_key>` | `modes/duel-mode.ts` → `ghost.ts` | duel ghost, same shape | 5-60 k chars (600 m-1 km) | duel start (`ghost_for`) | `is_lap` |
| `harepin:ghost:career-dev` | `modes/race-mode.ts:13` | key of the shipped dev ghost; filled via `use()`, only written if that ghost's `finish` runs | 0 today (unverified that it never writes) | race start | `is_lap` |
| `harepin:<mode>:<world_key>` | `modes/track.ts` `Track` | `Runs` (`{ id: { stars, ms, score? } }`) | 100 B-1 KB per world × mode | `Track` ctor: mode start (`modes.ts:188,306`), `run-play.ts:57`, **in menu render** via `event_track` / `Career.best` / `weekly_best` (`RunsPage.svelte:44` inside `$derived`) | `parse_runs`, entry by entry |
| `harepin:career:<event>:<world_key>` | `career/career-store.ts` | `Runs` of one event | ~200 B per event | as above, menu render | `parse_runs` |
| `harepin:career` | `career/career-store.ts` | `{ stars }` | <1 KB | `Career` ctor `main.ts:203` | `parse_stars` |
| `harepin:runs` | `runs/runs-store.ts` | season save + keep (stars, owned rewards, free cap) | ~1-2 KB | `Runs` ctor `main.ts:204` | `parse_runs_save`, `parse_runs_keep` |
| `harepin:goals` | `goals/goals.ts` | finished goal ids | <500 B | `Goals` ctor `main.ts:205`; catch-up scans every `harepin:` key (`catch-up.ts:63`) | `parse_done` |
| `harepin:lobby:<world_key>` | `net/lobby.ts` | `RaceRecord` | <200 B per world | `Lobby` ctor | `parse_race_record` |
| `harepin.cars.notes` | `viewer/notes.ts` | notes per view key, 200 × 1000 chars max per key | 0-200 KB | `?cars` viewer load | `parse_notes`. Dot prefix: the `harepin:` scans skip it |

`Store` (`modes/track.ts:23`) is the seam: `Track`, `Career`, `Runs`, `Goals` and `Lobby` take a `Store | null` and read it through `read_json` / `write_json`. `local_store()` returns `localStorage`. `race.ts`, `ghost.ts`, `builds.ts`, `garage-builds.ts`, `theme.ts`, `saved-pick.ts`, `prefs-store.ts` call `localStorage` directly.

### sessionStorage

| Key | File | Holds | Read when |
|---|---|---|---|
| `harepin:drive` | `menu/prefs-store.ts` | one-shot "skip menu" flag across a pick reload | `main.ts:528` |
| `harepin:room-password` | `net/directory.ts` | `{ room, password, asked }` | `main.ts:186` `load_lock`; dropped when landing in another room |
| `harepin.lab.<pack>.r<rev>` + results key | `lab/lab.ts`, `lab/answers.ts`, `lab/results-store.ts` | lab answers and driven metrics | `?lab=` start |

Nothing listens for the `storage` event. Each tab reads a key once into memory and writes the whole value back, so two tabs already clobber each other last-writer-wins per key today.

## 2. Move or stay

Why move at all: Harepin shares `lilbunnyrabbit.github.io` with WebOS and Series Tracker (`docs/plan/pwa.md`), so the ~5 MiB localStorage quota per origin is shared three ways (quota figure: MDN "Storage quotas and eviction criteria", unverified here, no network). A saved ghost that hits the quota fails silently today (`ghost: best lap not saved`). IndexedDB counts against the origin's much larger disk-based quota. Moving does **not** change eviction: both sit in the same best-effort bucket and both go when the browser clears the origin, including Safari's 7-day rule for script-written storage outside home-screen apps (unverified). The fix for eviction is `navigator.storage.persist()`, a separate one-liner (step 6).

- **Ghosts move to their own object store** `ghosts`, read one key at a time, async. Not in the boot cache: hydrating every ghost at boot means megabytes of arrays in memory for the one or two a session races. The ghost already tolerates arriving late: `Ghost.best` is null until set, `use()` exists for the async dev ghost, `update()` hides the car while `best` is null.
- **Records move to an object store `kv`** (out-of-line keys, same key strings, same JSON string values so every `parse_*` stays as is), behind a `CachedStore implements Store`: one `getAll` + `getAllKeys` at boot fills a `Map`, `getItem` reads the map, `setItem` writes the map then puts to IDB without awaiting. `local_store()` returns it. Every sync reader, including the menu-render `$derived` ones, stays sync.
- **Stay in localStorage:** settings and theme are read before the first paint and before the world pick; an await there costs the boot head start (`boot.ts` starts generation before `main` evaluates). The sync cache could cover them only if `boot.ts` awaited IDB before `start_early`, which delays first paint by the IDB open (a few ms warm, more cold; unmeasured) for under 5 KB of data. Not worth it. `build`, `rolled-name`, `seen-version` are read before main's first await or feed the `played` / `returning` heuristics that scan localStorage; they stay so those heuristics keep working unchanged.
- **Stay in sessionStorage:** per-tab lifetime is the point. IndexedDB has no tab scope, and a room password written there would persist to disk.

## 3. Migration

### Schema

`HAREPIN_DB` v2 adds `kv` (no keyPath) and `ghosts` (no keyPath). `idb.ts` today only does `put(store, value)` into keyPath stores; it needs `put(store, value, key?)` and an `entries(store)` (`getAllKeys` + `getAll` in one transaction). Whichever of series or this lands second bumps the version; the store list is append-only per its own comment.

`idb.ts` gaps that matter here (blockers, not polish):

- **No `onversionchange`.** A tab holding a v1 connection blocks another tab's v2 upgrade; `open()` then never settles (`onblocked` fires, `onsuccess` waits). If boot awaits it, boot hangs. Fix: `db.onversionchange = () => db.close()` on every open, and reject on `onblocked` after a short wait.
- **No timeout.** Boot must race hydration against a timeout (~1.5 s) and fall back to the localStorage `Store` (today's behaviour) on reject or timeout.

### Move, not copy: the sweep

Run on every boot of the new build, not once behind a flag. It is cheap (it only walks `Object.keys(localStorage)`) and it is what makes the migration idempotent and multi-tab safe:

1. Hydrate `kv` into the cache.
2. For every localStorage key in a moved family (prefix table below): IDB missing it → copy. IDB has it → merge with the family's merge, write the result.
3. One `readwrite` transaction over `kv` for all writes. On its `oncomplete`, `localStorage.removeItem` each swept key. Never remove before the commit.
4. Ghosts: same per key, lazily, when a `Ghost` loads its key: IDB miss and localStorage hit → copy, delete after commit. Plus one background pass after boot (idle) that moves every remaining `harepin:ghost:` key so the quota frees even for worlds never revisited.

Merges (pure functions beside their parsers, Bun-tested):

| Family | Merge when both sides hold a value |
|---|---|
| `harepin:best:*` with `splits:*` | lower lap wins; its splits go with it |
| `harepin:ghost:*` | lower last-frame ms wins |
| `harepin:<mode>:*`, `career:<event>:*` (`Runs`) | per id, `better()` from `track.ts` |
| `harepin:career` | per event, max stars |
| `harepin:lobby:*` | `best` per lap count min; `wins` / `podiums` max (summing double-counts the shared history) |
| `harepin:goals` | union |
| `harepin:builds` | IDB list, then localStorage names it lacks, capped at `MAX_BUILDS` |
| `harepin:runs` | same season: max stars, union `owned`; different seasons: keep IDB's and fold the other through `Runs.fold`. The one merge with real logic: test it first |

Why every boot and not once: after the move, an old build (a tab not yet updated, or a cached service worker in another tab) still reads and writes localStorage. Its new best lands in a localStorage key the new build has already moved. The next new-build boot finds it and merges it in. A one-time flag would orphan it.

### Zero loss

- Nothing is deleted from localStorage until the IDB transaction holding its copy commits.
- Nothing is ever deleted from IDB by the migration.
- Conflicts merge by "better record wins", never by "newer write wins", so the order tabs run in does not matter.
- Write-behind risk: `setItem` updates memory and issues the put; a tab killed in the milliseconds before the transaction commits loses that one write. localStorage has the same window in practice (async flush to disk, unverified). Accept; do not add a sync localStorage double-write.
- Remaining loss case: two **new-build** tabs both holding a `Track` for the same key, both improving. Same last-writer-wins as today; not a regression. Fix later, if ever, with a `BroadcastChannel("harepin:store")` that tells other tabs to reload a key.

### Multiple tabs

- Two new tabs booting at once: IDB serializes `readwrite` transactions on the same store. The second sweep sees the first's writes and merges instead of copying; its `removeItem` calls are no-ops. Idempotent.
- Old tab + new tab: covered by the every-boot sweep. The old tab never opens `harepin` IDB (master has no IDB code), so it never blocks the upgrade.
- An old series build at v1 against a v2 database: `indexedDB.open("harepin", 1)` on a v2 database rejects with `VersionError`; its `Idb` rejects and the series code must fall back. Only matters if series ships with v1 before this lands.

### What old builds see

- A build from before the move: localStorage with the moved keys gone. Records, career stars, runs and ghosts read empty: it looks like a fresh save, but writes nothing destructive (its own writes are swept back later). With `registerType: "prompt"` an old build only runs until the player picks Update now (`menu/update.ts`), or in a second tab. Settings, theme and build stay in localStorage, so it keeps the player's look and car.
- That "looks like a fresh save" flash in an old tab is the cost of freeing the quota. Alternative: keep localStorage copies for one release (copy, no delete). Rejected: it leaves the quota full, which is the reason to move, and the sweep cannot tell a leftover copy from an old tab's fresh write without per-key bookkeeping.

### Rollback

The service worker is prompt mode, so a rollback is a forward deploy. IDB is never wiped, so the data is always there. Ship a build whose boot does the reverse for `kv` (copy each entry back into localStorage, small enough to fit) and reads ghosts from IDB until it is fixed. A plain revert to a pre-IDB build loses access to records (not the data) until the next forward build; do not revert past the move without the reverse copy.

## 4. Async ripple

| Call site | Today | After | Meanwhile |
|---|---|---|---|
| `boot.ts` | sync reads only | starts `hydrate()` (IDB open + `kv` read + sweep) alongside `start_early`, exports the promise | nothing new: the loading screen is already up |
| `main.ts:203-207` (`Career`, `Runs`, `Goals`, `Race`, catch-up) | sync | `await hydrated` once, placed with `await opening` (`main.ts:145`) so it overlaps world generation | loading screen; on timeout or reject, `local_store()` falls back to localStorage and boot continues |
| `local_store()` (`track.ts:106`) | returns `localStorage` | returns the hydrated `CachedStore` (or localStorage on fallback) | sync, no change for `Track`, `Lobby`, `RunsPage`, `Career.best`, `event_track`, `run_track`, `weekly_best` |
| `race.ts` `load` / `save` | direct `localStorage` | take a `Store`, `new Race(world, store)` | sync |
| `car/builds.ts` `load_builds` / `store_builds` | direct `localStorage` | read / write `local_store()` | sync |
| `goals/catch-up.ts` `saved_entries` | scans localStorage | scans `CachedStore` entries plus localStorage | sync |
| `menu/updated-card.ts` `returning` | scans localStorage | unchanged: a returning player always has `harepin:settings` (written by `pin_pick` on the first load) | none |
| `Ghost` ctor (`main.ts:243`, `duel-mode.ts:20`) | sync `load` | `void ghosts.get(key).then(...)`; set `best` only if still null (a lap that finished first wins) | no ghost car for the few ms until it loads; `has_best` false, so duel's `dev_ghost` fallback may fire and then be replaced. Guard: duel waits on a `ghost.ready` promise before choosing the dev ghost |
| `Ghost.finish` | sync `setItem` | `void put`, warn on reject | none |

Nothing in the 360 Hz step or the frame loop touches storage today or after.

## 5. Order of work

Each step ships alone, behind no flag, and leaves the game working if the next never lands.

| Step | Change | Proof |
|---|---|---|
| 0 | `idb.ts`: v2 with `kv` + `ghosts`, `put(store, value, key?)`, `entries(store)`, `onversionchange` close, `onblocked` reject, open timeout. Lands on master with or before series | `typecheck`; browser: two tabs, one at v1 (old series build or a stub page), the other upgrades without hanging |
| 1 | Ghosts to `ghosts`: async load, write, lazy move + idle sweep, lower-ms merge, duel `ready` guard | `bun run test src/car src/modes`; browser on a `vite preview`: drive a lap, reload, ghost races; localStorage `harepin:ghost:*` gone, IDB has it; seed an old-format key by hand, reload, it moves; offline reload still shows it |
| 2 | `CachedStore` + `hydrate()` + `local_store()` returns it; sweep for the `Store` families (`<mode>`, `career*`, `runs`, `goals`, `lobby`) with merges; localStorage fallback on reject/timeout | Bun: merge tests per family (both-sides, one-side, malformed), `CachedStore` read-after-write, `runs` merge across a season boundary; `bun run test src/modes src/career src/runs src/goals src/net`; browser: profile seeded with stars and runs survives a reload, keys moved; two tabs booting at once leave identical IDB contents |
| 3 | `race.ts` best/splits and `car/builds.ts` through the `Store`; `catch-up.ts` scans the cache | `bun run test src/goals src/car`; browser: best lap and saved builds survive; first-steps goals still catch up on a migrated profile |
| 4 | Old-tab check: open a pre-move build (a `vite preview` of `470dad1`) beside the new one, set a record in the old one, reload the new one | the record merges in; nothing lost either way |
| 5 | Reverse-copy escape hatch for rollback (`kv` to localStorage), unreleased, kept ready | Bun test on the pure copy; never ships unless needed |
| 6 | `navigator.storage.persist()` once after the first saved record | browser: `navigator.storage.persisted()` true on an installed PWA; denial changes nothing |

Tests: Bun has no `indexedDB` (unverified), so `Idb` itself is checked in the browser only; everything worth testing (merges, `CachedStore`, sweep planning over a key list) is pure and takes a `Store` or plain entries, per the repo's no-fakes rule. `fake-indexeddb` would be a new dependency: not proposed.

Versioning: steps 1-3 change where saves live but no save format; old builds can still read what stays in localStorage. Each is a `feat:`/`fix:` minor at most, not a major. The changelog line is for the player only if they notice: "Ghosts no longer stop saving on long play sessions."

## Open questions for the owner

- Viewer notes: move now with the records, or leave until the viewer gets touched? Default here: leave.
- Old-tab "fresh save" look during the overlap window: acceptable, or keep a localStorage copy for one release at the cost of the quota? Default here: acceptable.
