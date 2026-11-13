import { CARS, car_sized, is_car, type CarId, type CarSpec, type Triple } from "./cars";
import type { Token } from "../theme/theme";

type NumericField = Exclude<{ [K in keyof CarSpec]-?: CarSpec[K] extends number ? K : never }[keyof CarSpec], "awd_split">;

interface Derived {
  torque: number;
  inertia: number;
  /** Suspension rest length, `wheel.rest`, metres. */
  rest: number;
  /** Metres the centre of mass sits lower in the body, from 0: wheel mounts and collision corners move up by it. */
  cog: number;
  nitro: number;
  /** Tyre grip multipliers on dirt trails and on grass or verge, from 1. */
  grip_dirt: number;
  grip_grass: number;
}

export type Field = NumericField | keyof Derived;

/** Per field the scales multiply onto the base first, then the adds sum on, so the slot order never changes the result. */
export interface Mod {
  scale?: Partial<Record<Field, number>>;
  add?: Partial<Record<Field, number>>;
}

/** How a part shows on the car model (`models.ts`); a part without one draws as the design's stock look. */
export interface Look {
  /** Tread width and rim size against the design's (a bigger rim is a lower sidewall), tread block size against the rally tyre's, and a sidewall ring colour. */
  tyre?: { width: number; rim: number; tread?: number; band?: Token };
  /** Brake caliper size; a theme colour sets it proud of the spokes, without one it is trim and hides behind them. */
  caliper?: { size: number; tone?: Token };
  /** Nitrous bottle length against the small tank's, and a second bottle beside it. */
  bottle?: { size: number; twin?: boolean };
  /** Rear wing level (1 lip, 2 wing, 3 the biggest; a design's own wing list keeps its top wing past its end), a front lip or deeper splitter, side skirts and a rear diffuser. */
  aero?: { wing: number; front?: "lip" | "splitter"; skirts?: boolean; diffuser?: boolean };
}

/** How the garage shows a slot: the car stays put on its stand and only turns, so a part swap is seen against a still car. */
export interface SlotView {
  /** The car's turn on its stand, radians: 0.7 points the nose at the camera, -0.87 shows the left flank side on. */
  yaw: number;
}

export interface Part {
  name: string;
  /** One line for the garage card: what the part does to the car. */
  blurb?: string;
  mod: Mod;
  look?: Look;
}

export interface SlotSpec {
  label: string;
  parts: Part[];
  view?: SlotView;
}

export const WHOLE_CAR: SlotView = { yaw: -0.5 };

