import * as THREE from "three";
import { brand, color } from "../theme/palette";
import type { Ground, Marks } from "./marks";
import { sin } from "../sim-math";

const BEAM = { radius: 0.9, height: 60 };
const LIFT = 0.15;
const DIM = 0.22;
const LIT = 0.55;
const PULSE = 0.15;
/** A missed gate's beam: full strength, pulsing twice as fast, so it reads over the shoulder. */
const CALL = 0.8;
const CALL_RATE = 8;

export class Beams {
  readonly groups: THREE.Group[] = [];
  private readonly materials: THREE.MeshBasicMaterial[] = [];
  private time = 0;
  private target = -1;
  private called = false;

  constructor(
    marks: Marks,
    private readonly ground: Ground,
    points: readonly { x: number; z: number }[],
  ) {
    const beam = marks.track(new THREE.CylinderGeometry(BEAM.radius, BEAM.radius, BEAM.height, 12, 1, true).translate(0, BEAM.height / 2, 0));
    for (const p of points) {
      const group = new THREE.Group();
      group.position.set(p.x, ground.height(p.x, p.z) + LIFT, p.z);
      const material = marks.track(new THREE.MeshBasicMaterial({ color: color(brand.accent), transparent: true, opacity: DIM, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }));
      group.add(new THREE.Mesh(beam, material));
      marks.root.add(group);
      this.groups.push(group);
      this.materials.push(material);
    }
  }

  /** Stands each beam where `inside` on the ground again, as `Marks.relay` does the paint. */
  relay(inside: (x: number, z: number) => boolean) {
    for (const { position } of this.groups) if (inside(position.x, position.z)) position.y = this.ground.height(position.x, position.z) + LIFT;
  }

  aim(index: number) {
    this.target = index;
  }

  /** `on`: the aimed gate was missed, so its beam calls the car back. */
  call(on: boolean) {
    this.called = on;
  }

  update(dt: number) {
    this.time += dt;
    const { materials, called } = this;
    const lit = called ? CALL + sin(this.time * CALL_RATE) * PULSE : LIT + sin(this.time * 4) * PULSE;
    for (let i = 0; i < materials.length; i++) materials[i].opacity = i === this.target ? lit : DIM;
  }
}
