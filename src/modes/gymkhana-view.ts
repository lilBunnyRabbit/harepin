import * as THREE from "three";
import { brand, color, tones } from "../palette";
import { CONE_RADIUS, to_world, type Box, type Course, type Hit } from "./gymkhana";
import { Marks, type Ground } from "./marks";

const CONE_HEIGHT = 0.7;
const FALL_S = 0.35;
const SLIDE = 0.6;
const LINE_LIFT = 0.06;
const LINE_STEP = 1;

interface Fall {
  index: number;
  t: number;
  axis: THREE.Vector3;
  dx: number;
  dz: number;
  slide: number;
}

export class GymkhanaView {
  private readonly marks: Marks;
  private readonly cones: THREE.InstancedMesh;
  private readonly falls: Fall[] = [];
  private readonly base: THREE.Vector3[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly spin_line: THREE.LineLoop;
  private readonly stop_line: THREE.LineLoop;

  constructor(
    readonly course: Course,
    private readonly ground: Ground,
  ) {
    this.marks = new Marks(ground);
    const geometry = this.marks.track(new THREE.ConeGeometry(CONE_RADIUS, CONE_HEIGHT, 10).translate(0, CONE_HEIGHT / 2, 0));
    const material = this.marks.track(new THREE.MeshLambertMaterial({ color: color(brand.warning) }));
    this.cones = new THREE.InstancedMesh(geometry, material, course.cones.length);
    this.cones.castShadow = true;
    course.cones.forEach((cone, index) => {
      const { x, z } = to_world(course.site, cone.u, cone.v);
      const at = new THREE.Vector3(x, ground.height(x, z), z);
      this.base.push(at);
      this.cones.setMatrixAt(index, this.matrix.makeTranslation(at));
    });
    this.root.add(this.cones);
    this.spin_line = this.outline(course.spin, tones.line);
    this.stop_line = this.outline(course.stop, brand.accent);
    const start = this.strip(course.start_line, course.spin.hu + 1);
    this.root.add(this.spin_line, this.stop_line, start);
  }

  private line_material(tone: Parameters<typeof color>[0]): THREE.LineBasicMaterial {
    return this.marks.track(new THREE.LineBasicMaterial({ color: color(tone), transparent: true, opacity: 0.85 }));
  }

  private ground_point(u: number, v: number): THREE.Vector3 {
    const { x, z } = to_world(this.course.site, u, v);
    return new THREE.Vector3(x, this.ground.height(x, z) + LINE_LIFT, z);
  }

  private outline(box: Box, tone: Parameters<typeof color>[0]): THREE.LineLoop {
    const corners: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const points: THREE.Vector3[] = [];
    corners.forEach(([su, sv], i) => {
      const [nu, nv] = corners[(i + 1) % 4];
      const a = { u: box.u + su * box.hu, v: box.v + sv * box.hv };
      const b = { u: box.u + nu * box.hu, v: box.v + nv * box.hv };
      const steps = Math.max(1, Math.ceil(Math.hypot(b.u - a.u, b.v - a.v) / LINE_STEP));
      for (let s = 0; s < steps; s++) points.push(this.ground_point(a.u + ((b.u - a.u) * s) / steps, a.v + ((b.v - a.v) * s) / steps));
    });
    const geometry = this.marks.track(new THREE.BufferGeometry().setFromPoints(points));
    return new THREE.LineLoop(geometry, this.line_material(tone));
  }

  private strip(v: number, half: number): THREE.Line {
    const points: THREE.Vector3[] = [];
    for (let u = -half; u <= half + 1e-6; u += LINE_STEP) points.push(this.ground_point(u, v));
    const geometry = this.marks.track(new THREE.BufferGeometry().setFromPoints(points));
    return new THREE.Line(geometry, this.line_material(tones.line));
  }

  get root(): THREE.Group {
    return this.marks.root;
  }

  target(box: "spin" | "stop" | null) {
    (this.spin_line.material as THREE.LineBasicMaterial).opacity = box === "spin" ? 1 : 0.45;
    (this.stop_line.material as THREE.LineBasicMaterial).opacity = box === "stop" ? 1 : 0.45;
  }

  knock(hits: Hit[]) {
    for (const hit of hits)
      this.falls.push({
        index: hit.cone,
        t: 0,
        axis: new THREE.Vector3(hit.dz, 0, -hit.dx).normalize(),
        dx: hit.dx,
        dz: hit.dz,
        slide: SLIDE + Math.min(3, hit.speed * 0.15),
      });
  }

  update(dt: number) {
    let changed = false;
    for (const fall of this.falls) {
      if (fall.t >= 1) continue;
      fall.t = Math.min(1, fall.t + dt / FALL_S);
      const k = 1 - (1 - fall.t) ** 2;
      const base = this.base[fall.index];
      this.quat.setFromAxisAngle(fall.axis, k * (Math.PI / 2));
      this.pos.set(base.x + fall.dx * fall.slide * k, base.y + CONE_RADIUS * k * 0.5, base.z + fall.dz * fall.slide * k);
      this.cones.setMatrixAt(fall.index, this.matrix.compose(this.pos, this.quat, this.scale));
      changed = true;
    }
    if (changed) this.cones.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.marks.dispose();
    this.cones.dispose();
  }
}
