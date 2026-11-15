import type * as THREE from "three";
import { build_spec, type Build } from "../car/build";
import { build_view, sync_car_view, type CarView } from "../car/models";
import type { Sim } from "../sim/sim-client";
import type { World } from "../world/world";
import { RouteKind } from "../worldgen/types";
import { personalities } from "./field";

/** `?field=<cars>`: an AI field laps the circuit in free drive, for measuring the sim with AI before race mode has one. */
export const FIELD_PARAM = "field";
const MAX_CARS = 7;

export class FieldView {
  private readonly views: CarView[] = [];

  private constructor(
    scene: THREE.Scene,
    private readonly sim: Sim,
    build: Build,
  ) {
    for (let i = 0; i < sim.field_cars.length; i++) {
      const view = build_view(build, sim.field_cars[i].spec);
      this.views.push(view);
      scene.add(view.root);
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
    return new FieldView(scene, sim, build);
  }

  update() {
    const cars = this.sim.field_cars;
    for (let i = 0; i < cars.length; i++) sync_car_view(this.views[i], cars[i]);
  }
}
