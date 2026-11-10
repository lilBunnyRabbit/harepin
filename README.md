# Harepin

Browser open-world driving MVP. Vite + Three.js, custom car sim, P2P multiplayer, no server.

```sh
bun install
bun run dev                # http://localhost:5173
bun run telemetry          # 0-100, top speed, braking, skidpad
bun scripts/feel.ts        # handling scenarios: step steer, lift-off, power-on, handbrake, trail brake, slopes
bun scripts/autolap.ts     # autopilot lap of the island road
bun run build              # static dist/, deploy anywhere (Vercel, Cloudflare Pages)
```

URL params: `?room=friends` (default `lobby`), `?name=Ana`, `?paint=0..6`, `?theme=Brand%20Light`, `?quality=low` (no bloom, 1x pixel ratio). Quality also steps down on its own when frames run under 45 fps.

Controls: WASD/arrows, Space handbrake, R reset, Backspace rewind (10 s), C camera, G best-lap ghost, H help, Q/E manual shift, M auto, 1/2/3 toggle TCS/ABS/assist. Gamepad: RT/LT, stick, A handbrake, X rewind, Y reset, LB/RB shift.

## Hosting

Static site, no server. Vercel: import the repo (framework Vite, build `bun run build`, output `dist`) or run `bunx vercel` in this folder. Cloudflare Pages: same build command and output. WebRTC signalling uses public Nostr relays, so nothing else to deploy.

Peer data is untrusted: `net.ts` takes the sender id from the WebRTC peer, shape-checks and clamps every field, rate-limits each peer and caps the lobby at 16 remote cars.

## Layout

- `src/car/car.ts`: the sim. Rigid body at 360 Hz, raycast suspension + anti-roll bars, normalised Pacejka tyres with combined slip, semi-implicit wheel spin, torque curve, 6-speed box, RWD, ABS, TCS, and an assist mode that does three things: speed-sensitive grip-limited steering lock, countersteer past 6° of slide, and a yaw damper that only fights yaw growing a slide.
- `src/world/world.ts`: 2 km procedural island heightfield (4 m grid), 4.1 km road loop flattened into it, 12 gates, ~4.7k trees.
- `src/render/scene.ts`, `src/car/models.ts`, `src/render/sky.ts`, `src/render/effects.ts`: terrain/road/trees, car/gates/curbs/posts, dusk sky + clouds, tyre smoke/dust + skid marks.
- `src/render/camera.ts`: chase cam that leads into slides, pulls back under acceleration, shakes off-road and on impacts.
- `src/net/net.ts`, `src/net/remotes.ts`: each client owns its car and broadcasts at 20 Hz from a timer; remotes drawn 110 ms behind, interpolated. Transport: trystero (WebRTC, signalling over public Nostr relays, ~10-30 s to find a peer) plus BroadcastChannel for same-browser tabs. Cars are ghosts.
- `src/theme/theme.ts`, `src/theme/palette.ts`: the webos theme presets (mirrored from webos `themes.ts`), applied as the same CSS custom properties webos uses (`--background`, `--primary`, …). The HUD styles from those vars; the 3D scene reads each resolved token back through a probe + 1px canvas, so relative-colour presets work too. Dark themes render dusk, light themes daytime. Theme picker in the HUD, saved in localStorage.
- `src/car/ghost.ts`: records each lap at 10 Hz, replays your best lap as a translucent car.

## Why no physics engine

Feel lives in the tyre/drivetrain/assist layer, which no web engine provides; their vehicle controllers would be replaced anyway. What remains (one rigid body, 4 raycasts on a heightfield) is ~150 lines, runs headless in Bun for the scenario scripts, and keeps the bundle at ~190 KB gzipped instead of +1-3 MB WASM. Switch the chassis and collisions to Rapier once the world needs mesh colliders (ramps, bridges, rails, props) or car-to-car contact; the tyre code stays and just feeds it forces.

## Known limits

- P2P can't stop cheating; lap times are client-reported.
- No TURN relay: some NATs won't connect.
- Trees and gate posts collide against a two-circle car (nose and tail); reflector posts and curbs don't.
- Whole island is one mesh, no streaming; fine at 2 km.
