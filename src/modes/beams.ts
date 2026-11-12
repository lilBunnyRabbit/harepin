import * as THREE from "three";
import { brand, color } from "../theme/palette";
import type { Ground, Marks } from "./marks";

const BEAM = { radius: 0.9, height: 60 };
const LIFT = 0.15;
const DIM = 0.22;
const LIT = 0.55;
const PULSE = 0.15;

export class Beams {
  readonly groups: THREE.Group[] = [];
  private readonly materials: THREE.MeshBasicMaterial[] = [];
  private time = 0;
  private target = -1;

  constructor(marks: Marks, ground: Ground, points: readonly { x: number; z: number }[]) {
    const beam = marks.track(new THREE.CylinderGeometry(BEAM.radius, BEAM.radius, BEAM.height, 12, 1, true).translate(0, BEAM.height / 2, 0));
    for (const p of points) {
      const group = new THREE.Group();
      group.position.set(p.x, ground.height(p.x, p.z) + LIFT, p.z);
      const material = marks.track(new THREE.MeshBasicMaterial({ color: color(brand.accent), transparent: true, opacity: DIM, depthWrite: false, side: THREE.DoubleSide }));
      group.add(new THREE.Mesh(beam, material));
      marks.root.add(group);
      this.groups.push(group);
      this.materials.push(material);
    }
  }

  aim(index: number) {
    this.target = index;
  }

  update(dt: number) {
    this.time += dt;
    this.materials.forEach((material, i) => {
      material.opacity = i === this.target ? LIT + Math.sin(this.time * 4) * PULSE : DIM;
    });
  }
}
