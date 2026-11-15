import * as THREE from "three";
import { LandmarksView } from "../world/landmarks";
import { soup_geometry } from "../world/buildings";
import type { TreeKind } from "../worldgen/biomes";
import { soup } from "../worldgen/chunks";
import { landmark_mesh } from "../worldgen/landmark-mesh";
import { Builder } from "../worldgen/mesh";
import { N, PropKind, type Prop, type Tree } from "../worldgen/types";
import { mesh_tones, tree_kit } from "./scene";
import { charred_kit, type TreeLook } from "./snags";
import { TreeBatch } from "./tree-batch";

const ARCH_HALF = 10;
export type TreeSpot = readonly [number, number, number];
export const TREE_CLUMP: readonly TreeSpot[] = [
  [0, 0, 1.1],
  [4.5, 3, 0.85],
  [-4, 2.5, 0.95],
];
const FLAT = new Float32Array((N + 1) * (N + 1));
const prop_material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

export function tree_sample(kind: TreeKind, snowy: boolean, look: TreeLook, spots: readonly TreeSpot[] = TREE_CLUMP): THREE.Object3D {
  const group = new THREE.Group();
  const here: Tree[] = spots.map(([x, z, scale]) => ({ x, y: 0, z, scale, kind }));
  const batch = new TreeBatch(look === "charred" ? charred_kit() : tree_kit(snowy), here.length);
  batch.plant(here, null);
  group.add(...batch.meshes);
  return group;
}

export function prop_sample(kind: PropKind, snowy: boolean): THREE.Object3D {
  const placed: Prop = { x: 0, y: 0, z: 0, angle: 0, kind, scale: kind === PropKind.ARCH ? ARCH_HALF : 1 };
  const builder = new Builder();
  landmark_mesh(builder, placed, FLAT, mesh_tones(snowy).landmark);
  const group = new THREE.Group();
  const shell = soup([builder]);
  if (shell) {
    const mesh = new THREE.Mesh(soup_geometry(shell), prop_material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.add(new LandmarksView([placed]).root);
  return group;
}
