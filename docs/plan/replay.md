# Replay viewer

Watch a finished run back: your own car, plus the ghost and the AI field when they were there. Chase and free camera, scrub, speed 0.25x-4x, pause.

## What a run records today

| What | Where | Rate | Kept | Holds |
|---|---|---|---|---|
| Player, circuit lap in free drive | `Ghost.record` (`car/ghost.ts`), called from `main.ts` | 10 Hz (`GHOST_EVERY_MS`) | best lap only, IndexedDB `ghosts` | ms, position, quaternion: 8 numbers (`STRIDE`) |
| Player, ghost duel | same `Ghost`, one per duel level (`modes/duel-mode.ts`) | 10 Hz | best run only, IndexedDB | same |
| Player, every other mode (race, AI race, drift, jump, gymkhana, parking, hunt) | nothing | - | - | - |
| Ghost | the best lap above, or a shipped dev ghost (`career/dev-ghost.ts`) | 10 Hz | already a recording | same; drawn as a stock coupe at coupe ride height |
| AI field | nothing: `SimHost` keeps only each car's pose before the last step (`field_from`) for the draw blend | - | - | - |
| Rewind | `car/rewind.ts`, ring buffer in the sim | every frame | last 10 s | full body state (pos, quat, vel, ang, gear, wheel speeds), nitro, pads, lap clock. Built to restore the sim, not to play back |

So only the ghost lap format is a replay source, and outside the duel a finished run leaves nothing behind.

## Slice 1 (built): your own run

- `replay/run-tape.ts`: `RunTape` records the player's car on every mode run in the ghost lap layout (8 numbers, 10 Hz, same `lap_pose` reader), at the car's own height. `Modes` starts it when a run goes, feeds it stepped time, closes it on the finish. In memory only, until the next run starts. Cap: ten minutes (`lap_cap_ms`).
- The results page gets a Watch replay link beside Restart (absent while the tape has no length).
- `replay/playback.ts`: the clock (pause, seek, speeds 0.25 / 0.5 / 1 / 2 / 4).
- `replay/replay.ts`: each frame it advances the clock, reads the pose from the tape and hands it to `Driver.draw_at`.
- `replay/free-camera.ts`: drag turns, the driving controls fly (throttle / brake along the view, steer sideways), the wheel sets the pace. The camera key swaps chase and free; Escape closes; Space pauses.
- `replay/ReplayBar.svelte`: the overlay, built from `menu/ui` (IconButton, Slider, Button).

### How playback drives the car view without physics

The sim is not touched. While a replay is open the frame is a `HOLD` (as under the garage), so the real car stays where it finished and nothing steps. After `driver.draw` has drawn the held car, `Driver.draw_at(pose, roll)` overwrites what was drawn: `drawn` (what the chase camera follows), the view's root, the wheels' spin, the stand on the drawn ground and the contact shadow. The pose is `lap_pose` on the tape; velocity is the pose 50 ms earlier differenced (the chase camera's zoom, FOV and tilt read it); wheel spin is the distance moved along the nose over the wheel radius. The light and the mainland's chunk streaming follow the replayed car, or the camera when it flies free. Closing snaps the chase camera back to the real car and the result card returns.

This is not the review's `?replay=` way (`FrameKind.FREE` and writing the sim car's pose): that moves the real car, so lap clocks, fall and stuck resets and mode logic would all see it, and it cannot work with the sim in a worker, whose replies overwrite the mirror.

No per-frame allocation: `lap_pose` now writes its span into one object instead of a new tuple; the replay reuses its vectors; the bar's clock is written in 100 ms steps so only a new step wakes the component.

### Not in slice 1

- Wheels spin but do not steer; brake lamps, nitro flame, smoke and skid marks do not replay. None of that is on the tape.
- Engine sound idles (the sim holds).
- A scrub on the streamed mainland lands before its chunks do: the car stands on stand-in ground for a moment.
- The tape ends at the finish line, not a few seconds after.

A reset or a fall put back mid-run is a cut, not a slide: the tape takes a second frame at the last one's time (two poses farther apart than 150 m/s allows), `lap_pose` has nothing to blend across it, and the chase camera snaps as on a seek. Same layout, still a valid lap.

## Slice 2 (built): the AI field

Option A of the gate below: no new format.

