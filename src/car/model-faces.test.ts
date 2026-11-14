/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import * as THREE from "three";
import { DECALS, DEFAULT_BUILD, DEFAULT_PARTS, SLOTS, SLOT_NAMES, type Build, type Part } from "./build";
import { CARS, type CarId } from "./cars";
import type { Point } from "./geometry";

const PLANE_GAP = 0.001;
const MIN_OVERLAP = 1e-5;
const NORMAL_DOT = 0.9995;

const TOP_PARTS = { ...DEFAULT_PARTS };
for (const slot of SLOT_NAMES) TOP_PARTS[slot] = SLOTS[slot].parts.length - 1;

function looks(car: CarId): [string, Build][] {
  const kits = [DEFAULT_PARTS, ...SLOTS.aero.parts.map((_, aero) => ({ ...TOP_PARTS, aero }))];
  return [
    ...kits.map((parts, k): [string, Build] => [`kit ${k}`, { ...DEFAULT_BUILD, car, parts }]),
    ...DECALS.map((decal, i): [string, Build] => [`decal ${decal}`, { ...DEFAULT_BUILD, car, parts: DEFAULT_PARTS, decal: i }]),
  ];
}

interface Face {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  normal: THREE.Vector3;
  d: number;
  tone: string;
}

function body_faces(root: THREE.Object3D, frame: THREE.Object3D = root): Face[] {
  root.updateMatrixWorld(true);
  const local = frame.matrixWorld.clone().invert();
  const faces: Face[] = [];
  let mesh_index = 0;
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.visible) return;
    if ([node.material].flat().some((material) => material.transparent)) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry;
    const position = geometry.getAttribute("position");
    const index = mesh_index++;
    const colors = geometry.getAttribute("color");
    const tone = (v: number) => (colors ? `${index}:${[colors.getX(v), colors.getY(v), colors.getZ(v)].map((x) => x.toFixed(3)).join(",")}` : `${index}`);
    for (let i = 0; i + 2 < position.count; i += 3) {
      const [a, b, c] = [i, i + 1, i + 2].map((v) => new THREE.Vector3().fromBufferAttribute(position, v).applyMatrix4(node.matrixWorld).applyMatrix4(local));
      const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      if (normal.length() < 1e-9) continue;
      normal.normalize();
      faces.push({ a, b, c, normal, d: normal.dot(a), tone: tone(i) });
    }
  });
  return faces;
}

function clip_polygon(subject: THREE.Vector2[], a: THREE.Vector2, b: THREE.Vector2, sign: number): THREE.Vector2[] {
  const side = (p: THREE.Vector2) => sign * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
  const out: THREE.Vector2[] = [];
  subject.forEach((p, i) => {
    const q = subject[(i + 1) % subject.length];
    const sp = side(p);
    const sq = side(q);
    if (sp >= 0) out.push(p);
    if (sp >= 0 !== sq >= 0) out.push(p.clone().lerp(q, sp / (sp - sq)));
  });
  return out;
}

const area = (points: THREE.Vector2[]) => Math.abs(points.reduce((sum, p, i) => sum + p.cross(points[(i + 1) % points.length]), 0)) / 2;

function overlap(f: Face, g: Face): number {
  const u = new THREE.Vector3().subVectors(f.b, f.a).normalize();
  const v = new THREE.Vector3().crossVectors(f.normal, u);
  const flat = (p: THREE.Vector3) => new THREE.Vector2(p.dot(u), p.dot(v));
  const first = [f.a, f.b, f.c].map(flat);
  let shape = [g.a, g.b, g.c].map(flat);
  const winding = Math.sign((first[1].x - first[0].x) * (first[2].y - first[0].y) - (first[1].y - first[0].y) * (first[2].x - first[0].x));
  for (let i = 0; i < 3 && shape.length > 0; i++) shape = clip_polygon(shape, first[i], first[(i + 1) % 3], winding);
  return shape.length < 3 ? 0 : area(shape);
}

