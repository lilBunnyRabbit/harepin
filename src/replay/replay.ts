import * as THREE from "three";
import type { SoundFrame } from "../audio/audio";
import { idle_sound, scrub_sound } from "../audio/held-sound";
import { FieldView, type FieldPoses } from "../ai/field-view";
import { parse_build } from "../car/build";
import type { Driver } from "../car/driver";
import { lap_pose } from "../car/ghost";
import { STRIDE } from "../car/ghost-cap";
import type { Look } from "../hud/input";
import type { ChaseCamera } from "../render/camera";
import type { Sim } from "../sim/sim-client";
import type { World } from "../world/world";
import { FreeCamera } from "./free-camera";
import { Playback } from "./playback";
import { ReplayView, Save } from "./replay-view.svelte";
import { taped_sound } from "./replay-sound";
import { TELEPORT_MPS, on_tape, type Watched } from "./run-tape";
import { watched, type SavedReplay } from "./saved";

const VEL_MS = 50;
const TURN = Math.PI * 2;

export class Replay {
  readonly view: ReplayView;
  on_open = () => {};
  on_close = () => {};
  private tape: Watched | null = null;
  private field: FieldView | null = null;
  private own: FieldView | null = null;
  private keep: (() => Promise<boolean>) | null = null;
  private opened = 0;
  private readonly poses: FieldPoses = { pose: (i, pos, quat) => this.rival_pose(i, pos, quat) };
  private free = false;
  private roll = 0;
  /** The clock ran this frame; it stands under a pause, a menu or at the end. */
  private moving = false;
  /** The car jumped this frame (a seek, a cut on the tape): the sound jumps with it, no blip. */
  private cut = false;
  /** m/s the wind last heard: the velocity differenced across a cut is the jump, not the drive. */
  private heard_speed = 0;
  private readonly clock = new Playback();
  private readonly fly: FreeCamera;
  private readonly pose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), vel: new THREE.Vector3() };
  private readonly before = new THREE.Vector3();
  private readonly before_quat = new THREE.Quaternion();
  private readonly ahead = new THREE.Vector3();

  constructor(
    private readonly chase: ChaseCamera,
    private readonly world: World,
    private readonly scene: THREE.Scene,
    private readonly sim: Sim,
  ) {
    this.fly = new FreeCamera(chase.camera);
    this.view = new ReplayView({
      toggle: () => this.clock.toggle(),
      seek: (ms) => this.clock.seek(ms),
      next_speed: () => this.clock.next_speed(),
      swap_camera: () => this.swap_camera(),
      close: () => this.close(),
      save: () => this.save(),
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

  /** `field`: the run's AI cars, drawn off the tape while it plays. `keep` saves the tape, resolving false when refused. */
  open(tape: Watched, field: FieldView | null, keep: (() => Promise<boolean>) | null) {
    if (tape.end_ms <= 0) return;
    this.close();
    this.begin(tape, field, keep);
  }

  /** A saved replay brings its own AI cars, built for it and gone when it closes. */
  open_saved(replay: SavedReplay) {
    const builds = replay.field.flatMap((car) => parse_build(car.car) ?? []);
    if (builds.length !== replay.field.length) return;
    this.close();
    this.own = builds.length ? new FieldView(this.scene, this.sim, builds) : null;
    this.begin(watched(replay), this.own, null);
  }

  private begin(tape: Watched, field: FieldView | null, keep: (() => Promise<boolean>) | null) {
    this.tape = tape;
    this.field = tape.field.length ? field : null;
    this.keep = keep;
    this.opened++;
    this.view.save = keep ? Save.READY : Save.NONE;
    this.clock.open(tape.end_ms);
    this.free = false;
    this.roll = 0;
    this.view.end_ms = tape.end_ms;
    this.view.shown = true;
    this.on_open();
  }

  private save() {
    const { keep, view, opened } = this;
    if (!keep || (view.save !== Save.READY && view.save !== Save.FAILED)) return;
    view.save = Save.SAVING;
    void keep().then((saved) => {
      if (this.opened === opened && this.tape) view.save = saved ? Save.SAVED : Save.FAILED;
    });
  }

  close() {
    if (!this.tape) return;
    this.tape = null;
    this.keep = null;
    this.field?.end_tape();
    this.field = null;
    this.own?.dispose();
    this.own = null;
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
    this.moving = clock.ms !== from_ms;
    this.cut = clock.jumped || before.length() > (TELEPORT_MPS * Math.abs(clock.ms - from_ms)) / 1000;
    // A cut on the tape moves the car as a seek does.
    if (this.cut) {
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

  /** The replayed car's sound into `frame`, whose car fields are set: idles while the clock stands; a tape saved without sound idles under the wind. */
  hear(frame: SoundFrame, idle: number): SoundFrame {
    const { tape, pose } = this;
    if (!tape || !this.moving) return idle_sound(frame, idle);
    const moved = pose.vel.length();
    const speed = moved > TELEPORT_MPS ? this.heard_speed : moved;
    this.heard_speed = speed;
    const offroad = !this.world.on_road(pose.pos.x, pose.pos.z);
    frame.speed = speed;
    frame.offroad = offroad;
    frame.held = this.cut;
    if (taped_sound(tape, this.clock.ms, frame)) frame.scrub = scrub_sound(frame.scrub, speed, offroad);
    else {
      frame.rpm = idle;
      frame.throttle = 0;
      frame.scrub = 0;
      frame.boost = false;
    }
    return frame;
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
