import * as THREE from "three";
import { color } from "../palette";
import type { RoutePoint } from "./route";

const LIFT = 0.1;
const STEP = 1;

type Tone = Parameters<typeof color>[0];

interface Ground {
  height(x: number, z: number): number;
}

export class Marks {
  readonly root = new THREE.Group();
  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];

  constructor(private readonly ground: Ground) {}

  paint(tone: Tone, opacity = 0.9): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({ color: color(tone), transparent: true, opacity, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    this.materials.push(material);
    return material;
  }

  across(p: RoutePoint, half: number, width: number, material: THREE.Material): THREE.Mesh {
    const ax = p.tz;
    const az = -p.tx;
    const positions: number[] = [];
    const point = (u: number, v: number) => {
      const x = p.x + ax * u + p.tx * v;
      const z = p.z + az * u + p.tz * v;
      return [x, this.ground.height(x, z) + LIFT, z];
    };
    const steps = Math.max(1, Math.ceil((half * 2) / STEP));
    for (let i = 0; i < steps; i++) {
      const u0 = -half + (i * half * 2) / steps;
      const u1 = -half + ((i + 1) * half * 2) / steps;
      const q = [point(u0, -width / 2), point(u0, width / 2), point(u1, -width / 2), point(u1, width / 2)];
      for (const k of [0, 1, 2, 2, 1, 3]) positions.push(...q[k]);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    this.root.add(mesh);
    return mesh;
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
