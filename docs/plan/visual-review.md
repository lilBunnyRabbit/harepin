# Visual review: shots without driving

Driving is for handling checks. To see how the game looks, an agent runs one command and reads the pictures. Every shot is deterministic: fixed seeds (career maps), a fixed frame clock, no input. The same build gives the same pictures, so `--diff` lists what a change moved.

## Run it

```sh
hq lock run -- node --experimental-strip-types scripts/shots.ts --out <dir>
```

Node, not Bun: Playwright's browser pipe hangs under Bun. The script builds with `vite build --mode review` into `node_modules/.shots-dist`, serves it on :5397 and drives Chrome (`channel: "chrome"`) headless. It never touches a dev server you have running. Without `--out` it writes to a fresh `harepin-shots-<time>` folder under the OS temp dir, and prints the path of the folder's `index.html`.

| Flag | Does |
|---|---|
| `--only cars\|worlds\|motion` | One group: the showcase sheets, the world viewpoints, or the replays |
| `--diff <old dir>` | After the run, compares every shot with the same file in an older run. Writes `diff.txt` (share of pixels changed, largest first) and puts the list at the top of `index.html` |
| `--maps <code,…>` | World shots on these map codes only (default: every career map, plus the plain map of each land kind no event uses) |
| `--replays <id,…>` | Replays of these career events only (default: every event with a dev ghost) |
| `--port <n>` | Shoot a preview you already serve instead of building one; it must be a `--mode review` build |

Every shot is taken four times: 1440x900 (DPR 1) and 844x390 (phone: touch, DPR 2, so the game picks its mobile quality tier), each in day (`Brand Light`) and dusk (`Brand Dark`). A full run (584 shots) takes about 7.5 minutes.

Typical loop for a visual change: run once on the base commit, make the change, run again with `--diff <first dir>`, and open only the shots the list names.

## What it shoots

Open `index.html`. It has one section per group:

- **cars**: the `?showcase` sheets. `cars` shows every car from four fixed angles, at one scale so sizes compare. `lineup` is the same without the bus, so the cars fill their tiles and their detail reads. `paints` shows every paint, the reward metals included, on the coupe. `decals` shows every car with every decal. `biomes` shows each land kind's trees and props on its ground (snow kinds use snowy crowns). `track` shows the start flags for each tier and locked, plus the gate unlit, lit as next, and the start gate.
- **worlds**: each map from its named viewpoints.
- **motion**: each dev ghost driven under the chase camera, held at 15/40/65/90% of its lap. These show speed readability, fog and streamed scenery at speed.

## The pages behind it

The pages exist only in the dev server and in a `vite build --mode review` build. A production build drops them, so players never download them (`REVIEW_BUILD` in `src/review/params.ts`, tested inline where each one is imported). The same URLs work by hand against `bun run dev` or a review-mode preview:

| URL | Shows |
|---|---|
| `?showcase=<sheet>` | One sheet: `cars`, `lineup`, `paints`, `decals`, `biomes`, `track`. Add `&theme=Brand Light` for day. The page is as tall as its grid, so take a full-page screenshot |
| `?map=<code>&view=<name>` | The world from a viewpoint: `start`, `q1` `q2` `q3` (side-on at the circuit's quarter points), `overlook` (from the highest road, looking out), `shore` (the lowest road, looking at the sea), `town` (the biggest town), `aerial`, `crest`, `bowl` and `rim` (a deck world's steepest bank: up its wall from the low edge, and down into it from over the top). Each is worked out from the world's road, towns and water (`src/review/viewpoints.ts`), so every seed has them without a hand list. A world with no sea or no town has no `shore` or `town` view. A world with no deck has no `bowl` or `rim` view. A road-less world (the dune sea, whose road is its spawn point) has only `start` and `crest`: the first dune 15 m+ tall within 480 m downwind of the spawn, seen from its windward shoulder over the brink and down the slip face. A world with a road has no `crest` |
| `?replay=<event id>&t=<seconds>` | The event's dev ghost driven from 2 s before `t`, held at `t`. Without `t` the lap plays on a loop |

On these pages the HUD and menu are hidden, and the run is solo: an unlisted room that no peer joins. A `#view=<name>` or `#t=<seconds>` hash moves to another shot without reloading. When the shot is drawn, `<html data-review>` reads `view:<name>`, `t:<seconds>` or `sheet:<name>`. It reads `missing:<name>` when there is no such view or ghost. After that the frame loop stops, so a screenshot taken any time later shows exactly that frame.

## Why the pictures repeat

- The frame loop skips frames while the world streams (`Review.waits`). Nothing moves until the chunks around the shot are in, so the worker's timing never changes the result.
- Review pages run on their own frame clock: 1/60 s per frame drawn, whatever the wall clock says. The script also installs Playwright's clock and steps it, and seeds `Math.random` (stars, smoke).
- A shot counts only after some settled frames: 30 for a view, so the car has dropped onto the road and the gates are up, and 2 for a replay, so the chase camera keeps its motion.

Left: GPU rasterisation can move a handful of pixels between runs (well under 0.1%). Treat a diff under ~0.1% as noise.