// Aero, suspension and engine sit at fixed spots in the build code; every other slot rides in its tail in table order,
// so a new slot goes last here or old codes would read its digits as another slot's.
export const SLOTS = {
  engine: {
    label: "Engine",
    view: { yaw: 0.4 },
    parts: [
      { name: "Stock", blurb: "Factory tune", mod: {} },
      { name: "Tuned", blurb: "+15% torque, revs higher, +15 kg", mod: { scale: { torque: 1.15 }, add: { redline: 300, upshift: 300, mass: 15 } } },
      { name: "Race", blurb: "+30% torque, revs much higher, +30 kg", mod: { scale: { torque: 1.3 }, add: { redline: 600, upshift: 600, mass: 30 } } },
    ],
  },
  tyres: {
    label: "Tyres",
    view: { yaw: -0.6 },
    parts: [
      { name: "Street", blurb: "All-round, fine on dirt", mod: {} },
      { name: "Sport", blurb: "More grip, a bit worse on dirt", mod: { scale: { mu: 1.06, grip_dirt: 0.95, grip_grass: 0.95 }, add: { offroad: -0.15 } }, look: { tyre: { width: 1.15, rim: 1.06 } } },
      { name: "Semi-slick", blurb: "Most grip, slides on dirt", mod: { scale: { mu: 1.12, grip_dirt: 0.92, grip_grass: 0.92 }, add: { offroad: -0.6 } }, look: { tyre: { width: 1.32, rim: 1.12, band: "warning" } } },
      { name: "Rally", blurb: "Less grip, best on dirt and gravel", mod: { scale: { mu: 0.96, grip_dirt: 1.04, grip_grass: 0.98 }, add: { offroad: 0.5 } }, look: { tyre: { width: 1.1, rim: 0.88, tread: 1 } } },
      { name: "All-terrain", blurb: "A little less grip, good off road", mod: { scale: { mu: 0.98, roll_resist: 1.05, grip_dirt: 1.01 }, add: { offroad: 0.3 } }, look: { tyre: { width: 1.08, rim: 0.86, tread: 0.7 } } },
      { name: "Mud-terrain", blurb: "Poor on tarmac, best on grass, mud and sand", mod: { scale: { mu: 0.94, roll_resist: 1.2, grip_dirt: 0.92, grip_grass: 1.06 }, add: { offroad: 0.9 } }, look: { tyre: { width: 1.22, rim: 0.8, tread: 1.5 } } },
    ],
  },
  // The kits move the downforce forward of the centre of mass: the street kit's lip and short wing make a pointy car at
  // speed, the race kit's splitter, diffuser and big wing press harder for the most drag and weight.
  aero: {
    label: "Aero kit",
    view: { yaw: -1.7 },
    parts: [
      { name: "None", blurb: "Clean, lowest drag", mod: {} },
      { name: "Lip", blurb: "More downforce, a little drag", mod: { scale: { downforce: 1.8 }, add: { drag: 0.04, rear_grip: 0.02 } }, look: { aero: { wing: 1 } } },
      { name: "Wing", blurb: "Big rear downforce, more drag", mod: { scale: { downforce: 2.6 }, add: { drag: 0.09, rear_grip: 0.04 } }, look: { aero: { wing: 2 } } },
      {
        name: "Street kit",
        blurb: "Lip, skirts, wing: sharper at speed",
        mod: { scale: { downforce: 3 }, add: { drag: 0.12, rear_grip: 0.03, aero_front: 0.08, mass: 6 } },
        look: { aero: { wing: 2, front: "lip", skirts: true } },
      },
      {
        name: "Race kit",
        blurb: "Most downforce and drag, +12 kg",
        mod: { scale: { downforce: 3.6 }, add: { drag: 0.17, rear_grip: 0.05, aero_front: 0.04, mass: 12 } },
        look: { aero: { wing: 3, front: "splitter", skirts: true, diffuser: true } },
      },
    ],
  },
  suspension: {
    label: "Suspension",
    view: { yaw: -1 },
    parts: [
      { name: "Soft", blurb: "Soft and tall, soaks up bumps", mod: { scale: { spring: 0.8, damper: 0.8, arb_front: 0.7, arb_rear: 0.7 }, add: { rest: 0.04 } } },
      { name: "Sport", blurb: "Balanced street setup", mod: {} },
      { name: "Race", blurb: "Stiff and low, sharp turn-in", mod: { scale: { spring: 1.3, damper: 1.3, arb_front: 1.4, arb_rear: 1.4 }, add: { rest: -0.03 } } },
      // Drift's extra lock is the countersteer room that turns a power slide from a spin into a held angle.
      { name: "Drift", blurb: "Loose rear, extra steering lock", mod: { scale: { spring: 1.25, damper: 1.25, arb_front: 0.6, arb_rear: 3, lock: 1.15, assist_yaw: 0.6 }, add: { rest: -0.02, rear_grip: -0.02 } } },
      { name: "Lifted", blurb: "Tall and soft, rolls, eats bumps", mod: { scale: { spring: 0.85, damper: 1.1, arb_front: 0.6, arb_rear: 0.6 }, add: { rest: 0.12 } } },
    ],
  },
  brakes: {
    label: "Brakes",
    view: { yaw: -0.6 },
    parts: [
      { name: "Stock", blurb: "Factory brakes", mod: {} },
      { name: "Sport", blurb: "+15% brake force", mod: { scale: { brake_front: 1.15, brake_rear: 1.15 }, add: { brake_grip: 0.14 } }, look: { caliper: { size: 1.15, tone: "error" } } },
      { name: "Race", blurb: "+30% brake force", mod: { scale: { brake_front: 1.3, brake_rear: 1.3 }, add: { brake_grip: 0.3 } }, look: { caliper: { size: 1.3, tone: "warning" } } },
    ],
  },
  weight: {
    label: "Weight",
    view: { yaw: -0.87 },
    parts: [
      { name: "Stock", blurb: "Full interior", mod: {} },
      { name: "Light", blurb: "-5% mass, sits a little lower", mod: { scale: { mass: 0.95, inertia: 0.95 }, add: { cog: 0.01 } } },
      { name: "Stripped", blurb: "-10% mass, no trim, lower still", mod: { scale: { mass: 0.9, inertia: 0.9 }, add: { cog: 0.025 } } },
    ],
  },
  // Balanced keeps both axles at their grip limit for the shortest straight stop; moving torque either way starves one.
  // Rear-heavy rotates the car into a braked turn and locks the rear first without ABS; front-heavy pushes straight on.
  bias: {
    label: "Brake bias",
    parts: [
      { name: "Front", blurb: "Stable, stops straight", mod: { scale: { brake_front: 1.1, brake_rear: 0.55 } } },
      { name: "Balanced", blurb: "Shortest straight stop", mod: {} },
      { name: "Rear", blurb: "Rotates into braked turns", mod: { scale: { brake_front: 0.7, brake_rear: 1.6 } } },
    ],
  },
  nitro: {
    label: "Nitro",
    view: { yaw: -1.9 },
    parts: [
      { name: "None", blurb: "No boost", mod: {} },
      { name: "Small tank", blurb: "4 s boost, +8 kg", mod: { add: { nitro: 4, mass: 8 } }, look: { bottle: { size: 1 } } },
      { name: "Big tank", blurb: "7 s boost, +18 kg", mod: { add: { nitro: 7, mass: 18 } }, look: { bottle: { size: 1.25, twin: true } } },
    ],
  },
} satisfies Record<string, SlotSpec>;

