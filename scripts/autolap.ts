import { Vector3 } from "three";
import { Car, drop_height } from "../src/car/car";
import { COUPE, car_spec, type CarSpec } from "../src/car/cars";
import { PadTimer } from "../src/world/sky-pads";
import { ROAD_HALF, World, type RoadPoint } from "../src/world/world";
import { SurfaceId } from "../src/worldgen/types";

export const DT = 1 / 360;
/**
 * Laid surfaces a race drives off the road: trail dirt, packed snow (a snowy trail, a frozen fall's pads), and the bare
 * ice of a descent bed. Ice off a route is a frozen lake 20 m past the shoulder, which a run reaches only after counting
 * time off the road already.
 */
const TRACK: readonly SurfaceId[] = [SurfaceId.DIRT, SurfaceId.PACKED_SNOW, SurfaceId.ICE];
const RAMP_LOOK = 120;
// Fastest pace on circuit kickers every seed's lap survives: past it the car lands with too little road left to brake
// for the next bend, having had none in the air.
const JUMP_PACE = 32;
/** Cornering grip and braking the autopilot plans on, well inside every car's limit (m/s²). */
const CORNER_GRIP = 4.5;
const CORNER_BRAKE = 2.5;
const GRAVITY = 9.81;
/** Road points ahead the autopilot reads for bends; past it any car stops from top speed for a hairpin. */
const CORNER_LOOK = 90;
const CORNER_SPAN = 5;
const HAIRPIN_PACE = 15;
/** Share of its cornering and braking plan the autopilot trusts over bare ice, and its top pace on it (m/s), as a driver eases off for it. */
const ICE_PLAN = 0.4;
const ICE_TOP = 25;
/** Slip angle (rad) at which the autopilot is fully off the brake. */
const SLIDE_LET_GO = 0.15;

/** Square of the fastest steady speed round `radius` at `p`: a sky-track bank adds its share of gravity to the grip. */
function corner_speed2(world: World, p: { x: number; y: number; z: number }, radius: number): number {
  const hit = world.deck?.surface(p.x, p.z, p.y + 1);
  const bank = world.deck && hit ? Math.abs(world.deck.at(hit.index, 5)) : 0;
  if (bank === 0) return CORNER_GRIP * radius;
  const mu = CORNER_GRIP / GRAVITY;
  const tan = Math.tan(bank);
  return (GRAVITY * radius * (mu + tan)) / (1 - mu * tan);
}

/** Fastest the car may go now and still slow to every bend's v = sqrt(grip * radius) within the look-ahead. */
function corner_pace(world: World, at: (i: number) => RoadPoint, index: number): number {
  let pace = Infinity;
  for (let k = 0; k < CORNER_LOOK; k += 2) {
    const a = at(index + k - CORNER_SPAN);
    const b = at(index + k);
    const c = at(index + k + CORNER_SPAN);
    const cross = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
    if (cross === 0) continue;
    const radius = (Math.hypot(b.x - a.x, b.z - a.z) * Math.hypot(c.x - b.x, c.z - b.z) * Math.hypot(c.x - a.x, c.z - a.z)) / (2 * cross);
    const plan = world.surface(b.x, b.z) === SurfaceId.ICE ? ICE_PLAN : 1;
    pace = Math.min(pace, Math.sqrt(plan * (corner_speed2(world, b, radius) + 2 * CORNER_BRAKE * k * 2)));
  }
  return pace;
}

export interface Lap {
  t: number;
  index: number;
  offroad: number;
  worst: number;
  slowest: number;
  flipped: boolean;
  /** Dropped off a sky deck, and the hardest rail or wall hit (m/s into it). */
  fell: boolean;
  impact: number;
  /** Speed (m/s) at each circuit kicker's toe, in the order the car reached them. */
  toes: number[];
}

/**
 * Drives `road` from its first point; an open one (a street or offroad route) ends at its last point instead of wrapping.
 * `watch` sees the car after every physics step and ends the drive by returning true; with it the drive goes on until it does (or `limit` seconds run out).
 */
