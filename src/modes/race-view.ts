import type * as THREE from "three";
import { brand } from "../palette";
import { Marks, type Ground } from "./marks";
import type { RaceCourse } from "./races";

const LINE = 0.6;
const GATE = 0.4;
const DIM = 0.3;

export class RaceView {
  private readonly marks: Marks;
  private readonly gates: THREE.Mesh[];
  private readonly dim: THREE.Material;
  private readonly lit: THREE.Material;

  constructor(course: RaceCourse, ground: Ground) {
    const { line, gates, route } = course;
    this.marks = new Marks(ground);
    this.dim = this.marks.paint(brand.accent, DIM);
    this.lit = this.marks.paint(brand.accent);
    if (!route.closed) this.marks.across(line[0], route.gate_hw, LINE, this.marks.paint(brand.accent));
    const finish = this.marks.paint(brand.success);
    this.gates = gates.map((at, i) => (i === gates.length - 1 ? this.marks.across(line[at], route.gate_hw, LINE, finish) : this.marks.across(line[at], route.gate_hw, GATE, this.dim)));
    this.aim(0);
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
    this.marks.dispose();
  }
}
