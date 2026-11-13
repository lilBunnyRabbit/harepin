import * as THREE from "three";

// three's one shared shadow depth material re-keys its program on every instancing / instance-colour flip.
const plain = new THREE.MeshDepthMaterial();
const coloured = new THREE.MeshDepthMaterial();

/** After `setColorAt`: that is what creates `instanceColor`. */
export function cast_instanced(mesh: THREE.InstancedMesh) {
  mesh.castShadow = true;
  mesh.customDepthMaterial = mesh.instanceColor ? coloured : plain;
}
