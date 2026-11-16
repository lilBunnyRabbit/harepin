import { COUPE, car_spec } from "../src/car/cars";
import { Field, personalities } from "../src/ai/field";
import { World, type Collider } from "../src/world/world";
import { ROAD_HALF } from "../src/worldgen/types";
import { circuits } from "./ai-race";
import { DT } from "./autolap";
import { GOLDEN_SEEDS } from "./proof/golden-file";

// bun scripts/ai-why.ts [seeds|all] [car] [count] [laps] [aggression] [mistakes]: ai-race.ts field races, with each spin's and reset's trigger:
// the earliest of a touch, a wall hit, the car's own slide starting, or leaving the road, inside the look-back window.
/** Seconds back a trigger counts for a spin, and for a reset with no spin before it. */
const LOOK = 3;
const RESET_LOOK = 8;
/** m/s of world impact that is a wall hit, and of car closing speed that is printed. */
const WALL = 1;
const HARD = 10;
/** Slip angle (rad) at which a slide starts, and under which it is over. */
const SLIDE = 0.35;
const CALM = 0.15;
/** Road points either side of a spin or reset over which a kicker's run tags it. */
const KICKER_NEAR = 40;

const Cause = { CONTACT: "contact", WALL: "wall", SLIDE: "own slide", OFFROAD: "offroad" } as const;
type Cause = (typeof Cause)[keyof typeof Cause];

