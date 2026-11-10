import * as THREE from "three";
import { parked_car_geometry, parked_cars } from "../buildings";
import { brand, car_paints, color, tones } from "../palette";
import { mulberry32, sub } from "../rng";
import { to_world, type Site } from "./gymkhana";
import { Marks, type Ground } from "./marks";
import { CONE_RADIUS, type ParkBay, type ParkLevel } from "./parking";

const LINE_LIFT = 0.08;
// Paint follows the ground in short pieces, or a long strip cuts under the pad between terrain samples.
const PAINT_STEP = 0.5;
const PAD_LIFT = 0.03;
const PAD_STEP = 2;
const PAD_MARGIN = 3;
const ARROW = 1.4;
const PAINT = 0.12;

export class ParkingView {
  private readonly marks: Marks;
  private readonly target: THREE.MeshBasicMaterial;
  private cars: THREE.InstancedMesh | null = null;

  constructor(
    private readonly site: Site,
    level: ParkLevel,
    private readonly ground: Ground,
    seed: number,
    area: { u0: number; u1: number; v0: number; v1: number },
  ) {
    this.marks = new Marks(ground);
    this.root.add(this.pad(area));
    for (const bay of level.lines) this.root.add(this.bay_line(bay, this.marks.paint(tones.line, 0.7)));
    this.target = this.marks.paint(brand.accent, 1);
    this.root.add(this.bay_line(level.bay, this.target));
    if (!level.bay.either) this.root.add(this.arrow(level.bay));
    const rng = mulberry32(sub(seed, `parking:${level.id}`));
    const cars = level.obstacles
      .filter((o) => o.kind === "car")
      .map((o) => {
        const { x, z } = to_world(site, o.u, o.v);
        return { x, y: ground.height(x, z), z, heading: site.heading + o.heading, paint: color(car_paints[Math.floor(rng() * car_paints.length)]) };
      });
    if (cars.length) {
      const shape = this.marks.track(parked_car_geometry());
      const material = this.marks.track(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      this.cars = parked_cars(cars, shape, material);
      this.root.add(this.cars);
    }
    const cone_shape = this.marks.track(new THREE.ConeGeometry(CONE_RADIUS, 1, 10).translate(0, 0.5, 0));
    const cone_material = this.marks.track(new THREE.MeshLambertMaterial({ color: color(brand.warning) }));
    const wall_shape = this.marks.track(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    const wall_material = this.marks.track(new THREE.MeshLambertMaterial({ color: color(tones.wall), flatShading: true }));
    for (const o of level.obstacles) {
      if (o.kind === "car") continue;
      const { x, z } = to_world(site, o.u, o.v);
      const mesh = o.kind === "cone" ? new THREE.Mesh(cone_shape, cone_material) : new THREE.Mesh(wall_shape, wall_material);
      mesh.position.set(x, ground.height(x, z), z);
      mesh.rotation.y = site.heading + o.heading;
      mesh.scale.set(o.kind === "cone" ? 1 : o.w, o.h, o.kind === "cone" ? 1 : o.l);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
    }
  }

  private point(u: number, v: number, lift = LINE_LIFT): THREE.Vector3 {
    const { x, z } = to_world(this.site, u, v);
    return new THREE.Vector3(x, this.ground.height(x, z) + lift, z);
  }

  private bay_point(bay: ParkBay, across: number, along: number): THREE.Vector3 {
    const c = Math.cos(bay.heading);
    const s = Math.sin(bay.heading);
    return this.point(bay.u + across * c + along * s, bay.v - across * s + along * c);
  }

  private strips(bay: ParkBay, segments: [number, number, number, number][], material: THREE.MeshBasicMaterial): THREE.Mesh {
    const positions: number[] = [];
    for (const [a0, l0, a1, l1] of segments) {
      const len = Math.hypot(a1 - a0, l1 - l0);
      const na = (-(l1 - l0) / len) * (PAINT / 2);
      const nl = ((a1 - a0) / len) * (PAINT / 2);
      const steps = Math.max(1, Math.ceil(len / PAINT_STEP));
      for (let k = 0; k < steps; k++) {
        const s = k / steps;
        const e = (k + 1) / steps;
        const as = a0 + (a1 - a0) * s;
        const ls = l0 + (l1 - l0) * s;
        const ae = a0 + (a1 - a0) * e;
        const le = l0 + (l1 - l0) * e;
        const p = [this.bay_point(bay, as + na, ls + nl), this.bay_point(bay, as - na, ls - nl), this.bay_point(bay, ae + na, le + nl), this.bay_point(bay, ae - na, le - nl)];
        for (const i of [0, 1, 2, 2, 1, 3]) positions.push(p[i].x, p[i].y, p[i].z);
      }
    }
    const geometry = this.marks.track(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.Mesh(geometry, material);
  }

  private bay_line(bay: ParkBay, material: THREE.MeshBasicMaterial): THREE.Mesh {
    const hw = bay.w / 2;
    const hl = bay.l / 2;
    return this.strips(
      bay,
      [
        [-hw, -hl, hw, -hl],
        [hw, -hl, hw, hl],
        [hw, hl, -hw, hl],
        [-hw, hl, -hw, -hl],
      ],
      material,
    );
  }

  private arrow(bay: ParkBay): THREE.Mesh {
    const tip = bay.l / 2 - 0.8;
    return this.strips(
      bay,
      [
        [0, -tip, 0, tip],
        [0, tip, -ARROW / 2, tip - ARROW / 2],
        [0, tip, ARROW / 2, tip - ARROW / 2],
      ],
      this.target,
    );
  }

  private pad(area: { u0: number; u1: number; v0: number; v1: number }): THREE.Mesh {
    const u0 = area.u0 - PAD_MARGIN;
    const v0 = area.v0 - PAD_MARGIN;
    const nu = Math.ceil((area.u1 + PAD_MARGIN - u0) / PAD_STEP);
    const nv = Math.ceil((area.v1 + PAD_MARGIN - v0) / PAD_STEP);
    const positions: number[] = [];
    for (let j = 0; j <= nv; j++)
      for (let i = 0; i <= nu; i++) {
        const p = this.point(u0 + i * PAD_STEP, v0 + j * PAD_STEP, PAD_LIFT);
        positions.push(p.x, p.y, p.z);
      }
    const index: number[] = [];
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i;
        const b = a + nu + 1;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    this.marks.track(geometry);
    const material = this.marks.track(new THREE.MeshLambertMaterial({ color: color(tones.asphalt), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  get root(): THREE.Group {
    return this.marks.root;
  }

  inside(on: boolean) {
    this.target.color.copy(color(on ? brand.success : brand.accent));
  }

  dispose() {
    this.marks.dispose();
    this.cars?.dispose();
  }
}
