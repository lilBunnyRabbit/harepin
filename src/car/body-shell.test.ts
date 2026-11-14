import { expect, test } from "bun:test";
import * as THREE from "three";
import { fitted_slab, sculpt } from "./body-shell";
import { DESIGNS } from "./designs";
import type { Design, Slab } from "./designs";

/** Corners of the outer side face of each piece of `s` on the left, sculpted with the body. */
function side_faces(d: Design, s: Slab): THREE.Vector3[][] {
  return fitted_slab(d, s).flatMap((piece) => {
    const position = sculpt(piece, d).getAttribute("position");
    const corners = Array.from({ length: position.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(position, i));
    if (corners.some((p) => p.x < 0)) return [];
    // A slab is a profile between two distances from the centre: of the two corners over each profile point, the outer one.
    const outer = new Map<string, number>();
    const key = (p: THREE.Vector3) => `${p.z.toFixed(6)} ${p.y.toFixed(6)}`;
    for (const p of corners) outer.set(key(p), Math.max(outer.get(key(p)) ?? 0, p.x));
    return [corners.filter((p) => p.x === outer.get(key(p)))];
  });
}

/** The furthest any corner of `face` stands off the plane through three of its corners that span the most area. */
function warp(face: THREE.Vector3[]): number {
  const [edge, other, normal] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let best = 0;
  for (const b of face)
    for (const c of face) {
      const area = edge.subVectors(b, face[0]).cross(other.subVectors(c, face[0]));
      if (area.length() > best) best = normal.copy(area).length();
    }
  normal.normalize();
  return Math.max(...face.map((p) => Math.abs(normal.dot(edge.subVectors(p, face[0])))));
}

const pinched = Object.entries(DESIGNS).filter(([, d]) => d.section && (d.section.nose[1] > 0 || d.section.tail[1] > 0));

test("a slab that overhangs a pinched nose or tail keeps every side face flat", () => {
  for (const [car, d] of pinched) {
    const zs = d.outline.map(([z]) => z);
    const [front, rear] = [Math.max(...zs), Math.min(...zs)];
    const y = Math.max(...d.outline.map(([, oy]) => oy)) + 0.2;
    const over: Slab[] = [
      { points: [[rear + 0.5, y], [rear - 0.2, y + 0.1], [rear - 0.2, y - 0.6], [rear + 0.5, y - 0.5]], from: 0, to: d.width / 2 },
      { points: [[front + 0.2, y - 0.6], [front + 0.2, y + 0.1], [front - 0.5, y], [front - 0.5, y - 0.5]], from: 0, to: d.width / 2 },
    ];
    for (const s of over) for (const face of side_faces(d, s)) expect(`${car}: ${warp(face).toFixed(6)}`).toBe(`${car}: ${(0).toFixed(6)}`);
  }
});
