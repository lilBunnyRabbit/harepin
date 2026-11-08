import * as THREE from "three";
import { Car } from "./car";
import { brand, color, dark, mix, tones } from "./palette";
import { ribbon } from "./scene";
import { ROAD_HALF, World } from "./world";

export interface Gate {
  group: THREE.Group;
  material: THREE.MeshLambertMaterial;
}

export function gates(world: World): Gate[] {
  const post = new THREE.BoxGeometry(0.7, 6.4, 0.7).translate(0, 3.2, 0);
  const beam = new THREE.BoxGeometry(ROAD_HALF * 2 + 3.4, 0.5, 0.5).translate(0, 6.2, 0);
  const check = new THREE.BoxGeometry(1, 0.55, 0.3);
  const dark = new THREE.MeshLambertMaterial({ color: color(tones.check_dark) });
  const light = new THREE.MeshLambertMaterial({ color: color(tones.check_light) });
  return world.checkpoints.map((cp, index) => {
    const group = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ color: color(tones.gate), emissive: new THREE.Color(0, 0, 0) });
    for (const side of [-1, 1]) {
      const mesh = new THREE.Mesh(post, material);
      mesh.position.x = side * (ROAD_HALF + 1.7);
      mesh.castShadow = true;
      group.add(mesh);
    }
    const top = new THREE.Mesh(beam, material);
    top.castShadow = true;
    group.add(top);
    if (index === 0) {
      const columns = 14;
      for (let row = 0; row < 2; row++)
        for (let col = 0; col < columns; col++) {
          const tile = new THREE.Mesh(check, (row + col) % 2 ? dark : light);
          tile.position.set((col - (columns - 1) / 2) * 1, 6.9 + row * 0.55, 0);
          group.add(tile);
        }
    }
    group.position.set(cp.x, world.height(cp.x, cp.z), cp.z);
    group.rotation.y = cp.heading;
    return { group, material };
  });
}

function curvature(world: World, s: number): number {
  const road = world.road;
  const a = road[(s - 6 + road.length) % road.length];
  const b = road[(s + 6) % road.length];
  return Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz);
}

export function roadside(world: World): THREE.Object3D {
  const group = new THREE.Group();
  const inside = new Map<number, number>();
  for (let s = 0; s < world.road.length; s++) {
    const k = curvature(world, s);
    if (Math.abs(k) > 0.09) inside.set(s, Math.sign(k));
  }
  for (const [tone, parity] of [
    [brand.accent, 0],
    [tones.check_light, 1],
  ] as const) {
    for (const side of [-1, 1]) {
      const from = side > 0 ? ROAD_HALF - 0.1 : -ROAD_HALF - 0.9;
      const to = side > 0 ? ROAD_HALF + 0.9 : -ROAD_HALF + 0.1;
      // Positive curvature bends toward the +side offset, so matching signs put the curb on the inside of the bend.
      group.add(ribbon(world, from, to, 0.12, (s) => inside.get(s) === side && s % 2 === parity, color(tone), -5));
    }
  }

  const spacing = 12;
  const count = Math.ceil(world.road.length / spacing) * 2;
  const posts = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.14, 1.0, 0.14).translate(0, 0.5, 0),
    new THREE.MeshLambertMaterial({ color: color(tones.post) }),
    count,
  );
  const reflector = color(tones.head);
  const caps = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(0, 1.05, 0),
    new THREE.MeshLambertMaterial({ color: reflector, emissive: reflector, emissiveIntensity: 0.9 }),
    count,
  );
  const m = new THREE.Matrix4();
  let n = 0;
  for (let s = 0; s < world.road.length; s += spacing) {
    const p = world.road[s];
    for (const side of [-1, 1]) {
      const off = side * (ROAD_HALF + 1.6);
      const x = p.x - p.tz * off;
      const z = p.z + p.tx * off;
      m.makeTranslation(x, world.height(x, z), z);
      posts.setMatrixAt(n, m);
      caps.setMatrixAt(n, m);
      n++;
    }
  }
  posts.count = caps.count = n;
  posts.castShadow = true;
  group.add(posts, caps);
  return group;
}

function extrude(profile: [number, number][], width: number, tone: THREE.Color): THREE.Mesh {
  const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geometry.translate(0, 0, -width / 2).rotateY(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: tone, flatShading: true }));
  mesh.castShadow = true;
  return mesh;
}

function box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, shadow = true): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  return mesh;
}

export interface CarView {
  root: THREE.Group;
  body: THREE.Group;
  wheels: THREE.Group[];
  brake: THREE.MeshLambertMaterial;
}

const GROUND_OFFSET = -0.49;

