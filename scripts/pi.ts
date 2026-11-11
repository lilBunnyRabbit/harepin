import { Car, drop_height, type Controls, type Ground } from "../src/car/car";
import { DEFAULT_BUILD, DEFAULT_PARTS, build_spec, parse_build, type Build } from "../src/car/build";
import { CARS, type CarId, type CarSpec } from "../src/car/cars";
import { PRESETS } from "../src/car/presets";
import { class_of, lap_time, spec_pi, stat_pace, CLASS_LABELS, type Pace } from "../src/car/pi";

// Measures each build's pace in the sim on flat ground (full-throttle run, straight stop, skidpads at two speeds), laps
// the reference circuit on those numbers, and prints them beside the PI `stats()` gives. Fit pi.ts's constants on this.

const DT = 1 / 360;
const flat: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };
const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
const SKID_KMH = [60, 140];
const BIN = 1;
const SKID_STEER = [0.04, 0.07, 0.1, 0.15, 0.22, 0.32, 0.45];

function run(car: Car, seconds: number, controls: (t: number) => Controls, until?: () => boolean) {
  let t = 0;
  while (t < seconds) {
    car.step(DT, controls(t), flat);
    t += DT;
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
    if (until?.()) break;
  }
  return t;
}

interface Measured {
  pace: Pace;
  t100: number;
  stop: number;
  g: number[];
}

export function measure(spec: CarSpec): Measured {
  const car = new Car(spec);
  const kmh = () => car.forward_speed * 3.6;
  car.place(0, drop_height(spec, 0.6), 0, 0);
  run(car, 2, () => idle);
  const y = car.pos.y;
  // The table keeps the first time each speed is reached: a shift's dip in speed would stall the lap at that speed.
  const reached: number[] = [];
  let t100 = Infinity;
  let t = 0;
  run(
    car,
    60,
    () => ({ ...idle, throttle: 1 }),
    () => {
      t += DT;
      const v = car.forward_speed;
      if (t100 === Infinity && v * 3.6 >= 100) t100 = t;
      while (reached.length * BIN <= v) reached.push(t);
      return false;
    },
  );
  const accel_table: [number, number][] = [];
  for (let i = 1; i < reached.length; i++) accel_table.push([(i - 0.5) * BIN, BIN / Math.max(DT, reached[i] - reached[i - 1])]);
  const top = (reached.length - 1) * BIN;
  car.place(0, y, 0, 0);
  run(
    car,
    30,
    () => ({ ...idle, throttle: 1 }),
    () => kmh() >= 100,
  );
  const from = car.pos.z;
  run(
    car,
    10,
    () => ({ ...idle, brake: 1 }),
    () => kmh() <= 0.5,
  );
  const stop = car.pos.z - from;
  const g: number[] = [];
  for (const target of SKID_KMH) {
    let best = 0;
    for (const steer of SKID_STEER) {
      car.place(0, y, 0, 0);
      car.assist = false;
      if (
        run(
          car,
          30,
          () => ({ ...idle, throttle: 1 }),
          () => kmh() >= target,
        ) >= 30
      )
        break;
      let sum = 0;
      let count = 0;
      run(car, 6, (s) => {
        if (s > 3 && Math.abs(kmh() - target) < target * 0.08) {
          sum += Math.abs(car.ang.y * car.vel.length());
          count++;
        }
        return { ...idle, steer, throttle: Math.max(0, Math.min(1, (target - kmh()) * 0.2 + 0.25)) };
      });
      if (count > 360) best = Math.max(best, sum / count);
    }
    g.push(best);
  }
  car.assist = true;
  const v2 = SKID_KMH.map((k) => (k / 3.6) ** 2);
  const slope = g[1] > 0 ? (g[1] - g[0]) / (v2[1] - v2[0]) : 0;
  const pace: Pace = {
    accel: (v) => {
      if (v <= accel_table[0][0]) return accel_table[0][1];
      for (let i = 1; i < accel_table.length; i++)
        if (v <= accel_table[i][0]) {
          const [va, aa] = accel_table[i - 1];
          const [vb, ab] = accel_table[i];
          return aa + ((ab - aa) * (v - va)) / (vb - va);
        }
      return 0;
    },
    brake: (100 / 3.6) ** 2 / (2 * stop),
    lateral: (v) => Math.max(g[0], g[0] + slope * (v * v - v2[0])),
    top,
  };
  return { pace, t100, stop, g: g.map((x) => x / 9.81) };
}

