import * as THREE from "three";
import { build_spec, type Build } from "./build";
import type { ChaseCamera } from "../render/camera";
import { Car, drop_height } from "./car";
import { oversize, type Size } from "./cars";
import type { Lighting } from "../render/lighting";
import { contact_shadow, fit_contact_shadow, place_contact_shadow } from "./contact-shadow";
import { show_flame } from "./lights";
import { build_view, dispose_car_view, sync_car_view, type CarView } from "./models";
import type { NitroSnapshot } from "./nitro";
import type { Race } from "../race";
import { Rewind, type RewindPart } from "./rewind";
import type { PadTimer } from "../world/sky-pads";
import { SPAWN_INDEX, type Spawn, type World } from "../world/world";

/** Speed (m/s) above which a reset faces the way the car travels rather than where its nose points. */
const RESET_MOVING = 2;
const RIDE_HEIGHT = 0.75;
// Farther than a step can move: the car was placed (reset, mode restart), so drawing it does not slide from the old spot.
const TELEPORT_SQ = 1;

interface CarFrame {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  vel: THREE.Vector3;
  ang: THREE.Vector3;
  gear: number;
  omega: number[];
}

export class Driver {
  car: Car;
  view: CarView;
  private size: Size;
  readonly shadow = contact_shadow();
  readonly rewind: Rewind;
  /** The car before its last physics step; the drawn car and the camera sit between this and `car`, `blend` of the way. */
  private readonly step_from = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  readonly drawn = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), vel: new THREE.Vector3() };
  /** Resolves once the ground around (x, z) is in; a teleport reads its height only after. */
  arrive: (x: number, z: number) => Promise<void> = (x, z) => this.world.tiles.ensure(x, z);

  constructor(
    private readonly scene: THREE.Scene,
    private readonly light: Lighting,
    private readonly world: World,
    private readonly race: Race,
    private readonly pads: PadTimer,
    private readonly chase: ChaseCamera,
    build: Build,
  ) {
    this.car = new Car(build_spec(build));
    this.view = build_view(build, this.car.spec);
    this.size = oversize(this.car.spec);
    fit_contact_shadow(this.shadow, this.car.spec);
    scene.add(this.view.root);
    scene.add(this.shadow.mesh);
    light.mount(this.view.root);
    const body: RewindPart<CarFrame> = {
      snapshot: () => {
        const car = this.car;
        return { pos: car.pos.clone(), quat: car.quat.clone(), vel: car.vel.clone(), ang: car.ang.clone(), gear: car.gear, omega: car.wheels.map((w) => w.omega) };
      },
      restore: (f) => {
        const car = this.car;
        car.pos.copy(f.pos);
        car.quat.copy(f.quat);
        car.vel.copy(f.vel);
        car.ang.copy(f.ang);
        car.gear = f.gear;
        car.parked = false;
        car.wheels.forEach((w, i) => (w.omega = f.omega[i]));
      },
    };
    const nitro: RewindPart<NitroSnapshot> = { snapshot: () => this.car.nitro.snapshot(), restore: (s) => this.car.nitro.restore(s) };
    this.rewind = new Rewind([body, race, nitro, pads]);
  }

  /** `spot.y` is the car's height, not the ground's. */
  place(spot: Spawn) {
    this.car.place(spot.x, spot.y, spot.z, spot.heading);
    this.pads.clear();
    this.chase.size = this.size;
    this.chase.snap(this.car);
  }

  road_spot(index: number, reverse = false): Spawn {
    const { world } = this;
    const p = world.road[world.clear_spawn(index, reverse ? -1 : 1)];
    return { x: p.x, y: world.height(p.x, p.z) + drop_height(this.car.spec, RIDE_HEIGHT), z: p.z, heading: Math.atan2(p.tx, p.tz) + (reverse ? Math.PI : 0) };
  }

  // In a lobby race a reset stays on the circuit; free driving drops the car on the nearest street.
  async reset(on_circuit: boolean) {
    const { car, world } = this;
    if (on_circuit) return this.place_road(world.road.indexOf(world.nearest_road(car.pos.x, car.pos.z)));
    await this.arrive(car.pos.x, car.pos.z);
    // A spun or sideways car points across the road; the way it was travelling is what the driver meant.
    const moving = Math.hypot(car.vel.x, car.vel.z) > RESET_MOVING;
    const f = moving ? new THREE.Vector3(car.vel.x, 0, car.vel.z) : new THREE.Vector3(0, 0, 1).applyQuaternion(car.quat);
    const spot = world.spawn_near(car.pos.x, car.pos.z, f.x, f.z);
    this.place({ ...spot, y: spot.y + drop_height(car.spec, RIDE_HEIGHT) });
  }

  // Back on the last checkpoint passed, not the nearest deck: that can be a later section, and a fall would be a shortcut.
  fall_back() {
    const { world, race } = this;
    const n = world.checkpoints.length;
    const cp = world.checkpoints[(race.next - 1 + n) % n];
    return this.place_road(race.started ? world.road.indexOf(world.nearest_road(cp.x, cp.z)) : SPAWN_INDEX);
  }

  async place_road(index: number) {
    const { world } = this;
    const p = world.road[world.clear_spawn(index)];
    await this.arrive(p.x, p.z);
    this.place(this.road_spot(index));
  }

  swap(build: Build, timed: boolean) {
    const { pos, heading } = this.car;
    const tank = this.car.nitro;
    this.car = new Car(build_spec(build));
    this.car.nitro.carry(tank, timed);
    this.pads.clear();
    this.car.park(pos.x, pos.z, heading, this.world);
    this.size = oversize(this.car.spec);
    fit_contact_shadow(this.shadow, this.car.spec);
    this.scene.remove(this.view.root);
    dispose_car_view(this.view);
    this.view = build_view(build, this.car.spec);
    this.scene.add(this.view.root);
    this.light.mount(this.view.root);
    sync_car_view(this.view, this.car);
  }

  begin_step() {
    this.step_from.pos.copy(this.car.pos);
    this.step_from.quat.copy(this.car.quat);
  }

  /** `held`: the car did not step this frame (rewind, garage, countdown), so nothing to blend from. */
  draw(held: boolean, blend: number, now: number) {
    const { car, view, step_from, drawn, chase } = this;
    if (held || step_from.pos.distanceToSquared(car.pos) > TELEPORT_SQ) this.begin_step();
    drawn.pos.lerpVectors(step_from.pos, car.pos, blend);
    drawn.quat.slerpQuaternions(step_from.quat, car.quat, blend);
    drawn.vel.copy(car.vel);
    sync_car_view(view, car);
    show_flame(view, car.nitro.boosting, now / 1000);
    view.root.position.copy(drawn.pos);
    view.root.quaternion.copy(drawn.quat);
    view.heads.visible = chase.mode !== 1 || chase.top;
    if (view.halo) view.halo.visible = view.heads.visible;
    chase.eye = view.eye;
    chase.size = this.size;
    place_contact_shadow(this.shadow, drawn.pos.x, drawn.pos.y, drawn.pos.z, car.heading, this.world);
  }
}
