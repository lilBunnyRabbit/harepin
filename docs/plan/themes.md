# Themes: the webos system in Harepin

> **Status 2026-11-12 (v0.29.0):** C and A shipped: the `desktop` token, `generate_theme` (`src/theme/random-theme.ts`), saved themes under `harepin:themes`, and a parity test against the webos checkout in `theme.test.ts` (skipped when that checkout is absent). B (shared package) not built.

Research 2026-11-09. Plan only. Nothing is built, and no code changed.

"The same theme generation and system as in webos" means three things webos has and Harepin lacks: the **theme generator** (`generate_theme`), **saved custom themes**, and webos's newer **`desktop` token and light/dark detection**. The 18 token names, the presets and `derive_theme` are already in Harepin, and they match webos value for value.

## What webos has

Paths are relative to `~/dev/orgs/lilbunnyrabbit/webos`. The docs are `docs/system/theming.md` and `docs/adrs/015-customization-theming.md` (revisions dated 2026-10-10 to 2026-11-07).

| Part | Where | What it does |
|------|-------|--------------|
| Tokens | `settings/type.ts:77-80`, `docs/system/theming.md:29-47` | There are 18 tokens: a 7-step surface ladder (`background_lightest` … `background_darkest`), `foreground`, `primary`, `secondary`, `tertiary`, `accent`, `cottontail`, `success`/`warning`/`error`/`info`, and `desktop`. The five base tokens are `background foreground primary secondary accent`. Keys use `snake_case` and are written to `<html>` as `--kebab-case`. |
| Presets | `settings/themes.ts:6-71,161-186` | Brand Dark, Brand Light and While True are written out in full. The other 21 presets go through `base(name, [bg, fg, p, s, a])`, which calls `derive_theme`. A `group` field (`webos` / `projects`) splits the grid in Settings. |
| Derivation | `settings/themes.ts:93-102,127-139` | No precomputed ladder. Every derived token is stored as a live CSS expression: `oklch(from var(--background) calc(l - min(…))) c h)` for the ladder, `color-mix(in oklch, var(--primary), var(--secondary))` for `tertiary`, and `oklch(from var(--primary) l 0.14 <hue>)` for the states (hues 140/70/30/240). Editing a base colour moves everything derived from it. |
| Generator | `settings/random-theme.ts:1-141` (ADR-015 rev. 2026-10-16) | Pure TS with no dependency. `generate_theme({ mode, harmony, vibrance, contrast, locked }, rand)` returns a `ThemeBase`. It picks one base hue plus a harmony (analogous / complementary / triadic / split) to place primary, secondary and accent. The background is a tint of the base hue and the foreground a near-neutral of the opposite hue. Contrast rules: text stays ≥ `MIN_TEXT_CONTRAST` 0.55 OKLCH L from the background, colours ≥ `MIN_COLOUR_CONTRAST` 0.35 (`:220-221,304-317`). Dark backgrounds land at L 0.10–0.30 and light ones at 0.90–0.985 (`:290`). Locked colours are kept, and a lock that only fits the other mode flips the mode (`:255-274`). |
| Generator UI | `apps/system/settings/sections/generate.svelte`, `generator.svelte.ts` | Mode (Dark/Light/Any), harmony select, vibrance and contrast sliders, a lock per base colour, a live preview card, Generate, Apply and Save…, and the last 3 generations (module state, lost on reload). |
| Saved themes | `settings/saved-themes.ts:1-25`, `settings/persistence.ts:106-127` | `saved_themes: { name, theme }[]` lives in `/etc/settings.json` (OPFS). Names are compared case-insensitively and may not match a preset (`theme-name.ts:10-21`). On load, `merge_theme` fills missing tokens and swaps old ladder expressions. |
| Picking | `sections/theme.svelte:44-45,95-123` | Cards show Your themes, then the WebOS presets, then the Project presets. The active theme is matched by value, so no theme id is stored: `settings.theme` holds the full token record. |
| Editing | `sections/colours.svelte`, `settings/color.ts` | A text field plus `<input type="color">` per token. A picked colour is stored as OKLCH, and picking replaces that token's live expression with a fixed value. |
| Share | `settings/theme-file.ts:1-60` | A `.webos-theme` file is JSON: `{ format: "webos-theme", version: 1, name, theme }`. On import every token is checked with `CSS.supports("color", …)`, and a missing `desktop` is filled in. |
| Light/dark | `settings/service.svelte.ts:87-96,262-269`; `random-theme.ts:248-250` | There is no mode field: light or dark is just a palette. `color-scheme` follows polarity (the foreground is darker than the background → `light`), measured on a probe element. `is_dark()` (background L < 0.6) is used only by the generator. |
| Libraries | `package.json:44-67` | No colour library: no culori, colorjs or chroma. All colour maths is native CSS relative colour syntax plus small regex parsers. |

