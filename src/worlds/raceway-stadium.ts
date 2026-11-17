import * as THREE from "three";
import { box, merge, tint } from "../car/geometry";
import { cast_instanced } from "../render/shadow-depth";
import { brand, color, dark, tones } from "../theme/palette";
import type { Lab } from "../theme/theme";
import type { World } from "../world/world";
import { tune } from "../worldgen/kinds/options";
import { RACEWAY_KNOBS } from "../worldgen/kinds/raceway";
import { RACEWAY } from "../worldgen/raceway";
import { BAY, BAY_DEPTH, lane_edges, layout_of, MODULE, PIT_FRONT, runs, side_index, STAND_FRONT, stand_depth, TIER, WALL, type Layout } from "../worldgen/raceway-layout";
import { BAY_HEIGHT, GANTRY_HEIGHT, RAIL_HEIGHT, spans, STAND_BACK, STAND_BASE, STAND_RISE, TYRE_HALF, TYRE_HEIGHT, WALL_HALF, WALL_HEIGHT } from "../worldgen/raceway-venue";
import { ROAD_HALF, type RoadPoint } from "../worldgen/types";

/** Metres a piece's walls run on below its floor, so a stand or garage on a slope shows no gap under its low side. */
const SKIRT = 4;
const TYRE_SPACING = 2;
const FLAGS: readonly Lab[] = [brand.primary, brand.cottontail, brand.secondary, brand.accent];

const paint = (geometry: THREE.BufferGeometry, tone: Lab) => tint(geometry, color(tone));

function stand_module(tiers: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const top = (i: number) => STAND_BASE + i * STAND_RISE;
  for (let i = 0; i < tiers; i++) {
    const z = 1 + (i + 0.5) * TIER;
    parts.push(paint(box(MODULE, top(i) + SKIRT, TIER, 0, (top(i) - SKIRT) / 2, z), tones.wall));
    for (const half of [-1, 1]) parts.push(paint(box(MODULE / 2 - 1.6, 0.4, 0.9, half * (MODULE / 4 - 0.1), top(i) + 0.2, z + 0.2), brand.accent));
  }
  const high = top(tiers - 1) + STAND_BACK;
  parts.push(paint(box(MODULE, high + SKIRT, 0.6, 0, (high - SKIRT) / 2, 1 + tiers * TIER + 0.3), tones.wall_trim));
  parts.push(paint(box(MODULE, STAND_BASE + SKIRT, 1, 0, (STAND_BASE - SKIRT) / 2, 0.5), tones.wall_trim));
  return merge(parts);
}

function bay(): THREE.BufferGeometry {
  return merge(
    paint(box(BAY, BAY_HEIGHT - 0.2 + SKIRT, BAY_DEPTH, 0, (BAY_HEIGHT - 0.2 - SKIRT) / 2, BAY_DEPTH / 2), tones.wall),
    paint(box(BAY, 0.6, 0.3, 0, BAY_HEIGHT - 0.5, -0.1), brand.accent),
    paint(box(BAY, 0.35, BAY_DEPTH + 1.6, 0, BAY_HEIGHT, BAY_DEPTH / 2 - 0.4), tones.roof_slate),
  );
}

function gantry(): THREE.BufferGeometry {
  const beam = GANTRY_HEIGHT - 0.65;
  return merge(
    [-1, 1].map((side) => paint(box(1.2, GANTRY_HEIGHT + SKIRT, 1.2, 0, (GANTRY_HEIGHT - SKIRT) / 2, side * WALL), tones.gate)),
    paint(box(1.8, 1.3, 2 * WALL + 1.2, 0, beam, 0), tones.gate),
    [-1, 1].map((side) => paint(box(1.9, 0.9, 3.2, 0, beam, side * (ROAD_HALF - 1)), brand.accent)),
    [-2, -1, 0, 1, 2].map((i) => paint(box(0.4, 0.8, 0.8, -0.6, beam - 0.95, i * 1.1), tones.tyre)),
  );
}

function tyre_stack(): THREE.BufferGeometry {
  return merge([-0.66, 0, 0.66].map((x) => new THREE.CylinderGeometry(TYRE_HALF, TYRE_HALF, TYRE_HEIGHT, 6, 1, true).translate(x, TYRE_HEIGHT / 2, 0)));
}

