# Release

One command cuts a release in a throwaway clone, so the main checkout and its in-flight work stay untouched:

```sh
hq lock run -- bun scripts/release.ts <ref> <version> --level hotfix|full [--title "..."] [--change fixed:"..."]...
```

It does, in order:

1. Clones this repo into a fresh folder under the OS temp dir (`--dir <path>` picks it; it must be empty) and checks out `<ref>` on branch `rel`.
2. Bumps `package.json` and prepends the changelog entry to `src/changelog.ts` (today's date, `--title`, default `Fixes`, one row per `--change`). Commits `chore: release <version>`.
3. Runs `bun install` and `bun install` in `tools/svelte-check` side by side.
4. Runs the checks side by side, each timed: `tsc --noEmit`, `check:svelte`, `FULL=1 bun test`, `vite build`. `full` adds `golden.ts --check` and `proof.ts --jobs 3`. A failed check prints the last 40 lines of its output.
5. Prints a table of steps and seconds, the clone path and the release sha. It exits non-zero when any step failed.

It never pushes. Push `rel` from the clone it prints once the table is green.

| Flag | Does |
|---|---|
| `--level hotfix\|full` | Which checks run. `full` adds golden and proof |
| `--auto-level` | Picks the level instead: `full` when the diff from the last release (the nearer of the last tag and the last `chore: release` commit before `<ref>`) touches `src/worldgen`, `src/world`, `src/car` or `scripts/golden`, else `hotfix` |
| `--title "..."` | The release title in the changelog |
| `--change kind:"text"` | One changelog row; kind is `new`, `improved` or `fixed`. At least one is needed |
| `--dir <path>` | Clone here instead of a temp folder |

The version must be `x.y.z` and past the one in `package.json`. `src/changelog.ts` may have CRLF or LF line endings; the entry uses whichever the file has.
