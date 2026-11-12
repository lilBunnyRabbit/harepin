# Open Road: architecture for v2 (seeded open world, towns, car types, chat, mobile, perf)

> **Status 2026-11-12 (v0.29.0):** Shipped. Seeded worldgen in a worker, box solids, chunked meshes with LOD, car specs and builds, chat, touch controls and quality tiers all landed; WASM stayed out, as the verdict says. The flat `src/*.ts` files named below have since moved into feature folders (`src/car/car.ts`, `car/cars.ts`, `car/build.ts`, `car/models.ts`, `car/ghost.ts`, `menu/garage.ts`, `net/net.ts`, `net/chat.ts`, `net/remotes.ts`, `hud/hud.ts`, `hud/input.ts`, `hud/touch.ts`, `render/scene.ts`, `render/quality.ts`, `world/world.ts`, `world/buildings.ts`); see the folder map in `AGENTS.md`. "Open Road" was the working name of Harepin.

Baseline `cb18d62`. Numbers measured headless in Bun on the dev desktop (2026-11-08), scratch bench, not committed.

## Measured baseline

| What | Cost | Notes |
|---|---|---|
| `new World()` | 244 ms cold, 181-220 ms warm | 4764 trees, 4788 solids, 2072 road points |
| of which `raw_height` fbm on 513² | ~170 ms | 3 fbm x 5 octaves + `exp` per vertex; the rest is road stamping + tree scan |
| `terrain_mesh(world)` | 229 ms | per-vertex fbm + `normal()` + OKLab `mix`/`linear`: as slow as gen itself |
| `road_meshes` / `tree_meshes` | 30 ms / 13 ms | |
| Main-thread startup CPU | **~480 ms desktop** | phone 3-5x = 1.5-2.5 s (unverified estimate) |
| `car.step` (1 car, 360 Hz) | **5.0 us/step = 0.03 ms per 60 fps frame** | 0.2% of a 16.7 ms frame |
| `world.collide` | 0.5 us/call | grid hit, 3x3 cells |
| `world.nearest_road` | 10 us | linear scan of 2072 points; fine now, O(n) on a road graph |
| `car_view()` | **22 meshes** | x2 with shadows; ghost + 16 remotes = up to 18 x 22 = ~400 draws |

Draw calls today (counted from code, not `renderer.info`): ~125 main pass (64 of them gates: 12 x 3 + 28 checker tiles) + ~90 shadow pass + ~10 bloom passes. Hot path is **draws and fill rate**, not JS math.

## 1. Seeded world generation

- `src/rng.ts`: `seed_of(room: string): number` (FNV-1a), `mulberry32(seed)`, `sub(seed, "towns")` that gives each stage its own stream, so a new stage never shifts the others.
- Seed = `?seed=` if present, else `seed_of(room)`. Same room gives the same map with no extra protocol. The invite link writes both `room` and `seed`. "New map" = Private room button (already exists).
- `World(seed)`: every fixed fbm/hash seed (3, 7, 11, 41, 55, 91-95) becomes `seed + k`. `seed = 0` must reproduce today's map; that is the acceptance test for the refactor.
- Determinism: `+ - * /` and `floor` are IEEE-exact on every engine. `Math.exp/hypot/sin` are not guaranteed bit-identical (Chrome vs Safari). Heights may differ in the last bit, which is harmless because each client simulates only its own car. Discrete choices (place building? road through cell?) must branch on integer `hash()` or on thresholds with margin, never on a transcendental value that sits right at the threshold.
- `CarState.seed` is sent; a remote with a different seed is dropped and the HUD shows "peer on a different map".

Pipeline (pure functions, run in `src/worldgen/`, each stage reads earlier output only):

```ts
interface Terrain { seed: number; size: number; cell: number; n: number; heights: Float32Array }
interface RoadNode { id: number; x: number; z: number; kind: "junction" | "end" | "town" }
interface RoadEdge { id: number; a: number; b: number; kind: "highway" | "street"; half: number; points: RoadPoint[] }
interface RoadGraph { nodes: RoadNode[]; edges: RoadEdge[] }
interface Town { id: number; x: number; z: number; radius: number; angle: number; name: string }
interface Lot { id: number; town: number; x: number; z: number; w: number; d: number; angle: number; kind: "house" | "shop" | "parking" | "empty" }
interface Building { lot: number; x: number; y: number; z: number; hw: number; hd: number; angle: number; height: number; style: number; roof: number }
interface Prop { x: number; y: number; z: number; angle: number; kind: number; scale: number }
interface WorldData { terrain: Terrain; graph: RoadGraph; towns: Town[]; lots: Lot[]; buildings: Building[]; props: Prop[]; circuit: number[] }
```