- `RunTape.field` holds one more ghost-layout lap per AI car, taken at the same moments as the player's frame, so every lap is on one clock. `FieldView.taped(i)` is the reader: the sim's car once the field has stepped, the grid car before, null for a car knocked out. A knocked-out car's lap stops short, and the replay hides it from one take after its last frame.
- `FieldView.draw_tape(camera, poses, world)` draws each car at the replay's pose in place of the sim's, with the same far and mid views; `update` does nothing until `end_tape`, which puts every car back where the held sim has it. The replay calls it right after `Driver.draw_at`, so the field and the player's car are drawn at the same clock.
- Cars stand as they did on the grid: wheels straight, no brake lamps, neon lit but still. As ghosts do.
- `FieldView` takes its route and the rival's slot on `start`, not in the constructor, so a view can be built with no grid: a saved replay builds its own.
- A dev `?field=` free-drive field is not taped.

## Saved replays (built)

- Save on the replay's bar writes the tape to IndexedDB, store `replays` (`HAREPIN_DB` version 5), through `replay/replay-store.ts`. `replay/saved.ts` is the pure side: `pack_replay` (laps rounded to 3 decimals, as ghosts are), `parse_replay` (any part out of shape: none), `capped`.
- A saved replay holds its name, mode, the map's code and name, the player's build code, the player's lap and each AI car's build code and lap.
- Caps: the newest `MAX_REPLAYS` (6) keep, and together they hold at most `MAX_SAVED_NUMBERS` (1 000 000 numbers, about 8 MB); the oldest go with the save that passes either. One replay over `MAX_REPLAY_NUMBERS` (400 000; a ten minute run with six AI cars is 336 000) does not load.
- Events > Runs > Replays lists them. Watch closes the menu and plays over the open road; a run under way refuses it, a results page is left first. A replay plays only on the map it was driven on: elsewhere its row says so.
- Not built: travelling to a replay's map to watch it, and drawing the car that drove. The player's car in a saved replay is the one fitted now; the saved build code is there for when it is drawn.

## Memory per minute

A frame is 8 doubles = 64 B.

| Tape | Per minute |
|---|---|
| One car, 10 Hz, `number[]` (today) | 38 KB |
| Player + 6 AI cars, 10 Hz | 269 KB |
| Same as `Float32Array` | 134 KB |
| One car, richer frame (16 floats: + steer, wheel speed, 4 suspension reaches, brake, throttle, nitro) at 30 Hz, `Float32Array` | 115 KB |
| Player + 6 AI, richer frame at 30 Hz | 806 KB |

The ten minute cap makes the worst case 0.4 MB for the player and 2.7 MB with a full field at 10 Hz. Saved as JSON rounded to 3 decimals (as ghosts are) a car is about 42 KB a minute.

## What was missing to replay the AI field

Points 1, 2 and 4 are slice 2. Point 3 holds for the field (one clock); a duel ghost is still not in the replay.

1. A recording. Nothing keeps the field's poses. Re-running the field from its seed is not an option: it reacts to the player's car, and which cars coast depends on what was on screen (`Field.seen`), so a re-run does not repeat the race.
2. A draw path. `FieldView.update` reads `sim.field_cars`; playback needs it to take a pose per car instead, as `Driver.draw_at` does for the player, with its far-view and retired handling kept.
3. Time alignment. The run tape's clock is stepped time from the run's go; a duel ghost's is the run's own elapsed time. Both need one zero, so the ghost and the field sit where they were.
4. On the results card of an AI race the field keeps driving after the player finishes; the replay has to hold or hide the live field while it shows the taped one.

## Decisions for the owner (the gate)

Slice 1 reuses the ghost lap layout and adds no saved format, so it was built. Decided since: field tapes are option A (slice 2), and replays are kept on request (the Save button), not per event.

1. **Field and ghost tapes**
   - A, lightest: one more ghost-layout tape per AI car (10 Hz, pose only), recorded in `SimHost` or by `FieldView`'s reader, and the ghost's lap read as is. No new format. Cars slide with fixed front wheels, as ghosts do today. Recommended for slice 2.
   - B: a new packed tape (`Float32Array`, wider frame with steer, wheel speeds, suspension, brake, nitro, 20-30 Hz) for the player and the field. Real wheels, lamps, flame; smoke and skids could run from it. A new recording format, about 3x the memory, and the sim worker's packet would carry or record it.
   - C: record inputs and re-simulate. Rejected: not repeatable (see above), and a scrub would cost a re-run from the start.
2. **Keeping replays.** Today the tape dies with the next run. Saving the last run or the best run per event to IndexedDB is a new store: only if wanted.
3. **Where it opens from.** The lobby race's result panel and the free-drive circuit lap have no card with a button yet; the UI rebuild decides.