export type Slot = keyof typeof SLOTS;
export const SLOT_NAMES = Object.keys(SLOTS) as Slot[];

export function part_of(slot: Slot, index: number): Part {
  const parts: Part[] = SLOTS[slot].parts;
  return parts[index];
}

export function slot_view(slot: Slot): SlotView {
  const spec: SlotSpec = SLOTS[slot];
  return spec.view ?? WHOLE_CAR;
}

const LIMITS: Partial<Record<Field, [number, number]>> = { offroad: [-1, 1] };

export interface Build {
  car: CarId;
  /** Index into theme `car_paints`, wrapped by the length there; past `MAX_PAINT`, a career reward paint (`paint_lab`). */
  paint: number;
  /** Index into `DECALS`. */
  decal: number;
  /** Index into palette `decal_inks`; swapped for a neutral when it would vanish on the paint. */
  ink: number;
  /** Shown by the number roundel, 0-99. */
  number: number;
  /** Index into `SLOTS[slot].parts` per slot. */
  parts: Record<Slot, number>;
}

export const MAX_PAINT = 15;
/** Career reward paints, one per tier, at `MAX_PAINT + 1` on: past the wrapped range, so no saved build changes colour. */
export const REWARD_PAINTS = 5;
// Append-only: build codes carry the index. From `sky` on, career rewards, one per tier final.
export const DECALS = ["none", "centre", "twin", "side", "number", "flames", "slash", "checker", "rabbit", "sky", "volcano", "ice", "dunes"] as const;
export type Decal = (typeof DECALS)[number];
export const MAX_DECAL = DECALS.length - 1;
export const MAX_INK = 8;
export const MAX_NUMBER = 99;
export const DEFAULT_PARTS: Record<Slot, number> = { engine: 0, tyres: 0, aero: 0, suspension: 1, brakes: 0, weight: 0, bias: 1, nitro: 0 };
// A new player's car, in the info paint: blue stands clear of grass, dirt and sand in both themes. The wing's rear grip takes the stock hatch's lift-off tuck at 80 km/h from 16 to 4 degrees of slip.
export const DEFAULT_BUILD: Build = { car: "hatch", paint: 4, decal: 0, ink: 0, number: 7, parts: { ...DEFAULT_PARTS, aero: 2 } };

