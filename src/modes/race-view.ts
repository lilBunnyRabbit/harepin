import * as THREE from "three";
import { brand, color } from "../theme/palette";
import { Marks, type Ground } from "./marks";
import type { RaceCourse } from "./races";

const LINE = 0.6;
const GATE = 0.4;
const DIM = 0.3;
const CONE_SEGMENTS = 10;

export class RaceView {
  private readonly marks: Marks;
  private readonly gates: THREE.Mesh[];
  private readonly dim: THREE.Material;
  private readonly lit: THREE.Material;
  private readonly closure: THREE.InstancedMesh;

  constructor(course: RaceCourse, ground: Ground) {
    const { line, gates, route } = course;
    this.marks = new Marks(ground);
    this.dim = this.marks.paint(brand.accent, DIM);
    this.lit = this.marks.paint(brand.accent);
    if (!route.closed) this.marks.across(line[0], route.gate_hw, LINE, this.marks.paint(brand.accent));
    const finish = this.marks.paint(brand.success);
    this.gates = gates.map((at, i) => (i === gates.length - 1 ? this.marks.across(line[at], route.gate_hw, LINE, finish) : this.marks.across(line[at], route.gate_hw, GATE, this.dim)));
    this.closure = this.cones(route.closure);
    this.root.add(this.closure);
    this.aim(0);
  }

  private cones(closure: RaceCourse["route"]["closure"]): THREE.InstancedMesh {
    const material = this.marks.track(new THREE.MeshLambertMaterial({ color: color(brand.warning) }));
    const meshes = new THREE.InstancedMesh(this.marks.track(new THREE.ConeGeometry(1, 1, CONE_SEGMENTS).translate(0, 0.5, 0)), material, closure.length);
    meshes.castShadow = true;
    const matrix = new THREE.Matrix4();
    closure.forEach((solid, i) => {
      meshes.setMatrixAt(i, matrix.makeScale(solid.radius, solid.height, solid.radius).setPosition(solid.x, solid.y, solid.z));
    });
    return meshes;
  }

  get root(): THREE.Group {
    return this.marks.root;
  }

  aim(next: number) {
    this.gates.forEach((gate, i) => {
      if (i < this.gates.length - 1) gate.material = i === next ? this.lit : this.dim;
      gate.visible = i >= next;
    });
  }

  dispose() {
    this.closure.dispose();
    this.marks.dispose();
  }
}