function flag(): THREE.BufferGeometry {
  return merge(box(0.14, 6.5, 0.14, 0, 3.25, 0), box(2.2, 1.3, 0.06, 1.17, 5.8, 0));
}

class Builder {
  readonly out: THREE.Object3D[] = [];
  private readonly flat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly plain = new THREE.MeshLambertMaterial({ flatShading: true, side: THREE.DoubleSide });
  private readonly glow = new THREE.MeshLambertMaterial({ color: color(tones.shop_glow), emissive: color(tones.shop_glow), emissiveIntensity: dark ? 0.7 : 0 });
  private readonly m = new THREE.Matrix4();
  private readonly x = new THREE.Vector3();
  private readonly y = new THREE.Vector3(0, 1, 0);
  private readonly z = new THREE.Vector3();
  private readonly at = new THREE.Vector3();
  private readonly n: number;

  constructor(
    private readonly world: World,
    private readonly layout: Layout,
  ) {
    this.n = world.road.length;
  }

  private road(s: number): RoadPoint {
    return this.world.road[((s % this.n) + this.n) % this.n];
  }

  private point(p: RoadPoint, off: number): [number, number, number] {
    const x = p.x - p.tz * off;
    const z = p.z + p.tx * off;
    return [x, this.world.height(x, z), z];
  }

  /** A piece's local +x runs along the road and +z away from it, so one model serves both sides unmirrored. */
  private pose(p: RoadPoint, side: number, off: number, ground_off: number, lift = 0): THREE.Matrix4 {
    const [, y] = this.point(p, side * ground_off);
    const [x, , z] = this.point(p, side * off);
    this.x.set(side * p.tx, 0, side * p.tz);
    this.z.set(-side * p.tz, 0, side * p.tx);
    return this.m.makeBasis(this.x, this.y, this.z).setPosition(this.at.set(x, y + lift, z));
  }

  private instanced(geometry: THREE.BufferGeometry, material: THREE.Material, poses: THREE.Matrix4[], tones_of?: (i: number) => Lab) {
    if (!poses.length) return;
    const mesh = new THREE.InstancedMesh(geometry, material, poses.length);
    poses.forEach((pose, i) => {
      mesh.setMatrixAt(i, pose);
      if (tones_of) mesh.setColorAt(i, color(tones_of(i)));
    });
    cast_instanced(mesh);
    mesh.computeBoundingSphere();
    this.out.push(mesh);
  }