## What Harepin has

| Part | Where | State |
|------|-------|-------|
| Tokens, presets, `derive_theme` | `src/theme.ts:1-144` | A hand copy of webos `themes.ts`. A diff of every literal `oklch(…)` in the two files comes out **identical** as of 2026-11-09 (webos last touched it in `21ce0c1d`, 2026-11-07). There are 17 tokens: **no `desktop`**. There are no groups. Themes are a `Record<name, Theme>`. |
| Storage | `src/theme.ts:146-163` | localStorage `harepin:theme` holds a **preset name**. `?theme=` overrides it, and an unknown name falls back to Brand Dark. |
| Apply | `src/theme.ts:165-168` | Writes `--kebab-case` vars on `<html>`, the same way webos does. |
| Read for 3D | `src/theme.ts:185-205` | `read_tokens()` resolves each var through a probe, then a 1px canvas, then sRGB, then OKLab. Any CSS colour syntax works, so generated or edited themes need no change here. |
| Game tones | `src/palette.ts:4-106` | Runs once, at import time. `dark = brand.background[0] < 0.55` (`:7`). About 30 `tones` are mixes of tokens, with dusk vs day branches. `car_paints` and `decal_inks` are drawn from the tokens. 13 modules import it. |
| CSS | `src/style.css:17-62` | `color-scheme: light dark` is fixed. The UI uses the ladder vars directly (`--background-darkest` ×11, `--foreground` ×22, `--primary` ×17). |
| Picker | `src/settings.ts:805-816` | A `<select>` of every `THEMES` key. On change it saves the name and reloads the page. |
| HUD scheme | `src/hud.ts:85` | `data-scheme` comes from `palette.dark`. |
| Art direction | `docs/plan/art-direction.md` items 3–8 | The tone choices were checked on only 4 themes (Brand Dark, Brand Light, Warm Sunset, Forest Night; "Not checked": the other 20). Item 8 asks for a `desktop` surface, which Harepin doesn't have. |

## Same, different, missing

- **Same:** token names and order (minus `desktop`), every preset value, the ladder formula, the state hues, the `--kebab` var names, and native CSS colour maths with no library.
- **Different:**
  - *Dark test.* Harepin uses background L < 0.55. webos uses polarity for `color-scheme` and L < 0.6 for the generator. Red & Black (background 0.45, foreground 0.15) is a **light** palette in webos but renders as **dusk** in Harepin. Mid-tone Green (0.5) is dark in both.
  - *Theme identity.* Harepin stores a name. webos stores the full token record and matches it by value.
  - *Storage.* Harepin uses localStorage. webos uses OPFS `/etc/settings.json`.
  - *Groups.* Harepin has none, so Speed Reader and While True mix in with the rest.
- **Missing in Harepin:** the generator (mode, harmony, vibrance, contrast, locks), saved/named themes, the per-token editor, `.webos-theme` import/export, the `desktop` token, polarity-based `color-scheme`, and any drift check.
- **Contrast rules:** webos only has the generator's L-gap rules, and they cover UI text against the background. Harepin has its own 3D value ladder in `palette.ts` (DUSK_* constants), and that ladder doesn't check contrast at all.

## Options, lightest first

### C. Keep copying definitions, close the gaps (S, ~60 lines)

Harepin already does this. Closing the gaps:

- Add the `desktop` token to `TOKENS` and the three written-out themes, and set `desktop: var(--background-darkest)` in `derive_theme`.
- Set `color-scheme` on `<html>` by polarity in `apply_theme`.
- Add a `bun test` that reads `../../orgs/lilbunnyrabbit/webos/.../themes.ts` when it exists, compares the literals, and skips when the file is absent.

- **Files:** `src/theme.ts`, `src/palette.ts:7` (use polarity or keep 0.55), `src/style.css:18`, new `src/theme.test.ts`.
- **Gives:** parity and a drift alarm. It does **not** give generation or custom themes, so on its own it doesn't satisfy the ask.
- **Risks:** a test that reads another repo by relative path only works on the owner's machine (that's why it skips). Switching `dark` to polarity changes Red & Black from dusk to day, which is a visible change.

### A. Port the generator and saved themes into Harepin (M, ~450–550 lines incl. tests)

Do C, plus copy webos's pure modules and build a small DOM version of the Generate panel.

