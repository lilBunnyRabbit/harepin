# Harepin: agent guide

Vite + TypeScript + Three.js driving game, no framework, no server. Code style follows the owner's webos repo (`~/dev/orgs/lilbunnyrabbit/webos`, `docs/CONVENTIONS.md`), minus everything Svelte-specific.

## Commands

```sh
bun run typecheck          # tsc --noEmit, must stay at 0 errors
bun run build              # static dist/
bun run telemetry          # scripts/telemetry.ts: 0-100, top speed, braking, skidpad
bun test                   # fast: seed sweeps take seeds 0-4; `bun run test:full` (FULL=1) sweeps every seed
bun scripts/golden.ts      # rewrite scripts/golden/*.txt; --check diffs generated worlds against them
bun scripts/proof.ts       # every world check, drive, golden diff and gen timing, one pass per seed, all cores
bun scripts/races.ts --changed  # race drives on routes whose golden digest moved, plus three canaries
bun scripts/feel.ts        # handling scenarios
bun scripts/autolap.ts     # autopilot lap; also scripts/crash.ts, scripts/offroad.ts
node scripts/og/render.mjs # link-preview card public/og.jpg from scripts/og/og.html; capture.mjs <port> re-shoots hero.jpg from a vite preview
```

Run `typecheck` and `build` before every commit; what else a change runs is in [Tests](#tests).

## Structure

One level of feature folders under `src/`. Each folder owns its modules, tests (`*.test.ts` beside the module) and CSS (imported by the module that renders it). Import the real file; no barrel `index.ts`.

| Folder | Owns |
|---|---|
| `car/` | physics (`car.ts`, `rigid-body.ts`, `axles.ts`), specs (`cars.ts`), parts (`build.ts`, `builds.ts`), rating and class (`pi.ts`), preset builds (`presets.ts`), nitro, 3D models and livery, driver session, rewind, ghost |
| `world/` | runtime world queries (`world.ts`: height, normal, grip, collide), the boot world pick (`world-pick.ts`), mainland chunk streaming (`world-stream.ts`), jumps, kerbs, buildings, landmarks, sky pads, water, lava |
| `worldgen/` | pure generation, runs in a Web Worker: no DOM, no THREE. `kinds/` holds the worker side of each world kind, its map options (`options.ts`, `land-knobs.ts`) and map codes (`map-code.ts`) |
| `worlds/` | UI side of each world kind: names, copy, facts, scene dressing |
| `modes/` | game modes, one `<mode>-mode.ts` def + logic + view each; race routes and records |
| `goals/` | first-steps goals and their toasts |
| `career/` | career events and tiers; off in the release, on with `?career` or an `?event=` link |
| `net/` | P2P (trystero + BroadcastChannel): channels, lobby, directory, chat, remotes, heartbeat |
| `menu/` | main menu shell (`settings.ts`), one file per page (Play, Create world, Online, room, modes, settings), prefs (`prefs.ts`), guide, garage, update card |
| `hud/` | dash, minimap, touch, input and bindings, pace card, rumble |
| `render/` | renderer, composer, scene, lighting, effects, camera, quality tiers |
| `audio/` | engine sound and worklet |
| `theme/` | palette and themes |

`main.ts` is the composition root: it builds each feature and wires them; feature logic does not live there. `style.css` holds tokens, resets and base element styles, plus the few button rules that must load after the base `button:hover`; it is imported last in `main.ts`.

## Adding things

Every kind of thing we add has a registry. Adding one touches its own files plus one registry line; the compiler lists anything missing.

- **Game mode:** `src/modes/<mode>-mode.ts` exports a `ModeDef` (`mode.ts`); logic and view in their own files beside it. Add it to `MODES` in `modes.ts`. `needs_ground` decides whether it runs on Sky.
- **World kind:** a `WorldKind` value in `worldgen/types.ts`, then four pieces. Worker side: `worldgen/kinds/<kind>.ts` exports `kind_def({ … })` (`kinds/kind-def.ts`: `base`/`tag`/`version` derive `id` and `key()`, plus `size`, `generate`, `options`, `recipe`, `open_ground`, `rails`, `ground`, `fall_reset`, `grip`, and optional `clamp`, `drivable`, `tuned`) and goes in `KINDS` (`kinds/kinds.ts`). A land kind spreads `land_kind(RECIPE, KNOBS, kind)` (`kinds/land-kind.ts`: `generate`, `clamp`, `tuned`, `drivable`) over its own `Recipe` (`worldgen/recipe.ts`: terrain shape, biome tree rules, items and ground rows, road, towns, landmarks, snow) and knob list (`kinds/land-knobs.ts`); a recipe is part of the kind's version, so changing a value bumps `version`. Map codes: one preset char per kind in `PRESETS` (`kinds/map-code.ts`), append-only like the knobs' field letters. UI side: `worlds/<kind>.ts` (`listed`, `mini`, copy, facts, `mood` deltas over the theme, `ground_puff`, `backdrop`, `dress`) in `WORLDS`. Images: `public/menu/<kind>.webp` and `<kind>-map.webp`. Play shows the mainland and every listed `mini` kind (`MINIS` in `worlds/worlds.ts`); an unlisted kind loads only from `?world=`. A kind's `base`, `tag` and `version` key saved records: never change them for an existing kind except as a deliberate version bump.
- **Car:** a `CarSpec` in `car/cars.ts` added to `CARS`, plus its body design (`Record<BodyStyle, …>` makes a missing one a type error). Axles come from the spec through `axles_of`; don't index wheels by number.
- **Part:** an entry in `SLOTS` in `car/build.ts`.
- **Setting:** a field on `SettingsState` and its entry in `FIELDS` in `menu/prefs.ts` (the mapped type rejects a missing one), then its row in the section builder in `menu/settings-sections.ts`. Reset picks the key up from the row.
- **Menu page:** a class implementing `MenuPage` (`menu/page.ts`, optional `on_show` / `on_hide`), one line in `page_list` in `menu/settings.ts`.
- **Net message:** one `this.link.channel(name, sanitize, limit?, accept?)` line in `net/net.ts` and its sanitizer. New fields on an existing message are optional; never rename or remove a wire field. Bump `PROTOCOL` when old peers can't play with new ones; peers send it in `hello`. The binary `car` packet (`net/car-packet.ts`) is append-only: new fields go at the end and new flag bits are optional, both ignored by older decoders; reordering or resizing a field bumps `PROTOCOL`.

## Working in parallel

Several agents often work in this repo at once.

- One agent per feature folder. A shared file (`main.ts`, a registry list) only gets the one line the change needs.
- Stage only your own hunks, never `git add -A`; run `git branch --show-current` before each commit; commit after every green step.
- Workers never bump the version or touch `changelog.ts`; the lead does that once per release.

## Code shape

- Small files split by responsibility, about 150-400 lines. A file past that is a sign it holds two things.
- Reuse an existing helper when it fits. Never bend a function with flags or mode parameters to cover every case: two clear functions beat one switch.
- Data over special cases: a difference between cars, worlds or modes is a field on their def, not an `if (kind === …)` in shared code.
- The code is the source: no comments that restate it.

## Performance

- No allocations in the 360 Hz physics step or the per-frame loop: hoist scratch vectors, no closures, `filter`, spreads or object literals per call.
- The DOM is written only when a value changes; read layout before writing, never after.
- A change that claims identical output proves it: `car.test.ts` bit-exact and `scripts/telemetry.ts` / `scripts/feel.ts` byte-identical for physics; `bun scripts/golden.ts --check` for worldgen and meshes.
- Generated world output is keyed by each kind's `version` in `worldgen/kinds/<kind>.ts` (the island's is `WORLD_VERSION`, the sky's `SKY_VERSION` in `worldgen/types.ts`). Changing what `generate_world` returns for a kind needs a bump, which resets every player's records for that kind.

## Rules

- `snake_case` for variables, functions, methods, properties; `PascalCase` for types and classes; `kebab-case` files. Settled; native and Three.js APIs keep their names.
- `interface` for object shapes, `type` for unions, intersections, mapped types. Discriminated unions over optional-field soup.
- No TS `enum`: a const object plus same-named type (`export const Gear = { … } as const; export type Gear = (typeof Gear)[keyof typeof Gear]`). Keys `SCREAMING_SNAKE`, values lowercase strings.
- No `any`. `private` / `protected` / `readonly`, never `#private`. Casts (`as`, `!`) only at a DOM or library boundary, never to silence a type you could model.
- Module-level `SCREAMING_SNAKE` constants for tuning numbers, named after what they are (`REDLINE`, `PEAK_SLIP`), at the top of the module that owns them.
- Pure logic (physics, maths, parsing, net message checks) in modules with no DOM and no renderer, so Bun can run it headless. Rendering and DOM wiring stay in their own modules.
- Constructors set fields; listeners, timers and loops start in an explicit method, and whatever starts gets a matching stop.
- Comments only for a non-obvious why: a constraint, an edge case, the reasoning. JSDoc on exported fields whose unit or sign is not obvious. No restating comments.
- One source of truth. Shared constants live in one module; never copy a block between files.
- No colours outside `palette.ts` / theme tokens (`theme.ts`, CSS custom properties). The 3D scene gets colours through `color(brand.x)` / `rgba(brand.x)`; a "missing" colour is a token mixed, lightened or at an opacity. Never hand-pick a hex.
- Brand rules: nothing on white, no white text on a brand fill, no gradients between brand colours.
- Persisted data is untrusted: validate its shape on load and fall back to defaults. Peer data even more so (see `net.ts`).
- Errors: throw on broken invariants (NaN in the sim); catch only where the platform can refuse (storage, WebRTC, audio) and fall back. No empty `catch {}` that hides why.
- Use the latest web platform; target is the owner's current browser, no polyfills or support checks.
- Lightest approach first: platform feature < existing code < new code < new dependency. No new dependency without asking.
- Architecture is the owner's call: a new state layer, manager, event system, persistence format or dependency gets asked before the first edit, with options lightest first.
- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`), short bullet body. Renames go in their own `refactor:` commit.

## Versioning

Semver, and `package.json` `version` is the only source. The build stamps it into the bundle (`__HAREPIN_VERSION__`) and into `dist/version.json` with the newest releases from `src/changelog.ts`; `src/menu/update.ts` shows them when a new service worker is waiting.

- A release is one `feat:`/`fix:` commit (or a run of them) plus a bump: `fix:` → patch, `feat:` → minor, a save or room format that old builds can't read → major. `refactor:`/`chore:`/`docs:` alone don't bump.
- Bump `package.json` and add an entry at the top of `CHANGELOG` in `src/changelog.ts` in the same commit: version, date, a short title, one line per change the player would notice, written for the player (`NEW`, `IMPROVED`, `FIXED`). `src/version.test.ts` fails when the two disagree.
- The update card never reloads during a lobby race or a gymkhana run; keep whatever counts as a run behind the `Updater` busy callback in `main.ts`.

## Tests

`bun test` for pure logic, `*.test.ts` beside the module, no fakes for what can run for real; `bun test src/<folder>` runs one feature. A module that needs a fake (a trystero room) takes it as a parameter rather than through a process-wide `mock.module`. Sim behaviour is checked by asserting on the `scripts/*.ts` numbers. Rendering is checked by eye in the browser: one headless browser at a time, against a `vite preview` of a build when others are editing the tree.

Run what the change needs, nothing more:

| Change | Proof |
|---|---|
| Every commit | `typecheck` + `bun test` (fast) |
| Touches generation (`worldgen/`, meshing, map) | + `bun scripts/golden.ts --check`. Output meant to change: run `bun scripts/golden.ts` and commit `scripts/golden/` with the change, so review sees which parts moved |
| Car physics | `car.test.ts` + `scripts/telemetry.ts` / `scripts/feel.ts` byte-identical, nothing else |
| Routes or race logic | `bun scripts/races.ts --changed` only; it fails only on runs missing from `scripts/golden/races-baseline.txt` and lists fixed ones. A change meant to move them: `bun scripts/races.ts --baseline` and commit the file |
| Generation hot path | one `bun scripts/proof.ts --no-drive --jobs 1` timing table; no repeated medians |
| Visual | screenshots, one theme unless the change is about themes, about 4 shots at most |
| Release | `bun run test:full` + `bun scripts/proof.ts` |

No base archives for identity proofs: the committed goldens are the base. A sweep test takes its seeds from `sweep(n)` (`src/sweep.ts`), so the fast run stays fast.

## Differs today

- `index.html:10` hard-codes `theme-color` `#0b1519` (`main.ts` appends a second one from the theme at runtime).
- The car contact-shadow blob is painted in raw white. Fine as an alpha mask; say so or use `alphaMap`.
- Imports mix `import * as THREE` (36 modules) with named imports (`car.ts`): pick one.
- `theme.ts` and `random-theme.ts` mirror webos by hand; `theme.test.ts` checks parity only when the webos checkout sits beside this repo, and skips elsewhere.
- `scripts/*.ts` print numbers and throw only on NaN; nothing fails when handling regresses beyond `car.test.ts`.
