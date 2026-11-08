# Minigames and the parking port
**Date:** 2026-11-08 · research brainstorm, nothing decided

Owner brief: "simple car game, really realistic but arcade (likes current feel), performant web game". Inputs: webos Drive Hub docs (`docs/apps/tight-spot.md`, `docs/apps/drive-hub-games.md`, ADR-087, ADR-089, `docs/brainstorm/2026-11-07_drive-hub-progression.md`), `tight-spot/games/parking/game.svelte`, and open-road `src/race.ts`, `src/net.ts`, `src/world.ts`, `src/car.ts`.

What open-road already has: one RWD car (wheelbase 2.6 m, lock 0.62 rad, so a rear-axle turning radius of about 3.6 m), a 4.1 km road loop with 12 gates, `Race` splits and a best lap in localStorage, a 10 Hz best-lap ghost, and P2P ghost cars (`net.ts`, client-owned state at 20 Hz, sanitized). Collision is two circles on the car against circle `Solid`s (trees) in `World.collide`. There are no boxes, ramps or car-to-car contact (README: Rapier comes once mesh colliders are needed).

## 1. Parking port (Tight Spot to 3D)

### Transfers as-is (pure 2D geometry and rules)
- **Lot builders.** `core/lot-layout.ts` (`Builder`, `Fit`) plus `games/parking/lots.ts` output polygons on an x/y plane. Map y to z and extrude: walls and pillars become boxes, bays become painted decals. `difficulty` 0..1 lerps every width, so the ladder shape survives.
- **Judging** (`game.ts`, `verdict`, `bay_for`). Parked means every body corner is inside the bay polygon and the heading is within 5° of the bay's, or of its reverse when the bay is `either`. Messages: "Not inside a bay", "Not straight in the bay", "Facing the wrong way". Show them only once the car has been driven.
- **Moves and stars.** A move is a D/R change; the first gear and N/P don't count. Stars: at or under par is 3, par + 2 is 2, anything else is 1. Pars per kind: parallel 2, nose in 0, reverse 1, angled 0, garage 0, pillars 1, narrow 2, door 2, dead end 2, end bay 2, underground 1. Time is the sim clock.
- **Precision.** `100 × (1 − e_s²)(1 − e_d²)(1 − e_a²)`, computed from the side, depth and angle error shares of the room in the bay (angle out of 5°). 95 % or more earns Perfect. It's a footprint calculation, so it works unchanged on the car's ground rectangle.
- **Progression.** The `core/track.ts` pattern: an ordered level list, the next level opening when the one before is done, stars and bests stored per level id, a seeded Random mode, and a daily from `daily_seed(day, app)`.
- **Spot kinds worth porting (car only).** Parallel, nose in, reverse in, angled, pillars, narrow aisle, garage, garage door, dead end, end bay. Drop the bus, rig, trailer and machine kinds, because open-road has one car. Leave the multi-storey for later: it needs ramps, ceilings and portals.

### Changes
- **Contact.** Webos ends the round on any polygon touch. Open-road pushes circles out of circles. Parking needs a car OBB against box obstacles (2D SAT on the ground plane, about 60 lines in `world.ts` beside `collide`). Keep "touch = fail" for the Levels mode. Add an arcade variant that counts scrapes as a penalty instead (+1 move or −10 % precision per scrape, above a speed threshold so a brush at 1 km/h still counts).
- **Parked trigger.** The auto box has no P: it flips to reverse on brake at standstill (`car.ts:213`). Use this rule instead: speed under 0.2 m/s with the handbrake held for 0.6 s, or a dedicated Park key. Moves come from `car.gear` sign changes.
- **Camera and aids.** The chase cam is wrong for bays. Add a high orbit/top camera on C, port the parking sensors (`core/sensors.ts`, distance beeps), and draw the bay outline plus a ground arrow. This is the biggest UX change.
- **Low-speed feel.** Pacejka tyres at 1-3 km/h may creep or jitter. Add a `scripts/feel.ts` scenario first: full lock at 2 km/h should trace a 3.6 m radius ±5 %. If it fails, blend to the kinematic bicycle model under 1.5 m/s. That keeps the "realistic but arcade" feel.
- **Proof.** Webos proves every spot with a kinematic hybrid A* (`core/planner.ts`). The 3D car slips, so that proof doesn't transfer exactly. Port the planner fed with open-road's wheelbase and lock, inflate the bodies by 10 cm instead of 5, and cap difficulty below the webos limits. Use "tightest the planner solves" as the 1.0 point, but expect a 0.85 practical ceiling (unverified until playtested).
- **Sizing.** `Fit` scales by turning circle over the hatchback's. Open-road's lock is close to a hatchback, so use ratio 1. Bays must still be at least 2.1 m wide (the rows stop placing askew neighbours below that).

