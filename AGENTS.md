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

Run `typecheck` and `build` before every commit. A change to `car.ts`, `world.ts` or input also runs the `scripts/*.ts` checks and compares numbers against the previous run.

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

## Tests

webos uses Vitest (unit in Node, browser tests in Chromium via Playwright), tests beside their source as `*.test.ts`. Here: `bun test` for pure logic, `src/{module}.test.ts` beside the module, no fakes for what can run for real. Sim behaviour is checked by asserting on the `scripts/*.ts` numbers. Rendering is checked by eye in the browser.

## Differs today

- `src/style.css:1-15` hard-codes Brand Dark's OKLCH values: a second copy of `theme.ts` that will drift.
- `index.html:8` hard-codes `theme-color` `#1a2329` (`main.ts:343` overwrites it at runtime).
- `src/models.ts:238-240` paints the contact-shadow blob in raw white. Fine as an alpha mask; say so or use `alphaMap`.
- `src/ghost.ts:20-21`, `src/race.ts:9-10` trust `JSON.parse` from localStorage (`as T`, no shape check); `ghost.ts`, `race.ts` have empty `catch {}`.
- `src/hud.ts:7`, `src/main.ts:28` use `as T` / `!` `$` helpers that hide a missing element.
- Imports mix `import * as THREE` (8 modules) with named imports (`car.ts`): pick one.
- No tests: `scripts/*.ts` print numbers and throw only on NaN; nothing fails when handling regresses.
- `theme.ts` mirrors webos `themes.ts` by hand, with no check that they still match.
