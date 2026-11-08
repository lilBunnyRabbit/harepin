import * as THREE from "three";
import { car_paints, color, linear, tones } from "./palette";
import type { World } from "./world";
import { hash } from "./worldgen/noise";
import { roof_rise } from "./worldgen/lots";
import { Roof } from "./worldgen/types";

const WALLS = [tones.wall, tones.wall_warm, tones.wall_cool];
const ROOFS = [tones.roof, tones.roof_slate];
const SHOPFRONT_LOW = 0.5;
const SHOPFRONT_HIGH = 2.8;
const SHOPFRONT_INSET = 0.8;
const FACADE_OUT = 0.03;
const EAVE = 0.3;
const PAD_LIFT = 0.06;
const LINE_LIFT = 0.09;
const LINE_HALF = 0.06;

type V3 = [number, number, number];

interface Frame {
  x: number;
  y: number;
  z: number;
  fx: number;
  fz: number;
}

class Builder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];

  /** With `ground`, every vertex sits `ly` above the terrain under it instead of above the frame's y. */
  constructor(
    private frame: Frame,
    private readonly ground?: (x: number, z: number) => number,
  ) {}

  at(frame: Frame) {
    this.frame = frame;
    return this;
  }

  private push([lx, ly, lz]: V3, rgb: V3) {
    const { x, y, z, fx, fz } = this.frame;
    const px = x + fz * lx + fx * lz;
    const pz = z - fx * lx + fz * lz;
    this.positions.push(px, (this.ground ? this.ground(px, pz) : y) + ly, pz);
    this.colors.push(...rgb);
  }

  tri(a: V3, b: V3, c: V3, rgb: V3) {
    this.push(a, rgb);
    this.push(b, rgb);
    this.push(c, rgb);
  }

  quad(a: V3, b: V3, c: V3, d: V3, rgb: V3) {
    this.tri(a, b, c, rgb);
    this.tri(a, c, d, rgb);
  }

  walls(hw: number, hd: number, y0: number, y1: number, rgb: V3) {
    this.quad([-hw, y0, hd], [hw, y0, hd], [hw, y1, hd], [-hw, y1, hd], rgb);
    this.quad([hw, y0, -hd], [-hw, y0, -hd], [-hw, y1, -hd], [hw, y1, -hd], rgb);
    this.quad([hw, y0, hd], [hw, y0, -hd], [hw, y1, -hd], [hw, y1, hd], rgb);
    this.quad([-hw, y0, -hd], [-hw, y0, hd], [-hw, y1, hd], [-hw, y1, -hd], rgb);
  }

  top(hw: number, hd: number, y: number, rgb: V3) {
    this.quad([-hw, y, hd], [hw, y, hd], [hw, y, -hd], [-hw, y, -hd], rgb);
  }

  gable(hw: number, hd: number, y: number, rise: number, roof: V3, wall: V3) {
    const ew = hw + EAVE;
    const ed = hd + EAVE;
    this.quad([-ew, y, ed], [ew, y, ed], [ew, y + rise, 0], [-ew, y + rise, 0], roof);
    this.quad([ew, y, -ed], [-ew, y, -ed], [-ew, y + rise, 0], [ew, y + rise, 0], roof);
    this.tri([hw, y, hd], [hw, y, -hd], [hw, y + rise, 0], wall);
    this.tri([-hw, y, -hd], [-hw, y, hd], [-hw, y + rise, 0], wall);
  }

  hip(hw: number, hd: number, y: number, rise: number, roof: V3) {
    const ew = hw + EAVE;
    const ed = hd + EAVE;
    const ridge = Math.max(0, hw - hd);
    this.quad([-ew, y, ed], [ew, y, ed], [ridge, y + rise, 0], [-ridge, y + rise, 0], roof);
    this.quad([ew, y, -ed], [-ew, y, -ed], [-ridge, y + rise, 0], [ridge, y + rise, 0], roof);
    this.tri([ew, y, ed], [ew, y, -ed], [ridge, y + rise, 0], roof);
    this.tri([-ew, y, -ed], [-ew, y, ed], [-ridge, y + rise, 0], roof);
  }

  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  mesh(material: THREE.Material): THREE.Mesh {
    return new THREE.Mesh(this.geometry(), material);
  }
}

function turned(b: Frame): Frame {
  return { x: b.x, y: b.y, z: b.z, fx: b.fz, fz: -b.fx };
}

