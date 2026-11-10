import * as THREE from "three";
import type { Look } from "../hud/input";
import type { World } from "../world";

const angle_diff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const DEG = Math.PI / 180;
const HOOD = new THREE.Vector3(0, 0.78, 0.9);
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
// Mouse and stick input set an aim; the view eases to it, so input events that land unevenly across frames still turn the camera at an even rate.
const ORBIT_SMOOTH_RATE = 20;
const FOLLOW_RATE = 14;
const PIVOT_RISE = 1.05;
const LOOK_LEAD = 4;
const RECENTER_SECONDS = 0.25;
const ORBITED_YAW = 12 * DEG;
const ORBITED_PITCH = 8 * DEG;
const ORBITED_ZOOM = 0.15;
const TOP_BACK = 9;
const TOP_RISE = 15;
const TOP_LEAD = 5;
const BOOST_FOV = 6;

/** The car as drawn this frame: interpolated between physics steps, so the camera never follows the step rhythm. */
export interface CarPose {
  readonly pos: THREE.Vector3;
  readonly quat: THREE.Quaternion;
  readonly vel: THREE.Vector3;
}

const heading_of = (quat: THREE.Quaternion, out: THREE.Vector3) => {
  out.set(0, 0, 1).applyQuaternion(quat);
  return Math.atan2(out.x, out.z);
};

export class ChaseCamera {
  mode = 0;
  /** High view over the car for parking; overrides `mode` while set. */
  top = false;
  /** Hood camera point in car space; null uses HOOD. */
  eye: THREE.Vector3 | null = null;
  boost = false;
  private yaw = 0;
  private height = 0;
  private pull = 0;
  private shake = 0;
  private last_speed = 0;
  private floor = -Infinity;
  private orbit_floor = -Infinity;
  private readonly chase = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly local = new THREE.Vector3();
  private readonly inverse = new THREE.Quaternion();
  /** Seconds a released mouse look holds once the car moves, before easing back behind it. */
  return_delay = 1.5;
  invert_y = false;
  /** Orbit offset from the chase yaw, radians. */
  private orbit_yaw = 0;
  /** Elevation added to the default chase angle, radians. */
  private orbit_pitch = 0;
  private zoom = 1;
  private aim_yaw = 0;
  private aim_pitch = 0;
  private aim_zoom = 1;
  private look_idle = 0;
  private stick_held = false;
  /** Seconds into a recenter ease, Infinity when none runs. */
  private recenter_t = Infinity;
  private recenter_from = { yaw: 0, pitch: 0, zoom: 1 };

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  snap(car: CarPose) {
    this.yaw = heading_of(car.quat, this.fwd);
    this.height = car.pos.y;
    this.orbit_yaw = this.aim_yaw = 0;
    this.orbit_pitch = this.aim_pitch = 0;
    this.recenter_t = Infinity;
    this.chase.set(car.pos.x - Math.sin(this.yaw) * 7, car.pos.y + 2.5, car.pos.z - Math.cos(this.yaw) * 7);
    this.camera.position.copy(this.chase);
    this.floor = this.orbit_floor = -Infinity;
  }

  /** Whether the chase view is looked away from straight behind the car, by orbit or zoom. */
  get orbited(): boolean {
    return (this.mode === 0 || this.top) && (Math.abs(this.orbit_yaw) > ORBITED_YAW || Math.abs(this.orbit_pitch) > ORBITED_PITCH || Math.abs(Math.log(this.zoom)) > ORBITED_ZOOM);
  }

  recenter() {
    this.recenter_t = 0;
    this.recenter_from = { yaw: this.orbit_yaw, pitch: this.orbit_pitch, zoom: this.zoom };
  }

