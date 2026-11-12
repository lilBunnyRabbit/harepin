import * as THREE from "three";
import { brand } from "../theme/palette";
import { Beams } from "./beams";
import { GATE_RADIUS, type Hunt } from "./hunt";
import { Marks, type Ground } from "./marks";

const RING = 0.6;

export class HuntView {
  private readonly marks: Marks;
  private readonly beams: Beams;

  constructor(hunt: Hunt, ground: Ground) {
    this.marks = new Marks(ground);
    this.beams = new Beams(this.marks, ground, hunt.gates);
    const ring = this.marks.track(new THREE.RingGeometry(GATE_RADIUS - RING, GATE_RADIUS, 48).rotateX(-Math.PI / 2));
    const ring_material = this.marks.paint(brand.accent, 0.8);
    for (const group of this.beams.groups) group.add(new THREE.Mesh(ring, ring_material));
  }

  get root(): THREE.Group {
    return this.marks.root;
  }

  found(index: number) {
    const gate = this.beams.groups[index];
    if (gate) gate.visible = false;
  }

  aim(index: number) {
    this.beams.aim(index);
  }

  update(dt: number) {
    this.beams.update(dt);
  }

  dispose() {
    this.marks.dispose();
  }
}