1. **terrain**: current `raw_height`, seeded. Optionally grow to 4096 m (4x cells, ~0.7 s desktop gen) only after the worker and chunking exist.
2. **towns**: 3-6 centres by Poisson-disc on land with height 5-60 m and low mean slope. Each town is a rotated street grid (45-70 m blocks), clipped where the slope is too steep.
3. **highways**: MST over towns plus 1-2 extra edges for loops. Route each edge with A* on a 16 m coarse grid (cost = length + slope² penalty, water forbidden). Smooth with the existing `catmull()`, then height-smooth as today.
4. **junctions**: split edges where they cross (segment test), add a node. Reuse the road-height smoothing per edge, pinned at node heights.
5. **stamp**: generalise the existing `road_dist`/`road_height` stamping loop to iterate all edges, with `half` per edge. Lots stamp a flat pad the same way. `grip()`/`roll()` keep working unchanged.
6. **lots/buildings**: walk each street edge, put frontage parcels every 14-22 m on both sides, offset `half + 3`, angle = road tangent. Kind from `hash` and the distance to the town centre. Parking = asphalt pad + parked-car props (static solids).
7. **props**: trees (the existing scan, which also skips lots and pads), street lights, fences.
8. **circuit**: pick a closed cycle in the graph for `race.ts` checkpoints. `world.road` becomes the circuit points, so `race.ts`/`ghost.ts` barely change.

`nearest_road` gets a 32 m grid index over edge points (O(1)). The worker returns `WorldData` with typed arrays as transferables (zero copy; no SharedArrayBuffer, so no COOP/COEP headers).

## 2. Collision: buildings as OBBs

Today: `Solid {x,y,z,radius,height}` circles in a 16 m `Map` grid against two car circles (nose/tail, `CAR_RADIUS` 1.05). Extend it, do not replace it:

```ts
type Solid = { kind: "circle"; x: number; y: number; z: number; radius: number; height: number }
  | { kind: "box"; x: number; y: number; z: number; hw: number; hd: number; cos: number; sin: number; height: number };
```

- Circle vs OBB: rotate the car circle centre into box space, clamp to `[-hw,hw]x[-hd,hd]`, normal = centre - clamped point (centre inside: push out along the axis with least penetration). This yields the same `(nx, nz, depth)` as the circle case. Extract the impulse block of `collide()` into `resolve(nx, nz, depth, offset)` and share it.
- A box goes into every grid cell its AABB overlaps. A per-query `stamp` counter stops a box that spans 2 cells from resolving twice.
- `collide()` takes the car (`collide(car)`), which reads `spec.mass`, `spec.yaw_inertia`, `spec.radius`, `spec.circles` instead of the `CAR_BODY` import.
- Car-to-car and ramps/bridges are still out of scope. When they are needed, that is the Rapier (WASM) switch the README already names.

## 3. Rendering: chunks, LOD, draw budget

- 256 m chunks (8x8 on 2 km). Per chunk: 1 terrain mesh (64² cells), 1 merged road mesh (asphalt + markings as vertex colours, one material, `polygonOffset`), 1 merged building mesh (boxes + roofs, vertex colours). Each chunk gets a real bounding sphere, so Three's frustum culling works; today's whole-island meshes are never culled.
- LOD: chunks past 600 m use a half-res terrain index buffer (same vertex buffer) and hide buildings under 6 m tall. Fog far drops to 1000 m desktop / 700 m mobile, and the camera far plane matches fog.
- Instancing: trees, posts, street lights, parked cars, and remote/ghost wheels as `InstancedMesh` per chunk.
- `car_view` 22 meshes becomes ~6: merge static parts per material (paint, trim, glass, lights) with `mergeGeometries`, plus 4 wheel groups. Remotes 16 x 22 = 352 draws becomes 16 x 6 = 96.
- Gates: merge the 28 checker tiles into one mesh (-27 draws).
- Budget: desktop <= 250 draws main + 120 shadow; mobile <= 120 main, shadow off. Triangles: desktop 1 M, mobile 300 k.
- Terrain colouring: build a `tones -> linear RGB` LUT once instead of OKLab `mix` per vertex. This should take most of the 229 ms (unverified until measured).

## 4. Car types and customization

`src/cars.ts` replaces the constants in `car.ts`. `new Car(spec = COUPE)` keeps `feel.ts`/`telemetry.ts` working. Acceptance: `bun scripts/feel.ts` output for COUPE is byte-identical before and after the refactor.

