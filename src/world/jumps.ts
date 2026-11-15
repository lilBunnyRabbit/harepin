import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Car } from "../car/car";
import { oversize } from "../car/cars";
import { cast_instanced } from "../render/shadow-depth";
import { brand, dark, linear, mix, tones } from "../theme/palette";
import { CHUNK, chunk_of, type Extent } from "../worldgen/chunk-grid";
import { challenge_outer, challenge_pieces, CONE_HEIGHT, CONE_RADIUS, GRAVITY, ITEMS, PIECE_DEPTH, ramp_extent, ramp_lift } from "../worldgen/jumps";
import { Builder, bounding_sphere, type Rgb } from "../worldgen/mesh";
import type { Challenge, Item, ItemKind, Ramp } from "../worldgen/types";

const BODY_HW = 1;
const WATCH = 60;
const BONK_REACH = 4;
// Share of the car's speed a light item takes when knocked, by its mass against the car's.
const DRAG: Record<ItemKind, number> = { cone: 0.003, barrel: 0.012, hay: 0.02, log: 0, rock: 0, barrier: 0 };
const BOUNCE = 0.3;
const SCRUB = 0.55;
const SETTLE = 0.6;
const LIP_STRIPE = 1.2;
const LIP_BLOCK = 1.1;
const CHEVRONS = [0.32, 0.58];
const CHEVRON = { reach: 0.7, sweep: 0.55, thick: 0.6, lift: 0.04 };
const FAR = 900;
const CONE_FOOT = 0.03;
const BARRIER = { foot: 0.6, top: 0.24, height: 0.85, length: 3 };

interface Tones {
  deck: Rgb;
  skirt: Rgb;
  stripe: Rgb;
  stripe_dark: Rgb;
  frame: Rgb;
  body: Rgb;
}

function jump_tones(): Tones {
  return {
    deck: linear(tones.cone),
    skirt: linear(tones.dirt),
    stripe: linear(tones.check_light),
    stripe_dark: linear(tones.check_dark),
    frame: linear(brand.accent),
    body: linear(tones.wall),
  };
}

export interface JumpData {
  ramps: Ramp[];
  items: Item[];
  challenges: Challenge[];
}

export interface JumpEvent {
  clean: Challenge | null;
}

function ramp_mesh(out: Builder, r: Ramp, t: Tones) {
  const { reach, from, to } = ramp_extent(r);
  const us = [-reach, -r.hw, r.hw, reach];
  const vs = [from, r.length - LIP_STRIPE, r.length, to];
  const point = (u: number, v: number): [number, number, number] => [u, r.y + r.grade * v + ramp_lift(r, u, v), v];
  out.at({ x: r.x, y: 0, z: r.z, fx: r.fx, fz: r.fz });
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      if (i === 1 && j === 1) continue;
      const tone = i === 1 && j === 0 ? t.deck : t.skirt;
      out.quad(point(us[i], vs[j]), point(us[i + 1], vs[j]), point(us[i + 1], vs[j + 1]), point(us[i], vs[j + 1]), tone);
    }
  // The lip in kerb blocks across the deck: a plain stripe this shallow vanished at chase distance.
  const blocks = Math.max(2, Math.round((2 * r.hw) / LIP_BLOCK));
  for (let k = 0; k < blocks; k++) {
    const u0 = -r.hw + (2 * r.hw * k) / blocks;
    const u1 = -r.hw + (2 * r.hw * (k + 1)) / blocks;
    out.quad(point(u0, vs[1]), point(u1, vs[1]), point(u1, vs[2]), point(u0, vs[2]), k % 2 ? t.stripe_dark : t.stripe);
  }
  const up = (u: number, v: number): [number, number, number] => {
    const p = point(u, v);
    return [p[0], p[1] + CHEVRON.lift, p[2]];
  };
  const w = r.hw * CHEVRON.reach;
  const back = Math.min(r.hw, r.length * 0.4) * CHEVRON.sweep;
  for (const at of CHEVRONS) {
    const v = r.length * at;
    out.quad(up(-w, v - back), up(0, v), up(0, v + CHEVRON.thick), up(-w, v - back + CHEVRON.thick), t.stripe);
    out.quad(up(0, v), up(w, v - back), up(w, v - back + CHEVRON.thick), up(0, v + CHEVRON.thick), t.stripe);
  }
}

function challenge_mesh(out: Builder, c: Challenge, t: Tones) {
  for (const p of challenge_pieces(c)) {
    out.at({ x: c.x + c.fz * p.lx, y: c.y, z: c.z - c.fx * p.lx, fx: c.fx, fz: c.fz });
    const tone = p.frame ? t.frame : t.body;
    out.walls(p.hw, PIECE_DEPTH, p.bottom, p.top, tone);
    out.top(p.hw, PIECE_DEPTH, p.top, tone);
    out.top(p.hw, PIECE_DEPTH, p.bottom, tone);
  }
}

