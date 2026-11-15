import * as THREE from "three";
import { build_spec, type Build } from "../car/build";
import { Car } from "../car/car";
import { TELEPORT_SQ } from "../car/driver";
import { far_view } from "../car/far-view";
import { build_view, dispose_car_view, sync_car_view, type CarView } from "../car/models";
import type { Sim } from "../sim/sim-client";
import type { World } from "../world/world";
import { RouteKind, type Route } from "../worldgen/types";
import { grid_spot, personalities } from "./field";

/** `?field=<cars>`: an AI field laps the circuit in free drive, for measuring the sim with AI before race mode has one. */
export const FIELD_PARAM = "field";
export const AI_RACE_PARAM = "airace";
/** With `?airace`: the field's driver drives the player's car too, for shots and frame-time runs. */
export const AI_DRIVE_PARAM = "aidrive";
/** With `?airace`: AI cars on the grid, 1-6, for a frame-time baseline; F3's six without it. */
export const AI_CARS_PARAM = "aicars";
export const AI_CARS = 6;
const MAX_CARS = 7;
/** Metres from the camera past which a car draws as its one-mesh far view, and inside which it is back to the full one. */
const FAR_VIEW = 75;
const NEAR_VIEW = 65;
/** Metres round a car's centre that count toward it being on screen: wide, so a coasting car is back on the physics before it comes into view. */
const SEEN_RADIUS = 30;

const frustum = new THREE.Frustum();
const view_projection = new THREE.Matrix4();
const sphere = new THREE.Sphere();
const drawn_pos = new THREE.Vector3();
const drawn_quat = new THREE.Quaternion();

export class FieldView {
  private readonly views: CarView[] = [];
  private readonly fars: THREE.Mesh[] = [];
  private readonly far: boolean[] = [];
  private readonly retired: boolean[] = [];
  /** Each car parked on its grid slot as the field will park it: drawn until the sim's field has stepped, so the grid shows at once. */
  private readonly grid: Car[];
  private seen = -1;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly sim: Sim,
    builds: readonly Build[],
    route: Route,
    world: World,
    /** The rival's grid slot: the cars stand on the others, as `Field` parks them. */
    rival_slot = builds.length,
  ) {
    this.grid = builds.map((build, k) => {
      const car = new Car(build_spec(build));
      const spot = grid_spot(route, k < rival_slot ? k : k + 1);
      car.park(spot.x, spot.z, spot.heading, world);
      return car;
    });
    for (let i = 0; i < builds.length; i++) {
      const view = build_view(builds[i], this.grid[i].spec);
      const far = far_view(view, this.grid[i].spec);
      far.visible = false;
      this.views.push(view);
      this.fars.push(far);
      this.far.push(false);
      this.retired.push(false);
      scene.add(view.root, far);
    }
  }

  /** Null without the param or a circuit. The field's grid waits for its ground, as a teleport does. */
  static async open(params: URLSearchParams, scene: THREE.Scene, world: World, sim: Sim, build: Build): Promise<FieldView | null> {
    const count = Math.min(MAX_CARS, Math.trunc(Number(params.get(FIELD_PARAM))) || 0);
    const route = world.routes.find((r) => r.kind === RouteKind.CIRCUIT);
    if (count <= 0 || !route) return null;
    await world.tiles.ensure(route.points[0].x, route.points[0].z);
    world.place(route.closure);
    const spec = build_spec(build);
    const view = new FieldView(scene, sim, Array.from({ length: count }, () => build), route, world);
    sim.send({ type: "field", route: route.id, specs: Array.from({ length: count }, () => spec), traits: personalities(world.seed, count), seed: world.seed });
    return view;
  }

  update(camera: THREE.Camera) {
    // Before its first step the sim's field stands where the grid cars do, or (a worker's mirrors) nowhere yet.
    const live = this.sim.field_cars.length === this.grid.length && Number.isFinite(this.sim.field_progress[0]);
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
      const d = car.pos.distanceTo(camera.position);
      const far = this.far[i] ? d > NEAR_VIEW : d > FAR_VIEW;
      if (far !== this.far[i]) {
        this.far[i] = far;
        this.views[i].root.visible = !far;
        this.fars[i].visible = far;
      }
      // Drawn between its last two steps at the frame's blend, as the player's car is: drawn on the last step, a car
      // moves a whole number of steps a frame (2 or 3 at 144 Hz) and judders against the player's.
      // A car put back on the road (a reset) is drawn where it lands, not slid there from where it was.
      const k = live && from[i].pos.distanceToSquared(car.pos) < TELEPORT_SQ ? blend : 1;
      drawn_pos.lerpVectors(live ? from[i].pos : car.pos, car.pos, k);
      drawn_quat.slerpQuaternions(live ? from[i].quat : car.quat, car.quat, k);
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
    if (seen !== this.seen) {
      this.seen = seen;
      this.sim.send({ type: "field_seen", mask: seen });
    }
  }

  /** Car i is off the track (`Field.retire`): it draws no more. */
  retire(i: number) {
    if (i < 0 || i >= this.views.length) return;
    this.retired[i] = true;
    this.views[i].root.visible = false;
    this.fars[i].visible = false;
  }

  dispose() {
    for (const view of this.views) {
      this.scene.remove(view.root);
      dispose_car_view(view);
    }
    for (const far of this.fars) {
      this.scene.remove(far);
      far.geometry.dispose();
      (far.material as THREE.Material).dispose();
    }
    this.sim.send({ type: "field_stop" });
  }
}
