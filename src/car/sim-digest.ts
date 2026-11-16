import { Car, type Controls, type Ground } from "./car";
import { CARS } from "./cars";
import { acos, asin, atan, atan2, cbrt, cos, exp, log, sin, tan } from "../sim-math";

const DT = 1 / 360;
const STEPS = 3600;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const BITS = new Float64Array(1);
const WORDS = new Uint32Array(BITS.buffer);

/** Rolling ground made of the shared sin and cos, so the suspension ray and the tyres both meet curved faces. */
const ROLLING: Ground = {
  height: (x, z) => 0.3 * sin(x * 0.11) * cos(z * 0.07) + 0.05 * sin(x * 0.9 + z * 0.4),
  normal: (x, z, out) => {
    const dx = 0.033 * cos(x * 0.11) * cos(z * 0.07) + 0.045 * cos(x * 0.9 + z * 0.4);
    const dz = -0.021 * sin(x * 0.11) * sin(z * 0.07) + 0.02 * cos(x * 0.9 + z * 0.4);
    return out.set(-dx, 1, -dz).normalize();
  },
  grip: () => 1,
  roll: () => 1,
};

function mix(hash: number, value: number): number {
  BITS[0] = value;
  hash = Math.imul(hash ^ WORDS[0], FNV_PRIME);
  return Math.imul(hash ^ WORDS[1], FNV_PRIME);
}

export function maths_digest(): string {
  let hash = FNV_OFFSET;
  for (let i = -2000; i <= 2000; i++) {
    const x = i * 0.0137;
    const unit = i / 2000;
    hash = mix(hash, sin(x * 50));
    hash = mix(hash, cos(x * 50));
    hash = mix(hash, tan(x));
    hash = mix(hash, atan(x * 10));
    hash = mix(hash, atan2(x, unit - 0.3));
    hash = mix(hash, asin(unit));
    hash = mix(hash, acos(unit));
    hash = mix(hash, exp(x * 20));
    hash = mix(hash, log(Math.abs(x) * 100 + 1e-3));
    hash = mix(hash, cbrt(x * 1000));
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function car_digest(): string {
  let hash = FNV_OFFSET;
  const controls: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
  for (const spec of Object.values(CARS)) {
    const car = new Car(spec);
    car.place(0, ROLLING.height(0, 0) + 1, 0, 0.3);
    for (let i = 0; i < STEPS; i++) {
      const t = i * DT;
      controls.steer = 0.6 * sin(t * 1.3);
      controls.throttle = t < 6 ? 1 : 0.4;
      controls.brake = t > 8 ? 0.7 : 0;
      car.step(DT, controls, ROLLING);
      const { pos, quat, vel, ang } = car.body;
      hash = mix(mix(mix(hash, pos.x), pos.y), pos.z);
      hash = mix(mix(mix(mix(hash, quat.x), quat.y), quat.z), quat.w);
      hash = mix(mix(mix(hash, vel.x), vel.y), vel.z);
      hash = mix(mix(mix(hash, ang.x), ang.y), ang.z);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
