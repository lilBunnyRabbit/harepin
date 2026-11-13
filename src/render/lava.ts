import * as THREE from "three";
import { glow, tones } from "../theme/palette";
import type { World } from "../world/world";

/**
 * Well under the bloom threshold: the pool fills the whole crater floor, and over it bloom whites out the view. Low enough
 * that an orange-red fits without clipping its red channel, which washed the pool to peach. Lights and fog never reach it,
 * or an aerial view sees a brown haze.
 */
const LAVA_GLOW = 0.4;
const SEGMENTS = 48;

/** A flat glowing disc over each crater's lava; the crater wall hides the part past the floor. */
export function lava_lakes(world: World): THREE.Object3D[] {
  const material = new THREE.MeshBasicMaterial({ color: glow(tones.lava_glow, LAVA_GLOW), fog: false });
  return world.lava.map((pool) => {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(pool.radius, SEGMENTS).rotateX(-Math.PI / 2), material);
    mesh.position.set(pool.x, pool.level, pool.z);
    return mesh;
  });
}
