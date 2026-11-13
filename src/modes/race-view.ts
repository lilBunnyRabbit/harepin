import * as THREE from "three";
import { brand } from "../theme/palette";
import { item_geometry, item_material } from "../world/jumps";
import { cast_instanced } from "../render/shadow-depth";
import { Beams } from "./beams";
import { CHEVRON_VERTS, Marks, type Ground } from "./marks";
import { gate_shown, type RaceCourse } from "./races";
import type { RoutePoint } from "./route";

const LINE = 2;
const GATE = 4;
const DIM = 0.3;
/** Metres between the arrowheads that lead the way to the next gate. */
const LEAD_PITCH = 10;
const LEAD_SHAPE = { half: 2.2, depth: 2.4, bar: 1.1 };
const LEAD_OPACITY = 0.85;
/** Route points before a gate kept clear of arrowheads, so the gate band reads on its own. */
const GATE_CLEAR = 3;

/** What the view marks out: a race course, or a duel's stretch of the circuit with its own line and gates. */
export interface Course {
  line: readonly RoutePoint[];
  gates: readonly number[];
  route: Pick<RaceCourse["route"], "closed" | "gate_hw" | "closure">;
}

export class RaceView {
  private readonly marks: Marks;
  private readonly gates: THREE.Mesh[];
  private readonly dim: THREE.Material;
  private readonly lit: THREE.Material;
  private readonly closure: THREE.InstancedMesh;
  private readonly beams: Beams;
  private readonly lead: THREE.Mesh;
  /** Line index of each arrowhead, ascending. */
  private readonly lead_at: number[];
  private lead_first = -1;
  private lead_end = -1;
  private readonly closed: boolean;

  constructor(course: Course, ground: Ground) {
    const { line, gates, route } = course;
    this.closed = route.closed;
    this.marks = new Marks(ground);
    this.dim = this.marks.paint(brand.accent, DIM);
    this.lit = this.marks.paint(brand.accent);
    if (!route.closed) this.marks.across(line[0], route.gate_hw, LINE, this.marks.paint(brand.accent));
    const finish = this.marks.paint(brand.success);
    this.gates = gates.map((at, i) => (i === gates.length - 1 ? this.marks.across(line[at], route.gate_hw, LINE, finish) : this.marks.across(line[at], route.gate_hw, GATE, this.dim)));
    this.beams = new Beams(this.marks, ground, gates.map((at) => line[at]));
    this.closure = this.cones(route.closure);
    this.root.add(this.closure);
    this.lead_at = spaced(line, LEAD_PITCH);
    this.lead = this.marks.chevrons(
      this.lead_at.map((i) => line[i]),
      LEAD_SHAPE,
      this.marks.paint(brand.accent, LEAD_OPACITY),
    );
    this.aim(0);
    this.guide(0, 0);
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

  update(dt: number) {
    this.beams.update(dt);
  }

  /** Shows the arrowheads past line index `from` up to the gate at line index `to`; `guide(0, 0)` hides them all. */
  guide(from: number, to: number) {
    const first = after(this.lead_at, from);
    const end = Math.max(first, after(this.lead_at, to - GATE_CLEAR));
    if (first === this.lead_first && end === this.lead_end) return;
    this.lead_first = first;
    this.lead_end = end;
    this.lead.geometry.setDrawRange(first * CHEVRON_VERTS, (end - first) * CHEVRON_VERTS);
  }

  dispose() {
    this.closure.dispose();
    this.marks.dispose();
  }
}

function spaced(line: readonly RoutePoint[], pitch: number): number[] {
  const at: number[] = [];
  let walked = pitch;
  for (let i = 1; i < line.length; i++) {
    walked += Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z);
    if (walked >= pitch) {
      at.push(i);
      walked = 0;
    }
  }
  return at;
}

/** The first slot of ascending `sorted` holding a value above `value`. */
function after(sorted: readonly number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
