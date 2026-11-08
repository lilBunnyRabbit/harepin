import * as THREE from "three";
import type { Car } from "./car";
import type { World } from "./world";

const angle_diff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class ChaseCamera {
  mode = 0;
  private yaw = 0;
  private height = 0;
  private pull = 0;
  private shake = 0;
  private last_speed = 0;
  private floor = -Infinity;
  private readonly target = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly local = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  snap(car: Car) {
    this.yaw = car.heading;
    this.height = car.pos.y;
    this.camera.position.set(car.pos.x - Math.sin(this.yaw) * 7, car.pos.y + 2.5, car.pos.z - Math.cos(this.yaw) * 7);
  }

  bump(amount: number) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  update(dt: number, car: Car, world: World, offroad: boolean, time: number) {
    const { camera } = this;
    const speed = car.vel.length();
    const accel = (speed - this.last_speed) / Math.max(dt, 1e-3);
    this.last_speed = speed;
    this.fwd.set(0, 0, 1).applyQuaternion(car.quat);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const rumble = (offroad ? Math.min(1, speed / 20) * 0.008 : 0) + Math.max(0, speed - 50) * 0.0004 + this.shake * 0.2;

    if (this.mode === 1) {
      camera.position.copy(new THREE.Vector3(0, 0.78, 0.9).applyQuaternion(car.quat).add(car.pos));
      camera.up.set(0, 1, 0).applyQuaternion(car.quat);
      camera.lookAt(this.look.copy(camera.position).addScaledVector(this.fwd, 10));
    } else {
      this.local.copy(car.vel).applyQuaternion(car.quat.clone().invert());
      // Lead the yaw toward the direction of travel in a slide, so a drift shows the car's angle instead of hiding it.
      const slide = speed > 6 && this.local.z > 0 ? Math.max(-0.6, Math.min(0.6, Math.atan2(this.local.x, this.local.z))) : 0;
      const reversing = car.forward_speed < -2;
      const desired = (reversing ? car.heading + Math.PI : car.heading) + slide * 0.55;
      this.yaw += angle_diff(desired, this.yaw) * Math.min(1, dt * 5);
      this.height += (car.pos.y - this.height) * Math.min(1, dt * 6);
      this.pull += (Math.max(-1, Math.min(1, accel / 9)) - this.pull) * Math.min(1, dt * 3);
      const back = 6.2 + speed * 0.022 + this.pull * 0.7;
      const rise = 2.15 + speed * 0.006;
      this.target.set(car.pos.x - Math.sin(this.yaw) * back, this.height + rise, car.pos.z - Math.cos(this.yaw) * back);
      camera.position.lerp(this.target, 1 - Math.exp(-dt * 14));
      const floor = world.height(camera.position.x, camera.position.z) + 0.9;
      this.floor = Number.isFinite(this.floor) ? this.floor + (floor - this.floor) * Math.min(1, dt * 6) : floor;
      camera.position.y = Math.max(camera.position.y, this.floor);
      camera.up.set(0, 1, 0);
      this.look.set(car.pos.x + Math.sin(this.yaw) * 4, this.height + 1.05, car.pos.z + Math.cos(this.yaw) * 4);
      camera.lookAt(this.look);
    }
    if (rumble > 0) {
      camera.position.x += Math.sin(time * 23) * rumble * 0.6;
      camera.position.y += Math.sin(time * 17 + 1.3) * rumble;
      camera.rotation.z += Math.sin(time * 13) * rumble * 0.02;
    }
    camera.fov += (64 + Math.min(24, speed * 0.3) - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
}