function fights(faces: Face[]): [Face, Face, number][] {
  const out: [Face, Face, number][] = [];
  // A mirrored part's halves meet at x 0, each cap buried in the other half.
  const seam = (f: Face) => Math.abs(f.normal.x) > NORMAL_DOT && Math.abs(f.a.x) + Math.abs(f.b.x) + Math.abs(f.c.x) < PLANE_GAP;
  const sorted = faces.filter((f) => !seam(f)).sort((f, g) => f.d - g.d);
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length && sorted[j].d - sorted[i].d < PLANE_GAP; j++) {
      const [f, g] = [sorted[i], sorted[j]];
      if (f.tone === g.tone || f.normal.dot(g.normal) < NORMAL_DOT) continue;
      if ([g.a, g.b, g.c].some((p) => Math.abs(f.normal.dot(p) - f.d) > PLANE_GAP)) continue;
      const shared = overlap(f, g);
      if (shared > MIN_OVERLAP) out.push([f, g, shared]);
    }
  return out;
}

test("no two body faces of any car and kit share a plane and an area", async () => {
  const { build_view, dispose_car_view } = await import("./models");
  const found: string[] = [];
  for (const car of Object.keys(CARS) as CarId[])
    for (const [k, build] of looks(car)) {
      const view = build_view(build);
      const hits = fights(body_faces(view.body));
      const at = (p: THREE.Vector3) => `[${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}]`;
      for (const [f, , shared] of hits.slice(0, 4)) found.push(`${car} ${k}: ${(shared * 1e4).toFixed(1)} cm² at ${at(f.a)} n ${at(f.normal)}`);
      if (hits.length > 4) found.push(`${car} ${k}: ${hits.length - 4} more`);
      dispose_car_view(view);
    }
  expect(found).toEqual([]);
}, 120_000);

// The opening is checked this far inside its arc and floor, clear of the arch faces and flares lying on them, whose
// chords cut the circle at their own angles.
const OPENING_MARGIN = 0.015;
const SAMPLES = 10;
function inside(polygon: Point[], z: number, y: number): boolean {
  let hit = false;
  polygon.forEach(([zi, yi], i) => {
    const [zj, yj] = polygon[(i + polygon.length - 1) % polygon.length];
    if (yi > y !== yj > y && z < ((zj - zi) * (y - yi)) / (yj - yi) + zi) hit = !hit;
  });
  return hit;
}

test("every wheel opening stays open over its tyre, on every car and kit", async () => {
  const { build_view, dispose_car_view } = await import("./models");
  const { build_spec } = await import("./build");
  const { DESIGNS } = await import("./designs");
  const { arch_opening } = await import("./body-shell");
  const { aero_of } = await import("./part-looks");
  const { axles_of } = await import("./axles");
  const found: string[] = [];
  for (const car of Object.keys(CARS) as CarId[])
    for (const [k, build] of looks(car).filter(([name]) => name.startsWith("kit"))) {
      const spec = build_spec(build);
      const stock = DESIGNS[spec.body.style];
      const d = aero_of(build.parts).skirts && stock.kit ? { ...stock, ...stock.kit } : stock;
      if (d.arches.steps === 0) continue;
      const view = build_view(build, spec);
      const tyre = view.wheels[0].children[0].children[0];
      if (!(tyre instanceof THREE.Mesh)) throw new Error("wheel without a tyre mesh");
      tyre.geometry.computeBoundingBox();
      const half = tyre.geometry.boundingBox?.max.x ?? 0;
      const narrow = { ...d, outline: d.outline.map(([z, y]): Point => [z, y - OPENING_MARGIN]), sill: d.sill + OPENING_MARGIN, arches: { ...d.arches, gap: d.arches.gap - OPENING_MARGIN } };
      const openings = axles_of(spec).map((axle) => arch_opening(narrow, spec, axle.z));
      const track = Math.abs(spec.wheel.mounts[0][0]);
      const p = new THREE.Vector3();
      let worst = 0;
      for (const face of body_faces(view.body))
        for (let i = 0; i <= SAMPLES; i++)
          for (let j = 0; i + j <= SAMPLES; j++) {
            p.set(0, 0, 0).addScaledVector(face.a, i / SAMPLES).addScaledVector(face.b, j / SAMPLES).addScaledVector(face.c, (SAMPLES - i - j) / SAMPLES);
            if (Math.abs(Math.abs(p.x) - track) > half) continue;
            if (openings.some((opening) => inside(opening, p.z, p.y))) worst = Math.max(worst, Math.abs(p.x));
          }
      if (worst > 0) found.push(`${car} ${k}: a body face crosses a wheel opening at x ${worst.toFixed(3)}`);
      dispose_car_view(view);
    }
  expect(found).toEqual([]);
}, 120_000);

