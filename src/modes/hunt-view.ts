import * as THREE from "three";
import { brand, color } from "../palette";
import { GATE_RADIUS, type Hunt } from "./hunt";
import { Marks, type Ground } from "./marks";

const BEAM = { radius: 0.9, height: 60 };
const RING = 0.6;
const LIFT = 0.15;
const DIM = 0.22;
const LIT = 0.55;
const PULSE = 0.15;

interface GateMesh {
  group: THREE.Group;
  beam: THREE.MeshBasicMaterial;
}

export class HuntView {
  private readonly marks: Marks;
  private readonly gates: GateMesh[] = [];
  private time = 0;
  private target = -1;

  constructor(hunt: Hunt, ground: Ground) {
    this.marks = new Marks(ground);
    const beam = this.marks.track(new THREE.CylinderGeometry(BEAM.radius, BEAM.radius, BEAM.height, 12, 1, true).translate(0, BEAM.height / 2, 0));
    const ring = this.marks.track(new THREE.RingGeometry(GATE_RADIUS - RING, GATE_RADIUS, 48).rotateX(-Math.PI / 2));
    const ring_material = this.marks.paint(brand.accent, 0.8);
    for (const gate of hunt.gates) {
      const group = new THREE.Group();
      group.position.set(gate.x, ground.height(gate.x, gate.z) + LIFT, gate.z);
      const material = this.marks.track(new THREE.MeshBasicMaterial({ color: color(brand.accent), transparent: true, opacity: DIM, depthWrite: false, side: THREE.DoubleSide }));
      group.add(new THREE.Mesh(beam, material), new THREE.Mesh(ring, ring_material));
      this.marks.root.add(group);
      this.gates.push({ group, beam: material });
    }
  }

  get root(): THREE.Group {
    return this.marks.root;
  }

  found(index: number) {
    const gate = this.gates[index];
    if (gate) gate.group.visible = false;
  }

  aim(index: number) {
    this.target = index;
  }

  update(dt: number) {
    this.time += dt;
    this.gates.forEach((gate, i) => {
      gate.beam.opacity = i === this.target ? LIT + Math.sin(this.time * 4) * PULSE : DIM;
    });
  }

  dispose() {
    this.marks.dispose();
  }
}
