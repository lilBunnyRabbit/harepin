import type { Triple } from "./cars";
import type { Cabin } from "./designs";
import { tail_at, type Part, type Point } from "./geometry";

export const MIRROR: Triple = [0.16, 0.1, 0.18];

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

/** A door mirror on the cabin's base edge at `z`, standing off the leaned side glass. */
export function mirror(cabin: Cabin, z: number, size: Triple, shoulder: number): Part {
  const [[z0, y0], [z1, y1]] = cabin.points;
  const y = y0 + ((y1 - y0) * (z0 - z)) / (z0 - z1);
  const ys = cabin.points.map(([, py]) => py);
  const low = Math.min(...ys);
  const half = (cabin.width / 2) * (1 - (cabin.tumble * (y - low)) / (Math.max(...ys) - low));
  return on_cabin({ size, at: [half + size[0] / 2 - 0.015, y, z] }, shoulder);
}
