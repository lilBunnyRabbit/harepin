import * as THREE from "three";
import { glow, tones } from "../theme/palette";
import type { World } from "../world/world";

/** Over 1 so bloom picks the lava up; the theme's own lights never reach it. */
const LAVA_GLOW = 1.6;
const SEGMENTS = 48;

/** A flat glowing disc over each crater's lava; the crater wall hides the part past the floor. */
export function lava_lakes(world: World): THREE.Object3D[] {
  const material = new THREE.MeshBasicMaterial({ color: glow(tones.lava, LAVA_GLOW) });
  return world.lava.map((pool) => {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(pool.radius, SEGMENTS).rotateX(-Math.PI / 2), material);
    mesh.position.set(pool.x, pool.level, pool.z);
    return mesh;
  });
}
