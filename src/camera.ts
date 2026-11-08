import * as THREE from "three";
import type { Car } from "./car";
import type { Look } from "./input";
import type { World } from "./world";

const angle_diff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const DEG = Math.PI / 180;
const LOOK_YAW_PER_PX = 0.006;
const LOOK_PITCH_PER_PX = 0.004;
const PITCH_MIN = -5 * DEG;
const PITCH_MAX = 60 * DEG;
const ZOOM_PER_PX = 0.0012;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2.2;
// Below this the car counts as parked and a free look stays where it was left.
const LOOK_PARKED_SPEED = 1.5;
const LOOK_RETURN_RATE = 2.5;
const STICK_FOLLOW_RATE = 10;
const STICK_RETURN_RATE = 8;
const PIVOT_RISE = 1.05;
const LOOK_LEAD = 4;

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
  /** Seconds a released mouse look holds once the car moves, before easing back behind it. */
  return_delay = 1.5;
  invert_y = false;
  /** Orbit offset from the chase yaw, radians. */
  private orbit_yaw = 0;
  /** Elevation added to the default chase angle, radians. */
  private orbit_pitch = 0;
  private zoom = 1;
  private look_idle = 0;
  private stick_held = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  snap(car: Car) {
    this.yaw = car.heading;
    this.height = car.pos.y;
    this.orbit_yaw = 0;
    this.orbit_pitch = 0;
    this.camera.position.set(car.pos.x - Math.sin(this.yaw) * 7, car.pos.y + 2.5, car.pos.z - Math.cos(this.yaw) * 7);
  }

  bump(amount: number) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  private orbit(dt: number, look: Look, speed: number, base_pitch: number) {
    const flip = this.invert_y ? -1 : 1;
    const stick = look.stick_x !== 0 || look.stick_y !== 0;
    const ease = (rate: number) => 1 - Math.exp(-dt * rate);
    if (stick) {
      const pitch = look.stick_y * flip > 0 ? PITCH_MAX - base_pitch : base_pitch - PITCH_MIN;
      this.orbit_yaw += angle_diff(-look.stick_x * Math.PI, this.orbit_yaw) * ease(STICK_FOLLOW_RATE);
      this.orbit_pitch += (look.stick_y * flip * pitch - this.orbit_pitch) * ease(STICK_FOLLOW_RATE);
    } else if (look.dragging || look.dx !== 0 || look.dy !== 0) {
      this.orbit_yaw = angle_diff(this.orbit_yaw - look.dx * LOOK_YAW_PER_PX, 0);
      this.orbit_pitch += look.dy * flip * LOOK_PITCH_PER_PX;
      this.look_idle = 0;
    } else if (this.stick_held) {
      this.look_idle = Infinity;
    } else if (speed > LOOK_PARKED_SPEED) {
      this.look_idle += dt;
    }
    this.stick_held = stick;
    if (!stick && !look.dragging && this.look_idle >= this.return_delay) {
      const rate = ease(this.look_idle === Infinity ? STICK_RETURN_RATE : LOOK_RETURN_RATE);
      this.orbit_yaw -= this.orbit_yaw * rate;
      this.orbit_pitch -= this.orbit_pitch * rate;
    }
    this.orbit_pitch = Math.max(PITCH_MIN - base_pitch, Math.min(PITCH_MAX - base_pitch, this.orbit_pitch));
    this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom * Math.exp(look.zoom * ZOOM_PER_PX)));
  }

  update(dt: number, car: Car, world: World, offroad: boolean, time: number, look: Look) {
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
      const rise = 2.15 + speed * 0.006 - PIVOT_RISE;
      const base_pitch = Math.atan2(rise, back);
      this.orbit(dt, look, speed, base_pitch);
      const reach = Math.hypot(back, rise) * this.zoom;
      const pitch = base_pitch + this.orbit_pitch;
      const yaw = this.yaw + this.orbit_yaw;
      const flat = Math.cos(pitch) * reach;
      this.target.set(car.pos.x - Math.sin(yaw) * flat, this.height + PIVOT_RISE + Math.sin(pitch) * reach, car.pos.z - Math.cos(yaw) * flat);
      camera.position.lerp(this.target, 1 - Math.exp(-dt * 14));
      const floor = world.height(camera.position.x, camera.position.z) + 0.9;
      this.floor = Number.isFinite(this.floor) ? this.floor + (floor - this.floor) * Math.min(1, dt * 6) : floor;
      camera.position.y = Math.max(camera.position.y, this.floor);
      camera.up.set(0, 1, 0);
      this.look.set(car.pos.x + Math.sin(yaw) * LOOK_LEAD, this.height + PIVOT_RISE, car.pos.z + Math.cos(yaw) * LOOK_LEAD);
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