const WHEEL_SKIN = 0.002;
const WHEEL_STEP = 0.015;
// A steered tyre may lay its inner sidewall on an arm; this far under the tread the arm never shows through it.
const ARM_TREAD = 0.05;

const TYRES: readonly Part[] = SLOTS.tyres.parts;
const SUSPENSIONS: readonly Part[] = SLOTS.suspension.parts;
const best = (parts: readonly Part[], score: (part: Part) => number) => parts.reduce((top, part, i) => (score(part) > score(parts[top]) ? i : top), 0);
const WIDE_TYRE = best(TYRES, (part) => part.look?.tyre?.width ?? 1);
const SMALL_RIM = best(TYRES, (part) => -(part.look?.tyre?.rim ?? 1));
const MOST_LOCK = best(SUSPENSIONS, (part) => part.mod.scale?.lock ?? 1);

test("no body part or arm stands in a tyre, straight or at full lock, on every car, kit and tyre", async () => {
  const { build_view, dispose_car_view, rest_wheels } = await import("./models");
  const { build_spec, part_of } = await import("./build");
  const { DESIGNS } = await import("./designs");
  const { aero_of } = await import("./part-looks");
  const { axle_index, axles_of } = await import("./axles");
  const found = new Map<string, { depth: number; at: string }>();
  const p = new THREE.Vector3();
  const box = new THREE.Box3();
  // The wide tyre on every kit for the body; the stock and the smallest rim once more for the arms, which no kit moves.
  const fits = [...SLOTS.aero.parts.keys()].map((aero) => ({ aero, tyres: WIDE_TYRE })).concat([0, SMALL_RIM].map((tyres) => ({ aero: 0, tyres })));
  for (const car of Object.keys(CARS) as CarId[])
    for (const { aero, tyres } of fits) {
      const build: Build = { ...DEFAULT_BUILD, car, parts: { ...DEFAULT_PARTS, aero, tyres, suspension: MOST_LOCK } };
      const spec = build_spec(build);
      const stock = DESIGNS[spec.body.style];
      const kit = aero_of(build.parts).skirts === true && stock.kit !== undefined;
      const d = kit ? { ...stock, ...stock.kit } : stock;
      const look = part_of("tyres", tyres).look?.tyre ?? { width: 1, rim: 1 };
      const view = build_view(build, spec);
      rest_wheels(view, spec);
      view.root.updateMatrixWorld(true);
      const arm_faces = view.arms.map((arm) => (arm ? body_faces(arm.group, view.root) : []));
      for (const arm of view.arms) arm?.group.removeFromParent();
      const shell = body_faces(view.body, view.root);
      const axles = axles_of(spec);
      const radius = spec.wheel.radius;
      const disc = radius * d.rim.size * look.rim;
      // The skin a low bonnet keeps over a capped opening stands in the tyre top, inside the raised wing that covers it.
      const covered = (x: number, y: number, z: number) => (d.slabs ?? []).some((s) => Math.abs(x) >= s.from && Math.abs(x) <= s.to && inside(s.points, z, y - view.body.position.y));
      spec.wheel.mounts.forEach(([mx], w) => {
        // The car is mirrored: its left wheels stand for both sides.
        if (mx < 0) return;
        const centre = view.wheels[w].position;
        const half = (d.tyre[Math.min(axle_index(axles, w), 1)] * look.width) / 2;
        const near = (faces: Face[]) => faces.filter((face) => box.setFromPoints([face.a, face.b, face.c]).distanceToPoint(centre) < Math.hypot(radius, half));
        const check = (faces: Face[], angle: number, arm: boolean) => {
          const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
          const key = `${car}${kit ? " kit" : ""}, wheel ${w}${angle ? " at full lock" : ""}: ${arm ? "an arm" : "the body"} stands in the tyre`;
          for (const face of faces) {
            const n = Math.ceil(Math.max(face.a.distanceTo(face.b), face.b.distanceTo(face.c), face.c.distanceTo(face.a)) / WHEEL_STEP);
            for (let i = 0; i <= n; i++)
              for (let j = 0; i + j <= n; j++) {
                p.set(0, 0, 0).addScaledVector(face.a, i / n).addScaledVector(face.b, j / n).addScaledVector(face.c, (n - i - j) / n);
                if (!arm && covered(p.x, p.y, p.z)) continue;
                p.sub(centre);
                const across = p.x * cos - p.z * sin;
                const spoke = Math.hypot(p.y, p.x * sin + p.z * cos);
                const depth = Math.min(half - Math.abs(across), radius - spoke);
                if (depth <= WHEEL_SKIN) continue;
                // An arm ends in the rim, on the car's side of the wheel.
                if (arm && across <= 0 && (angle === 0 ? spoke < disc : radius - spoke > ARM_TREAD)) continue;
                if (depth > (found.get(key)?.depth ?? 0)) found.set(key, { depth, at: p.add(centre).toArray().map((x) => x.toFixed(3)).join(", ") });
              }
          }
        };
        const [body_near, arm_near] = [near(shell), near(arm_faces[w])];
        for (const angle of view.steered[w] ? [0, spec.lock, -spec.lock] : [0]) {
          check(body_near, angle, false);
          check(arm_near, angle, true);
        }
      });
      dispose_car_view(view);
    }
  expect([...found].map(([key, { depth, at }]) => `${key} by ${(depth * 1000).toFixed(0)} mm at [${at}]`)).toEqual([]);
}, 240_000);

