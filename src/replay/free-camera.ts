import * as THREE from "three";
import type { Look } from "../hud/input";
import type { World } from "../world/world";

const LOOK_PER_PX = 0.004;
const PITCH_MAX = 85 * (Math.PI / 180);
const FLY_MPS = 25;
const PACE_PER_PX = 0.0012;
const PACE_MIN = 0.2;
const PACE_MAX = 8;
const GROUND_CLEAR_M = 1;

export class FreeCamera {
  private yaw = 0;
  private pitch = 0;
  private pace = 1;
  private readonly ahead = new THREE.Vector3();
  private readonly right = new THREE.Vector3();

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  take() {
    const { camera, ahead } = this;
    camera.getWorldDirection(ahead);
    this.yaw = Math.atan2(-ahead.x, -ahead.z);
    this.pitch = Math.asin(Math.max(-1, Math.min(1, ahead.y)));
    camera.up.set(0, 1, 0);
  }

  /** `forward` and `strafe`: -1 to 1, along the view and to its right. */
  update(dt: number, look: Look, forward: number, strafe: number, world: Pick<World, "height">) {
    const { camera, ahead, right } = this;
    this.yaw -= look.dx * LOOK_PER_PX;
    this.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, this.pitch - look.dy * LOOK_PER_PX));
    this.pace = Math.max(PACE_MIN, Math.min(PACE_MAX, this.pace * Math.exp(-look.zoom * PACE_PER_PX - look.pinch)));
    camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    ahead.set(0, 0, -1).applyQuaternion(camera.quaternion);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const step = FLY_MPS * this.pace * dt;
    camera.position.addScaledVector(ahead, forward * step).addScaledVector(right, strafe * step);
    camera.position.y = Math.max(camera.position.y, world.height(camera.position.x, camera.position.z, camera.position.y) + GROUND_CLEAR_M);
  }
}
