import * as THREE from "three";
import { lap_pose } from "../car/ghost";
import { STRIDE } from "../car/ghost-cap";
import { event_of } from "../career/career";
import { dev_ghost } from "../career/dev-ghost";
import type { ChaseCamera } from "../render/camera";
import type { World } from "../world/world";
import type { WorldStream } from "../world/world-stream";
import { REPLAY_PARAM, TIME_PARAM, VIEW_PARAM } from "./params";
import { view_of, type View } from "./viewpoints";
import "./review.css";

// Seconds of the lap driven before a held time, so the chase camera arrives in motion rather than snapped.
const WARM_S = 2;
// Settled frames before a shot counts: gates and markers land a frame after their chunks, and a view's car drops onto
// the road; a replay holds at its time, so only a couple, or the chase camera eases out of its motion.
const VIEW_FRAMES = 30;
const REPLAY_FRAMES = 2;
const VEL_S = 0.05;
const FRAME_MS = 1000 / 60;

interface Pose {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  vel: THREE.Vector3;
}

interface Ask {
  view: string | null;
  replay: string | null;
  /** Null plays the lap on a loop. */
  at: number | null;
}

function read_ask(): Ask {
  const params = new URLSearchParams(location.search);
  for (const [key, value] of new URLSearchParams(location.hash.slice(1))) params.set(key, value);
  const t = params.get(TIME_PARAM);
  const at = t === null || t === "" ? null : Math.max(0, Number(t));
  return { view: params.get(VIEW_PARAM), replay: params.get(REPLAY_PARAM), at: at !== null && Number.isFinite(at) ? at : null };
}

const ask_key = (ask: Ask) => (ask.view !== null ? `view:${ask.view}` : `t:${ask.at ?? "live"}`);

// The frame loop skips frames while the world streams, so a shot is the same whatever the worker's timing. A `#view=` or
// `#t=` hash moves to another shot without a reload; `<html data-review>` reads the shot's key once it is drawn.
export class Review {
  private view: View | null = null;
  private lap: number[] | null = null;
  private time = 0;
  private held: number | null = null;
  private snap = false;
  private settled_frames = 0;
  private switching: Promise<void> | null = null;
  private key = "";
  private frames = 0;
  /** The asked shot is drawn: frames stop, so a screenshot taken any time after shows exactly it. */
  private shown = false;
  private readonly prev = new THREE.Vector3();
  private readonly prev_quat = new THREE.Quaternion();

  private constructor(
    private readonly world: World,
    private readonly chase: ChaseCamera,
    private ask: Ask,
  ) {
    this.mark("busy");
    addEventListener("hashchange", () => this.go(read_ask()));
  }

  static async open(world: World, chase: ChaseCamera): Promise<Review> {
    const review = new Review(world, chase, read_ask());
    await review.load(review.ask);
    return review;
  }

  get start_index(): number | null {
    if (this.view) return this.view.at;
    const lap = this.lap;
    if (!lap) return null;
    const ms = (this.held === null ? 0 : Math.max(0, this.held - WARM_S)) * 1000;
    if (!lap_pose(lap, ms, this.prev, this.prev_quat)) return null;
    return this.world.road.indexOf(this.world.nearest_road(this.prev.x, this.prev.z));
  }

  get replaying(): boolean {
    return this.lap !== null;
  }

  place: (index: number) => Promise<void> = () => Promise.resolve();

  private go(ask: Ask) {
    this.ask = ask;
    this.mark("busy");
    this.settled_frames = 0;
    this.shown = false;
    const switching = this.load(ask).then(async () => {
      const at = this.start_index;
      if (this.view && at !== null) await this.place(at);
    });
    this.switching = switching;
    void switching.finally(() => {
      if (this.switching === switching) this.switching = null;
    });
  }

  private async load(ask: Ask) {
    this.key = ask_key(ask);
    this.view = null;
    if (ask.view !== null) {
      this.lap = null;
      this.view = await view_of(this.world, ask.view);
      if (!this.view) this.mark(`missing:${ask.view}`);
      return;
    }
    const event = event_of(ask.replay);
    this.lap = event ? await dev_ghost(event) : null;
    if (!this.lap) {
      this.mark(`missing:${ask.replay}`);
      return;
    }
    const end = this.lap[this.lap.length - STRIDE] / 1000;
    this.held = ask.at === null ? null : Math.min(ask.at, end);
    this.time = this.held === null ? 0 : Math.max(0, this.held - WARM_S);
    this.snap = true;
  }

  get now(): number {
    return this.frames * FRAME_MS;
  }

  waits(stream: WorldStream): boolean {
    if (this.shown) return true;
    if (this.switching === null && stream.settled) {
      this.frames++;
      return false;
    }
    this.settled_frames = 0;
    return true;
  }

  drive(car: Pose, dt: number) {
    const lap = this.lap;
    if (!lap) return;
    const end = lap[lap.length - STRIDE] / 1000;
    if (this.held === null) {
      this.time += dt;
      if (this.time > end) {
        this.time = 0;
        this.snap = true;
      }
    } else this.time = Math.min(this.held, this.time + dt);
    const ms = this.time * 1000;
    lap_pose(lap, ms, car.pos, car.quat);
    lap_pose(lap, Math.max(0, ms - VEL_S * 1000), this.prev, this.prev_quat);
    car.vel.subVectors(car.pos, this.prev).divideScalar(VEL_S);
    if (!this.snap) return;
    this.snap = false;
    this.chase.snap(car);
  }

  aim(camera: THREE.Camera): boolean {
    const view = this.view;
    if (!view) return false;
    camera.position.set(...view.from);
    camera.lookAt(...view.to);
    return true;
  }

  drawn(stream: WorldStream) {
    if (this.switching || (!this.view && !this.lap)) return;
    if (!stream.settled) {
      this.settled_frames = 0;
      return;
    }
    const arrived = this.view !== null || this.held === null || this.time >= this.held;
    if (!arrived) return;
    if (++this.settled_frames < (this.view ? VIEW_FRAMES : REPLAY_FRAMES)) return;
    this.mark(this.key);
    this.shown = this.view !== null || this.held !== null;
  }

  private mark(state: string) {
    document.documentElement.dataset.review = state;
  }
}