### Minimum data from a world generator
```ts
interface ParkingLot {
  id: string;                    // stable, keys stars/bests
  kind: LotKind; seed: number; difficulty: number; par: number;
  origin: { x: number; z: number; y: number }; // lot centre; terrain flattened to y like the road
  heading: number;               // lot's local +z in world radians
  size: { w: number; d: number };// footprint, 32 m like webos chunks
  entry: { road_index: number; side: -1 | 1; width: number }; // where the access lane meets the loop
  start: { x: number; z: number; heading: number };            // car pose at round start, lot-local
  bays: { x: number; z: number; heading: number; w: number; l: number; either: boolean; target: boolean }[];
  obstacles: { kind: "car" | "wall" | "pillar" | "bollard" | "kerb"; x: number; z: number; heading: number; w: number; l: number; h: number }[];
}
```
Everything is lot-local, so the webos builders fill it directly. The generator only has to place lots along `World.road` (pads offset from road points, flattened exactly as the road flattens terrain at `world.ts:194`) and register the obstacles in the solid grid as boxes.

## 2. Minigame ideas

MP rule for every mode: each client is authoritative for its own car and its own result, as `net.ts` already is. Add one trystero action (`makeAction("event")`) for small typed events such as start, finish, score and tag, sanitized like `CarState`. There is no referee, so the stance is "friends' room":
- plausibility checks reject impossible claims (a lap shorter than gate-path length / 90 m/s, a position jump over 50 m between snapshots);
- results show as "claimed";
- cars stay ghosts, so there is no contact desync.

Start sync: the peer with the lowest `selfId` among those present picks `start_at` in its own clock. Each receiver converts it with its own `Remote.offset`. A 100-200 ms spread is acceptable for 3 s countdowns.

| # | Name | Solo/MP | Loop | World needs | Cost | Fun |
|---|------|---------|------|-------------|------|-----|
| 1 | Tight Spot (parking) | Solo; MP "first parked" in a shared seeded lot | Drive from the start pose into the target bay, fewest moves, best precision | Lots off the loop, box colliders | L | 1 |
| 2 | Lobby race | MP | Leader calls a race, synced countdown, N laps of the loop, finish order from claimed times | Existing loop and gates | S | 2 |
| 3 | Gymkhana (Rodeo port) | Solo + lobby board | Cone slalom, 180° spin box and a stop box against the clock; +2 s per cone | Open flat area; cones are circle `Solid`s, already supported | S-M | 3 |
| 4 | Drift zones | Solo + MP board | Marked road sections score slip angle × speed × time held, a multiplier for chaining | Existing road; slip already in `car.ts` | S | 4 |
| 5 | Ghost duel / async challenge | Async MP | Share a seed and a ghost (URL or room event), beat a friend's lap | Existing `ghost.ts` + `Race` | S | 5 |
| 6 | Gate hunt | Solo / MP | 10 seeded gates across the island, any order, off-road allowed | Open terrain; reuses gate radius check | S | 6 |
| 7 | Hill climb | Solo | Point-to-point up the island peak, off-road gates, a best time per route | Terrain + gate chain; no loop | S | 7 |
| 8 | Tag | MP (3+) | "It" chases; a tag is within 4 m and accepted when tagger and victim views agree within 2 m slack; longest time not-it wins | Whole island | M | 8 |
| 9 | Taxi / delivery | Solo | Pick up at A, drop at B in time; drop-off is a loose stop box (parking judge at 15° and ±1 m) | Lots or stops along the road | M | 9 |
| 10 | Speed trap | Solo + MP board | Radar points on straights record peak km/h; top 3 per trap in room | Road straights | S | 10 |
| 11 | Driving test (ADR-089 port) | Solo | Route prompts, give-way and speed faults, pass sheet | A town with lanes, junctions, signs (missing entirely) | L | 11 |
| 12 | Jumps / stunt park | Solo | Distance and air time off ramps | Mesh colliders (Rapier, per README) | L | 12 |

Fun rank is a judgement from the owner's brief (parking is their known love, "realistic arcade" favours drift and gymkhana). It is unverified until the owner ranks it.

## 3. Pass split

- **Pass 1.**
  - Lobby race (2): nearly free and proves the event channel and start sync.
  - Gymkhana (3): reuses circle solids, stars against par time, and introduces the shared level-track module (port `core/track.ts`).
  - Parking groundwork: OBB collision, the lot spec above, judge, moves, stars, precision, top camera, and one kind (nose in) at 3 difficulties.
- **Pass 2.**
  - Full parking ladder: the 10 car kinds, levels, daily, Random, the planner proof and the scrape-penalty arcade variant.
  - Drift zones (4), ghost duel (5), gate hunt (6).
- **Later.**
  - Taxi (9) once lots line the road.
  - Tag (8).
  - Speed trap (10) and hill climb (7) as filler.
  - Driving test (11) only after a town generator exists.
  - Jumps (12) and the multi-storey garage after the Rapier switch.

Risk to check first: the low-speed creep test in `scripts/feel.ts`. If the Pacejka car can't hold a 3.6 m circle at walking pace, parking needs the kinematic blend before anything else.