function building_mesh(world: World): THREE.Mesh {
  const out = new Builder({ x: 0, y: 0, z: 0, fx: 0, fz: 1 });
  const flat = linear(tones.roof_flat);
  const glass = linear(tones.shopfront);
  for (const b of world.buildings) {
    const wall = linear(WALLS[b.style % WALLS.length]);
    const roof = linear(ROOFS[Math.floor(hash(b.lot, 0, world.seed + 81) * ROOFS.length)]);
    const rise = roof_rise(b);
    out.at(b);
    out.walls(b.hw, b.hd, -1, b.height, wall);
    if (world.lots[b.lot].kind === "shop") {
      const w = b.hw - SHOPFRONT_INSET;
      const z = b.hd + FACADE_OUT;
      out.quad([-w, SHOPFRONT_LOW, z], [w, SHOPFRONT_LOW, z], [w, SHOPFRONT_HIGH, z], [-w, SHOPFRONT_HIGH, z], glass);
    }
    if (b.roof === Roof.GABLE) out.gable(b.hw, b.hd, b.height, rise, roof, wall);
    else if (b.roof === Roof.CROSS) out.at(turned(b)).gable(b.hd, b.hw, b.height, rise, roof, wall);
    else if (b.roof === Roof.HIP) {
      if (b.hw >= b.hd) out.hip(b.hw, b.hd, b.height, rise, roof);
      else out.at(turned(b)).hip(b.hd, b.hw, b.height, rise, roof);
    } else out.top(b.hw, b.hd, b.height, flat);
  }
  const mesh = out.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function parking_mesh(world: World): THREE.Mesh {
  const out = new Builder({ x: 0, y: 0, z: 0, fx: 0, fz: 1 }, (x, z) => world.height(x, z));
  const pad = linear(tones.asphalt);
  const line = linear(tones.line);
  for (const lot of world.parking) {
    const frame = world.lots[lot.lot];
    out.at(frame).top(lot.size.w / 2, lot.size.d / 2, PAD_LIFT, pad);
    for (const bay of lot.bays) {
      const z0 = bay.z - bay.l / 2;
      const z1 = bay.z + bay.l / 2;
      for (const x of [bay.x - bay.w / 2, bay.x + bay.w / 2])
        out.quad([x - LINE_HALF, LINE_LIFT, z1], [x + LINE_HALF, LINE_LIFT, z1], [x + LINE_HALF, LINE_LIFT, z0], [x - LINE_HALF, LINE_LIFT, z0], line);
    }
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = out.mesh(material);
  mesh.receiveShadow = true;
  return mesh;
}

function parked_cars(world: World): THREE.InstancedMesh {
  const shape = new Builder({ x: 0, y: 0, z: 0, fx: 0, fz: 1 });
  const white: V3 = [1, 1, 1];
  shape.walls(0.95, 2.25, 0.25, 0.95, white);
  shape.top(0.95, 2.25, 0.95, white);
  shape.at({ x: 0, y: 0, z: -0.3, fx: 0, fz: 1 }).walls(0.8, 1.1, 0.95, 1.4, white);
  shape.top(0.8, 1.1, 1.4, white);
  const geometry = shape.geometry();
  const cars = world.parking.flatMap((lot) => lot.obstacles.filter((o) => o.kind === "car").map((o) => ({ lot, o })));
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), Math.max(1, cars.length));
  mesh.count = cars.length;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  cars.forEach(({ lot, o }, i) => {
    const frame = world.lots[lot.lot];
    const x = frame.x + frame.fz * o.x + frame.fx * o.z;
    const z = frame.z - frame.fx * o.x + frame.fz * o.z;
    p.set(x, world.height(x, z) + PAD_LIFT, z);
    q.setFromAxisAngle(up, frame.angle + o.heading);
    mesh.setMatrixAt(i, m.compose(p, q, s));
    mesh.setColorAt(i, color(car_paints[Math.floor(hash(lot.lot, i, world.seed + 63) * car_paints.length)]));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function street_lights(world: World): THREE.Object3D {
  const group = new THREE.Group();
  const pole = new THREE.CylinderGeometry(0.08, 0.12, 6, 5).translate(0, 3, 0);
  const arm = new THREE.BoxGeometry(0.08, 0.08, 1.4).translate(0, 5.9, 0.65);
  const head = new THREE.BoxGeometry(0.3, 0.12, 0.5).translate(0, 5.82, 1.3);
  const parts: [THREE.BufferGeometry, THREE.Material][] = [
    [pole, new THREE.MeshLambertMaterial({ color: color(tones.post), flatShading: true })],
    [arm, new THREE.MeshLambertMaterial({ color: color(tones.post), flatShading: true })],
    [head, new THREE.MeshLambertMaterial({ color: color(tones.head), emissive: color(tones.head), emissiveIntensity: 0.6 })],
  ];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  for (const [geometry, material] of parts) {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, world.props.length));
    mesh.count = world.props.length;
    world.props.forEach((prop, i) => {
      p.set(prop.x, prop.y, prop.z);
      q.setFromAxisAngle(up, prop.angle);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    });
    mesh.castShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }
  return group;
}

export function town_meshes(world: World): THREE.Object3D {
  const group = new THREE.Group();
  group.add(building_mesh(world), parking_mesh(world), parked_cars(world), street_lights(world));
  return group;
}
