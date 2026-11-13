import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { color, dark, glow, tones } from "../theme/palette";
import { cast_instanced } from "../render/shadow-depth";
import { beacons, rotor_hub } from "../worldgen/landmark-mesh";
import { ROTOR_RADIUS } from "../worldgen/landmarks";
import { PropKind, type Prop } from "../worldgen/types";

const ROTOR_SPEED = 1.4;
const BLADE_ROOT = 0.6;
const BLADE_WIDTH = 0.7;
const BLADE_TIP = 0.25;
const BLINK = 1.6;
const BLINK_ON = 0.35;
const LAMP_LOW = 0.15;
const LAMP_HIGH = dark ? 2.4 : 1.2;

function rotor_geometry(): THREE.BufferGeometry {
  const blades = [0, 1, 2].map((k) => {
    const blade = new THREE.CylinderGeometry(BLADE_TIP / 2, BLADE_WIDTH / 2, ROTOR_RADIUS - BLADE_ROOT, 4).scale(1, 1, 0.3).translate(0, BLADE_ROOT + (ROTOR_RADIUS - BLADE_ROOT) / 2, 0);
    return blade.rotateZ((k * Math.PI * 2) / 3);
  });
  const hub = new THREE.ConeGeometry(0.55, 1.4, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const rotor = mergeGeometries([...blades.map((b) => b.toNonIndexed()), hub.toNonIndexed()]);
  // Centred on the hub, so the culling bounds hold at every spin angle and never need recomputing.
  rotor.boundingSphere = new THREE.Sphere(new THREE.Vector3(), ROTOR_RADIUS + BLADE_WIDTH);
  return rotor;
}

export class LandmarksView {
  readonly root = new THREE.Group();
  private readonly rotors: THREE.InstancedMesh | null;
  private readonly hubs: {
    position: THREE.Vector3;
    yaw: THREE.Quaternion;
    phase: number;
  }[];
  private readonly lamp: THREE.MeshLambertMaterial;
  private readonly m = new THREE.Matrix4();
  private readonly spin = new THREE.Quaternion();
  private readonly turn = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly axis = new THREE.Vector3(0, 0, 1);

  constructor(props: Prop[]) {
    const turbines = props.filter((p) => p.kind === PropKind.TURBINE);
    const up = new THREE.Vector3(0, 1, 0);
    this.hubs = turbines.map((p, i) => ({
      position: new THREE.Vector3(...rotor_hub(p)),
      yaw: new THREE.Quaternion().setFromAxisAngle(up, p.angle),
      phase: i * 0.9,
    }));
    this.rotors = turbines.length
      ? new THREE.InstancedMesh(
          rotor_geometry(),
          new THREE.MeshLambertMaterial({
            color: color(tones.post),
            flatShading: true,
          }),
          turbines.length,
        )
      : null;
    if (this.rotors) {
      cast_instanced(this.rotors);
      this.root.add(this.rotors);
    }
    this.lamp = new THREE.MeshLambertMaterial({
      color: color(tones.beacon),
      emissive: glow(tones.beacon),
      emissiveIntensity: LAMP_HIGH,
      flatShading: true,
    });
    const lamps = beacons(props);
    if (lamps.length) {
      const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1.5, 8), this.lamp, lamps.length);
      const q = new THREE.Quaternion();
      lamps.forEach((b, i) => mesh.setMatrixAt(i, this.m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.size, b.size, b.size))));
      mesh.frustumCulled = false;
      this.root.add(mesh);
    }
    this.update(0);
    this.rotors?.computeBoundingSphere();
  }

  update(time: number) {
    this.lamp.emissiveIntensity = (time / BLINK) % 1 < BLINK_ON ? LAMP_HIGH : LAMP_LOW;
    if (!this.rotors) return;
    this.hubs.forEach((hub, i) => {
      this.spin.setFromAxisAngle(this.axis, time * ROTOR_SPEED + hub.phase);
      this.rotors?.setMatrixAt(i, this.m.compose(hub.position, this.turn.copy(hub.yaw).multiply(this.spin), this.scale));
    });
    this.rotors.instanceMatrix.needsUpdate = true;
  }
}
