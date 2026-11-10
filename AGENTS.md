# Harepin: agent guide

Vite + TypeScript + Three.js driving game, no framework, no server. Code style follows the owner's webos repo (`~/dev/orgs/lilbunnyrabbit/webos`, `docs/CONVENTIONS.md`), minus everything Svelte-specific.

## Commands

```sh
bun run typecheck          # tsc --noEmit, must stay at 0 errors
bun run build              # static dist/
bun run telemetry          # scripts/telemetry.ts: 0-100, top speed, braking, skidpad
bun scripts/feel.ts        # handling scenarios
bun scripts/autolap.ts     # autopilot lap; also scripts/crash.ts, scripts/offroad.ts
```

Run `typecheck` and `build` before every commit. A change to `src/car/`, `src/world/` or input also runs the `scripts/*.ts` checks and compares numbers against the previous run.

## Structure

One level of feature folders under `src/`. Each folder owns its modules, tests (`*.test.ts` beside the module) and CSS (imported by the module that renders it). Import the real file; no barrel `index.ts`.

| Folder | Owns |
|---|---|
| `car/` | physics (`car.ts`, `rigid-body.ts`, `axles.ts`), specs (`cars.ts`), parts (`build.ts`, `builds.ts`), 3D models and livery, driver session, rewind, ghost |
| `world/` | runtime world queries (`world.ts`: height, normal, grip, collide), ramps, buildings, landmarks |
| `worldgen/` | pure generation, runs in a Web Worker: no DOM, no THREE. `kinds/` holds the worker side of each world kind |
| `worlds/` | UI side of each world kind: names, copy, facts, scene dressing |
| `modes/` | game modes, one `<mode>-mode.ts` def + logic + view each |
| `net/` | P2P (trystero + BroadcastChannel): channels, lobby, directory, chat, remotes, heartbeat |
| `menu/` | main menu shell (`settings.ts`), one file per page, prefs (`prefs.ts`), guide, garage |
| `hud/` | dash, minimap, touch, input |
| `render/` | renderer, composer, scene, lighting, effects, camera, quality tiers |
| `audio/` | engine sound and worklet |
| `theme/` | palette and themes |

`main.ts` is the composition root: it builds each feature and wires them; feature logic does not live there. `style.css` holds tokens, resets and base element styles, plus the few button rules that must load after the base `button:hover`; it is imported last in `main.ts`.

## Adding things

Every kind of thing we add has a registry. Adding one touches its own files plus one registry line; the compiler lists anything missing.

- **Game mode:** `src/modes/<mode>-mode.ts` exports a `ModeDef` (`mode.ts`); logic and view in their own files beside it. Add it to `MODES` in `modes.ts`. `needs_ground` decides whether it runs on Sky.
- **World kind:** add a `WorldKind` value in `worldgen/types.ts`; worker side `worldgen/kinds/<kind>.ts` (id, key, generate, rails, open ground) in `KINDS`; UI side `worlds/<kind>.ts` in `WORLDS`; images `public/menu/<kind>.webp` and `<kind>-map.webp`. Not covered by the compiler yet: its meshing and map preview (`worldgen/chunks.ts` and `worldgen/map.ts` branch on `kind === "sky"`) and its Play tile's grid area in `menu/menu.css`. A kind's `id` and `key()` key saved records: never change them for an existing kind.
- **Car:** a `CarSpec` in `car/cars.ts` added to `CARS`, plus its body design (`Record<BodyStyle, …>` makes a missing one a type error). Axles come from the spec through `axles_of`; don't index wheels by number.
- **Part:** an entry in `SLOTS` in `car/build.ts`.
- **Setting:** a field on `SettingsState` and its entry in `FIELDS` in `menu/prefs.ts` (the mapped type rejects a missing one), then its row in the section builder in `menu/settings-sections.ts`. Reset picks the key up from the row.
- **Menu page:** a class implementing `MenuPage` (`menu/page.ts`, optional `on_show` / `on_hide`), one line in `page_list` in `menu/settings.ts`.
- **Net message:** one `this.link.channel(name, sanitize, limit?, accept?)` line in `net/net.ts` and its sanitizer. New fields on an existing message are optional; never rename or remove a wire field. Bump `PROTOCOL` when old peers can't play with new ones; peers send it in `hello`.

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
- A change that claims identical output proves it: `car.test.ts` bit-exact and `scripts/telemetry.ts` / `scripts/feel.ts` byte-identical for physics; a hash of the generated arrays for worldgen and meshes.
- Generated world output is keyed by `WORLD_VERSION` / `SKY_VERSION` (`worldgen/types.ts`). Changing what `generate_world` returns needs a bump, which resets every player's records for that kind.

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

## Differs today

- `src/style.css` hard-codes Brand Dark's OKLCH values: a second copy of `theme.ts` that will drift.
- `index.html:8` hard-codes `theme-color` `#1a2329` (`main.ts` overwrites it at runtime).
- The car contact-shadow blob is painted in raw white. Fine as an alpha mask; say so or use `alphaMap`.
- Imports mix `import * as THREE` (25 modules) with named imports (`car.ts`): pick one.
- `theme.ts` mirrors webos `themes.ts` by hand, with no check that they still match.
- `scripts/*.ts` print numbers and throw only on NaN; nothing fails when handling regresses beyond `car.test.ts`.
