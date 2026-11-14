/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import * as THREE from "three";
import { DECALS, DEFAULT_BUILD, DEFAULT_PARTS, SLOTS, SLOT_NAMES, type Build } from "./build";
import { CARS, type CarId } from "./cars";

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

function body_faces(root: THREE.Object3D): Face[] {
  root.updateMatrixWorld(true);
  const local = root.matrixWorld.clone().invert();
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
      // A mirrored part's halves meet at x 0, each cap buried in the other half.
      if (Math.abs(normal.x) > NORMAL_DOT && Math.abs(a.x) + Math.abs(b.x) + Math.abs(c.x) < PLANE_GAP) continue;
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
  const sorted = [...faces].sort((f, g) => f.d - g.d);
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