function why(seeds: readonly number[], car: string | undefined, count: number, laps: number, aggression: number, mistakes: number) {
  const spec = car ? car_spec(car) : COUPE;
  const split = new Map<string, number>();
  const tally = (key: string) => split.set(key, (split.get(key) ?? 0) + 1);
  for (const seed of seeds) {
    const world = new World(seed);
    for (const route of circuits(world)) {
      if (route.excludes?.includes(spec.id)) continue;
      const unplace = world.place(route.closure);
      const field = new Field(world, route, Array.from({ length: count }, () => spec), personalities(seed, count, aggression, mistakes), seed);
      const { racers, line } = field;
      const cars = racers.map((r) => r.car as Collider);
      const fresh = () => new Float64Array(count).fill(-Infinity);
      const at: Record<Cause, Float64Array> = { [Cause.CONTACT]: fresh(), [Cause.WALL]: fresh(), [Cause.SLIDE]: fresh(), [Cause.OFFROAD]: fresh() };
      const sliding = new Uint8Array(count);
      const off = new Uint8Array(count);
      const slide_state: string[] = new Array(count).fill("");
      const touch_by = new Int32Array(count).fill(-1);
      const spin_at = fresh();
      const spin_cause: string[] = new Array(count).fill("");
      const spins = new Int32Array(count);
      const resets = new Int32Array(count);
      const n = line.room.length;
      const kicker = (index: number) => {
        for (let k = -KICKER_NEAR; k <= KICKER_NEAR; k++) if (line.room[(((index + k) % n) + n) % n] === 0) return " kicker";
        return "";
      };
      const first = (i: number, t: number, span: number): string => {
        let best = "";
        let when = Infinity;
        for (const cause of Object.values(Cause)) {
          const a = at[cause][i];
          // A slide still going counts however long ago it started: a long drift is what runs a car wide.
          if ((t - a <= span || (cause === Cause.SLIDE && sliding[i])) && a < when) {
            when = a;
            best = cause === Cause.SLIDE ? `${cause} ${slide_state[i]}` : cause;
          }
        }
        return best;
      };
      const collide = world.collide.bind(world);
      world.collide = (c: Collider) => {
        const hit = collide(c);
        const k = cars.indexOf(c);
        if (k >= 0 && hit > WALL) at[Cause.WALL][k] = field.t;
        return hit;
      };
      let plan = 0;
      for (let i = 0; i < line.step.length; i++) plan += line.step[i] / line.speed[i];
      const limit = plan * laps * 1.6 + 30;
      while (field.t < limit && racers.some((r) => r.stats.laps.length < laps)) {
        field.step(DT, laps);
        const t = field.t;
        for (let i = 0; i < count; i++) {
          const hit = field.impacts[i];
          if (hit < 0) continue;
          let other = -1;
          for (let j = 0; j < count; j++) if (j !== i && field.impacts[j] === hit) other = j;
          if (t - at[Cause.CONTACT][i] > 0.5) at[Cause.CONTACT][i] = t;
          touch_by[i] = other;
          if (hit > HARD && other > i) {
            const a = racers[i], b = racers[other];
            const gap = (b.driver.progress - a.driver.progress) * (route.length / route.points.length);
            const [front, back] = gap > 0 ? [b, a] : [a, b];
            const fk = gap > 0 ? other : i, bk = gap > 0 ? i : other;
            const sp = (r: typeof a) => Math.hypot(r.car.vel.x, r.car.vel.z).toFixed(1);
            console.log(`  hard ${hit.toFixed(1)} m/s seed ${seed} t ${t.toFixed(1)} lap ${back.driver.laps}: car ${bk + 1} (${sp(back)} m/s, target ${back.driver.target.toFixed(1)}, cap ${back.driver.cap.toFixed(1)}, aside ${back.driver.aside.toFixed(1)}) into car ${fk + 1} (${sp(front)} m/s, target ${front.driver.target.toFixed(1)}, aside ${front.driver.aside.toFixed(1)}${first(fk, t, LOOK) ? `, ${first(fk, t, LOOK)}` : ""}) ${Math.abs(gap).toFixed(1)} m apart`);
          }
        }
        for (let i = 0; i < count; i++) {
          const { car: c, driver, stats } = racers[i];
          const speed = Math.hypot(c.vel.x, c.vel.z);
          const slide = speed > 3 ? Math.abs(Math.atan2(Math.sin(Math.atan2(c.vel.x, c.vel.z) - c.heading), Math.cos(Math.atan2(c.vel.x, c.vel.z) - c.heading))) : 0;
          if (!sliding[i] && slide > SLIDE && driver.reversing <= 0) {
            sliding[i] = 1;
            at[Cause.SLIDE][i] = t;
            slide_state[i] = `(${driver.push > 1 ? "passing" : Math.abs(driver.aside) > 0.5 ? "off line" : driver.cap < Infinity ? "following" : "on line"}, ${speed.toFixed(0)} m/s, plan ${line.speed[driver.index].toFixed(0)})`;
          } else if (sliding[i] && slide < CALM) sliding[i] = 0;
          // Leaving the tarmac starts the trouble, well before OFF_ROAD counts the car as off for a reset.
          const away = world.distance_to_road(c.pos.x, c.pos.z) > ROAD_HALF;
          if (away && !off[i]) at[Cause.OFFROAD][i] = t;
          off[i] = away ? 1 : 0;
          if (stats.spins > spins[i]) {
            spins[i] = stats.spins;
            const cause = (first(i, t, LOOK) || "none") + kicker(driver.index);
            spin_cause[i] = cause;
            spin_at[i] = t;
            tally(`spin ${cause.replace(/ \(.*\)/, "")}`);
            console.log(`  spin ${cause} seed ${seed} car ${i + 1} lap ${driver.laps} pt ${driver.index}${cause.startsWith(Cause.CONTACT) ? ` by car ${touch_by[i] + 1}` : ""}`);
          }
          if (stats.resets > resets[i]) {
            resets[i] = stats.resets;
            const cause = t - spin_at[i] <= RESET_LOOK ? `after spin: ${spin_cause[i]}` : (first(i, t, RESET_LOOK) || "stall") + kicker(driver.index);
            tally(`reset ${cause.replace(/ \(.*\)/, "")}`);
            console.log(`  reset ${cause} seed ${seed} car ${i + 1} lap ${driver.laps} pt ${driver.index}`);
          }
        }
      }
      unplace();
    }
  }
  console.log([...split].sort().map(([k, v]) => `${k}: ${v}`).join("\n"));
}

if (import.meta.main) {
  const [seeds_arg, car, count = "6", laps = "2", aggression = "3", mistakes = "3"] = process.argv.slice(2);
  const seeds = seeds_arg && seeds_arg !== "all" ? seeds_arg.split(",").map(Number) : GOLDEN_SEEDS.island;
  why(seeds, car, Number(count), Number(laps), Number(aggression), Number(mistakes));
}