| File | Change | Size |
|------|--------|------|
| `src/theme.ts` (or split `src/theme-generate.ts`) | Port `generate_theme`, `Harmony`, `parse_oklch`, `is_dark` and the `MIN_*` constants from `random-theme.ts:1-141` verbatim (it's already `snake_case` and dependency-free), plus `saved-themes.ts:1-25` | ~170 |
| `src/theme.test.ts` | Port `random-theme.test.ts` (101 lines). Swap the `vitest` import for `bun:test` | ~110 |
| `src/theme.ts` storage | `current_theme()` resolves a name against presets first, then saved themes. Add `load_saved()`, which validates each entry's shape and each token with `CSS.supports("color", v)` and drops bad ones | ~50 |
| `src/settings.ts` `display()` | Theme select with groups (`<optgroup>` Your themes / Presets / Projects). Add a Create panel: mode segmented, harmony select, vibrance and contrast ranges, 5 lock toggles, swatch preview, Generate, and Save & apply (name prompt, unique against presets and saved themes, then reload). Add Delete for the active saved theme | ~180 |
| `src/style.css` | Swatch row, lock buttons. Ladder tokens only | ~50 |
| Optional: `.webos-theme` import/export | `parse_theme_file` / `serialize_theme_file` (`theme-file.ts:19-45`) with zod swapped for a hand check, a file input and a download link. Lets a theme made in webos be used in Harepin | ~70 |

- **Preview without reloading:** draw the swatch strip from the generated `ThemeBase` through `derive_theme`, with the 5 base vars set on the preview element only. This is webos's theme-card trick (`theming.md:145`). The 3D scene changes only after a reload, because `palette.ts` runs once at import. Making the scene re-theme live would mean rebuilding every material, which is out of scope.
- **Risks:**
  - **palette.ts mapping.** Generated themes are bounded: background L sits in 0.10–0.30 or 0.90–0.985, so they never land near the 0.55 cutoff. But locks allow any background, and chroma goes up to 0.3. The dusk ladder (`DUSK_*`, `above_asphalt`) was tuned on 4 themes. With a black background, the whole dark side of the ladder (`background_darkest`, so `asphalt`, `skid`, `glass`) is pure black. Before shipping, screenshot 3–5 extreme generations (L 0.1, high chroma, a light theme, a locked mid-tone background). Grass and sand hues are safe because the state tokens keep fixed hues (140/70) at primary's L.
  - **Saved theme ids.** `harepin:theme` keeps holding a name, so existing values (preset names) still resolve. Saved names must not collide with preset names: reject on save, the way webos does. If a saved theme is deleted while active, the name falls back to Brand Dark (the behaviour `current_theme` already has). `?theme=` works for saved names too.
  - **Unsaved "customised" theme:** webos can apply one without saving it. Harepin needs a name to store, so Apply = Save. The alternative is storing the full record, which is a bigger storage change.
  - **Drift:** a second hand copy, now about 200 lines of logic. The C test only covers the literals, so the generator can still drift silently.

### B. Shared package (L, plus work in webos)

Extract `themes.ts`, `random-theme.ts`, `saved-themes.ts` and the theme types into a package, for example `@lilbunnyrabbit/themes`, published like `@lilbunnyrabbit/task-manager`, or as a Bun workspace / `file:` link. Both repos import it.

- **Files:** a new repo or package. In webos: `settings/index.ts` re-exports, `type.ts`, the tests move, an ADR. In Harepin: `src/theme.ts` shrinks to storage plus `read_tokens`, and `package.json` gains the dependency.
- **Gives:** one source of truth and no drift.
- **Costs:** a **new dependency in both repos**, and both repos require owner approval for that. It also brings publishing and versioning work, a webos ADR, and webos CI touching a package boundary. A `file:` link breaks the Harepin GitHub Pages build unless the package is published. Two consumers is the minimum that justifies a shared package, and the generator is about 140 lines.

### Not recommended: a colour library (culori)

webos doesn't use one. Harepin's OKLab maths (`theme.ts:172-183`, `palette.ts:17-27`) and native relative colour syntax already cover everything. Adding culori would make Harepin *less* like webos.

## Recommendation

**C now, then A.** Build C first: parity (`desktop`, polarity `color-scheme`, drift test), one `fix:`/`refactor:`-sized change. Then build A as one `feat:` (minor bump plus a changelog line). Leave out `.webos-theme` import unless the owner wants to carry themes between the two apps. Revisit B only if a third project needs the generator.

## Needs owner approval

- **Storage change (A):** a new localStorage key `harepin:themes` holding `{ name, theme }[]`, validated on load. `harepin:theme` keeps its meaning (a name). This is a new persistence format, which AGENTS.md says must be asked about.
- **Visible change (C):** whether `dark` follows webos polarity (Red & Black becomes a day scene) or keeps the L < 0.55 rule.
- **New dependency:** none for C or A. **B adds one** (a shared package) to both Harepin and webos.
- **Scope:** whether "same system" includes the per-token colour editor (`colours.svelte`). It isn't costed above, and it would add ~100 lines plus the risk that a hand-edited token breaks the `palette.ts` tones.
