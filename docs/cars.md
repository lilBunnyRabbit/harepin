# Car viewer

A hidden page for reviewing car models: the real car models on a plain stage, orbit round them, write notes per build, pin spots on the body, then copy one text block back to the lead. No world, no physics, no HUD. Code: `src/viewer/`.

## Open it

`/?cars` works on the live site and in dev, with no menu entry. A link can hold a whole view:

```
?cars=<car>&p=<preset>&b=<build code>&cam=<yaw,pitch,dist,tx,ty,tz,fov>&steer=<-1..1>&light=day|dusk[&pin=x,y,z,n][&shot]
```

| Param | Meaning |
|---|---|
| `cars` | car id; a bare `?cars` opens the hatch |
| `p` | viewer preset id: `stock`, `aero1`-`aero4` (Lip, Wing, Street kit, Race kit), `mid`, `max`, `preset-<name>` (the shipped presets in `car/presets.ts`) |
| `b` | build code, paint included; it wins over `p` for what is drawn, so an old link keeps its picture after a preset changes |
| `cam` | degrees: yaw is the bearing from the nose (0 front, 90 left side, 180 rear), pitch the elevation; metres: distance and target; fov degrees (defaults to 30) |
| `steer` | share of the build's steering lock, positive right; front wheels turn with Ackermann as in the sim |
| `light` | `day` or `dusk`: the page reloads once in Brand Light or Brand Dark, since the palette is read once per load |
| `pin` | a pin to draw: car-local point and its number |
| `shot` | no UI, for headless pictures |

The URL bar always holds the current view, so a copied address opens the same picture. `<html data-cars="ready">` marks a drawn frame.

## Controls

Drag orbits, right drag or shift drag pans, wheel or pinch zooms, two fingers pan. Front, 3/4, Side, Rear, Top and Low snap the camera; Reset also straightens the wheels; Spin turns the camera round the car. Pad: left stick orbits, right stick zooms, LB/RB step through the snaps, Y resets, X spins.

Pin, then tap the car: the pin lands on the hit point in car-local metres and the note box names it. Save note keeps the text, the pin and the whole view (camera, build, steer, light). Tapping a note flies back to that view; a note written in the other light reloads into it.

## Storage

`localStorage` under `harepin.cars.notes`: per `car/preset`, a list of `{ text, pin, view }`. Checked on load (`notes.ts`): a note whose view, build code or pin does not check out is dropped, the rest kept.

## The export block

Copy all, or Copy <car> for one car's presets:

```
#cars v0.42.2 2026-11-14T10:02Z 1440x900
#car sturm aero4 2 notes
 c 1 sturm.4.0.4.1.0 cam=35,14,7.5,0,0.6,0,30 steer=0.6 light=dusk pin=0.9,0.55,1.3
 n "front arch lip"
 c - sturm.4.0.4.1.0 cam=150,18,8,0,0.6,0,30 steer=0 light=day
 n "wing"
#end 1 preset 2 notes
```

| Line | Fields |
|---|---|
| `#cars` | game version, UTC time, viewport |
| `#car` | car, preset id, note count |
| ` c` | pin number (`-` for a note without one), build code, `cam=` as in the URL, `steer=`, `light=`, `pin=` car-local x,y,z |
| ` n` | the note, JSON-quoted |

`read_block` (`export.ts`) reads it back, forgiving of CRLF and text around it; `export.test.ts` holds the round trip.

## Shots from a block

```sh
node --experimental-strip-types scripts/car-view.ts <block.txt | -> [--out <dir>] [--screen desktop|phone] [--ui] [--port N]
```

One PNG per note at the view it was written at, its pin drawn, plus `notes.txt` naming each file and its note. Without `--port` it builds and serves its own preview; `--ui` keeps the panel.
