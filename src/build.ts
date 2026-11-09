import { CARS, is_car, type CarId, type CarSpec } from "./cars";

export type Level = 0 | 1 | 2;

export interface Build {
  car: CarId;
  /** Index into theme `car_paints`, wrapped by the length there. */
  paint: number;
  /** Index into `DECALS`. */
  decal: number;
  /** Index into palette `decal_inks`; swapped for a neutral when it would vanish on the paint. */
  ink: number;
  /** Shown by the number roundel, 0-99. */
  number: number;
  spoiler: Level;
  /** 0 soft, 1 sport (stock), 2 race. */
  suspension: Level;
  engine: Level;
}

export const MAX_PAINT = 15;
export const DECALS = ["none", "centre", "twin", "side", "number", "flames", "slash", "checker", "rabbit"] as const;
export type Decal = (typeof DECALS)[number];
export const MAX_DECAL = DECALS.length - 1;
export const MAX_INK = 8;
export const MAX_NUMBER = 99;
export const DEFAULT_BUILD: Build = { car: "coupe", paint: 0, decal: 0, ink: 0, number: 7, spoiler: 0, suspension: 1, engine: 0 };

const SPOILER_DOWNFORCE = [1, 1.8, 2.6];
const SPOILER_DRAG = [0, 0.04, 0.09];
const SPOILER_REAR_GRIP = [0, 0.02, 0.04];
const SUSPENSION_SPRING = [0.8, 1, 1.3];
const SUSPENSION_ARB = [0.7, 1, 1.4];
const SUSPENSION_REST = [0.04, 0, -0.03];
const ENGINE_TORQUE = [1, 1.15, 1.3];
const ENGINE_REVS = [0, 300, 600];
const ENGINE_MASS = [0, 15, 30];

// Ink and number ride as an optional tail, so a build that keeps their defaults has the same code it had before them.
const CODE = new RegExp(`^(${Object.keys(CARS).join("|")})\\.(\\d{1,2})\\.(\\d)\\.([012])\\.([012])\\.([012])(?:\\.(\\d)\\.(\\d{1,2}))?$`);

export function build_code(build: Build): string {
  const code = `${build.car}.${build.paint}.${build.decal}.${build.spoiler}.${build.suspension}.${build.engine}`;
  return build.ink === DEFAULT_BUILD.ink && build.number === DEFAULT_BUILD.number ? code : `${code}.${build.ink}.${build.number}`;
}

function level(digit: string): Level {
  const n = Number(digit);
  if (n !== 0 && n !== 1 && n !== 2) throw new Error(`level out of range: ${digit}`);
  return n;
}

export function parse_build(code: unknown): Build | null {
  if (typeof code !== "string" || code.length > 32) return null;
  const m = CODE.exec(code);
  if (!m || !is_car(m[1])) return null;
  const paint = Number(m[2]);
  const decal = Number(m[3]);
  const ink = m[7] === undefined ? DEFAULT_BUILD.ink : Number(m[7]);
  const number = m[8] === undefined ? DEFAULT_BUILD.number : Number(m[8]);
  if (paint > MAX_PAINT || decal > MAX_DECAL || ink > MAX_INK || number > MAX_NUMBER) return null;
  return { car: m[1], paint, decal, ink, number, spoiler: level(m[4]), suspension: level(m[5]), engine: level(m[6]) };
}

export function apply_build(base: CarSpec, build: Build): CarSpec {
  const { spoiler, suspension, engine } = build;
  const spring = SUSPENSION_SPRING[suspension];
  const arb = SUSPENSION_ARB[suspension];
  const revs = ENGINE_REVS[engine];
  const torque = ENGINE_TORQUE[engine];
  return {
    ...base,
    mass: base.mass + ENGINE_MASS[engine],
    wheel: { ...base.wheel, rest: base.wheel.rest + SUSPENSION_REST[suspension] },
    spring: base.spring * spring,
    damper: base.damper * spring,
    arb_front: base.arb_front * arb,
    arb_rear: base.arb_rear * arb,
    rear_grip: base.rear_grip + SPOILER_REAR_GRIP[spoiler],
    redline: base.redline + revs,
    upshift: base.upshift + revs,
    torque: base.torque.map(([rpm, nm]) => [rpm, nm * torque]),
    drag: base.drag + SPOILER_DRAG[spoiler],
    downforce: base.downforce * SPOILER_DOWNFORCE[spoiler],
  };
}

export function build_spec(build: Build): CarSpec {
  return apply_build(CARS[build.car], build);
}