  private mesh(positions: number[], material: THREE.MeshLambertMaterial, shadow: boolean) {
    if (!positions.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    this.out.push(mesh);
  }

  lane() {
    const { lane, inside } = this.layout;
    const positions: number[] = [];
    const row = (s: number) => {
      const [near, far] = lane_edges(lane[s]);
      return [near, (near + far) / 2, far].map((off) => {
        const [x, y, z] = this.point(this.road(s), inside * off);
        return [x, y + 0.08, z];
      });
    };
    for (let s = 0; s < this.n; s++) {
      const t = (s + 1) % this.n;
      if (lane[s] <= 0 || lane[t] <= 0) continue;
      const a = row(s);
      const b = row(t);
      for (let l = 0; l < 2; l++) positions.push(...a[l], ...a[l + 1], ...b[l], ...b[l], ...a[l + 1], ...b[l + 1]);
    }
    this.mesh(positions, new THREE.MeshLambertMaterial({ color: color(tones.asphalt), flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), false);
  }

  private sweep(offsets: [Float32Array, Float32Array], faces: readonly (readonly [number, number])[], tone: Lab, shadow: boolean) {
    const positions: number[] = [];
    for (const side of [-1, 1]) {
      const line = offsets[side_index(side)];
      for (const run of runs(line)) {
        // A run's two ends stand at ground height, so it ramps out of the grass instead of ending in an open box.
        const row = (s: number, across: number, up: number) => {
          const p = this.road(s);
          const base = this.point(p, side * line[s]);
          const end = s === run[0] || s === run[run.length - 1];
          return [base[0] - p.tz * across * side, base[1] + (up > 0 && end ? 0 : up), base[2] + p.tx * across * side];
        };
        for (const [a, b] of spans(run))
          for (let f = 0; f + 1 < faces.length; f++) {
            const [a0, a1] = [row(a, ...faces[f]), row(a, ...faces[f + 1])];
            const [b0, b1] = [row(b, ...faces[f]), row(b, ...faces[f + 1])];
            positions.push(...a0, ...a1, ...b0, ...b0, ...a1, ...b1);
          }
      }
    }
    this.mesh(positions, new THREE.MeshLambertMaterial({ color: color(tone), flatShading: true, side: THREE.DoubleSide }), shadow);
  }

  barriers() {
    const { concrete, armco } = this.layout;
    this.sweep(concrete, [[-WALL_HALF, -1], [-WALL_HALF, WALL_HEIGHT], [WALL_HALF, WALL_HEIGHT], [WALL_HALF, -1]], tones.wall, true);
    this.sweep(armco, [[0, 0.35], [0, RAIL_HEIGHT], [0.12, RAIL_HEIGHT]], tones.chrome, false);
    const posts: THREE.Matrix4[] = [];
    for (const side of [-1, 1]) {
      const line = armco[side_index(side)];
      for (let s = 0; s < this.n; s += 2) if (!Number.isNaN(line[s])) posts.push(this.pose(this.road(s), side, line[s] + 0.14, line[s]).clone());
    }
    this.instanced(paint(box(0.14, 0.9 + 1, 0.14, 0, -0.05, 0), tones.post), this.flat, posts);
  }

  tyres() {
    const poses: THREE.Matrix4[] = [];
    for (const side of [-1, 1]) {
      const line = this.layout.tyres[side_index(side)];
      for (const run of runs(line)) {
        let carried = 0;
        for (let k = 0; k + 1 < run.length; k++) {
          const a = this.point(this.road(run[k]), side * line[run[k]]);
          const b = this.point(this.road(run[k + 1]), side * line[run[k + 1]]);
          const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
          this.x.set((b[0] - a[0]) / length, 0, (b[2] - a[2]) / length);
          this.z.set(-this.x.z, 0, this.x.x);
          let d = carried;
          for (; d < length; d += TYRE_SPACING) {
            const share = d / length;
            this.at.set(a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share, a[2] + (b[2] - a[2]) * share);
            poses.push(new THREE.Matrix4().makeBasis(this.x, this.y, this.z).setPosition(this.at));
          }
          carried = d - length;
        }
      }
    }
    this.instanced(tyre_stack(), this.plain, poses, (i) => (i % 3 === 2 ? tones.check_light : tones.tyre));
  }

  stands() {
    const { inside, stands, tiers } = this.layout;
    const depth = stand_depth(tiers);
    this.instanced(
      stand_module(tiers),
      this.flat,
      stands.map((s) => this.pose(this.road(s), -inside, STAND_FRONT, STAND_FRONT + depth / 2).clone()),
    );
  }

  pits() {
    const { inside, bays } = this.layout;
    const middle = PIT_FRONT + BAY_DEPTH / 2;
    this.instanced(
      bay(),
      this.flat,
      bays.map((s) => this.pose(this.road(s), inside, PIT_FRONT, middle).clone()),
    );
    this.instanced(
      box(BAY - 1.4, 3.3, 0.2, 0, 1.65, 0),
      this.glow,
      bays.map((s) => this.pose(this.road(s), inside, PIT_FRONT - 0.06, middle).clone()),
    );
    this.instanced(
      flag(),
      this.plain,
      bays.filter((_, i) => i % 2 === 0).map((s) => this.pose(this.road(s), inside, PIT_FRONT + 0.6, middle, BAY_HEIGHT).clone()),
      (i) => FLAGS[i % FLAGS.length],
    );
  }

  gantry() {
    const mesh = new THREE.Mesh(gantry(), this.flat);
    mesh.applyMatrix4(this.pose(this.road(0), 1, 0, 0));
    mesh.castShadow = true;
    this.out.push(mesh);
  }
}

export function stadium(world: World): THREE.Object3D[] {
  const build = new Builder(world, layout_of(world.road, tune(RACEWAY, RACEWAY_KNOBS, world.levels).stand));
  build.lane();
  build.barriers();
  build.tyres();
  build.stands();
  build.pits();
  build.gantry();
  for (const object of build.out) {
    object.updateMatrixWorld(true);
    object.matrixAutoUpdate = false;
  }
  return build.out;
}
