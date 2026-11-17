import * as THREE from "three";
import { build_spec, type Build } from "../car/build";
import { Car } from "../car/car";
import { TELEPORT_SQ } from "../car/driver";
import { far_view } from "../car/far-view";
import { light_neon, place_neon } from "../car/neon-look";
import { build_view, dispose_car_view, sync_car_view, type CarView } from "../car/models";
import type { Sim } from "../sim/sim-client";
import type { FieldStart } from "../sim/sim-host";
import { atan2 } from "../sim-math";
import type { World } from "../world/world";
import { RouteKind, type Route } from "../worldgen/types";
import { warm } from "./capability";
import { grid_spot, personalities } from "./field";

/** `?field=<cars>`: an AI field laps the circuit in free drive, for measuring the sim with AI before race mode has one. */
export const FIELD_PARAM = "field";
export const AI_RACE_PARAM = "airace";
/** With `?airace`: AI cars on the grid, 1-6, for a frame-time baseline; F3's six without it. */
export const AI_CARS_PARAM = "aicars";
export const AI_CARS = 6;
const MAX_CARS = 7;
/** Metres from the camera past which a car draws as its one-mesh far view, and inside which it is back to the full one. */
const FAR_VIEW = 75;
const NEAR_VIEW = 65;
/** Metres past which a full view drops its brake discs and calipers, which sit behind the rim: a few pixels there, four draw calls a car. */
const MID_VIEW = 30;
const MID_BACK = 25;
/** Metres round a car's centre that count toward it being on screen: wide, so a coasting car is back on the physics before it comes into view. */
const SEEN_RADIUS = 30;

const frustum = new THREE.Frustum();
const view_projection = new THREE.Matrix4();
const sphere = new THREE.Sphere();
const drawn_pos = new THREE.Vector3();
const drawn_quat = new THREE.Quaternion();
const ahead = new THREE.Vector3();

/** A replay's cars: car i's pose at the replay's clock, false where its tape has none (before it, or once it left the track). */
export interface FieldPoses {
  pose(i: number, pos: THREE.Vector3, quat: THREE.Quaternion): boolean;
}

export class FieldView {
  private readonly views: CarView[] = [];
  private readonly fars: THREE.Mesh[] = [];
  private readonly far: boolean[] = [];
  private readonly brakes: THREE.Object3D[][] = [];
  private readonly mid: boolean[] = [];
  private readonly retired: boolean[] = [];
  /** Each car parked on its grid slot as the field will park it: drawn until the sim's field has stepped, so the grid shows at once. */
  private readonly grid: Car[];
  private seen = -1;
  /** The cars stand on the grid and the sim's field runs: `start`. */
  private started = false;
  private world: World | null = null;
  /** A replay draws the cars off its tape (`draw_tape`): the live draw waits for `end_tape`. */
  private taping = false;
  private readonly shown: boolean[] = [];

  /** Builds every car's view, hidden until `start`: the models are ready before the race's first frame. */
  constructor(
    private readonly scene: THREE.Scene,
    private readonly sim: Sim,
    readonly builds: readonly Build[],
  ) {
    this.grid = builds.map((build) => new Car(build_spec(build)));
    for (let i = 0; i < builds.length; i++) {
      const view = build_view(builds[i], this.grid[i].spec);
      const far = far_view(view, this.grid[i].spec);
      view.root.visible = false;
      far.visible = false;
      this.views.push(view);
      this.fars.push(far);
      this.far.push(false);
      this.brakes.push(view.wheels.flatMap((steer) => steer.children.filter((part) => part instanceof THREE.Mesh)));
      this.mid.push(false);
      this.retired.push(false);
      this.shown.push(false);
      scene.add(view.root, far);
      if (view.neon) {
        view.neon.mesh.visible = false;
        scene.add(view.neon.mesh);
      }
    }
  }

  /**
   * Parks the cars on `route`'s grid and shows them, then sends `field`: call once the grid's ground is in, or on a
   * streamed world a car parks on the flat stand-in under the road. The rival's slot is `field.grid`, the last without one.
   */
  start(world: World, route: Route, field: FieldStart) {
    const rival_slot = field.grid ?? this.grid.length;
    this.grid.forEach((car, k) => {
      const spot = grid_spot(route, k < rival_slot ? k : k + 1);
      car.park(spot.x, spot.z, spot.heading, world);
      this.show(k, true);
    });
    this.world = world;
    this.started = true;
    this.sim.send({ type: "field", ...field });
  }

  /** Null without the param or a circuit. The field's grid waits for its ground, as a teleport does. */
  static async open(params: URLSearchParams, scene: THREE.Scene, world: World, sim: Sim, build: Build): Promise<FieldView | null> {
    const count = Math.min(MAX_CARS, Math.trunc(Number(params.get(FIELD_PARAM))) || 0);
    const route = world.routes.find((r) => r.kind === RouteKind.CIRCUIT);
    if (count <= 0 || !route) return null;
    await world.tiles.ensure(route.points[0].x, route.points[0].z);
    world.place(route.closure);
    const spec = build_spec(build);
    warm([spec]);
    const view = new FieldView(scene, sim, Array.from({ length: count }, () => build));
    view.start(world, route, { route: route.id, specs: Array.from({ length: count }, () => spec), traits: personalities(world.seed, count), seed: world.seed });
    return view;
  }

