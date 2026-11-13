# Release

One command cuts a release in a throwaway clone, so the main checkout and its in-flight work stay untouched:

```sh
hq lock run -- bun scripts/release.ts <ref> <version> --level hotfix|full [--title "..."] [--change fixed:"..."]...
```

It does, in order:

1. Clones this repo into a fresh folder under the OS temp dir (`--dir <path>` picks it; it must be empty) and checks out `<ref>` on branch `rel`.
2. Bumps `package.json` and prepends the changelog entry to `src/changelog.ts` (today's date, `--title`, default `Fixes`, one row per `--change`). Commits `chore: release <version>`.
3. Runs `bun install` and `bun install` in `tools/svelte-check` side by side.
4. Runs the checks side by side, each timed: `tsc --noEmit`, `check:svelte`, `vite build` and `bun test` on the picked test files (below). `hotfix` always runs them plain. `full` runs them with `FULL=1`, started once tsc, svelte-check and the build are done, and adds `golden.ts --check` and `proof.ts --jobs 3`, but only when the diff touches `src/worldgen`, `src/world`, `scripts/golden` or a car physics file (`CAR_PHYSICS` in the script: `car`, `rigid-body`, `axles`, `cars`, `build`, `presets`, `driver`, `nitro`, `pi`); otherwise `full` runs as `hotfix`. Render-only car files (models, livery, paint, part looks, wheels, lights) do not count. A failed check prints its `(fail)` lines and the last 40 lines of its output.
5. Prints a table of steps and seconds, the clone path and the release sha. It exits non-zero when any step failed.

Only the tests for what changed run. The diff is taken from the last release (the nearer of the last tag and the last `chore: release` commit before `<ref>`). A test file is picked when it sits in the folder of a changed file, or imports a changed module by a relative path (direct imports only). `src/version.test.ts` always runs. The picked files are printed before the checks. `--all-tests` runs the whole suite instead, as does a ref with no earlier release. Tests run with `--timeout 30000`: several car and audio tests take 3-4 s alone, and next to the builds they pass bun's 5 s default.

It never pushes. Push `rel` from the clone it prints once the table is green.

| Flag | Does |
|---|---|
| `--level hotfix\|full` | `full` adds FULL tests, golden and proof when world, car physics or golden paths changed |
| `--auto-level` | Picks the level instead: `full` when the diff from the last release touches `src/worldgen`, `src/world`, `scripts/golden` or a car physics file, else `hotfix` |
| `--title "..."` | The release title in the changelog |
| `--change kind:"text"` | One changelog row; kind is `new`, `improved` or `fixed`. At least one is needed |
| `--all-tests` | Runs the whole `bun test` suite, not just the picked files |
| `--dir <path>` | Clone here instead of a temp folder |

The version must be `x.y.z` and past the one in `package.json`. `src/changelog.ts` may have CRLF or LF line endings; the entry uses whichever the file has.