export function car_view(paint: THREE.Color): CarView {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = GROUND_OFFSET;
  const trim = color(tones.trim);
  const trim_material = new THREE.MeshLambertMaterial({ color: trim, flatShading: true });
  const paint_material = new THREE.MeshLambertMaterial({ color: paint, flatShading: true });

  body.add(
    extrude(
      [
        [-2.18, 0.3],
        [2.12, 0.3],
        [2.3, 0.4],
        [2.26, 0.56],
        [1.5, 0.7],
        [-1.75, 0.8],
        [-2.24, 0.74],
        [-2.3, 0.5],
      ],
      1.86,
      paint,
    ),
    extrude(
      [
        [-2.1, 0.2],
        [2.2, 0.2],
        [2.36, 0.33],
        [-2.2, 0.33],
      ],
      1.9,
      trim,
    ),
    extrude(
      [
        [1.42, 0.7],
        [0.42, 1.12],
        [-0.85, 1.15],
        [-1.7, 0.8],
      ],
      1.52,
      color(tones.glass),
    ),
    extrude(
      [
        [0.3, 1.12],
        [-0.82, 1.15],
        [-0.88, 1.2],
        [0.22, 1.18],
      ],
      1.44,
      paint,
    ),
  );
  body.add(box(1.82, 0.05, 0.42, paint_material, 0, 1.04, -2.02));
  for (const side of [-1, 1]) {
    body.add(box(0.06, 0.22, 0.14, trim_material, side * 0.62, 0.9, -1.98));
    body.add(box(0.16, 0.1, 0.2, paint_material, side * 0.98, 0.84, 0.86));
  }
  body.add(box(1.0, 0.14, 0.04, trim_material, 0, 0.42, 2.3));

  const head = color(tones.head);
  const head_material = new THREE.MeshLambertMaterial({ color: head, emissive: head, emissiveIntensity: 1.2 });
  const tail = color(brand.error);
  const brake = new THREE.MeshLambertMaterial({ color: tail, emissive: tail, emissiveIntensity: 0.5 });
  for (const side of [-1, 1]) {
    const lamp = box(0.46, 0.08, 0.1, head_material, side * 0.64, 0.55, 2.24, false);
    lamp.rotation.x = -0.25;
    body.add(lamp, box(0.5, 0.1, 0.06, brake, side * 0.6, 0.68, -2.27, false));
  }
  root.add(body);

  const tyre = new THREE.CylinderGeometry(Car.RADIUS, Car.RADIUS, 0.3, 12).rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.22, 0.22, 0.32, 6).rotateZ(Math.PI / 2);
  const tyre_material = new THREE.MeshLambertMaterial({ color: color(tones.tyre), flatShading: true });
  const rim_material = new THREE.MeshLambertMaterial({ color: color(mix(brand.foreground, brand.background_lightest, 0.6)), flatShading: true });
  const wheels = [0, 1, 2, 3].map(() => {
    const steer = new THREE.Group();
    const spin = new THREE.Group();
    const t = new THREE.Mesh(tyre, tyre_material);
    t.castShadow = true;
    spin.add(t, new THREE.Mesh(rim, rim_material));
    steer.add(spin);
    root.add(steer);
    return steer;
  });
  return { root, body, wheels, brake };
}

export function sync_car_view(view: CarView, car: Car) {
  view.root.position.copy(car.pos);
  view.root.quaternion.copy(car.quat);
  car.wheels.forEach((w, i) => {
    const g = view.wheels[i];
    g.position.set(w.mount.x, w.mount.y - (w.reach - Car.RADIUS), w.mount.z);
    g.rotation.y = -w.angle;
    g.children[0].rotation.x = w.spin;
  });
  view.brake.emissiveIntensity = car.braking > 0.05 ? 2.2 : 0.5;
}

let blob: THREE.CanvasTexture | null = null;

function blob_texture(): THREE.CanvasTexture {
  if (blob) return blob;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  gradient.addColorStop(0, "rgb(255 255 255 / 1)");
  gradient.addColorStop(0.55, "rgb(255 255 255 / 0.75)");
  gradient.addColorStop(1, "rgb(255 255 255 / 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  blob = new THREE.CanvasTexture(canvas);
  return blob;
}

export interface ContactShadow {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  strength: number;
}

// The sun's shadow lands metres away at a low sun and blurs out, so without a dark patch right under the body the car
// reads as hovering; this is that patch, tinted from the theme rather than black.
export function contact_shadow(): ContactShadow {
  const strength = dark ? 0.7 : 0.4;
  const material = new THREE.MeshBasicMaterial({
    color: color(tones.skid),
    alphaMap: blob_texture(),
    transparent: true,
    opacity: strength,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -8,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 5.0).rotateX(-Math.PI / 2), material);
  mesh.renderOrder = 1;
  return { mesh, material, strength };
}

const up = new THREE.Vector3(0, 1, 0);
const ground_normal = new THREE.Vector3();
const tilt = new THREE.Quaternion();
const yaw = new THREE.Quaternion();

export function place_contact_shadow(shadow: ContactShadow, x: number, y: number, z: number, heading: number, world: World) {
  const ground = world.height(x, z);
  world.normal(x, z, ground_normal);
  shadow.mesh.position.set(x, ground + 0.05, z);
  tilt.setFromUnitVectors(up, ground_normal);
  yaw.setFromAxisAngle(up, heading);
  shadow.mesh.quaternion.copy(tilt).multiply(yaw);
  const lift = Math.max(0, y - ground - 0.5);
  shadow.material.opacity = shadow.strength * Math.max(0, 1 - lift / 3);
}
