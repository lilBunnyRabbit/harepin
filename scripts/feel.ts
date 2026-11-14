import { car_spec } from "../src/car/cars";
import { SteerMode } from "../src/car/car";
import * as feel from "./bench/feel-cases";

// bun scripts/feel.ts [car] [steer mode]: the shipped Smooth keys unless a mode is named.
const rig: feel.Rig = { spec: car_spec(process.argv[2] ?? "coupe"), mode: steer_mode(process.argv[3] ?? SteerMode.SMOOTH) };

function steer_mode(arg: string): SteerMode {
  const mode = Object.values(SteerMode).find((m) => m === arg);
  if (!mode) throw new Error(`unknown steer mode ${arg}`);
  return mode;
}

const note = (key: string, value: string) => console.log(`${key.padEnd(34)} ${value}`);

const step = feel.step_steer(rig);
note("step steer 100 km/h (keys)", `yaw 90% in ${step.t90.toFixed(2)} s, overshoot ${(step.overshoot * 100).toFixed(0)}%, ${step.g.toFixed(2)} g, slip ${step.slip.toFixed(1)}°, speed ${step.kmh.toFixed(0)}`);

const lane = feel.lane_change(rig);
note("lane change 160 km/h", `max slip ${lane.slip.toFixed(1)}°, yaw after 3.5 s ${lane.yaw.toFixed(3)} rad/s, upright ${lane.upright.toFixed(3)}`);

for (const assist of [true, false]) {
  const worst = feel.lift_off(rig, assist);
  note(`lift-off mid corner (assist ${assist ? "on" : "off"})`, `max slip ${worst.toFixed(1)}°, spun ${worst > 60}`);
}

for (const tcs of [true, false]) {
  const power = feel.power_on(rig, tcs);
  note(`power on mid corner 2nd (TCS ${tcs ? "on" : "off"})`, `max slip ${power.slip.toFixed(1)}°, rear slip ${power.rear_slip.toFixed(2)}`);
}

const flick = feel.handbrake_flick(rig);
note("handbrake flick 70 km/h, 0.45 s", `turned ${flick.turned.toFixed(0)}°, straightens in ${flick.settle.toFixed(2)} s, upright ${flick.upright.toFixed(3)}`);

const kick = feel.yaw_kick(rig);
note("yaw kick at 220 km/h", `settles in ${kick.settle.toFixed(2)} s, slip now ${kick.slip.toFixed(2)}°`);

const trail = feel.trail_brake(rig);
note("trail brake 120 km/h + steer", `max slip ${trail.slip.toFixed(1)}°, stopped in ${trail.stopped.toFixed(2)} s`);

const hill = feel.hill(rig);
note("parked on 20% slope, 5 s", `crept ${hill.crept.toFixed(2)} m`);
note("hill start 20%", `${hill.kmh.toFixed(0)} km/h after 6 s`);

const lock = feel.lock_launch(rig);
note("full lock + throttle from 0", `${lock.kmh.toFixed(0)} km/h, yaw ${lock.yaw.toFixed(2)}, upright ${lock.upright.toFixed(3)}`);

const rest = feel.rest_jitter(rig);
note("rest jitter", `max dy/step ${(rest.jitter * 1000).toFixed(4)} mm, speed ${rest.speed.toFixed(4)}`);

const c = feel.lock_creep(rig);
note("full lock 2 km/h, rear axle", `radius ${c.radius.toFixed(2)} m (kinematic ${c.kinematic.toFixed(2)}, ${((c.radius / c.kinematic - 1) * 100).toFixed(1)}%), ±${(c.spread * 100).toFixed(1)} cm, speed ${c.kmh.toFixed(2)} ±${c.kmh_sd.toFixed(2)} km/h, rear creep ${(c.creep * 100).toFixed(1)} cm/s`);

const hunt = feel.gear_hunt(rig);
note("launch TCS off, gear hunting", `0-100 in ${hunt.t100.toFixed(2)} s, ${hunt.shifts} shifts`);

note("150 ms key tap at 100 km/h", `peak yaw ${feel.key_tap(rig).toFixed(3)} rad/s`);

const parked = feel.hold_parked(rig);
note("hold: parked, steer then release", `wheel ${parked.full.toFixed(3)} -> ${parked.parked.toFixed(3)} rad after 2 s at 0 km/h, ${parked.rolling.toFixed(3)} after 1 s at ${parked.kmh.toFixed(1)} km/h`);

note("hold: parked, key to full lock", `${feel.hold_reach(rig).toFixed(2)} s`);

const release = feel.hold_release(rig);
note("hold: release at 100 km/h", `wheel ${release.held.toFixed(3)} rad -> 10% in ${release.centred.toFixed(2)} s, yaw after 2 s ${release.yaw.toFixed(3)} rad/s`);
