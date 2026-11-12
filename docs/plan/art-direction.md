# Art direction

> **Status 2026-11-12 (v0.29.0):** Mostly shipped: smaller smoke, golden-hour sun for dark themes (lighting A), lit cloud tones, a warmer headlight, the reworked HUD and a speed FOV kick are in `render/` and `hud/`. Open: the car outline (#11) and phone FXAA (#12). The other items were not rechecked one by one. The screenshots sit in a local scratchpad, not in the repo.

Round 1, 2026-11-08. Direction only, nothing built. Screenshots (1600x900 and 844x390 @2x; Brand Dark, Brand Light, Warm Sunset, Forest Night) in `C:\Users\Andra\AppData\Local\Temp\claude\7b7af39d18cf6668\bb083546-0056-4804-9143-4bb5fcb02143\scratchpad\shots\`: `{dark,light,sunset,forest}-{1-start,2-drive,3-slide,4-after}.png`, `{dark,light}-phone-1-start.png`.

## Direction in 5 lines

1. Keep it as it is: flat-shaded facets, a brand-token palette, dusk for dark themes and day for light. The owner liked this look, so it evolves and is not replaced.
2. Every scene is built in value steps. The sky is brightest, then road markings and the car, then grass, then trees, then asphalt. Lit faces and shaded faces sit at least ~0.08 L apart.
3. The car is the brightest solid object on screen. Nothing else in the world uses its paint hue at full chroma.
4. Effects are small and short. They show state (sliding, off-road) and never hide the car or the road.
5. The HUD reads as webos chrome: surfaces from the ladder, Inter for labels, Hack (mono) for numbers, semibold rather than heavy weights, one main readout.

## What the screenshots show (worst first)

- **Smoke** (`dark-3-slide`, `sunset-3-slide`, `light-3-slide`): puffs grow into metre-wide grey icosahedra. They read as boulders, fill the bottom third of the screen during a slide, and hide the skid marks. This is also the largest overdraw cost in the frame (420 alpha instances, `depthWrite: false`).
- **Value collapse at dusk** (`sunset-2`, `forest-2`): asphalt, grass and tree crowns all land at L ≈ 0.18–0.28. The road only reads through its edge lines, and forests turn to mush.
- **Car vs world** (`dark-1`, `forest-2`): `car_paints[0]` is `primary`. In Brand Dark that is the same hue as the grass and the `cottontail` edge lines, so the car sinks in. The dark glass also merges with the asphalt.
- **Edge lines**: `cottontail` is the brightest, most saturated thing on screen in every dark theme. It pulls the eye away from the car and the gate.
- **Headlight** (`dark-4-after`): `tones.head = cottontail` throws a lime cone onto the grass.
- **Clouds**: flat brown slabs that are darker than the sky behind them at dusk, so they read as mud rather than lit cloud.
- **HUD hierarchy**: the top-left panel puts lobby actions (invite, private room, race, theme) above the lap time. Help text sits there permanently as an 11.5px paragraph. The minimap panel is 228x270 for a 120px track. Speed is Inter 800 at 52px, while webos sets values in Hack, semibold.
- **Light HUD**: panels use `background_darkest` (saturated tan) at 78%, which reads muddy. The webos rule is that Brand Light uses its page shade, and tan is for small things only.
- **Phone** (`dark-phone-1`): the speedo sits over the car's tail. The top-left panel takes about 35% of the screen. At render ratio 0.85 with no AA, jaggies show on the edge lines. `drag to steer` disappears on light grass.
- **Loading screen**: not caught on desktop. It was gone before 250 ms. It is a bare mark plus `Building island…` in 800 weight with no progress shown.

## Do with P2 (ranked)

Colour mixes follow `palette.mix(a, b, share)`: `share` is the amount of `a`, so `mix(foreground, asphalt, .7)` is 70% foreground.

| # | What | File / owner | Tokens | Perf | Size |
|---|------|--------------|--------|------|------|
| 1 | Smoke: cap scale at ~0.5× today's (`0.4 + t*1.2`), life 1.0 s, material opacity 0.35. Tint road smoke from `FOG` mixed 50% with `foreground`, so it sits in the atmosphere. Dust and grass puffs at 0.25 size. | `effects.ts` (free; no coder on it) | `mix(sky FOG, foreground, .5)`; dust `mix(warning, background, .3)` kept | Fill drops ~4–6× during slides; same 1 draw | S |
| 2 | Lighting mood for dark themes: **see variations A/B/C below** | `main.ts` lights, `sky.ts` | — | 0 draws | S |
| 3 | Dusk value ladder: asphalt `background_dark` → `background_darkest`; grass up +0.04 L; tree crowns `leaf_dark` pushed 0.06 L under grass; edge line `mix(foreground, asphalt, .7)`; `cottontail` only on markers (lit gate, posts, checkpoint) | `palette.ts` `tones` (shared, tell world/scene coders) | as listed | 0 | S |
| 4 | Car pops: player paint drawn from the tokens farthest in hue from `success` (grass) and `cottontail`. Dark themes only: paint L +0.06 through `lighten()`, glass `mix(sky_tones.upper, background_darkest, .3)` so it reflects some sky | `palette.ts` `car_paints`, `models.ts` (cars coder) | `secondary`/`accent`/`info` first; `primary` last | 0 | S |
| 5 | Headlight tone `mix(cottontail, foreground, .3)`; cone intensity −30% | `palette.ts` `tones.head`, `main.ts:70` | as listed | 0 | S |
| 6 | HUD layout: **see variations A/B/C below** | `hud.ts`, `style.css`, `index.html` (HUD coder) | ladder only | DOM only | M |
| 7 | Light HUD surfaces `light-dark(background_darkest, background_lighter)` at 85%; speed ink `primary`, not `cottontail` (brand rule: no brand colour on near-white, and keep enough contrast) | `style.css` | `background_lighter`, `primary` | 0 | S |
| 8 | Loading screen: `desktop` surface (Brand Light: `background`) with the webos glow two shades up; mark in `primary`; `Building island` in Inter 600 14px at `foreground/80`; step line in Hack 11px (`terrain · roads · towns`); 300 ms fade on first frame | `index.html`, `style.css`, `main.ts` | `primary`, `foreground` | 0 | S |

### Lighting variations (item 2): dark themes only, light stays day

- **A. Golden hour (recommended).** Raise the sun from y 0.17 to 0.24. Sun 3.3 → 4.0. Hemisphere 1.9 → 1.3, ground colour `background_darkest`. This splits lit and shaded faces about 0.1 L apart, which lets the facets carry the low-poly look. Clouds take `emissiveIntensity` 0.08 → 0.35 toward `cloud_lit`. Fog near 180 → 120. Closest to today and keeps the owner's "looking great".
- **B. Blue hour.** Sun just under the horizon. The key light becomes `skylight` (`secondary`-led, cool) at 2.2, and `horizon_sun` is the only warm band. Headlights, posts and the lit gate carry the scene (bloom tier already exists). Moodier, but the car's silhouette depends on the headlight, and phones without bloom lose the glow.
- **C. Rim key.** Keep today's sun. Add a second, weak directional light from behind the camera, `foreground` at 0.6, with no shadow. Faces toward the camera lift, so the car and road read without changing the mood. Cost: one extra light in every lit shader (cheap). Least atmospheric.

### HUD variations (item 6): all on the webos ladder, `rounded-xl` panels, Hack for values

- **A. Race strip (recommended).** Top centre: one pill with lap time (Hack 20px semibold), gate `3/12`, best, and the delta beside it. Top left: a logo button that opens a webos-style menu (invite, private room, race and laps, theme, help) on `background_lighter`. Top right: minimap with no panel, track stroke 2px `foreground/65`, you in `primary`. Bottom right: speed in Hack 44px semibold, gear in a chip. Help appears only on `H`. Phone: the speedo moves to bottom centre above the pedal line, the strip shrinks to the lap time, and nothing covers the car.
- **B. Cluster.** Every live number goes in one bottom-centre cluster: speed, gear, rpm arc, lap and delta. Corners hold only the menu and the minimap. Strongest focus, but at 844x390 it fights with the car and the pedals.
- **C. Webos window.** Keep the four corners and restyle them only: ladder surfaces, mono values, help folded away. Smallest change, but the hierarchy problem stays.

## P3 polish

| # | What | File | Tokens | Perf | Size |
|---|------|------|--------|------|------|
| 9 | Skid marks visible at dusk once asphalt drops (item 3): skid `mix(error, background_darkest, .1)` at 0.6, fade the oldest 20% of the ring buffer | `effects.ts` | `background_darkest`, `error` | 0 | S |
| 10 | Aerial perspective: distant terrain picks up `FOG` earlier on phones (fog far 700 hides the pop-in) and hills read as layered silhouettes | `main.ts` fog, `quality.ts` | `FOG` | 0 | S |
| 11 | Car outline (inverted hull, `background_darkest`, 2 cm): toon edge, readable over any ground | `models.ts` | `background_darkest` | +1 draw per car (remotes +16) | M |
| 12 | Phone AA: at ratio 0.85, use FXAA on the final pass instead of no AA, or drop to 0.75 and add FXAA | `quality.ts`, `main.ts` | — | 1 full-screen pass, cheap | M |
| 13 | Clouds: 2 shades per puff (bottom `cloud`, top `cloud_lit`) through vertex colours instead of one tint per puff | `sky.ts` | `sky_tones` | 0 | S |
| 14 | Speed lines or slight FOV kick above 150 km/h (motion shows state) | `camera.ts` | — | 0 | S |
| 15 | Kerbs: keep `accent`/`foreground` stripes but never touch the `cottontail` edge line (gap of asphalt; brand colours never touch) | `world.ts` (world coder) | — | 0 | S |

## Not checked

Real phone GPU, frame time per change, bloom on and off side by side, remote cars and ghosts, towns (in flight), the loading screen at real load time, and the other 20 themes beyond the four above.