  // Before its first step the sim's field stands where the grid cars do, or (a worker's mirrors) nowhere yet.
  private get live(): boolean {
    return this.sim.field_cars.length === this.grid.length && Number.isFinite(this.sim.field_progress[0]);
  }

  get count(): number {
    return this.views.length;
  }

  /** Car i as a run's tape takes it: null before the grid stands and once the car left the track. */
  taped(i: number): Car | null {
    if (!this.started || this.retired[i]) return null;
    return (this.live ? this.sim.field_cars : this.grid)[i];
  }

  private show(i: number, on: boolean) {
    this.shown[i] = on;
    this.views[i].root.visible = on && !this.far[i];
    this.fars[i].visible = on && this.far[i];
    const { neon } = this.views[i];
    if (neon) neon.mesh.visible = on;
  }

  private put(i: number, car: Car, d: number) {
    const far = this.far[i] ? d > NEAR_VIEW : d > FAR_VIEW;
    if (far !== this.far[i]) {
      this.far[i] = far;
      this.views[i].root.visible = !far;
      this.fars[i].visible = far;
    }
    const mid = this.mid[i] ? d > MID_BACK : d > MID_VIEW;
    if (mid !== this.mid[i]) {
      this.mid[i] = mid;
      for (const part of this.brakes[i]) part.visible = !mid;
    }
    if (far) {
      const mesh = this.fars[i];
      mesh.position.copy(drawn_pos);
      mesh.quaternion.copy(drawn_quat);
      mesh.updateMatrix();
    } else {
      const { root } = this.views[i];
      sync_car_view(this.views[i], car);
      root.position.copy(drawn_pos);
      root.quaternion.copy(drawn_quat);
    }
  }

  /** A replay's cars in place of the sim's, until `end_tape`: wheels as they stood on the grid, as a ghost's are. */
  draw_tape(camera: THREE.Camera, poses: FieldPoses, world: World) {
    this.taping = true;
    const now = performance.now() / 1000;
    for (let i = 0; i < this.views.length; i++) {
      const on = poses.pose(i, drawn_pos, drawn_quat);
      if (on !== this.shown[i]) this.show(i, on);
      if (!on) continue;
      this.put(i, this.grid[i], drawn_pos.distanceTo(camera.position));
      const { neon } = this.views[i];
      if (!neon) continue;
      ahead.set(0, 0, 1).applyQuaternion(drawn_quat);
      place_neon(neon, drawn_pos.x, drawn_pos.y, drawn_pos.z, atan2(ahead.x, ahead.z), world);
      light_neon(neon, 0, false, now);
    }
  }

  end_tape() {
    this.taping = false;
    for (let i = 0; i < this.views.length; i++) this.show(i, this.started && !this.retired[i]);
  }

  update(camera: THREE.Camera) {
    if (!this.started || this.taping) return;
    const now = performance.now() / 1000;
    const live = this.live;
    const cars = live ? this.sim.field_cars : this.grid;
    const from = this.sim.field_from;
    const blend = this.sim.blend;
    view_projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(view_projection);
    let seen = 0;
    for (let i = 0; i < cars.length; i++) {
      if (this.retired[i]) continue;
      const car = cars[i];
      if (frustum.intersectsSphere(sphere.set(car.pos, SEEN_RADIUS))) seen |= 1 << i;
      // Drawn between its last two steps at the frame's blend, as the player's car is: drawn on the last step, a car
      // moves a whole number of steps a frame (2 or 3 at 144 Hz) and judders against the player's.
      // A car put back on the road (a reset) is drawn where it lands, not slid there from where it was.
      const k = live && from[i].pos.distanceToSquared(car.pos) < TELEPORT_SQ ? blend : 1;
      drawn_pos.lerpVectors(live ? from[i].pos : car.pos, car.pos, k);
      drawn_quat.slerpQuaternions(live ? from[i].quat : car.quat, car.quat, k);
      this.put(i, car, car.pos.distanceTo(camera.position));
      const { neon } = this.views[i];
      if (neon && this.world) {
        place_neon(neon, drawn_pos.x, drawn_pos.y, drawn_pos.z, car.heading, this.world);
        light_neon(neon, Math.hypot(car.vel.x, car.vel.z), car.nitro.boosting, now);
      }
    }
    if (seen !== this.seen) {
      this.seen = seen;
      this.sim.send({ type: "field_seen", mask: seen });
    }
  }

  /** Car i is off the track (`Field.retire`): it draws no more. */
  retire(i: number) {
    if (i < 0 || i >= this.views.length) return;
    this.retired[i] = true;
    this.show(i, false);
  }

  dispose() {
    for (const view of this.views) {
      this.scene.remove(view.root);
      if (view.neon) this.scene.remove(view.neon.mesh);
      dispose_car_view(view);
    }
    for (const far of this.fars) {
      this.scene.remove(far);
      far.geometry.dispose();
      (far.material as THREE.Material).dispose();
    }
    if (this.started) this.sim.send({ type: "field_stop" });
  }
}
