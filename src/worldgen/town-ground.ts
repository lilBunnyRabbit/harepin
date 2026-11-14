import type { MeshTones } from "./chunks";
import { LIFT } from "./lifts";
import type { Builder, Frame, Rgb } from "./mesh";
import { post, shift, slab } from "./town-parts";
import { STALL, WALL_HALF, WALL_TOP, stall_spots, wall_runs } from "./town-style";
import type { Lot } from "./types";

const PAD_LIFT = LIFT.pad;
const PATH_HALF = 0.7;
const PATH_LONG = 3.6;
/** A pad reaches this far past the lot line, over the grass strip behind the sidewalk. */
const PAD_OUT = 1.2;
const PLAZA_FRONT = 1.6;
const PLAZA_BORDER = 1.2;
const PLAZA_LIP = 0.4;
const BENCH_IN = { side: 6, back: 3.2 };
const STALL_EAVE = 0.5;
const STALL_OVER = 0.3;
const COUNTER = { half: 0.5, top: 0.9, leg: 0.4 };

/** A rectangle of paving in a lot's frame, `lift` over the terrain. */
export interface Paving {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  lift: number;
}

/** The paving `dress_lot` lays on `lot`, highest last. */
export function lot_paving(lot: Lot): Paving[] {
  const hw = lot.w / 2;
  const hd = lot.d / 2;
  if (lot.ground === "plaza")
    return [
      { x0: -hw - PAD_OUT, x1: hw + PAD_OUT, z0: -hd - PAD_OUT, z1: hd + PLAZA_FRONT, lift: PAD_LIFT },
      { x0: PLAZA_BORDER - hw, x1: hw - PLAZA_BORDER, z0: PLAZA_BORDER - hd, z1: hd - PLAZA_LIP, lift: LIFT.plaza },
    ];
  if (lot.ground === "paved") return [{ x0: -hw, x1: hw, z0: -hd, z1: hd + PAD_OUT, lift: PAD_LIFT }];
  if (lot.ground === "yard") return [{ x0: -PATH_HALF, x1: PATH_HALF, z0: hd + PAD_OUT - PATH_LONG, z1: hd + PAD_OUT, lift: PAD_LIFT }];
  return [];
}

type Ground = (x: number, z: number) => number;

function stand(lot: Lot, lx: number, lz: number, ground: Ground): Frame {
  const at = shift(lot, lx, lz);
  return { ...at, y: ground(at.x, at.z) };
}

function bench(out: Builder, timber: Rgb) {
  slab(out, -0.9, 0.9, 0.35, 0.5, -0.25, 0.25, timber);
  slab(out, -0.9, 0.9, 0.5, 0.95, -0.25, -0.17, timber);
}

function stall(out: Builder, canvas: Rgb, wares: readonly Rgb[], timber: Rgb) {
  const { hw, hd, height } = STALL;
  const eave = height - STALL_EAVE;
  for (const x of [-hw, hw]) for (const z of [-hd, hd]) post(out, x - 0.06, x + 0.06, 0, eave, z - 0.06, z + 0.06, timber);
  const ew = hw + STALL_OVER;
  const ed = hd + STALL_OVER;
  for (const side of [-1, 1]) {
    out.quad([-ew * side, eave, ed * side], [ew * side, eave, ed * side], [ew * side, height, 0], [-ew * side, height, 0], canvas);
    out.quad([ew * side, eave, ed * side], [-ew * side, eave, ed * side], [-ew * side, height, 0], [ew * side, height, 0], canvas);
    out.tri([ew * side, eave, ed * side], [ew * side, eave, -ed * side], [ew * side, height, 0], canvas);
  }
  const { half, top, leg } = COUNTER;
  slab(out, -hw + 0.1, hw - 0.1, top - 0.1, top, -half, half, timber);
  for (const x of [-hw + 0.5, hw - 0.5]) post(out, x - 0.05, x + 0.05, 0, top - 0.1, -leg, leg, timber);
  const wide = (2 * hw - 0.6) / wares.length;
  wares.forEach((rgb, i) => {
    const x0 = -hw + 0.3 + wide * i;
    post(out, x0 + 0.08, x0 + wide - 0.08, top, top + 0.22 + (i % 2) * 0.14, -half + 0.12, half - 0.12, rgb);
  });
}

/** `ground` stands each wall run, stall and bench on the terrain under its middle, where its solid stands. */
export function dress_lot(pads: Builder, out: Builder, lot: Lot, tones: MeshTones, ground: Ground) {
  const hd = lot.d / 2;
  const { pave, square, stone, timber, awnings, walls } = tones.town;
  pads.at(lot);
  lot_paving(lot).forEach(({ x0, x1, z0, z1, lift }, i) => pads.quad([x0, lift, z1], [x1, lift, z1], [x1, lift, z0], [x0, lift, z0], i ? square : pave));
  if (lot.ground === "plaza") {
    stall_spots(lot).forEach((spot, i) => {
      const wares = [0, 1, 2].map((k) => (k === 1 ? walls[(i + 1) % walls.length] : awnings[(i + k + 1) % awnings.length]));
      stall(out.at(stand(lot, spot.x, spot.z, ground)), awnings[i % awnings.length], wares, timber);
    });
    for (const side of [-1, 1]) bench(out.at(stand(lot, side * (lot.w / 2 - BENCH_IN.side), -hd + BENCH_IN.back, ground)), timber);
  } else if (lot.ground === "yard")
    for (const run of wall_runs(lot)) {
      out.at(stand(lot, run.x, run.z, ground));
      post(out, -run.hw, run.hw, -0.6, WALL_TOP, -WALL_HALF, WALL_HALF, stone);
    }
}
