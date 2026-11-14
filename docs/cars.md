# Car and asset viewer

A hidden page for reviewing models: the real car models, their parts and the world's assets on a plain stage, orbit round them, write notes per asset, pin spots on it, then copy one text block back to the lead. No world, no physics, no HUD. Code: `src/viewer/`.

## What it shows

One registry, `ASSETS` in `viewer/assets.ts` (label, group, seeded), with how each kind is listed and drawn in `ASSET_LOOKS` (`viewer/asset-looks.ts`). Every kind is drawn by the game's own builders, never a copy:

| Asset | Group | Drawn by |
|---|---|---|
| `car` | car | `build_view`, as before |
| `wheel` | part | the build's own left wheels off `build_view`: rim (stock, or the kit's rim on a kit), tyre, brake and camber as the build fits them, at their mounts. Tyres and Brakes pick the slot |
| `wing` | part | `rear_wing` for the build's aero level |
| `aero` | part | `aero_parts`: front lip or splitter, the kit's skirt band, diffuser |
| `arches` | part | `flares`: the arch lips or the kit's arches |
| `mirror` | part | `Design.mirror` of the fitted design (the kit's on a kit): housing in paint, arm or stalk and glass face in trim |
| `building` | world | a building of the generated world, through `town_builders` and the town materials: terraces, houses, clock towers, plain blocks |
| `ground` | world | a market square (stalls, benches, paving) or a garden wall lot, through `town_builders` |
| `ramp` | world | a jump ramp of the generated world, through `JumpsView` |
| `tree` | world | one tree of a kind the world's recipe grows, from its tree kit (green or charred) |
| `prop` | world | a landmark or scattered prop of the world's recipe, through `landmark_mesh` and `LandmarksView` |
| `piece` | world | a world kit piece (`kit_sample`) |

A part keeps the car-local frame: pins and cameras land on the same spot with On car pressed, which draws the whole car carrying it. A world asset is moved to the stage centre with its front to yaw 0. A seeded one (building, ground, ramp) comes out of `generate_world(seed, kind)`, so a seed and an item index pick the same thing on every machine until the kind's version moves; the item list holds the first few of each look.

Adding a kind: a key in `ASSETS`, its look in `ASSET_LOOKS` (the mapped type rejects a missing one), and a part kind or world kind union member in `assets.ts`.

## Open it

`/?cars` works on the live site and in dev, with no menu entry. A link can hold a whole view:

```
?cars=<car>&p=<preset>&b=<build code>&cam=<yaw,pitch,dist,tx,ty,tz,fov>&steer=<-1..1>&light=day|dusk[&a=<asset>[&on=1|&w=<world>&i=<item>&s=<seed>]][&pin=x,y,z,n][&shot]
```

| Param | Meaning |
|---|---|
| `cars` | car id; a bare `?cars` opens the hatch |
| `p` | viewer preset id: `stock`, `aero1`-`aero4` (Lip, Wing, Street kit, Race kit), `mid`, `max`, `preset-<name>` (the shipped presets in `car/presets.ts`) |
| `b` | build code, paint included; it wins over `p` for what is drawn, so an old link keeps its picture after a preset changes |
| `cam` | degrees: yaw is the bearing from the nose (0 front, 90 left side, 180 rear), pitch the elevation; metres: distance and target; fov degrees (defaults to 30) |
| `steer` | share of the build's steering lock, positive right; front wheels turn with Ackermann as in the sim |
| `light` | `day` or `dusk`: the page reloads once in Brand Light or Brand Dark, since the palette is read once per load |
| `a` | asset kind other than the car; a part takes `on=1` to stand on its car |
| `w`, `i`, `s` | a world asset's world kind, item (`b12` building, `l40` lot, `r3` ramp, or a name: `pine`, `lighthouse`, `basalt`) and seed (0 when the kind is seedless) |
| `pin` | a pin to draw: the asset's local point and its number |
| `shot` | no UI, for headless pictures |

The URL bar always holds the current view, so a copied address opens the same picture. `<html data-cars="ready">` marks a drawn frame.

## Controls

Drag orbits, right drag or shift drag pans, wheel or pinch zooms, two fingers pan. Front, 3/4, Side, Rear, Top and Low snap the camera; Reset also straightens the wheels; Spin turns the camera round the car. Pad: left stick orbits, right stick zooms, LB/RB step through the snaps, Y resets, X spins.

Pin, then tap the car: the pin lands on the hit point in car-local metres and the note box names it. Save note keeps the text, the pin and the whole view (camera, build, steer, light). Tapping a note flies back to that view; a note written in the other light reloads into it.

## Storage

`localStorage` under `harepin.cars.notes`: per key, a list of `{ text, pin, view }`. A car note keys `car/preset`; an asset note `kind:id/variant@seed` (`wheel:sturm/aero4@0`, `building:mainland/b12@3`). Checked on load (`notes.ts`): a note whose view, build code or pin does not check out is dropped, the rest kept.

## The export block

Copy all, or Copy <car> for one car's presets and parts, or Copy <world> for one world kind's assets:

```
#cars v0.42.2 2026-11-14T10:02Z 1440x900
#car sturm aero4 2 notes
 c 1 sturm.4.0.4.1.0 cam=35,14,7.5,0,0.6,0,30 steer=0.6 light=dusk pin=0.9,0.55,1.3
 n "front arch lip"
 c - sturm.4.0.4.1.0 cam=150,18,8,0,0.6,0,30 steer=0 light=day
 n "wing"
#asset wheel sturm aero4 0 1 note
 c 1 sturm.4.0.4.1.0 cam=60,10,2.2,0.8,0.35,0,30 steer=0 light=day pin=0.8,0.3,1.3 on=1
 n "rim dish too deep"
#asset building mainland b12 3 1 note
 c - - cam=30,14,45,0,8,0,30 steer=0 light=day
 n "clock face floats"
#end 3 presets 4 notes
```

| Line | Fields |
|---|---|
| `#cars` | game version, UTC time, viewport |
| `#car` | car, preset id, note count |
| `#asset` | kind, id (car for a part, world kind for a world asset), variant (preset for a part, item for a world asset), seed, note count |
| ` c` | pin number (`-` for a note without one), build code (`-` for a world asset), `cam=` as in the URL, `steer=`, `light=`, `pin=` local x,y,z, `on=1` for a part shown on its car |
| ` n` | the note, JSON-quoted |

`read_block` (`export.ts`) reads it back, forgiving of CRLF and text around it; `export.test.ts` and `assets.test.ts` hold the round trips.

## Reading the owner's notes

The owner notes a fault once, on the first preset where it shows. A note on a later tier (aero1 → aero4, mid, max) covers only what that tier changed. So:

- A note about a part (wing, lip, arch kit, mirror, exhaust) applies to every car and every tier that carries that part, not only the preset it sits on.
- Faults noted on a lower tier carry forward to the higher ones; the owner does not repeat them.
- "Same issues as already mentioned" means: every fault noted on this car's lower tiers.

After a fix, check the part on every car and tier that has it, not just the noted presets.

## Shots from a block

```sh
node --experimental-strip-types scripts/car-view.ts <block.txt | -> [--out <dir>] [--screen desktop|phone] [--ui] [--port N]
```

One PNG per note at the view it was written at, its pin drawn, plus `notes.txt` naming each file and its note. Asset notes shoot the same way; a file is named by kind, id, variant and seed. Without `--port` it builds and serves its own preview; `--ui` keeps the panel.
