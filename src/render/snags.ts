import * as THREE from "three";
import { dark, lighten, mix, tones } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { soup_geometry } from "../world/buildings";
import { soup } from "../worldgen/chunks";
import { Builder, type Rgb, type V3 } from "../worldgen/mesh";
import type { TreeKit } from "./scene";

export type TreeLook = "green" | "charred";

const ASH = 0.35;
const WHITE: Rgb = [1, 1, 1];

// Burnt wood is the ink with a little bark left in it. A day theme's bark is pale, so there the ink carries it: at
// the dusk share it read as khaki, a dry tree and not a burnt one.
const CHAR_INK = dark ? 0.2 : 0.88;
/** How far a day char sits under the ink: sunlit ink alone read as slate. */
const CHAR_DROP = dark ? 0 : 0.1;

const char = () => lighten(mix(tones.check_dark, tones.trunk, CHAR_INK), -CHAR_DROP);

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

const TRUNK = { foot: 0.35, top: 0.25, height: 2.2 };
/** Where a snag's stem starts: inside the trunk, low enough that a scrub's squashed snag still reaches the ground. */
const STEM_FOOT = 1.4;

// A stem is a limb on the trunk's own axis, corners on the trunk's corners. It starts just inside the trunk and
// leaves it at the trunk's top with the trunk's section, so the two read as one piece of wood.
function stem(out: Builder, top: number, tip: number): number {
  const run = (TRUNK.height - STEM_FOOT) / (top - STEM_FOOT);
  const foot = (TRUNK.top - tip * run) / (1 - run);
  limb(out, [0, STEM_FOOT, 0], [0, top, 0], foot, tip);
  return foot;
}

// Snags sit on the living kit's 2 m trunk in the crown slots, so tree spots and solids are the same as the green trees'.
function pine_snag(): THREE.BufferGeometry {
  const out = new Builder();
  const top = 7.4;
  const foot = stem(out, top, 0.03);
  [3.1, 3.9, 4.6, 5.4, 6.1].forEach((y, k) => {
    const a = k * 2.4;
    const reach = 1.3 - k * 0.18;
    const r = foot * (1 - (y - STEM_FOOT) / (top - STEM_FOOT));
    limb(out, [0, y, 0], [Math.cos(a) * reach, y + 0.35, Math.sin(a) * reach], r * 0.5, 0.02);
  });
  return geometry(out);
}

function broad_snag(): THREE.BufferGeometry {
  const out = new Builder();
  stem(out, 3.3, 0.24);
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
    // Four sides, as a limb has, and open ends: the foot is in the ground, the top inside the stem.
    trunk: new THREE.CylinderGeometry(TRUNK.top, TRUNK.foot, TRUNK.height, 4, 1, true).translate(0, TRUNK.height / 2, 0),
    crowns: [pine_snag(), broad_snag()],
    bark: new THREE.MeshLambertMaterial({ flatShading: true }),
    leaf: new THREE.MeshLambertMaterial({ flatShading: true, side: THREE.DoubleSide }),
    tone: (_kind, shade): Lab => (shade > ASH ? mix(base, tones.rock, 0.35) : lighten(base, shade * 0.06)),
    one_tone: true,
  };
}
