import type { Triple } from "./cars";
import type { Cabin, Slab } from "./designs";
import { tail_at, type Part, type Point } from "./geometry";

const PROUD = 0.012;
const LAMP_DEPTH = 0.04;
const PLATE: Triple = [0.17, 0.1, 0.02];
// The panel stands this far past `half` and `h`, so a body side or lamp that ends there never shares its face.
const SEAT = 0.004;

export interface TailEnd {
  trim: Part[];
  tails: Part[];
  chrome: Part[];
}

function tail_face(outline: Point[], low: number, high: number): [number, number] {
  const zs = Array.from({ length: 7 }, (_, i) => tail_at(outline, low + ((high - low) * i) / 6)).filter(Number.isFinite);
  return [Math.min(...zs), Math.max(...zs)];
}

/**
 * A trim panel across the tail at height `y`, `h` tall and `half` wide, set on the outline's tail face, with `lamps` and
 * an optional light `bar` proud of it and a number plate at `plate_y`. Lamp depth and z come from the face, not the part.
 */
export function tail_end(outline: Point[], y: number, h: number, half: number, lamps: Part[], bar: { half: number; y: number; h?: number } | null, plate_y: number): TailEnd {
  const [face, deep] = tail_face(outline, y - h / 2, y + h / 2);
  const thick = deep - face + 0.03;
  const panel_back = face - PROUD;
  const lamp_z = panel_back - PROUD + LAMP_DEPTH / 2;
  const on_panel = Math.abs(plate_y - y) < h / 2;
  const plate_face = on_panel ? panel_back : tail_face(outline, plate_y - 0.05, plate_y + 0.05)[0];
  return {
    trim: [{ size: [half + SEAT, h + 2 * SEAT, thick], at: [(half + SEAT) / 2, y, panel_back + thick / 2] }],
    tails: [
      ...lamps.map((lamp): Part => ({ ...lamp, size: [lamp.size[0], lamp.size[1], LAMP_DEPTH], at: [lamp.at[0], lamp.at[1], lamp_z] })),
      ...(bar ? [{ size: [bar.half, bar.h ?? 0.035, LAMP_DEPTH], at: [bar.half / 2, bar.y, lamp_z] } satisfies Part] : []),
    ],
    chrome: [{ size: PLATE, at: [PLATE[0] / 2, plate_y, plate_face - PROUD + PLATE[2] / 2] }],
  };
}

/** A part drawn for the cabin on a body whose shoulder narrows everything above the belt: widened to come out as drawn. */
export function on_cabin(part: Part, shoulder: number): Part {
  return { ...part, size: [part.size[0] / (1 - shoulder), part.size[1], part.size[2]], at: [part.at[0] / (1 - shoulder), part.at[1], part.at[2]] };
}

const MIRROR_BACK = 0.2;
const MIRROR_UP = 0.06;
const MIRROR_SWEEP = 0.3;
const MIRROR_HOUSING: Triple = [0.14, 0.09, 0.05];
const MIRROR_ARM: Triple = [0.1, 0.035, 0.045];

/** A door mirror at the front corner of the side glass: a slim housing swept back, on a short arm out of the pillar foot. */
export function mirror(cabin: Cabin, shoulder: number): Part[] {
  const [z0, y0] = cabin.points[0];
  const ys = cabin.points.map(([, py]) => py);
  const low = Math.min(...ys);
  const y = y0 + MIRROR_UP;
  const z = z0 - MIRROR_BACK;
  const half = (cabin.width / 2) * (1 - (cabin.tumble * (y - low)) / (Math.max(...ys) - low));
  const reach = MIRROR_ARM[0] - 0.03;
  const arm: Part = { size: MIRROR_ARM, at: [half + MIRROR_ARM[0] / 2 - 0.03, y - 0.02, z] };
  const housing: Part = { size: MIRROR_HOUSING, at: [half + reach + MIRROR_HOUSING[0] / 2 - 0.02, y, z - 0.01], tilt: [0, MIRROR_SWEEP, 0] };
  return [arm, housing].map((part) => on_cabin(part, shoulder));
}

/** A bar from `a` to `b` on the left side, `thick` tall and `wide` across. */
export function rod(a: Triple, b: Triple, thick: number, wide = thick): Part {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz);
  return { size: [wide, thick, length], at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], tilt: [-Math.asin(dy / length), Math.atan2(dx, dz), 0] };
}

const NOSE_SHARE = 0.3;