const EXTRA: [string, string][] = [
  ["coupe race engine", "coupe.0.0.0.1.2"],
  ["coupe semi-slick", "coupe.0.0.0.1.0.0.7.2"],
  ["coupe race kit", "coupe.0.0.4.1.0"],
  ["coupe stripped, race brakes", "coupe.0.0.0.1.0.0.7.0.2.2"],
  ["kaze all race", "kaze.0.0.4.2.2.0.7.2.2.2"],
  ["muscle all race", "muscle.0.0.4.2.2.0.7.2.2.2"],
  ["hatch all race", "hatch.0.0.4.2.2.0.7.2.2.2"],
];

export function calibration_builds(): [string, Build][] {
  const builds: [string, Build][] = (Object.keys(CARS) as CarId[]).map((car) => [`${car} stock`, { ...DEFAULT_BUILD, car, parts: { ...DEFAULT_PARTS } }]);
  for (const [name, code] of [...PRESETS.map((p): [string, string] => [`preset ${p.name}`, p.code]), ...EXTRA]) {
    const build = parse_build(code);
    if (!build) throw new Error(`bad code ${code}`);
    builds.push([name, build]);
  }
  return builds;
}

export interface Row {
  name: string;
  spec: CarSpec;
  measured: Measured;
  lap: number;
}

export function measure_all(only?: string): Row[] {
  return calibration_builds()
    .filter(([name]) => !only || name.includes(only))
    .map(([name, build]) => {
      const spec = build_spec(build);
      const measured = measure(spec);
      return { name, spec, measured, lap: lap_time(measured.pace) };
    });
}

const rank = (xs: number[]) => {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  order.forEach(([, i], k) => (r[i] = k));
  return r;
};
const pearson = (a: number[], b: number[]) => {
  const ma = a.reduce((s, x) => s + x, 0) / a.length;
  const mb = b.reduce((s, x) => s + x, 0) / b.length;
  let ab = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += (a[i] - ma) * (b[i] - mb);
    aa += (a[i] - ma) ** 2;
    bb += (b[i] - mb) ** 2;
  }
  return ab / Math.sqrt(aa * bb);
};
if (import.meta.main) {
  const rows = measure_all(process.argv[2]);
  console.log("build | PI | class | stat lap s | measured lap s | 0-100 s | 100-0 m | lat g 60/140 | top km/h");
  for (const { name, spec, measured: m, lap } of rows)
    console.log(
      `${name} | ${spec_pi(spec)} | ${CLASS_LABELS[class_of(spec_pi(spec))]} | ${lap_time(stat_pace(spec)).toFixed(1)} | ${lap.toFixed(1)} | ${Number.isFinite(m.t100) ? m.t100.toFixed(2) : "-"} | ${m.stop.toFixed(1)} | ${m.g.map((x) => x.toFixed(2)).join("/")} | ${(m.pace.top * 3.6).toFixed(0)}`,
    );
  const laps = rows.map((r) => r.lap);
  const stat_laps = rows.map((r) => lap_time(stat_pace(r.spec)));
  const pis = rows.map((r) => spec_pi(r.spec));
  const error = rows.reduce((s, r, i) => s + Math.abs(stat_laps[i] - r.lap) / r.lap, 0) / rows.length;
  console.log(`stat lap vs measured lap: mean error ${(error * 100).toFixed(1)}%, pearson ${pearson(stat_laps, laps).toFixed(3)}`);
  console.log(`PI vs measured lap: spearman ${(-pearson(rank(pis), rank(laps))).toFixed(3)}`);
}
