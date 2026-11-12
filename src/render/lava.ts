import * as THREE from "three";
import { glow, tones } from "../theme/palette";
import type { World } from "../world/world";

/** Under the bloom threshold: the pool fills the whole crater floor, and over it bloom whites out the view. Lights and fog never reach it, or an aerial view sees a brown haze. */
const LAVA_GLOW = 0.8;
const SEGMENTS = 48;

/** A flat glowing disc over each crater's lava; the crater wall hides the part past the floor. */
export function lava_lakes(world: World): THREE.Object3D[] {
  const material = new THREE.MeshBasicMaterial({ color: glow(tones.lava, LAVA_GLOW), fog: false });
  return world.lava.map((pool) => {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(pool.radius, SEGMENTS).rotateX(-Math.PI / 2), material);
    mesh.position.set(pool.x, pool.level, pool.z);
    return mesh;
  });
}