  bump(amount: number) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  private orbit(dt: number, look: Look, speed: number, base_pitch: number) {
    const flip = this.invert_y ? -1 : 1;
    const stick = look.stick_x !== 0 || look.stick_y !== 0;
    const ease = (rate: number) => 1 - Math.exp(-dt * rate);
    const moved = stick || look.dragging || look.dx !== 0 || look.dy !== 0 || look.zoom !== 0 || look.pinch !== 0;
    if (moved) this.recenter_t = Infinity;
    if (stick) {
      const pitch = look.stick_y * flip > 0 ? PITCH_MAX - base_pitch : base_pitch - PITCH_MIN;
      this.aim_yaw += angle_diff(-look.stick_x * Math.PI, this.aim_yaw) * ease(STICK_FOLLOW_RATE);
      this.aim_pitch += (look.stick_y * flip * pitch - this.aim_pitch) * ease(STICK_FOLLOW_RATE);
    } else if (look.dragging || look.dx !== 0 || look.dy !== 0) {
      this.aim_yaw = angle_diff(this.aim_yaw - look.dx * LOOK_YAW_PER_PX, 0);
      this.aim_pitch += look.dy * flip * LOOK_PITCH_PER_PX;
      this.look_idle = 0;
    } else if (this.stick_held) {
      this.look_idle = Infinity;
    } else if (speed > LOOK_PARKED_SPEED) {
      this.look_idle += dt;
    }
    this.stick_held = stick;
    if (!stick && !look.dragging && this.look_idle >= this.return_delay) {
      const rate = ease(this.look_idle === Infinity ? STICK_RETURN_RATE : LOOK_RETURN_RATE);
      this.aim_yaw -= this.aim_yaw * rate;
      this.aim_pitch -= this.aim_pitch * rate;
    }
    this.aim_pitch = Math.max(PITCH_MIN - base_pitch, Math.min(PITCH_MAX - base_pitch, this.aim_pitch));
    this.aim_zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.aim_zoom * Math.exp(look.zoom * ZOOM_PER_PX + look.pinch)));

    if (this.recenter_t !== Infinity) {
      this.recenter_t += dt;
      const t = Math.min(1, this.recenter_t / RECENTER_SECONDS);
      const k = 1 - t * t * (3 - 2 * t);
      const from = this.recenter_from;
      this.orbit_yaw = this.aim_yaw = from.yaw * k;
      this.orbit_pitch = this.aim_pitch = from.pitch * k;
      this.zoom = this.aim_zoom = Math.exp(Math.log(from.zoom) * k);
      if (t === 1) {
        this.recenter_t = Infinity;
        this.look_idle = 0;
      }
      return;
    }
    const smooth = ease(ORBIT_SMOOTH_RATE);
    this.orbit_yaw = angle_diff(this.orbit_yaw + angle_diff(this.aim_yaw, this.orbit_yaw) * smooth, 0);
    this.orbit_pitch += (this.aim_pitch - this.orbit_pitch) * smooth;
    this.zoom = Math.exp(Math.log(this.zoom) + (Math.log(this.aim_zoom) - Math.log(this.zoom)) * smooth);
  }

  update(dt: number, car: CarPose, world: World, offroad: boolean, time: number, look: Look) {
    const { camera } = this;
    const speed = car.vel.length();
    const accel = (speed - this.last_speed) / Math.max(dt, 1e-3);
    this.last_speed = speed;
    this.fwd.set(0, 0, 1).applyQuaternion(car.quat);
    const heading = Math.atan2(this.fwd.x, this.fwd.z);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const rumble = (offroad ? Math.min(1, speed / 20) * 0.008 : 0) + Math.max(0, speed - 50) * 0.0004 + this.shake * 0.2;

    if (this.mode === 1 && !this.top) {
      camera.position.copy(this.eye ?? HOOD).applyQuaternion(car.quat).add(car.pos);
      camera.up.set(0, 1, 0).applyQuaternion(car.quat);
      camera.lookAt(this.look.copy(camera.position).addScaledVector(this.fwd, 10));
      this.chase.copy(camera.position);
    } else {
      this.local.copy(car.vel).applyQuaternion(this.inverse.copy(car.quat).invert());
      // Lead the yaw toward the direction of travel in a slide, so a drift shows the car's angle instead of hiding it.
      const slide = speed > 6 && this.local.z > 0 ? Math.max(-0.6, Math.min(0.6, Math.atan2(this.local.x, this.local.z))) : 0;
      // Up high the view stays nose-up when reversing, so the bay does not swing round under a parking car.
      const reversing = !this.top && this.local.z < -2;
      const desired = (reversing ? heading + Math.PI : heading) + slide * 0.55;
      this.yaw += angle_diff(desired, this.yaw) * Math.min(1, dt * 5);
      this.height += (car.pos.y - this.height) * Math.min(1, dt * 6);
      this.pull += (Math.max(-1, Math.min(1, accel / 9)) - this.pull) * Math.min(1, dt * 3);
      const back = this.top ? TOP_BACK : 6.2 + speed * 0.022 + this.pull * 0.7;
      const rise = this.top ? TOP_RISE : 2.15 + speed * 0.006 - PIVOT_RISE;
      const base_pitch = Math.atan2(rise, back);
      this.orbit(dt, look, speed, base_pitch);
      const reach = Math.hypot(back, rise);
      const pivot_y = this.height + PIVOT_RISE;
      this.target.set(car.pos.x - Math.sin(this.yaw) * Math.cos(base_pitch) * reach, pivot_y + Math.sin(base_pitch) * reach, car.pos.z - Math.cos(this.yaw) * Math.cos(base_pitch) * reach);
      this.chase.lerp(this.target, 1 - Math.exp(-dt * FOLLOW_RATE));
      this.floor = this.ground(world, this.chase, pivot_y, this.floor, dt);
      this.chase.y = Math.max(this.chase.y, this.floor);

      // The orbit turns the eased chase offset about the pivot, so a drag moves the view at once instead of being chased by the follow lag.
      const ox = this.chase.x - car.pos.x;
      const oy = this.chase.y - pivot_y;
      const oz = this.chase.z - car.pos.z;
      const flat = Math.hypot(ox, oz);
      const dist = Math.hypot(flat, oy) * this.zoom;
      const azimuth = Math.atan2(ox, oz) + this.orbit_yaw;
      const elevation = Math.atan2(oy, flat) + this.orbit_pitch;
      camera.position.set(car.pos.x + Math.sin(azimuth) * Math.cos(elevation) * dist, pivot_y + Math.sin(elevation) * dist, car.pos.z + Math.cos(azimuth) * Math.cos(elevation) * dist);
      this.orbit_floor = this.ground(world, camera.position, pivot_y, this.orbit_floor, dt);
      camera.position.y = Math.max(camera.position.y, this.orbit_floor);
      camera.up.set(0, 1, 0);
      const yaw = this.yaw + this.orbit_yaw;
      const lead = this.top ? TOP_LEAD : LOOK_LEAD;
      this.look.set(car.pos.x + Math.sin(yaw) * lead, pivot_y, car.pos.z + Math.cos(yaw) * lead);
      camera.lookAt(this.look);
    }
    if (rumble > 0) {
      camera.position.x += Math.sin(time * 23) * rumble * 0.6;
      camera.position.y += Math.sin(time * 17 + 1.3) * rumble;
      camera.rotation.z += Math.sin(time * 13) * rumble * 0.02;
    }
    camera.fov += (64 + Math.min(24, speed * 0.3) + (this.boost ? BOOST_FOV : 0) - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }

  /** `from` is the car's pivot height: under a crossover the camera keeps to the car's deck, not the one overhead. */
  private ground(world: World, at: THREE.Vector3, from: number, last: number, dt: number): number {
    const floor = world.height(at.x, at.z, from) + 0.9;
    return Number.isFinite(last) ? last + (floor - last) * Math.min(1, dt * 6) : floor;
  }
}
