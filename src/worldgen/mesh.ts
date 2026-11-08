export type Rgb = [number, number, number];
export type V3 = [number, number, number];
export type Sphere = [number, number, number, number];

export interface Frame {
  x: number;
  y: number;
  z: number;
  fx: number;
  fz: number;
}

const EAVE = 0.3;

/** Triangle soup with flat vertex colours; everything it makes is drawn flat-shaded, so it carries no normals. */
export class Builder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];

  /** With `ground`, every vertex sits `ly` above the terrain under it instead of above the frame's y. */
  constructor(
    private frame: Frame = { x: 0, y: 0, z: 0, fx: 0, fz: 1 },
    private readonly ground?: (x: number, z: number) => number,
  ) {}

  get vertices() {
    return this.positions.length / 3;
  }

  at(frame: Frame) {
    this.frame = frame;
    return this;
  }

  private push([lx, ly, lz]: V3, rgb: Rgb) {
    const { x, y, z, fx, fz } = this.frame;
    const px = x + fz * lx + fx * lz;
    const pz = z - fx * lx + fz * lz;
    this.positions.push(px, (this.ground ? this.ground(px, pz) : y) + ly, pz);
    this.colors.push(rgb[0], rgb[1], rgb[2]);
  }

  tri(a: V3, b: V3, c: V3, rgb: Rgb) {
    this.push(a, rgb);
    this.push(b, rgb);
    this.push(c, rgb);
  }

  quad(a: V3, b: V3, c: V3, d: V3, rgb: Rgb) {
    this.tri(a, b, c, rgb);
    this.tri(a, c, d, rgb);
  }

  walls(hw: number, hd: number, y0: number, y1: number, rgb: Rgb) {
    this.quad([-hw, y0, hd], [hw, y0, hd], [hw, y1, hd], [-hw, y1, hd], rgb);
    this.quad([hw, y0, -hd], [-hw, y0, -hd], [-hw, y1, -hd], [hw, y1, -hd], rgb);
    this.quad([hw, y0, hd], [hw, y0, -hd], [hw, y1, -hd], [hw, y1, hd], rgb);
    this.quad([-hw, y0, -hd], [-hw, y0, hd], [-hw, y1, hd], [-hw, y1, -hd], rgb);
  }

  top(hw: number, hd: number, y: number, rgb: Rgb) {
    this.quad([-hw, y, hd], [hw, y, hd], [hw, y, -hd], [-hw, y, -hd], rgb);
  }

  gable(hw: number, hd: number, y: number, rise: number, roof: Rgb, wall: Rgb) {
    const ew = hw + EAVE;
    const ed = hd + EAVE;
    this.quad([-ew, y, ed], [ew, y, ed], [ew, y + rise, 0], [-ew, y + rise, 0], roof);
    this.quad([ew, y, -ed], [-ew, y, -ed], [-ew, y + rise, 0], [ew, y + rise, 0], roof);
    this.tri([hw, y, hd], [hw, y, -hd], [hw, y + rise, 0], wall);
    this.tri([-hw, y, -hd], [-hw, y, hd], [-hw, y + rise, 0], wall);
  }

  hip(hw: number, hd: number, y: number, rise: number, roof: Rgb) {
    const ew = hw + EAVE;
    const ed = hd + EAVE;
    const ridge = Math.max(0, hw - hd);
    this.quad([-ew, y, ed], [ew, y, ed], [ridge, y + rise, 0], [-ridge, y + rise, 0], roof);
    this.quad([ew, y, -ed], [-ew, y, -ed], [-ridge, y + rise, 0], [ridge, y + rise, 0], roof);
    this.tri([ew, y, ed], [ew, y, -ed], [ridge, y + rise, 0], roof);
    this.tri([-ew, y, -ed], [-ew, y, ed], [-ridge, y + rise, 0], roof);
  }
}

export function turned(b: Frame): Frame {
  return { x: b.x, y: b.y, z: b.z, fx: b.fz, fz: -b.fx };
}

export function bounding_sphere(positions: ArrayLike<number>): Sphere {
  let x0 = Infinity;
  let y0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const cz = (z0 + z1) / 2;
  let r2 = 0;
  for (let i = 0; i < positions.length; i += 3) r2 = Math.max(r2, (positions[i] - cx) ** 2 + (positions[i + 1] - cy) ** 2 + (positions[i + 2] - cz) ** 2);
  return [cx, cy, cz, Math.sqrt(r2)];
}
