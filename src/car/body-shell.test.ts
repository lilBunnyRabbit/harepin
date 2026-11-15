import { expect, test } from "bun:test";
import * as THREE from "three";
import { fitted_slab, sculpt, sculpt_factor } from "./body-shell";
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

test("a straight slab stands square to the car across the pinch, as wide as the body at its anchor", () => {
  for (const [car, d] of pinched) {
    const tail = d.outline[d.outline.length - 1][0];
    const y = Math.max(...d.outline.map(([, oy]) => oy)) + 0.2;
    const points: Slab["points"] = [[tail + 1.2, y], [tail - 0.3, y + 0.3], [tail - 0.3, y + 0.2], [tail + 1.2, y - 0.1]];
    const anchor = tail + 0.1;
    const wide = (d.width / 2) * sculpt_factor(d, y, anchor);
    for (const face of side_faces(d, { points, from: 0, to: d.width / 2, straight: anchor }))
      for (const p of face) expect(`${car}: ${p.x.toFixed(5)}`).toBe(`${car}: ${wide.toFixed(5)}`);
    // Down through the crest and a sloping belt, far from its anchor, it still folds where the body does.
    const tall: Slab = { points: [[tail + 1.2, y], [tail + 1.0, y], [tail + 1.0, d.sill + 0.05], [tail + 1.2, d.sill + 0.05]], from: 0, to: d.width / 2, straight: anchor };
    for (const face of side_faces(d, tall)) expect(`${car}: ${warp(face).toFixed(6)}`).toBe(`${car}: ${(0).toFixed(6)}`);
  }
});

test("a leaned slab's inner face moves out with height and its outer face stays where it was", () => {
  const d = DESIGNS.coupe;
  const points: Slab["points"] = [[0.4, 0.3], [0.4, 0.5], [-0.4, 0.5], [-0.4, 0.3]];
  const lean = { low: 0.3, high: 0.5, out: 0.1 };
  const xs = (s: Slab) =>
    fitted_slab(d, s).flatMap((piece) => {
      const position = piece.getAttribute("position");
      return Array.from({ length: position.count }, (_, i) => [Math.abs(position.getX(i)), position.getY(i)]);
    });
  const plain = xs({ points, from: 0.5, to: 0.8 });
  const leaned = xs({ points, from: 0.5, to: 0.8, lean });
  for (const [k, [x, y]] of leaned.entries()) {
    const was = plain[k][0];
    const want = Math.abs(was - 0.5) < 1e-6 ? 0.5 + lean.out * Math.max(0, Math.min(1, (y - lean.low) / (lean.high - lean.low))) : was;
    expect(x).toBeCloseTo(want, 6);
  }
});

test("a rolled slab's outer face moves in with height and its inner face stays where it was", () => {
  const d = DESIGNS.coupe;
  const points: Slab["points"] = [[0.4, 0.3], [0.4, 0.5], [-0.4, 0.5], [-0.4, 0.3]];
  const roll = { low: 0.3, high: 0.5, in: 0.1 };
  const xs = (s: Slab) =>
    fitted_slab(d, s).flatMap((piece) => {
      const position = piece.getAttribute("position");
      return Array.from({ length: position.count }, (_, i) => [Math.abs(position.getX(i)), position.getY(i)]);
    });
  const plain = xs({ points, from: 0.5, to: 0.8 });
  const rolled = xs({ points, from: 0.5, to: 0.8, roll });
  for (const [k, [x, y]] of rolled.entries()) {
    const was = plain[k][0];
    const want = Math.abs(was - 0.8) < 1e-6 ? 0.8 - roll.in * Math.max(0, Math.min(1, (y - roll.low) / (roll.high - roll.low))) : was;
    expect(x).toBeCloseTo(want, 6);
  }
});
