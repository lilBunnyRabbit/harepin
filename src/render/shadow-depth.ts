import * as THREE from "three";

// three's one shared shadow depth material re-keys its program on every instancing / batching / colour flip.
const plain = new THREE.MeshDepthMaterial();
const coloured = new THREE.MeshDepthMaterial();
const batched = new THREE.MeshDepthMaterial();
const batched_coloured = new THREE.MeshDepthMaterial();

/** After `setColorAt`: that is what creates `instanceColor`. */
export function cast_instanced(mesh: THREE.InstancedMesh) {
  mesh.castShadow = true;
  mesh.customDepthMaterial = mesh.instanceColor ? coloured : plain;
}

/** `coloured` when the batch takes `setColorAt`: its colour texture keys the program from the first one on. */
export function cast_batched(mesh: THREE.BatchedMesh, coloured: boolean) {
  mesh.castShadow = true;
  mesh.customDepthMaterial = coloured ? batched_coloured : batched;
}
