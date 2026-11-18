import { Car, drop_height, type Controls, type Ground } from "../car/car";
import { build_spec, parse_build } from "../car/build";
import { CARS, COUPE, spec_hash, type CarAi, type CarSpec } from "../car/cars";
import { PRESETS } from "../car/presets";
import { MEASURED } from "./capability-table";
import { hypot } from "../sim-math";

/** What a car does on flat tarmac with every aid on, as the AI drives it: measured on the real physics, once per build. */
export interface Capability {
  /** m/s²: steady cornering at SLOW_AT and FAST_AT m/s, the hairpin and the fast bend of the line's grip. */
  slow: number;
  fast: number;
  /** m/s²: full brake down to BRAKE_TO from the launch's end speed (POWER_BAND's top, or less when LAUNCH_TIME ran out), or from BRAKE_FROM (or the car's top under it) when that end is under BRAKE_FROM. */
  brake: number;
  /** m/s²: the most full throttle pulls between DRIVE_BAND m/s, where traction sets it. */
  drive: number;
  /** m²/s³: full throttle acceleration times speed over POWER_BAND m/s. */
  power: number;
}

/** A car's limits over the stock coupe's, its `ai` trim on the grip and braking, and the car's own untrimmed `car`. */
export interface PlanScale extends Capability {
  car: Capability;
  /** The car's `ai.model`: the share of the corner model's raise its plan takes. */
  model: number;
}

const NO_TRIM: CarAi = { slow: 1, fast: 1, brake: 1 };

const DT = 1 / 360;
export const SLOW_AT = 13;
export const FAST_AT = 25;
const BRAKE_FROM = 30;
const BRAKE_TO = 10;
const DRIVE_BAND = [5, 20] as const;
const POWER_BAND = [20, 40] as const;
const LAUNCH_TIME = 20;
const SAMPLE = 0.25;
const SETTLE = 4;
const READ = 2;
const SKID_STEERS = [0.6, 1];
const HOLD_GAIN = 0.5;
const HOLD_BASE = 0.3;

const FLAT: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };

export function measure(spec: CarSpec): Capability {
  const car = new Car(spec);
  const controls: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
  const run = (seconds: number, until: () => boolean) => {
    for (let t = 0; t < seconds; t += DT) {
      car.step(DT, controls, FLAT);
      if (!Number.isFinite(car.pos.x)) throw new Error(`NaN measuring ${spec.id}`);
      if (until()) return;
    }
  };
  const speed = () => hypot(car.vel.x, car.vel.z);
  const never = () => false;
  car.place(0, drop_height(spec, 0.6), 0, 0);
  run(1, never);

  let drive = 0;
  let power = 0;
  let powers = 0;
  let best_power = 0;
  controls.throttle = 1;
  for (let t = 0; t < LAUNCH_TIME && speed() < POWER_BAND[1]; t += SAMPLE) {
    const before = speed();
    run(SAMPLE, never);
    const v = (before + speed()) / 2;
    const a = (speed() - before) / SAMPLE;
    if (v > DRIVE_BAND[0] && v < DRIVE_BAND[1]) drive = Math.max(drive, a);
    if (v > POWER_BAND[0]) {
      power += a * v;
      powers++;
    }
    if (v > DRIVE_BAND[0]) best_power = Math.max(best_power, a * v);
  }
  // A car that never reaches the band (the bus) is rated on the best it pulls anywhere.
  power = powers ? power / powers : best_power;

  run(LAUNCH_TIME, () => speed() >= BRAKE_FROM);
  const from = speed();
  const z = car.pos.z;
  controls.throttle = 0;
  controls.brake = 1;
  run(LAUNCH_TIME, () => speed() <= BRAKE_TO);
  const brake = (from * from - speed() * speed()) / (2 * Math.max(1e-9, car.pos.z - z));
  controls.brake = 0;

  const skidpad = (at: number): number => {
    let best = 0;
    for (const steer of SKID_STEERS) {
      car.place(0, car.pos.y, 0, 0);
      car.vel.set(0, 0, 0);
      car.ang.set(0, 0, 0);
      controls.steer = 0;
      controls.throttle = 1;
      run(LAUNCH_TIME, () => speed() >= at);
      controls.steer = steer;
      let sum = 0;
      let reads = 0;
      for (let t = 0; t < SETTLE + READ; t += DT) {
        controls.throttle = Math.max(0, Math.min(1, (at - speed()) * HOLD_GAIN + HOLD_BASE));
        run(DT, never);
        if (t >= SETTLE) {
          sum += Math.abs(car.ang.y * speed());
          reads++;
        }
      }
      best = Math.max(best, sum / reads);
    }
    return best;
  };
  return { slow: skidpad(SLOW_AT), fast: skidpad(FAST_AT), brake, drive, power };
}

// Every stock car and preset comes from the table; any other build measures once, at its first field.
const measured = new Map<string, Capability>(Object.entries(MEASURED));

export function capability(spec: CarSpec): Capability {
  const key = spec_hash(spec);
  let c = measured.get(key);
  if (!c) {
    c = measure(spec);
    measured.set(key, c);
  }
  return c;
}

/**
 * Measures every build a field is about to plan for that the table misses: call it when the mode or field loads, as a
 * custom build's measure takes a skidpad's worth of physics, and the field's start runs inside a frame (`Field`).
 */
export function warm(specs: readonly CarSpec[]) {
  for (const spec of specs) capability(spec);
}

export function plan_scale(spec: CarSpec): PlanScale {
  const car = capability(spec);
  const ref = capability(COUPE);
  const ai = spec.ai ?? NO_TRIM;
  return { slow: (car.slow / ref.slow) * ai.slow, fast: (car.fast / ref.fast) * ai.fast, brake: (car.brake / ref.brake) * ai.brake, drive: car.drive / ref.drive, power: car.power / ref.power, car, model: ai.model ?? 1 };
}

export const UNIT_SCALE: PlanScale = plan_scale(COUPE);

/**
 * The plan's `ai` trim on the car's own grip and braking, each at most 1: what a plan of `scale` may raise a corner to.
 * A trim over 1 (the formula's fast 1.074) lifts the line's own grip guess, not what the car holds.
 */
export function trim_of(scale: PlanScale): CarAi {
  const { car } = scale;
  const ref = UNIT_SCALE.car;
  return { slow: Math.min(1, (ref.slow * scale.slow) / car.slow), fast: Math.min(1, (ref.fast * scale.fast) / car.fast), brake: Math.min(1, (ref.brake * scale.brake) / car.brake) };
}

/** Every build a field draws on, one per `spec_hash` (bodies on a frame share one), named by every build it covers: what `capability-table.ts` holds. */
export function tabled_specs(): { name: string; spec: CarSpec }[] {
  const stock = Object.values(CARS).map((spec) => ({ name: spec.id, spec }));
  const presets = PRESETS.flatMap((preset) => {
    const build = parse_build(preset.code);
    return build ? [{ name: preset.code, spec: build_spec(build) }] : [];
  });
  const rows = new Map<string, { name: string; spec: CarSpec }>();
  for (const row of [...stock, ...presets]) {
    const key = spec_hash(row.spec);
    const seen = rows.get(key);
    rows.set(key, seen ? { ...seen, name: `${seen.name}, ${row.name}` } : row);
  }
  return [...rows.values()];
}
