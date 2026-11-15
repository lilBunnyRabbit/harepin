import * as THREE from "three";
import type { CarSpec } from "./cars";
import { CAR_ORDER } from "./contact-shadow";
import { merge } from "./geometry";
import { rest_wheels, type CarView } from "./models";

const inverse = new THREE.Matrix4();
const local = new THREE.Matrix4();

/** Position and colour only: a piece with normals or uvs would not merge with the rest. */
function piece(mesh: THREE.Mesh): THREE.BufferGeometry {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const position = source.getAttribute("position");
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", position.clone());
  const colors = source.getAttribute("color");
  if (colors && colors.itemSize === 3) out.setAttribute("color", colors.clone());
  else {
    const tone = (mesh.material as THREE.MeshLambertMaterial).color ?? new THREE.Color();
    const flat = new Float32Array(position.count * 3);
    for (let i = 0; i < flat.length; i += 3) tone.toArray(flat, i);
    out.setAttribute("color", new THREE.BufferAttribute(flat, 3));
  }
  local.multiplyMatrices(inverse, mesh.matrixWorld);
  out.applyMatrix4(local);
  // A mirrored wheel (scale.x -1) turns its faces inside out once baked: three flips the winding only for a live mesh.
  if (local.determinant() < 0) {
    for (const name of ["position", "color"]) {
      const a = out.getAttribute(name) as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i += 3)
        for (let k = 0; k < 3; k++) {
          const t = a.getComponent(i + 1, k);
          a.setComponent(i + 1, k, a.getComponent(i + 2, k));
          a.setComponent(i + 2, k, t);
        }
    }
  }
  return out;
}

/** One draw call and no shadow, where the full view takes a dozen and casts each. */
export function far_view(view: CarView, spec: CarSpec): THREE.Mesh {
  rest_wheels(view, spec);
  view.root.updateMatrixWorld(true);
  inverse.copy(view.root.matrixWorld).invert();
  const pieces: THREE.BufferGeometry[] = [];
  view.root.traverse((object) => {
    if (object instanceof THREE.Mesh && object !== view.flame && object.visible) pieces.push(piece(object));
  });
  const mesh = new THREE.Mesh(merge(pieces), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.renderOrder = CAR_ORDER;
  mesh.matrixAutoUpdate = false;
  return mesh;
}
