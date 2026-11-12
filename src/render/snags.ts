import * as THREE from "three";
import { color, lighten, mix, tones } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { soup_geometry } from "../world/buildings";
import { soup } from "../worldgen/chunks";
import { Builder, type Rgb, type V3 } from "../worldgen/mesh";
import type { TreeKit } from "./scene";

export type TreeLook = "green" | "charred";

const ASH = 0.35;
const WHITE: Rgb = [1, 1, 1];

const char = () => mix(tones.check_dark, tones.trunk, 0.2);

// The snag material draws both faces, so a limb's winding does not matter.
function limb(out: Builder, a: V3, b: V3, r0: number, r1: number) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  const side = new THREE.Vector3(0, 1, 0).cross(d);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  const up = new THREE.Vector3().crossVectors(d, side);
  const ring = (p: V3, r: number): V3[] =>
    [0, 1, 2, 3].map((k) => {
      const c = Math.cos((k * Math.PI) / 2) * r;
      const s = Math.sin((k * Math.PI) / 2) * r;
      return [p[0] + side.x * c + up.x * s, p[1] + side.y * c + up.y * s, p[2] + side.z * c + up.z * s];
    });
  const lo = ring(a, r0);
  const hi = ring(b, r1);
  for (let k = 0; k < 4; k++) out.quad(lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k], WHITE);
}

// Snags sit on the living kit's 2 m trunk in the crown slots, so tree spots and solids are the same as the green trees'.
function pine_snag(): THREE.BufferGeometry {
  const out = new Builder();
  limb(out, [0, 1.8, 0], [0, 7.4, 0], 0.24, 0.03);
  [3.1, 3.9, 4.6, 5.4, 6.1].forEach((y, k) => {
    const a = k * 2.4;
    const reach = 1.3 - k * 0.18;
    const r = 0.24 * (1 - (y - 1.8) / 5.6);
    limb(out, [0, y, 0], [Math.cos(a) * reach, y + 0.35, Math.sin(a) * reach], r * 0.5, 0.02);
  });
  return geometry(out);
}

function broad_snag(): THREE.BufferGeometry {
  const out = new Builder();
  limb(out, [0, 1.8, 0], [0, 3.3, 0], 0.3, 0.24);
  const forks: readonly V3[] = [
    [1.3, 5.6, 0.3],
    [-1.1, 5.1, -0.6],
    [0.2, 6.1, -1.1],
  ];
  forks.forEach((tip, k) => {
    limb(out, [0, 3.2, 0], tip, 0.17, 0.05);
    const mid: V3 = [tip[0] * 0.6, 3.2 + (tip[1] - 3.2) * 0.6, tip[2] * 0.6];
    const a = k * 2.1 + 0.8;
    limb(out, mid, [mid[0] + Math.cos(a) * 0.9, mid[1] + 0.8, mid[2] + Math.sin(a) * 0.9], 0.07, 0.02);
  });
  return geometry(out);
}

function geometry(out: Builder): THREE.BufferGeometry {
  const shell = soup([out]);
  if (!shell) throw new Error("snag mesh is empty");
  return soup_geometry({ positions: shell.positions, sphere: shell.sphere });
}

export function charred_kit(): TreeKit {
  const base = char();
  return {
    trunk: new THREE.CylinderGeometry(0.25, 0.35, 2.2, 5).translate(0, 1.1, 0),
    crowns: [pine_snag(), broad_snag()],
    bark: new THREE.MeshLambertMaterial({ color: color(base), flatShading: true }),
    leaf: new THREE.MeshLambertMaterial({ flatShading: true, side: THREE.DoubleSide }),
    tone: (_kind, shade): Lab => (shade > ASH ? mix(base, tones.rock, 0.35) : lighten(base, shade * 0.06)),
  };
}
