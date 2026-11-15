import * as THREE from "three";
import { build_spec, type Build } from "../car/build";
import { far_view } from "../car/far-view";
import { build_view, dispose_car_view, sync_car_view, type CarView } from "../car/models";
import type { Sim } from "../sim/sim-client";
import type { World } from "../world/world";
import { RouteKind } from "../worldgen/types";
import { personalities } from "./field";

/** `?field=<cars>`: an AI field laps the circuit in free drive, for measuring the sim with AI before race mode has one. */
export const FIELD_PARAM = "field";
export const AI_RACE_PARAM = "airace";
/** With `?airace`: the field's driver drives the player's car too, for shots and frame-time runs. */
export const AI_DRIVE_PARAM = "aidrive";
const MAX_CARS = 7;
/** Metres from the camera past which a car draws as its one-mesh far view, and inside which it is back to the full one. */
const FAR_VIEW = 75;
const NEAR_VIEW = 65;
/** Metres round a car's centre that count toward it being on screen: wide, so a coasting car is back on the physics before it comes into view. */
const SEEN_RADIUS = 30;

const frustum = new THREE.Frustum();
const view_projection = new THREE.Matrix4();
const sphere = new THREE.Sphere();

export class FieldView {
  private readonly views: CarView[] = [];
  private readonly fars: THREE.Mesh[] = [];
  private readonly far: boolean[] = [];
  private seen = -1;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly sim: Sim,
    builds: readonly Build[],
  ) {
    for (let i = 0; i < sim.field_cars.length; i++) {
      const view = build_view(builds[i], sim.field_cars[i].spec);
      const far = far_view(view, sim.field_cars[i].spec);
      far.visible = false;
      this.views.push(view);
      this.fars.push(far);
      this.far.push(false);
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
    sim.send({ type: "field", route: route.id, specs: Array.from({ length: count }, () => spec), traits: personalities(world.seed, count), seed: world.seed });
    return new FieldView(scene, sim, Array.from({ length: count }, () => build));
  }

  update(camera: THREE.Camera) {
    const cars = this.sim.field_cars;
    view_projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(view_projection);
    let seen = 0;
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      if (frustum.intersectsSphere(sphere.set(car.pos, SEEN_RADIUS))) seen |= 1 << i;
      const d = car.pos.distanceTo(camera.position);
      const far = this.far[i] ? d > NEAR_VIEW : d > FAR_VIEW;
      if (far !== this.far[i]) {
        this.far[i] = far;
        this.views[i].root.visible = !far;
        this.fars[i].visible = far;
      }
      if (far) {
        const mesh = this.fars[i];
        mesh.position.copy(car.pos);
        mesh.quaternion.copy(car.quat);
        mesh.updateMatrix();
      } else sync_car_view(this.views[i], car);
    }
    if (seen !== this.seen) {
      this.seen = seen;
      this.sim.send({ type: "field_seen", mask: seen });
    }
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