/** A wing plane's side profile: `chord` long about `at` [z, y], its tail raised by `tilt` radians; front top, rear top, rear bottom, front bottom. */
export function plane(at: Point, chord: number, thick: number, tilt: number): Point[] {
  const [cos, sin] = [Math.cos(tilt), Math.sin(tilt)];
  const on = (along: number, up: number): Point => [at[0] + along * cos + up * sin, at[1] - along * sin + up * cos];
  const [front, rear] = [chord / 2, -chord / 2];
  return [on(front, (thick / 2) * NOSE_SHARE), on(rear, thick / 2), on(rear, -thick / 2), on(front, (-thick / 2) * NOSE_SHARE)];
}

/** An endplate round a plane's profile, standing `above` and `below` it at the tail and half that at the nose: the plane ends on its inner face. */
export function endplate(profile: Point[], above: number, below: number, lead = 0.02): Point[] {
  const zs = profile.map(([z]) => z);
  const ys = profile.map(([, y]) => y);
  const [front, rear, low, high] = [Math.max(...zs) + lead, Math.min(...zs) - lead, Math.min(...ys), Math.max(...ys)];
  return [[front, low - below / 2], [front, high + above / 2], [rear, high + above], [rear, low - below]];
}

/** A side plate swept up from the deck at `front` over a plane's end and down to `rear`, so plane and legs are one hoop. */
export function hoop(profile: Point[], front: Point, rear: Point): Point[] {
  return [front, profile[0], profile[1], profile[2], rear];
}

/** A leg from its foot on the deck, `front` to `rear`, to a head inside a plane's profile. */
export function leg(profile: Point[], front: Point, rear: Point): Point[] {
  const mid = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const [nose, tail] = [mid(profile[0], profile[3], 0.5), mid(profile[1], profile[2], 0.5)];
  return [front, mid(nose, tail, 0.3), mid(nose, tail, 0.7), rear];
}

/** A strip standing `tall` on a plane's trailing edge. */
export function gurney(profile: Point[], tall: number, deep = 0.03): Point[] {
  const [, [z, y], [low_z, low_y]] = profile;
  return [[z + deep, y - 0.005], [z + deep, y + tall], [z, y + tall], [low_z, low_y]];
}

const ROOF_SINK = 0.012;
const ROOF_PROUD = 0.004;

export interface RoofLip {
  /** The wedge grown out of the roof's rear edge. */
  lip: Slab;
  /** A fence at each end of it, standing on the screen pillar behind the roof edge and hanging `drop` under the tip. */
  fence: (drop: number, above?: number) => Slab;
  /** Half the roof's width at its rear edge, as a slab distance. */
  half: number;
  /** The roof's rear edge and the lip's tip, [z, y]. */
  edge: Point;
  tip: Point;
}

/**
 * A roof spoiler as one wedge: it leaves the roof `start` ahead of the rear edge that ends cabin edge `edge`, runs `reach`
 * past it and rises `kick` there, `thick` at the tip, and is as wide as the roof.
 */
export function roof_lip(cabin: Cabin, shoulder: number, edge: number, start: number, reach: number, kick: number, thick: number): RoofLip {
  const [fz, fy] = cabin.points[edge];
  const [rz, ry] = cabin.points[edge + 1];
  const [sz, sy] = cabin.points[edge + 2];
  const ys = cabin.points.map(([, y]) => y);
  const half = ((cabin.width / 2) * (1 - cabin.tumble) + ROOF_PROUD) / (1 - shoulder);
  const length = Math.hypot(fz - rz, fy - ry);
  const root: Point = [rz + ((fz - rz) * start) / length, ry + ((fy - ry) * start) / length - ROOF_SINK];
  const tip: Point = [rz - reach, ry + kick];
  const lip: Slab = { points: [root, tip, [tip[0] + 0.012, tip[1] - thick], [rz + 0.03, ry - thick - 0.03]], from: 0, to: half };
  const top = (z: number) => root[1] + ((tip[1] - root[1]) * (root[0] - z)) / (root[0] - tip[0]);
  const fence = (drop: number, above = 0.03): Slab => {
    const low = Math.max(Math.min(...ys), tip[1] - drop);
    const on_screen: Point = [rz + ((sz - rz) * (ry - low)) / (ry - sy) - 0.02, low];
    return { points: [[rz - 0.02, top(rz - 0.02) + above * 0.6], [tip[0] - 0.015, tip[1] + above], [tip[0] - 0.015, tip[1] - drop], on_screen], from: half - 0.03 / (1 - shoulder), to: half };
  };
  return { lip, fence, half, edge: [rz, ry], tip };
}
