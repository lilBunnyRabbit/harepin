import * as THREE from "three";
import { axle_index, axles_of } from "./axles";
import { rest_reach, type Car } from "./car";
import { DEFAULT_PARTS, build_spec, part_of, type Build, type Slot } from "./build";
import { COUPE, type CarSpec } from "./cars";
import { body_outline, cabin_parts, flares, side_panel, skirts } from "./body-shell";
import { DESIGNS } from "./designs";
import { extrude, merge, parts, slab, taper, tint } from "./geometry";
import { flame_mesh, lamps } from "./lights";
import { livery_of, livery_parts, roof, type Livery } from "./livery";
import { aero_of, aero_parts, kit_parts, rear_wing } from "./part-looks";
import { STOCK_CALIPER, STOCK_TYRE, caliper_geometry, chrome_tone, wheel_geometry } from "./wheels";
import { paint_lab } from "./paint";
import { brand, color, tones } from "../theme/palette";

export interface CarView {
  root: THREE.Group;
  body: THREE.Group;
  wheels: THREE.Group[];
  /** Per wheel, whether it turns with the steering. */
  steered: boolean[];
  brake: THREE.MeshLambertMaterial;
  /** Headlamp lenses; hidden from the hood camera, which sits right behind them. */
  heads: THREE.Mesh;
  /** Cockpit halo, hidden from the hood camera with `heads`; null on closed bodies. */
  halo: THREE.Mesh | null;
  /** Hood camera point in car space, or null for the camera's default. */
  eye: THREE.Vector3 | null;
  /** Nitro exhaust flame, hidden until `show_flame`. */
  flame: THREE.Mesh;
}

export function build_view(build: Build, spec: CarSpec = build_spec(build)): CarView {
  return car_view(color(paint_lab(build.paint)), spec, build.parts, livery_of(build));
}

// Paint, trim, glass and decals are baked into vertex colours so the whole shell is one draw; a repaint rebuilds the view.
export function car_view(paint: THREE.Color, spec: CarSpec = COUPE, kit: Record<Slot, number> = DEFAULT_PARTS, livery: Livery | null = null): CarView {
  const d = DESIGNS[spec.body.style];
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -(rest_reach(spec) - spec.wheel.mounts[0][1]);
  const trim = color(tones.trim);
  const arch_tone = d.arches.tone === "paint" ? paint : trim;

  const glass = color(tones.glass);
  const stripped = kit.weight > 1;
  const nose = d.outline[0][0];
  const tail = d.outline[d.outline.length - 1][0];
  const shell_body = extrude(body_outline(d, spec), d.width);
  const base = merge(
    tint(d.taper ? taper(shell_body, d.taper.from, tail, d.taper.share) : shell_body, paint),
    cabin_parts(d.cabin, paint, glass),
    flares(d, spec).map((g) => tint(g, arch_tone)),
    (d.slabs ?? []).flatMap((slab_part) => slab(slab_part.points, slab_part.from, slab_part.to)).map((g) => tint(g, paint)),
    skirts(d, spec, 0.03, 0.09).map((g) => tint(g, trim)),
    parts(d.paint).map((g) => tint(g, paint)),
    parts(d.trim).map((g) => tint(g, trim)),
    parts(livery && livery.decal !== "none" ? [] : (d.stripes ?? [])).map((g) => tint(g, trim)),
    parts(stripped ? [] : d.markers).map((g) => tint(g, color(brand.warning))),
    parts(stripped ? [] : d.chrome).map((g) => tint(g, chrome_tone())),
  );
  const decals = livery && livery.decal !== "none" ? livery_parts(livery, side_panel(d, spec), roof(base, glass), nose, tail) : [];
  const aero = aero_of(kit);
  const shell = merge(base, rear_wing(d, aero, paint, trim), aero_parts(d, spec, aero, paint, trim), kit_parts(d, kit, paint, trim), decals);
  const hull = new THREE.Mesh(shell, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  hull.castShadow = true;
  const halo = d.halo ? new THREE.Mesh(merge(parts(d.halo).map((g) => tint(g, trim))), hull.material) : null;
  if (halo) {
    halo.castShadow = true;
    body.add(halo);
  }

  const { heads, tails, brake } = lamps(d);
  const flame = flame_mesh(d);
  body.add(hull, heads, tails, flame);
  root.add(body);

  const tyre = part_of("tyres", kit.tyres).look?.tyre ?? STOCK_TYRE;
  const caliper = part_of("brakes", kit.brakes).look?.caliper ?? (d.caliper ? { ...STOCK_CALIPER, tone: d.caliper } : STOCK_CALIPER);
  const axles = axles_of(spec);
  const tyres = [0, 1].map((axle) => wheel_geometry(spec.wheel.radius, d.tyre[axle], d.rim, tyre));
  const calipers = [0, 1].map((axle) => caliper_geometry(spec.wheel.radius, d.tyre[axle], d.rim, tyre, caliper));
  const wheel_material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const wheel_axles = spec.wheel.mounts.map((_, i) => axle_index(axles, i));
  const wheels = wheel_axles.map((axle) => {
    const steer = new THREE.Group();
    const spin = new THREE.Group();
    const mesh = new THREE.Mesh(tyres[Math.min(axle, 1)], wheel_material);
    mesh.castShadow = true;
    spin.add(mesh);
    steer.add(spin, new THREE.Mesh(calipers[Math.min(axle, 1)], wheel_material));
    root.add(steer);
    return steer;
  });
  const steered = wheel_axles.map((axle) => axles[axle].steer);
  return { root, body, wheels, steered, brake, heads, halo, eye: d.eye ? new THREE.Vector3(0, body.position.y + d.eye[1], d.eye[0]) : null, flame };
}

export function sync_car_view(view: CarView, car: Car) {
  view.root.position.copy(car.pos);
  view.root.quaternion.copy(car.quat);
  car.wheels.forEach((w, i) => {
    const g = view.wheels[i];
    g.position.set(w.mount.x, w.mount.y - (w.reach - car.spec.wheel.radius), w.mount.z);
    g.rotation.y = -w.angle;
    g.children[0].rotation.x = w.spin;
  });
  view.brake.emissiveIntensity = car.braking > 0.05 ? 2.2 : 0.5;
}

export function rest_wheels(view: CarView, spec: CarSpec = COUPE) {
  const drop = rest_reach(spec) - spec.wheel.radius;
  view.wheels.forEach((wheel, i) => {
    const [x, y, z] = spec.wheel.mounts[i];
    wheel.position.set(x, y - drop, z);
  });
}

// Ghost and remote cars have no collision, so one can pass right through the camera and fill the view.
const CAMERA_HIDE = 2.5;
const CAMERA_CLEAR = 6;

/** Opacity factor for a see-through car centred at `at`: 0 within `CAMERA_HIDE` metres of the camera, 1 from `CAMERA_CLEAR` out. */
export function camera_fade(at: THREE.Vector3, camera: THREE.Vector3): number {
  const k = Math.max(0, Math.min(1, (at.distanceTo(camera) - CAMERA_HIDE) / (CAMERA_CLEAR - CAMERA_HIDE)));
  // Squared: a car a few metres off still fills most of the frame, so it stays faint until it is clear.
  return k * k;
}

export function dispose_car_view(view: CarView) {
  view.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    (object.material as THREE.Material).dispose();
  });
}
