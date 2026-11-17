import * as THREE from "three";
import { color } from "../theme/palette";
import type { RoutePoint } from "./route";

// Over the drawn ground: a road or paving stands a few centimetres over the terrain, and paint laid from the terrain would
// float over one and sink under the other.
const LIFT = 0.07;
const STEP = 1;
/** Vertices one `chevron` adds; a run of chevrons is shown or hidden by draw range in these units. */
export const CHEVRON_VERTS = 12;

type Tone = Parameters<typeof color>[0];

export interface Ground {
  height(x: number, z: number): number;
}

/** Ground a view lays paint on: `drawn_lift` is how far the road or paving drawn there stands over `height`. */
export interface DrawnGround extends Ground {
  drawn_lift(x: number, z: number): number;
}

export function drawn_height(ground: DrawnGround, x: number, z: number): number {
  return ground.height(x, z) + ground.drawn_lift(x, z);
}

export interface Chevron {
  half: number;
  depth: number;
  bar: number;
}

export class Marks {
  readonly root = new THREE.Group();
  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly laid: THREE.BufferGeometry[] = [];

  constructor(private readonly ground: DrawnGround) {}

  paint(tone: Tone, opacity = 0.9): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({ color: color(tone), transparent: true, opacity, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    this.materials.push(material);
    return material;
  }

  /** The point `u` metres left of `p` and `v` along it, `rise` over the drawn ground. */
  point(p: RoutePoint, u: number, v: number, rise = 0): [number, number, number] {
    return this.drape(p.x + p.tz * u + p.tx * v, p.z - p.tx * u + p.tz * v, rise);
  }

  drape(x: number, z: number, rise = 0): [number, number, number] {
    return [x, drawn_height(this.ground, x, z) + LIFT + rise, z];
  }

  /** `rise`: metres each vertex stands over the ground, for paint that is not flat on it. */
  mesh(positions: number[], material: THREE.Material, rise?: number[]): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    if (rise) geometry.setAttribute("rise", new THREE.Float32BufferAttribute(rise, 1));
    this.geometries.push(geometry);
    this.laid.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    this.root.add(mesh);
    return mesh;
  }

  // A deep band crosses bumps along the road too, so it is draped on a grid both ways.
  across(p: RoutePoint, half: number, width: number, material: THREE.Material): THREE.Mesh {
    const positions: number[] = [];
    const cols = Math.max(1, Math.ceil((half * 2) / STEP));
    const rows = Math.max(1, Math.ceil(width / STEP));
    for (let i = 0; i < cols; i++) {
      const u0 = -half + (i * half * 2) / cols;
      const u1 = -half + ((i + 1) * half * 2) / cols;
      for (let j = 0; j < rows; j++) {
        const v0 = -width / 2 + (j * width) / rows;
        const v1 = -width / 2 + ((j + 1) * width) / rows;
        const q = [this.point(p, u0, v0), this.point(p, u0, v1), this.point(p, u1, v0), this.point(p, u1, v1)];
        for (const k of [0, 1, 2, 2, 1, 3]) positions.push(...q[k]);
      }
    }
    return this.mesh(positions, material);
  }

  /** One mesh of arrowheads pointing along each point, `CHEVRON_VERTS` apiece in the order given. */
  chevrons(points: readonly RoutePoint[], shape: Chevron, material: THREE.Material): THREE.Mesh {
    const { half, depth, bar } = shape;
    const positions: number[] = [];
    for (const p of points) {
      const back = -(depth + bar) / 2;
      const tip = back + depth;
      for (const side of [-1, 1]) {
        const q = [this.point(p, side * half, back), this.point(p, side * half, back + bar), this.point(p, 0, tip), this.point(p, 0, tip + bar)];
        for (const k of [0, 1, 2, 2, 1, 3]) positions.push(...q[k]);
      }
    }
    return this.mesh(positions, material);
  }

  /** Lays every painted vertex where `inside` on the ground again: the ground there streamed in after the paint went down. */
  relay(inside: (x: number, z: number) => boolean) {
    for (const geometry of this.laid) {
      const at = geometry.getAttribute("position");
      const rise = geometry.getAttribute("rise");
      const a = at.array;
      let moved = false;
      for (let i = 0; i < a.length; i += 3) {
        if (!inside(a[i], a[i + 2])) continue;
        a[i + 1] = drawn_height(this.ground, a[i], a[i + 2]) + LIFT + (rise ? rise.getX(i / 3) : 0);
        moved = true;
      }
      if (!moved) continue;
      at.needsUpdate = true;
      geometry.computeBoundingSphere();
    }
  }

  track<T extends THREE.BufferGeometry | THREE.Material>(thing: T): T {
    if (thing instanceof THREE.Material) this.materials.push(thing);
    else this.geometries.push(thing);
    return thing;
  }

  dispose() {
    this.root.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