export function item_geometry(kind: ItemKind): THREE.BufferGeometry {
  switch (kind) {
    case "cone":
      return traffic_cone();
    case "barrel":
      return new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8).translate(0, 0.45, 0);
    case "hay":
      return new THREE.CylinderGeometry(0.7, 0.7, 1.2, 9).rotateZ(Math.PI / 2).translate(0, 0.7, 0);
    case "log":
      return new THREE.CylinderGeometry(0.32, 0.36, 4.4, 7).rotateZ(Math.PI / 2).translate(0, 0.3, 0);
    case "rock":
      return new THREE.IcosahedronGeometry(1, 0).scale(1, 0.75, 0.9).translate(0, 0.45, 0);
    case "barrier":
      return barrier();
  }
}

// A square foot under a six-sided cone: one side fewer than the bare spike it replaces pays for the foot.
function traffic_cone(): THREE.BufferGeometry {
  const foot = CONE_RADIUS;
  const plate = new THREE.PlaneGeometry(foot * 2, foot * 2).rotateX(-Math.PI / 2).translate(0, CONE_FOOT, 0);
  const cone = new THREE.ConeGeometry(CONE_RADIUS * 0.8, CONE_HEIGHT, 6).translate(0, CONE_HEIGHT / 2, 0);
  return mergeGeometries([plate.toNonIndexed(), cone.toNonIndexed()]);
}

// A road barrier's section: a wide foot leaning in to a narrow top. The box's own twelve triangles, its top edges moved.
function barrier(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(BARRIER.foot, BARRIER.height, BARRIER.length).translate(0, BARRIER.height / 2, 0);
  const position = box.getAttribute("position");
  for (let i = 0; i < position.count; i++) if (position.getY(i) > BARRIER.height / 2) position.setX(i, position.getX(i) * (BARRIER.top / BARRIER.foot));
  return box;
}

export function item_material(kind: ItemKind): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: item_tone(kind), flatShading: true });
}

function item_tone(kind: ItemKind): THREE.Color {
  const lab = {
    cone: tones.cone,
    barrel: mix(brand.info, brand.background_darkest, 0.55),
    hay: tones.sand,
    log: tones.trunk,
    rock: tones.rock,
    barrier: tones.sidewalk,
  }[kind];
  const [r, g, b] = linear(lab);
  return new THREE.Color().setRGB(r, g, b);
}

interface Loose {
  item: Item;
  mesh: THREE.InstancedMesh;
  slot: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  spin: THREE.Vector3;
  moving: boolean;
}

function circle_span(car: Car): number {
  let span = 0;
  for (let i = 0; i < car.spec.circles.length; i++) span = Math.max(span, Math.abs(car.spec.circles[i]));
  return span;
}

function touches(car: Car, fx: number, fz: number, at: THREE.Vector3, r: number): boolean {
  const circles = car.spec.circles;
  for (let i = 0; i < circles.length; i++) if (Math.hypot(car.pos.x + fx * circles[i] - at.x, car.pos.z + fz * circles[i] - at.z) < r) return true;
  return false;
}

export class JumpsView {
  readonly root = new THREE.Group();
  private readonly chunks: THREE.Mesh[] = [];
  private readonly loose: Loose[] = [];
  private readonly instanced: THREE.InstancedMesh[] = [];
  private readonly side = new Map<number, number>();
  private readonly m = new THREE.Matrix4();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly event: JumpEvent = { clean: null };
  private readonly q = new THREE.Quaternion();

