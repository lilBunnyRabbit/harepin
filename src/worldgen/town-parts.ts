import type { Builder, Frame, Rgb } from "./mesh";

/** Trim stands this far off its wall, glass twice as far; far off only the glass material's polygon offset keeps it in front. */
export const OUT = 0.04;
const NONE: Rgb = [0, 0, 0];
const FRAME = 0.16;

export function shift(b: Frame, lx: number, lz: number): Frame {
  return { x: b.x + b.fz * lx + b.fx * lz, y: b.y, z: b.z - b.fx * lx + b.fz * lz, fx: b.fx, fz: b.fz };
}

export function pane(out: Builder, x0: number, x1: number, y0: number, y1: number, z: number, rgb: Rgb) {
  out.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], rgb);
}

/** Glass facing +z; its colour comes from the glass material. */
export function glazing(glass: Builder, x0: number, x1: number, y0: number, y1: number, z: number) {
  pane(glass, x0, x1, y0, y1, z, NONE);
}

export function back_glazing(glass: Builder, x0: number, x1: number, y0: number, y1: number, z: number) {
  glass.quad([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], NONE);
}

export function framed(out: Builder, glass: Builder, x: number, w: number, y0: number, y1: number, z: number, trim: Rgb) {
  pane(out, x - w / 2 - FRAME, x + w / 2 + FRAME, y0 - FRAME, y1 + FRAME, z + OUT, trim);
  glazing(glass, x - w / 2, x + w / 2, y0, y1, z + OUT * 2);
}

export function bays(hw: number, pitch: number): number[] {
  const n = Math.max(1, Math.floor((2 * hw - 0.8) / pitch));
  const step = (2 * hw) / n;
  return Array.from({ length: n }, (_, i) => -hw + step * (i + 0.5));
}

export function slab(out: Builder, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, rgb: Rgb) {
  post(out, x0, x1, y0, y1, z0, z1, rgb);
  out.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], rgb);
}

export function post(out: Builder, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, rgb: Rgb) {
  out.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], rgb);
  out.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], rgb);
  out.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], rgb);
  out.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], rgb);
  out.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], rgb);
}
