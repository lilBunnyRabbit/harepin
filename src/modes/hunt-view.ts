import * as THREE from "three";
import { brand, color } from "../palette";
import { GATE_RADIUS, type Hunt } from "./hunt";

const BEAM = { radius: 0.9, height: 60 };
const RING = 0.6;
const LIFT = 0.15;
const DIM = 0.22;
const LIT = 0.55;
const PULSE = 0.15;

interface Ground {
  height(x: number, z: number): number;
}

interface GateMesh {
  group: THREE.Group;
  beam: THREE.MeshBasicMaterial;
}

export class HuntView {
  readonly root = new THREE.Group();
  private readonly gates: GateMesh[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private time = 0;
  private target = -1;

  constructor(hunt: Hunt, ground: Ground) {
    const beam = new THREE.CylinderGeometry(BEAM.radius, BEAM.radius, BEAM.height, 12, 1, true).translate(0, BEAM.height / 2, 0);
    const ring = new THREE.RingGeometry(GATE_RADIUS - RING, GATE_RADIUS, 48).rotateX(-Math.PI / 2);
    const ring_material = new THREE.MeshBasicMaterial({ color: color(brand.accent), transparent: true, opacity: 0.8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    this.geometries.push(beam, ring);
    this.materials.push(ring_material);
    for (const gate of hunt.gates) {
      const group = new THREE.Group();
      group.position.set(gate.x, ground.height(gate.x, gate.z) + LIFT, gate.z);
      const material = new THREE.MeshBasicMaterial({ color: color(brand.accent), transparent: true, opacity: DIM, depthWrite: false, side: THREE.DoubleSide });
      this.materials.push(material);
      group.add(new THREE.Mesh(beam, material), new THREE.Mesh(ring, ring_material));
      this.root.add(group);
      this.gates.push({ group, beam: material });
    }
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
    this.root.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