```ts
interface CarSpec {
  id: string; name: string; mass: number; inertia: [number, number, number]; drive: "rwd" | "fwd" | "awd"; awd_split?: number;
  wheel: { radius: number; rest: number; mounts: [number, number, number][] }; wheelbase: number;
  spring: number; damper: number; bump: number; arb_front: number; arb_rear: number;
  mu: number; rear_grip: number; peak_slip: number; peak_angle: number;
  idle: number; redline: number; upshift: number; downshift: number; gears: number[]; reverse: number; final: number;
  torque: [number, number][]; brake_front: number; brake_rear: number; handbrake: number;
  drag: number; downforce: number; roll_resist: number; circles: [number, number]; radius: number; corners: [number, number, number][];
  body: { length: number; width: number; height: number; style: "hatch" | "coupe" | "muscle" | "rally" };
}
interface Build { car: string; paint: number; decal: number; spoiler: 0 | 1 | 2; suspension: 0 | 1 | 2; engine: 0 | 1 | 2 }
function apply_build(base: CarSpec, build: Build): CarSpec;
```

Starter types: **Hatch** (FWD, 1050 kg, 150 Nm peak, nimble, understeers), **Coupe** (today's car, RWD 1350 kg), **Muscle** (RWD 1650 kg, 600 Nm, soft, wide drifts), **Rally** (AWD 40/60, 1300 kg, +4 cm ride height, best off-road grip multiplier).

What each option changes:
- **spoiler** 0/1/2: `downforce` x1/1.8/2.6, `drag` +0/+0.04/+0.09, `rear_grip` +0/+0.02/+0.04.
- **suspension** soft/sport/race: `spring`/`damper` x0.8/1/1.3, `arb_*` x0.7/1/1.4, `rest` +0.04/0/-0.03.
- **engine** stock/tuned/race: torque curve x1/1.15/1.3, `redline` +0/+300/+600, `mass` +0/+15/+30.
- **paint/decal**: visual only. `paint` stays an index into theme `car_paints`. `decal` indexes a small canvas texture atlas (stripes, number, flames).

Sync: `CarState.b: string`, compact code like `"coupe.3.1.2.1.0"`. `net.ts` validates it against a regex plus whitelists. It rides in every 20 Hz packet (~16 bytes, no separate handshake). `remotes.ts` rebuilds the view when `b` changes. Persist with `localStorage["open-road:build"]` behind try/catch like `HELP_KEY`; `?car=` overrides. Garage = an HTML panel over the paused scene (`src/garage.ts`) with a live `car_view` preview.

## 5. Chat

- `net.ts`: a second trystero action `makeAction<ChatMsg>("chat")` plus the same BroadcastChannel. `type ChatMsg = { text: string; t: number }`; the name comes from the sender's latest `CarState`, never from the message.
- Sanitize: string only, strip `\p{C}`, trim, max 140 chars, drop empty messages. Rate limit: 1 per 800 ms per peer, max 5 per 10 s, extra messages dropped. Render with `textContent` only, never `innerHTML`.
- UI (`src/chat.ts` + markup in `index.html`): bottom-left log of the last 6 lines, each fading after 12 s. Enter/T opens the input, Esc closes it. `Input` must ignore keydown while an input/select has focus (a guard at the top of its keydown handler). Mobile: a chat button in the HUD opens the same input; the on-screen keyboard is fine in landscape.

## 6. Mobile: landscape, touch controls

- Portrait: CSS `@media (orientation: portrait) and (pointer: coarse)` shows a "rotate your device" overlay. On the first tap, try `requestFullscreen()` then `screen.orientation.lock("landscape")` (Android only; iOS ignores it, so the overlay covers iOS). The touch overlay replaces `#notice`.
- Layout: left 45% of the screen is a **floating steer pad**. The touch-down point is the origin, `steer = clamp(dx / 70 px)` with a 6 px deadzone and the same `^1.4` curve as the gamepad, `analog: true`. Right side: tall **throttle** pedal (analog, 0 at the bottom edge to 1 at the top while dragging), **brake** pedal left of it (analog the same way; holding it at standstill reverses via the existing auto logic), **handbrake** button above the brake. Small top-row buttons: rewind (hold), reset, camera, chat. Tilt steering (DeviceOrientation, needs an iOS permission prompt) can come later.
- Pointer Events on an overlay with `touch-action: none`. Track each finger by `pointerId`, call `setPointerCapture`, and release on `lostpointercapture` (it always fires, unlike `pointerup`).
- Hook: `src/touch.ts` exports `class Touch { active; steer; throttle; brake; handbrake; rewind; take_actions(): Action[] }`. `Input` owns `touch = new Touch(root)`, and `read()` merges it after keyboard and pad, the way the pad branch does now: when `touch.active`, steer/throttle/brake/handbrake take the max, `analog = true`, and actions are appended. `rumble()` falls back to `navigator.vibrate` on impacts (Android).
- Mobile perf tier, chosen **before** the renderer is created (`antialias` is fixed at context creation): `pointer: coarse` or `?quality=low` gives `antialias: false`, pixel ratio 1 (0.85 if `adapt_quality` still drops), no bloom, shadow map off (the contact shadow already covers the car), fog far 700, half-res far terrain, trees past 300 m hidden. Desktop tiers: 0 = today, 1 = shadow 1024 + pixel ratio 1, 2 = no bloom/shadows. Toggling `shadowMap.enabled` at runtime needs `material.needsUpdate` on every lit material, so a tier change does a scene traverse.
- Gen on a weak CPU: today ~480 ms desktop main-thread, so a phone is ~2 s blocked (estimate). With towns, plan for 2x. The worker keeps the loading screen animating. Target: interactive in <= 3 s on a mid Android.

## 7. Performance and the WASM verdict

Bottlenecks, ranked: (1) draw calls: car 22 meshes x remotes, 64 gate meshes, shadow pass doubling; (2) fill rate: bloom + PCF 2048 shadow at DPR 1.75; (3) startup: 480 ms blocking main thread, growing with towns; (4) `nearest_road` O(n) on a graph. Physics is not on the list.

Wins in weight order: merge `car_view` and gate meshes; per-chunk meshes for culling; quality tiers; terrain colour LUT; world gen + mesh buffers in one module Worker (`new Worker(new URL("./worldgen/worker.ts", import.meta.url), { type: "module" })`, Vite-native, three works in workers without DOM). The palette probe needs the DOM, so main resolves tones and sends them to the worker as plain RGB.

**WASM verdict: not now, nowhere.**
- Physics: 5 us/step = 0.03 ms/frame. Even 16 locally simulated cars = 0.5 ms. A JS-to-WASM call per step plus copying Vector3 state would eat most of any gain. Do not port `car.ts`.
- World gen: ~400 ms of math on the desktop, a one-off at load. In a Worker it no longer blocks frames. Expected WASM speedup on tight float loops over a JIT is ~1.5-2x (unverified, no benchmark run here). That saves ~1 s on a phone, once, and costs a toolchain (Rust/AssemblyScript), a second language, and a slower headless loop in Bun.
- Revisit only if the measured worker gen on a mid phone is > 3 s **after** the LUT and worker changes. Then port `fbm`/`raw_height` plus stamping (pure Float32Array in and out) to WASM inside the worker. The one real future WASM dependency is Rapier for car-to-car/mesh colliders, and that is a feature need, not a perf one.

## 8. Task breakdown (3 coders, one checkout, disjoint files)

`main.ts` is the only shared hotspot. Coder C owns it; A and B hand C a one-line wiring call in their report and never edit it.

| Coder | Owns (only these files) | Phase 1 (parallel) | Phase 2 | Phase 3 |
|---|---|---|---|---|
| **A: world** | `src/rng.ts`, `src/world.ts`, `src/worldgen/*`, `src/scene.ts`, `src/buildings.ts`, `src/race.ts`, `scripts/gen.ts` | A1 `rng.ts` + `World(seed)`, seed 0 = today's map, gen bench script | A2 road graph, towns, lots, buildings, OBB collision, `circuit` for race, grid `nearest_road` | A3 chunked meshes + LOD + terrain LUT, worldgen Worker |
| **B: cars** | `src/car.ts`, `src/cars.ts`, `src/build.ts`, `src/models.ts`, `src/garage.ts`, `src/remotes.ts`, `src/ghost.ts`, `scripts/feel.ts`, `scripts/telemetry.ts`, `scripts/autolap.ts` | B1 `CarSpec` refactor, `new Car(spec)`, feel.ts output unchanged; merge `car_view` to ~6 meshes + gate tiles | B2 4 types, `apply_build`, decal atlas, garage panel, per-type feel/telemetry runs | B3 remotes rebuild on `b` change |
| **C: net/UI/mobile** | `src/net.ts`, `src/chat.ts`, `src/touch.ts`, `src/input.ts`, `src/hud.ts`, `src/quality.ts`, `src/main.ts`, `index.html`, `src/style.css` | C1 chat (action, sanitize, UI, input focus guard); touch controls + portrait overlay | C2 `seed` + `b` in `CarState`, seed in invite link, quality tiers in `quality.ts` (mobile tier pre-renderer) | C3 wire A3 worker loading + B2 garage into `main.ts` |

Dependencies: A1 and B1 must land before A2/B2. `collide(car)` signature (A2) needs `spec.radius/circles/mass` (B1), so A2 starts after B1 merges. C2 needs the `Build` code format from B1 (agree on the string grammar first; it is just a regex). C3 is last. Each phase ends with `bun run typecheck`, `bun scripts/feel.ts`, `bun scripts/autolap.ts`, and a phone check at landscape 844x390.