const HEAD: readonly Slot[] = ["aero", "suspension", "engine"];
const TAIL = SLOT_NAMES.filter((slot) => !HEAD.includes(slot));

// Ink and number, then the tail slots, ride as optional tails, so a build that keeps their defaults has the code it had
// before them and older peers still read it.
const CODE = new RegExp(`^(${Object.keys(CARS).join("|")})\\.(\\d{1,2})\\.(\\d{1,2})\\.(\\d)\\.(\\d)\\.(\\d)(?:\\.(\\d)\\.(\\d{1,2})((?:\\.\\d){0,${TAIL.length}}))?$`);

export function build_code(build: Build): string {
  const code = `${build.car}.${build.paint}.${build.decal}.${HEAD.map((slot) => build.parts[slot]).join(".")}`;
  const tail = TAIL.map((slot) => build.parts[slot]);
  while (tail.length && tail[tail.length - 1] === DEFAULT_PARTS[TAIL[tail.length - 1]]) tail.pop();
  if (!tail.length && build.ink === DEFAULT_BUILD.ink && build.number === DEFAULT_BUILD.number) return code;
  return [code, build.ink, build.number, ...tail].join(".");
}

export function parse_build(code: unknown): Build | null {
  if (typeof code !== "string" || code.length > 40) return null;
  const m = CODE.exec(code);
  if (!m || !is_car(m[1])) return null;
  const paint = Number(m[2]);
  const decal = Number(m[3]);
  const ink = m[7] === undefined ? DEFAULT_BUILD.ink : Number(m[7]);
  const number = m[8] === undefined ? DEFAULT_BUILD.number : Number(m[8]);
  if (paint > MAX_PAINT + REWARD_PAINTS || decal > MAX_DECAL || ink > MAX_INK || number > MAX_NUMBER) return null;
  const tail = m[9] ? m[9].slice(1).split(".").map(Number) : [];
  const parts = { ...DEFAULT_PARTS };
  HEAD.forEach((slot, i) => (parts[slot] = Number(m[4 + i])));
  TAIL.forEach((slot, i) => (parts[slot] = tail[i] ?? DEFAULT_PARTS[slot]));
  if (SLOT_NAMES.some((slot) => parts[slot] >= SLOTS[slot].parts.length)) return null;
  return { car: m[1], paint, decal, ink, number, parts };
}

function fold(mods: Mod[], field: Field, base: number): number {
  let value = base;
  for (const mod of mods) value *= mod.scale?.[field] ?? 1;
  for (const mod of mods) value += mod.add?.[field] ?? 0;
  const limit = LIMITS[field];
  return limit ? Math.max(limit[0], Math.min(limit[1], value)) : value;
}

const is_numeric = (spec: CarSpec, field: keyof CarSpec): field is NumericField => typeof spec[field] === "number" && field !== "awd_split";

export function apply_build(base: CarSpec, build: Build): CarSpec {
  const mods = SLOT_NAMES.map((slot) => part_of(slot, build.parts[slot]).mod);
  const at = (field: Field, value: number) => fold(mods, field, value);
  const spec = { ...base };
  for (const field of Object.keys(base) as (keyof CarSpec)[]) if (is_numeric(base, field)) spec[field] = at(field, base[field]);
  const cog = at("cog", 0);
  const grip_dirt = at("grip_dirt", base.grip_dirt ?? 1);
  const grip_grass = at("grip_grass", base.grip_grass ?? 1);
  const [ix, iy, iz] = base.inertia;
  return {
    ...spec,
    inertia: [at("inertia", ix), at("inertia", iy), at("inertia", iz)],
    torque: base.torque.map(([rpm, nm]) => [rpm, at("torque", nm)]),
    wheel: { ...base.wheel, rest: at("rest", base.wheel.rest), mounts: base.wheel.mounts.map(([x, y, z]): Triple => [x, y + cog, z]) },
    corners: base.corners.map(([x, y, z]): Triple => [x, y + cog, z]),
    nitro: at("nitro", base.nitro ?? 0) || undefined,
    grip_dirt: grip_dirt === 1 ? base.grip_dirt : grip_dirt,
    grip_grass: grip_grass === 1 ? base.grip_grass : grip_grass,
    stock_mu: spec.mu === base.mu ? base.stock_mu : (base.stock_mu ?? base.mu),
  };
}

