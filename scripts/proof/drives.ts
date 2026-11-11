import { Vector3 } from "three";
import { Car } from "../../src/car/car";
import type { CarSpec } from "../../src/car/cars";
import { min_radius, World } from "../../src/world/world";
import { spur_edges } from "../../src/worldgen/graph";
import { GAP_FAST, GAP_SLOW, twistiness, twisty } from "../../src/worldgen/sky";
import type { RoadPoint } from "../../src/worldgen/types";
import { autolap } from "../autolap";

const DT = 1 / 360;
const LIMIT = 200;
/** Rail hits slower than this are scrapes; faster ones count as a crash. */
const IMPACT = 8;

interface Drive {
  done: boolean;
  t: number;
  offroad: number;
  worst: number;
  flipped: boolean;
}

export interface Outcome {
  clean: boolean;
  text: string;
}

function drive(world: World, points: RoadPoint[], spec: CarSpec): Drive {
  const car = new Car(spec);
  const p = points[1];
  car.place(p.x, world.height(p.x, p.z) + 0.75, p.z, Math.atan2(p.tx, p.tz));
  const last = points.length - 1;
  let t = 0, index = 1, offroad = 0, worst = 0;
  while (t < LIMIT && index < last - 3) {
    for (let k = index; k < Math.min(last, index + 40); k++) {
      const q = points[k];
      if ((q.x - car.pos.x) ** 2 + (q.z - car.pos.z) ** 2 < 64) index = Math.max(index, k);
    }
    const speed = car.vel.length();
    const ahead = points[Math.min(last, index + 4 + Math.floor(speed / 4))];
    const want = Math.atan2(ahead.x - car.pos.x, ahead.z - car.pos.z);
    const err = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading));
    const far = points[Math.min(last, index + 20)];
    const here = points[index];
    const curve = Math.abs(Math.atan2(Math.sin(Math.atan2(far.tx, far.tz) - Math.atan2(here.tx, here.tz)), 1));
    const target = curve > 0.6 ? 11 : curve > 0.3 ? 17 : 25;
    car.step(DT, { steer: Math.max(-1, Math.min(1, -err * 3)), throttle: speed < target ? 1 : 0, brake: speed > target + 3 ? 0.8 : 0, handbrake: 0, analog: true }, world);
    world.collide(car);
    t += DT;
    const d = world.distance_to_road(car.pos.x, car.pos.z);
    worst = Math.max(worst, d);
    if (d > 7) offroad += DT;
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
    if (new Vector3(0, 1, 0).applyQuaternion(car.quat).y < 0.3) return { done: false, t, offroad, worst, flipped: true };
  }
  return { done: index >= last - 3, t, offroad, worst, flipped: false };
}

// An edge a route races (the volcano descent) is driven by races.ts with the full autopilot; this crude driver is fitted to town spurs.
function raced(world: World, points: readonly RoadPoint[]): boolean {
  const [a, b] = [points[0], points[points.length - 1]];
  return world.routes.some((r) => !r.closed && r.points.length === points.length && r.points[0].x === a.x && r.points[0].z === a.z && r.points[r.points.length - 1].x === b.x && r.points[r.points.length - 1].z === b.z);
}

export function drive_spurs(world: World, spec: CarSpec): Outcome[] {
  return spur_edges(world.graph, world.circuit).filter((edge) => !raced(world, edge.points)).map((edge) => {
    const run = drive(world, edge.points, spec);
    return {
      clean: run.done && !run.flipped && run.offroad < 0.5,
      text: `spur ${edge.id}: ${run.done ? "reached the ring" : run.flipped ? "flipped" : "stuck"} in ${run.t.toFixed(1)} s, offroad ${run.offroad.toFixed(1)} s, worst ${run.worst.toFixed(1)} m`,
    };
  });
}

export function circuit_lap(world: World, spec: CarSpec): Outcome {
  const radius = min_radius(world.road.map((p) => [p.x, p.z]));
  const lap = autolap(world, spec);
  return {
    clean: lap.offroad === 0 && lap.index >= world.road.length - 10,
    text: `min radius ${radius.toFixed(0)} m, lap ${lap.t.toFixed(1)} s to ${lap.index}/${world.road.length}, offroad ${lap.offroad.toFixed(1)} s, worst ${lap.worst.toFixed(1)} m`,
  };
}

/** One autopilot lap of the sky track: twisty enough, no fall, flip or crash, every gap jumped inside its speed window. */
export function sky_lap(world: World, spec: CarSpec): Outcome & { toes: number[] } {
  const lap = autolap(world, spec);
  const toe_ok = lap.toes.length === world.ramps.length && lap.toes.every((v) => v >= GAP_SLOW && v <= GAP_FAST);
  const twist = twistiness(world.road);
  return {
    clean: twisty(twist) && !lap.fell && !lap.flipped && lap.impact <= IMPACT && lap.index >= world.road.length - 10 && toe_ok,
    toes: lap.toes,
    text: `${((world.road.length * 2) / 1000).toFixed(2)} km, lap ${lap.t.toFixed(1)} s to ${lap.index}/${world.road.length}, slowest ${(lap.slowest * 3.6).toFixed(0)} km/h, hardest hit ${lap.impact.toFixed(1)} m/s, turn ${twist.turn.toFixed(1)} rad/km, ${twist.corners} corners, toes ${lap.toes.map((v) => v.toFixed(1)).join(" ")} m/s${lap.fell ? ", fell" : ""}${lap.flipped ? ", flipped" : ""}`,
  };
}