export function autolap(world: World, spec: CarSpec = COUPE, road: readonly RoadPoint[] = world.road, closed = true, watch?: (car: Car) => boolean, limit = 400): Lap {
  const car = new Car(spec);
  const n = road.length;
  const point_at = (i: number) => (closed ? road[((i % n) + n) % n] : road[Math.max(0, Math.min(n - 1, i))]);
  const p = road[0];
  car.place(p.x, world.height(p.x, p.z) + drop_height(spec, 0.75), p.z, Math.atan2(p.tx, p.tz));
  const pads = new PadTimer();
  let t = 0, index = 0, offroad = 0, worst = 0, slowest = Infinity, flipped = false, fell = false, impact = 0;
  const step = road.reduce((sum, p, i) => sum + Math.hypot(road[(i + 1) % n].x - p.x, road[(i + 1) % n].z - p.z), 0) / n;
  // Each circuit kicker by its spot along the road: a box around the ramp axis only catches a car that is already lined up
  // with it, which on a bent run-up is too late to brake without turning, and the car took off still yawing.
  const kickers = world.ramps.filter((r) => r.road).map((r) => {
    let at = 0;
    for (let i = 1; i < n; i++) if ((road[i].x - r.x) ** 2 + (road[i].z - r.z) ** 2 < (road[at].x - r.x) ** 2 + (road[at].z - r.z) ** 2) at = i;
    return { ramp: r, at };
  }).filter(({ ramp, at }) => Math.hypot(road[at].x - ramp.x, road[at].z - ramp.z) < ROAD_HALF);
  const toes: number[] = [];
  const behind = kickers.map(() => true);
  const end = watch ? Infinity : n - 10;
  while (t < limit && index < end) {
    for (let k = index; k < index + 60 && (closed || k < n); k++) {
      const q = point_at(k);
      if ((q.x - car.pos.x) ** 2 + (q.z - car.pos.z) ** 2 < 100) index = Math.max(index, k);
    }
    const speed = car.vel.length();
    const pace = corner_pace(world, point_at, index);
    // `index` already runs up to 10 m ahead of the car; in a hairpin a longer aim point cuts across the inside.
    const ahead = point_at(index + (pace < HAIRPIN_PACE ? 0 : 6) + Math.floor(speed / 3));
    const want = Math.atan2(ahead.x - car.pos.x, ahead.z - car.pos.z);
    const err = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading));
    const far = point_at(index + 40);
    const here = point_at(index);
    const curve = Math.abs(Math.atan2(Math.sin(Math.atan2(far.tx, far.tz) - Math.atan2(here.tx, here.tz)), 1));
    // Takes a kicker on the circuit at JUMP_PACE and holds the wheel straight in the air, as a driver would.
    const jump = kickers.find(({ ramp, at }) => {
      const along = ((((at - index) % n) + n + n / 2) % n) - n / 2;
      return along * step < RAMP_LOOK && -along * step < ramp.length + ramp.landing;
    });
    const airborne = car.wheels.every((w) => !w.contact);
    // A driver comes off the brake once the tail steps out: braking on through a slide spins a light-tailed car downhill.
    const slide = speed > 5 ? Math.abs(Math.atan2(Math.sin(Math.atan2(car.vel.x, car.vel.z) - car.heading), Math.cos(Math.atan2(car.vel.x, car.vel.z) - car.heading))) : 0;
    const ease = Math.max(0, 1 - slide / SLIDE_LET_GO);
    const target = Math.min(jump ? JUMP_PACE : Infinity, curve > 0.5 ? 20 : curve > 0.25 ? 30 : 42, pace, world.surface(car.pos.x, car.pos.z) === SurfaceId.ICE ? ICE_TOP : Infinity);
    car.step(DT, { steer: airborne ? 0 : Math.max(-1, Math.min(1, -err * 3)), throttle: speed < target ? 1 : 0, brake: speed > target + (pace <= target ? 1 : 4) ? Math.min(0.5, (speed - target) / 10) * Math.max(0.2, 1 - Math.abs(err) * 4) * ease : 0, handbrake: 0, analog: true }, world);
    pads.step(DT, car, world);
    impact = Math.max(impact, world.collide(car));
    if (watch?.(car)) break;
    kickers.forEach(({ ramp }, k) => {
      const along = (car.pos.x - ramp.x) * ramp.fx + (car.pos.z - ramp.z) * ramp.fz;
      const across = Math.abs((car.pos.x - ramp.x) * ramp.fz - (car.pos.z - ramp.z) * ramp.fx);
      if (behind[k] && along >= 0 && along < 5 && across < ramp.hw + 2) toes.push(car.vel.length());
      behind[k] = along < 0;
    });
    t += DT;
    const d = world.distance_to_road(car.pos.x, car.pos.z);
    worst = Math.max(worst, d);
    if (d > 7 && !TRACK.includes(world.surface(car.pos.x, car.pos.z))) offroad += DT;
    if (t > 5) slowest = Math.min(slowest, speed);
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
    if (new Vector3(0, 1, 0).applyQuaternion(car.quat).y < 0.3) {
      flipped = true;
      break;
    }
    if (world.fallen(car.pos)) {
      fell = true;
      break;
    }
  }
  return { t, index, offroad, worst, slowest, flipped, fell, impact, toes };
}

if (import.meta.main) {
  const t0 = performance.now();
  const world = new World();
  const ys = world.road.map((p) => p.y);
  let grade = 0;
  for (let i = 0; i < world.road.length; i++) grade = Math.max(grade, Math.abs(world.road[(i + 5) % world.road.length].y - world.road[i].y) / 10);
  console.log(`world: ${(performance.now() - t0).toFixed(0)} ms, road ${(world.road.length * 2 / 1000).toFixed(2)} km, height ${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)} m, max grade ${(grade * 100).toFixed(0)}%, trees ${world.trees.length}`);
  const lap = autolap(world, car_spec(process.argv[2] ?? "coupe"));
  if (lap.flipped) console.log(`flipped at t=${lap.t.toFixed(1)} index ${lap.index}`);
  console.log(`autolap: ${lap.t.toFixed(1)} s to index ${lap.index}/${world.road.length}, offroad ${lap.offroad.toFixed(1)} s, worst distance ${lap.worst.toFixed(1)} m, slowest ${(lap.slowest * 3.6).toFixed(0)} km/h`);
}