  constructor(
    private readonly data: JumpData,
    private readonly height: (x: number, z: number) => number,
    ext: Extent,
  ) {
    const t = jump_tones();
    const builders = new Map<number, Builder>();
    const of = (x: number, z: number) => {
      const key = chunk_of(x, z, ext);
      let b = builders.get(key);
      if (!b) builders.set(key, (b = new Builder()));
      return b;
    };
    for (const r of data.ramps) if (!r.deck) ramp_mesh(of(r.x, r.z), r, t);
    for (const c of data.challenges) challenge_mesh(of(c.x, c.z), c, t);
    // A frozen fall's deck lies on its bed, which is carved to the same plane: pulled forward like the road, it wins every frame.
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const b of builders.values()) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(b.positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(b.colors, 3));
      const [x, y, z, r] = bounding_sphere(b.positions);
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(x, y, z), r);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.chunks.push(mesh);
      this.root.add(mesh);
    }

    const up = new THREE.Vector3(0, 1, 0);
    for (const kind of Object.keys(ITEMS) as ItemKind[]) {
      const here = data.items.filter((i) => i.kind === kind);
      if (!here.length) continue;
      const mesh = new THREE.InstancedMesh(item_geometry(kind), item_material(kind), here.length);
      here.forEach((item, slot) => {
        const pos = new THREE.Vector3(item.x, item.y, item.z);
        const quat = new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(item.fx, item.fz));
        mesh.setMatrixAt(slot, this.m.compose(pos, quat, this.s.setScalar(item.scale)));
        if (item.light) this.loose.push({ item, mesh, slot, pos, vel: new THREE.Vector3(), quat, spin: new THREE.Vector3(), moving: false });
      });
      cast_instanced(mesh);
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.instanced.push(mesh);
      this.root.add(mesh);
    }
  }

  cull(camera: THREE.Camera, fog_far: number) {
    for (const mesh of this.chunks) {
      const sphere = mesh.geometry.boundingSphere;
      if (sphere) mesh.visible = sphere.center.distanceTo(camera.position) - sphere.radius < Math.min(fog_far, FAR) + CHUNK;
    }
  }

  /** `drag` slows the car by a knocked item's share: the car belongs to the sim, which may run elsewhere. */
  update(dt: number, car: Car, drag: (keep: number) => void): JumpEvent {
    this.knock(car, drag);
    this.fly(dt);
    this.event.clean = this.watch(car);
    return this.event;
  }

  bonked(x: number, z: number): boolean {
    return this.data.challenges.some((c) => {
      const dx = x - c.x;
      const dz = z - c.z;
      return Math.abs(dx * c.fx + dz * c.fz) < BONK_REACH && Math.abs(dx * c.fz - dz * c.fx) < challenge_outer(c) + BONK_REACH;
    });
  }

  private knock(car: Car, drag: (keep: number) => void) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const speed = car.vel.length();
    const span = circle_span(car) + 1;
    for (let i = 0; i < this.loose.length; i++) {
      const l = this.loose[i];
      if (l.moving || Math.abs(l.pos.y - car.pos.y) > 2.5) continue;
      const r = ITEMS[l.item.kind].r * l.item.scale + car.spec.radius;
      // `touches` calls Math.hypot, a builtin that boxes its doubles: an item out of every circle's reach skips it.
      if (Math.abs(l.pos.x - car.pos.x) > r + span || Math.abs(l.pos.z - car.pos.z) > r + span) continue;
      if (!touches(car, fx, fz, l.pos, r)) continue;
      const ax = l.pos.x - car.pos.x;
      const az = l.pos.z - car.pos.z;
      const away = Math.hypot(ax, az) || 1;
      const kick = Math.max(2, speed * 1.25);
      l.vel.set(car.vel.x * 1.1 + (ax / away) * kick * 0.35, 2 + speed * 0.18, car.vel.z * 1.1 + (az / away) * kick * 0.35);
      l.spin.set(az / away, 0, -ax / away).multiplyScalar(4 + speed * 0.4);
      l.moving = true;
      drag(1 - DRAG[l.item.kind]);
    }
  }

  private fly(dt: number) {
    for (let i = 0; i < this.loose.length; i++) {
      const l = this.loose[i];
      if (!l.moving) continue;
      l.vel.y -= GRAVITY * dt;
      l.pos.addScaledVector(l.vel, dt);
      const angle = l.spin.length() * dt;
      if (angle > 0) l.quat.premultiply(this.q.setFromAxisAngle(this.s.copy(l.spin).normalize(), angle));
      const ground = this.height(l.pos.x, l.pos.z);
      if (l.pos.y < ground) {
        l.pos.y = ground;
        if (l.vel.y < 0) l.vel.y *= -BOUNCE;
        l.vel.x *= SCRUB;
        l.vel.z *= SCRUB;
        l.spin.multiplyScalar(SCRUB);
        if (l.vel.length() < SETTLE) {
          l.moving = false;
          l.vel.set(0, 0, 0);
        }
      }
      l.mesh.setMatrixAt(l.slot, this.m.compose(l.pos, l.quat, this.s.setScalar(l.item.scale)));
      l.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private watch(car: Car): Challenge | null {
    let clean: Challenge | null = null;
    for (const c of this.data.challenges) {
      const dx = car.pos.x - c.x;
      const dz = car.pos.z - c.z;
      if (Math.abs(dx) > WATCH || Math.abs(dz) > WATCH) {
        this.side.delete(c.id);
        continue;
      }
      const along = dx * c.fx + dz * c.fz;
      const before = this.side.get(c.id);
      this.side.set(c.id, along);
      if (before === undefined || before >= 0 || along < 0) continue;
      const lateral = Math.abs(dx * c.fz - dz * c.fx);
      const y = car.pos.y - c.y;
      const airborne = car.wheels.every((w) => !w.contact);
      if (airborne && lateral + BODY_HW * oversize(car.spec).width < c.gap_hw && y - car.spec.band[0] > c.gap_bottom && y + car.spec.band[1] < c.gap_top) clean = c;
    }
    return clean;
  }
}