// An arm end this close to the axle line, inside the wheel, is on the hub.
const HUB = 0.06;

test("every suspension arm runs from the body to its wheel's hub", async () => {
  const { build_view, dispose_car_view, rest_wheels } = await import("./models");
  const { build_spec } = await import("./build");
  const { DESIGNS } = await import("./designs");
  const { axle_index, axles_of } = await import("./axles");
  const found: string[] = [];
  for (const car of Object.keys(CARS) as CarId[]) {
    const build: Build = { ...DEFAULT_BUILD, car };
    const spec = build_spec(build);
    const d = DESIGNS[spec.body.style];
    const view = build_view(build, spec);
    rest_wheels(view, spec);
    view.root.updateMatrixWorld(true);
    const axles = axles_of(spec);
    view.arms.forEach((arm, w) => {
      if (!arm) return;
      const centre = view.wheels[w].position;
      const inner = Math.abs(centre.x) - d.tyre[Math.min(axle_index(axles, w), 1)] / 2;
      const points = body_faces(arm.group, view.root).flatMap((face) => [face.a, face.b, face.c]);
      if (!points.some((q) => Math.abs(q.x) >= inner && Math.abs(q.x) <= Math.abs(centre.x) && Math.hypot(q.y - centre.y, q.z - centre.z) < HUB)) found.push(`${car} wheel ${w}: no arm reaches the hub`);
      if (!points.some((q) => Math.abs(q.x) < d.width / 2)) found.push(`${car} wheel ${w}: no arm reaches the body`);
    });
    dispose_car_view(view);
  }
  expect(found).toEqual([]);
});
