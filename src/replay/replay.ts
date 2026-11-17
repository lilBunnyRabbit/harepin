import * as THREE from "three";
import type { Driver } from "../car/driver";
import { lap_pose } from "../car/ghost";
import type { Look } from "../hud/input";
import type { ChaseCamera } from "../render/camera";
import type { World } from "../world/world";
import { FreeCamera } from "./free-camera";
import { Playback } from "./playback";
import { ReplayView } from "./replay-view.svelte";
import type { RunTape } from "./run-tape";

const VEL_MS = 50;
const TURN = Math.PI * 2;

export class Replay {
  readonly view: ReplayView;
  on_open = () => {};
  on_close = () => {};
  private tape: readonly number[] | null = null;
  private free = false;
  private roll = 0;
  private readonly clock = new Playback();
  private readonly fly: FreeCamera;
  private readonly pose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), vel: new THREE.Vector3() };
  private readonly before = new THREE.Vector3();
  private readonly before_quat = new THREE.Quaternion();
  private readonly ahead = new THREE.Vector3();

  constructor(private readonly chase: ChaseCamera) {
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

  open(tape: RunTape) {
    if (!tape.watchable) return;
    this.tape = tape.frames;
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
    const { tape, clock, pose, before, view } = this;
    if (!tape) return;
    clock.advance(dt);
    before.copy(pose.pos);
    lap_pose(tape, Math.max(0, clock.ms - VEL_MS), pose.vel, this.before_quat);
    lap_pose(tape, clock.ms, pose.pos, pose.quat);
    pose.vel.subVectors(pose.pos, pose.vel).divideScalar(VEL_MS / 1000);
    if (clock.jumped) {
      clock.jumped = false;
      if (!this.free) this.chase.snap(pose);
    } else {
      const rolled = this.ahead.set(0, 0, 1).applyQuaternion(pose.quat).dot(before.sub(pose.pos).negate());
      this.roll = (this.roll + rolled / driver.car.spec.wheel.radius) % TURN;
    }
    driver.draw_at(pose, this.roll);
    view.paused = clock.paused;
    view.speed = clock.speed;
    view.free = this.free;
    view.clock(clock.ms);
  }

  aim(dt: number, look: Look, forward: number, strafe: number, world: Pick<World, "height">) {
    this.fly.update(dt, look, forward, strafe, world);
  }
}
