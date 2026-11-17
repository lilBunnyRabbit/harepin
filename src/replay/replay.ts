import * as THREE from "three";
import type { FieldPoses, FieldView } from "../ai/field-view";
import type { Driver } from "../car/driver";
import { lap_pose } from "../car/ghost";
import { STRIDE } from "../car/ghost-cap";
import type { Look } from "../hud/input";
import type { ChaseCamera } from "../render/camera";
import type { World } from "../world/world";
import { FreeCamera } from "./free-camera";
import { Playback } from "./playback";
import { ReplayView } from "./replay-view.svelte";
import { TELEPORT_MPS, on_tape, type Watched } from "./run-tape";

const VEL_MS = 50;
const TURN = Math.PI * 2;

export class Replay {
  readonly view: ReplayView;
  on_open = () => {};
  on_close = () => {};
  private tape: Watched | null = null;
  private field: FieldView | null = null;
  private readonly poses: FieldPoses = { pose: (i, pos, quat) => this.rival_pose(i, pos, quat) };
  private free = false;
  private roll = 0;
  private readonly clock = new Playback();
  private readonly fly: FreeCamera;
  private readonly pose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), vel: new THREE.Vector3() };
  private readonly before = new THREE.Vector3();
  private readonly before_quat = new THREE.Quaternion();
  private readonly ahead = new THREE.Vector3();

  constructor(
    private readonly chase: ChaseCamera,
    private readonly world: World,
  ) {
    this.fly = new FreeCamera(chase.camera);
    this.view = new ReplayView({
      toggle: () => this.clock.toggle(),
      seek: (ms) => this.clock.seek(ms),
      next_speed: () => this.clock.next_speed(),
      swap_camera: () => this.swap_camera(),
      close: () => this.close(),
    });
  }

  get is_open(): boolean {
    return this.tape !== null;
  }

  /** What the light and the world's streaming follow in place of the held car. */
  get focus(): THREE.Vector3 {
    return this.free ? this.chase.camera.position : this.pose.pos;
  }

  get flying(): boolean {
    return this.tape !== null && this.free;
  }

  /** `field`: the run's AI cars, drawn off the tape while it plays. */
  open(tape: Watched, field: FieldView | null) {
    if (tape.end_ms <= 0) return;
    this.close();
    this.tape = tape;
    this.field = tape.field.length ? field : null;
    this.clock.open(tape.end_ms);
    this.free = false;
    this.roll = 0;
    this.view.end_ms = tape.end_ms;
    this.view.shown = true;
    this.on_open();
  }

  close() {
    if (!this.tape) return;
    this.tape = null;
    this.field?.end_tape();
    this.field = null;
    this.view.shown = false;
    this.on_close();
  }

  swap_camera() {
    this.free = !this.free;
    if (this.free) this.fly.take();
    else this.clock.jumped = true;
  }

  /** Call after the driver has drawn the held car: `dt` real seconds, 0 under a menu. */
  draw(dt: number, driver: Driver) {
    const { clock, pose, before, view } = this;
    if (!this.tape) return;
    const tape = this.tape.frames;
    const from_ms = clock.ms;
    clock.advance(dt);
    before.copy(pose.pos);
    lap_pose(tape, Math.max(0, clock.ms - VEL_MS), pose.vel, this.before_quat);
    lap_pose(tape, clock.ms, pose.pos, pose.quat);
    pose.vel.subVectors(pose.pos, pose.vel).divideScalar(VEL_MS / 1000);
    before.sub(pose.pos).negate();
    // A cut on the tape moves the car as a seek does.
    if (clock.jumped || before.length() > (TELEPORT_MPS * Math.abs(clock.ms - from_ms)) / 1000) {
      clock.jumped = false;
      if (!this.free) this.chase.snap(pose);
    } else {
      const rolled = this.ahead.set(0, 0, 1).applyQuaternion(pose.quat).dot(before);
      this.roll = (this.roll + rolled / driver.car.spec.wheel.radius) % TURN;
    }
    driver.draw_at(pose, this.roll);
    this.field?.draw_tape(this.chase.camera, this.poses, this.world);
    view.paused = clock.paused;
    view.speed = clock.speed;
    view.free = this.free;
    view.clock(clock.ms);
  }

  aim(dt: number, look: Look, forward: number, strafe: number) {
    this.fly.update(dt, look, forward, strafe, this.world);
  }

  private rival_pose(i: number, pos: THREE.Vector3, quat: THREE.Quaternion): boolean {
    const lap = this.tape?.field[i];
    const { ms } = this.clock;
    if (!on_tape(lap, ms)) return false;
    lap_pose(lap, Math.min(ms, lap[lap.length - STRIDE]), pos, quat);
    return true;
  }
}
