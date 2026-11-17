import * as THREE from "three";
import { brand } from "../theme/palette";
import { item_geometry, item_material } from "../world/jumps";
import { cast_instanced } from "../render/shadow-depth";
import { Beams } from "./beams";
import { Lead } from "./lead";
import { Marks, type DrawnGround } from "./marks";
import { WrongWay } from "./wrong-way";
import { gate_shown, type RaceCourse } from "./races";
import type { RoutePoint } from "./route";

const LINE = 2;
const GATE = 4;
const TRAP = 3;
const DIM = 0.3;

/** What the view marks out: a race course, or a duel's stretch of the circuit with its own line and gates. */
export interface Course {
  line: readonly RoutePoint[];
  gates: readonly number[];
  route: Pick<RaceCourse["route"], "closed" | "gate_hw" | "road" | "closure">;
}

export class RaceView {
  private readonly marks: Marks;
  private readonly gates: THREE.Mesh[];
  private readonly traps: THREE.Mesh[];
  private readonly dim: THREE.Material;
  private readonly lit: THREE.Material;
  private readonly closure: THREE.InstancedMesh;
  private readonly beams: Beams;
  private readonly lead: Lead;
  private readonly wrong = new WrongWay();
  private readonly line: readonly RoutePoint[];
  private readonly half: number;
  private readonly closed: boolean;

  /** `traps`: line indices of a speed trap run's traps, banded across the road until passed. */
  constructor(course: Course, ground: DrawnGround, traps: readonly number[] = []) {
    const { line, gates, route } = course;
    this.closed = route.closed;
    this.marks = new Marks(ground);
    this.dim = this.marks.paint(brand.accent, DIM);
    this.lit = this.marks.paint(brand.accent);
    if (!route.closed) this.marks.across(line[0], route.gate_hw, LINE, this.marks.paint(brand.accent));
    const finish = this.marks.paint(brand.success);
    this.gates = gates.map((at, i) => (i === gates.length - 1 ? this.marks.across(line[at], route.gate_hw, LINE, finish) : this.marks.across(line[at], route.gate_hw, GATE, this.dim)));
    const trap = this.marks.paint(brand.warning);
    this.traps = traps.map((at) => this.marks.across(line[at], route.gate_hw, TRAP, trap));
    this.beams = new Beams(this.marks, ground, gates.map((at) => line[at]));
    this.closure = this.cones(route.closure);
    this.root.add(this.closure);
    this.line = line;
    this.half = route.gate_hw;
    this.lead = new Lead(this.marks, line, route.road, route.closed);
    this.aim(0);
  }

  private cones(closure: Course["route"]["closure"]): THREE.InstancedMesh {
    const meshes = new THREE.InstancedMesh(this.marks.track(item_geometry("cone")), this.marks.track(item_material("cone")), closure.length);
    cast_instanced(meshes);
    const matrix = new THREE.Matrix4();
    closure.forEach((solid, i) => {
      meshes.setMatrixAt(i, matrix.makeTranslation(solid.x, solid.y, solid.z));
    });
    return meshes;
  }

  get root(): THREE.Group {
    return this.marks.root;
  }

  aim(next: number) {
    const { closed } = this;
    const count = this.gates.length;
    this.gates.forEach((gate, i) => {
      if (i < count - 1) gate.material = i === next ? this.lit : this.dim;
      gate.visible = gate_shown(i, next, count, closed);
    });
    this.beams.aim(next);
    this.beams.groups.forEach((beam, i) => {
      beam.visible = gate_shown(i, next, count, closed);
    });
  }

  trap_passed(i: number) {
    const trap = this.traps[i];
    if (trap) trap.visible = false;
  }

  update(dt: number) {
    this.beams.update(dt);
  }

  /** The ground where `inside` streamed in: what was laid there on stand-in ground goes down on it. */
  ground_in(inside: (x: number, z: number) => boolean) {
    this.marks.relay(inside);
    this.beams.relay(inside);
  }

  /** Lights the route from line index `at`, where the car heading `heading` stands `offset` metres off the line, and on over the line when `more` laps follow; true while it faces the wrong way. */
  guide(at: number, heading: number, offset: number, more = false): boolean {
    const i = Math.max(0, Math.min(this.line.length - 1, at));
    const wrong = this.wrong.update(this.line[i], heading, offset, this.half);
    this.lead.show(i, wrong, more);
    return wrong;
  }

  unguide() {
    this.wrong.reset();
    this.lead.hide();
  }

  dispose() {
    this.closure.dispose();
    this.marks.dispose();
  }
}