export function build_spec(build: Build): CarSpec {
  return apply_build(CARS[build.car], build);
}

const GRAVITY = 9.81;
// Front axle's share of the weight under hard braking, one figure for every car: the braking stat only needs to rank
// bias settings, so an axle with more torque than this share can hold adds nothing and one with less leaves grip unused.
const BRAKING_FRONT_SHARE = 0.6;

export interface Stats {
  /** Peak power over mass, W/kg. */
  power: number;
  grip: number;
  /** Peak straight-line braking, m/s². */
  braking: number;
  /** m/s, the lower of the drag limit at peak power and the limiter in top gear. */
  top_speed: number;
}

export const STATS: readonly (keyof Stats)[] = ["power", "grip", "braking", "top_speed"];

export function stats(spec: CarSpec): Stats {
  const watts = Math.max(...spec.torque.filter(([rpm]) => rpm <= spec.redline).map(([rpm, nm]) => (nm * rpm * Math.PI) / 30));
  const grip = (spec.mu * (1 + spec.rear_grip)) / 2;
  const axle = (torque: number, mu: number, share: number) => Math.min((2 * torque) / spec.wheel.radius, mu * spec.brake_grip * share * spec.mass * GRAVITY);
  const front = axle(spec.brake_front, spec.mu, BRAKING_FRONT_SHARE);
  const rear = axle(spec.brake_rear, spec.mu * spec.rear_grip, 1 - BRAKING_FRONT_SHARE);
  const drag_limit = Math.cbrt((watts * spec.driveline) / spec.drag);
  const gear_limit = ((spec.redline * Math.PI) / 30) * spec.wheel.radius / (spec.gears[spec.gears.length - 1] * spec.final);
  return {
    power: watts / spec.mass,
    grip,
    braking: (front + rear) / spec.mass,
    top_speed: Math.min(drag_limit, gear_limit),
  };
}

let range: { low: Stats; high: Stats } | null = null;

// Every combination is tens of thousands of specs, too slow for a garage tap on a phone. Per car, each stat takes the
// best (or worst) part per slot on its own, which lands on or near the true extreme; the bars clamp the rest.
/** Each stat's spread over the car-sized cars and their parts: the two ends of a garage bar. A bigger vehicle clamps into it. */
export function stat_range(): { low: Stats; high: Stats } {
  if (range) return range;
  const low: Stats = { power: Infinity, grip: Infinity, braking: Infinity, top_speed: Infinity };
  const high: Stats = { power: 0, grip: 0, braking: 0, top_speed: 0 };
  for (const car of (Object.keys(CARS) as CarId[]).filter((id) => car_sized(CARS[id])))
    for (const key of STATS)
      for (const sign of [-1, 1]) {
        const score = (parts: Record<Slot, number>) => sign * stats(build_spec({ ...DEFAULT_BUILD, car, parts }))[key];
        const parts = { ...DEFAULT_PARTS };
        for (const slot of SLOT_NAMES) {
          const pick = (i: number) => score({ ...DEFAULT_PARTS, [slot]: i });
          parts[slot] = SLOTS[slot].parts.reduce((best, _, i) => (pick(i) > pick(best) ? i : best), DEFAULT_PARTS[slot]);
        }
        const value = sign * score(parts);
        low[key] = Math.min(low[key], value);
        high[key] = Math.max(high[key], value);
      }
  range = { low, high };
  return range;
}
