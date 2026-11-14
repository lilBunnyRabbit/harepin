import * as THREE from "three";
import { build_spec, type Build } from "./build";
import type { ChaseCamera } from "../render/camera";
import { Car, drop_height } from "./car";
import { oversize, type CarSpec, type Size } from "./cars";
import type { Lighting } from "../render/lighting";
import { dark } from "../theme/palette";
import { contact_shadow, fit_contact_shadow, place_contact_shadow } from "./contact-shadow";
import { set_lights, show_flame } from "./lights";
import { build_view, dispose_car_view, sync_car_view, type CarView } from "./models";
import type { NitroSnapshot } from "./nitro";
import type { Race } from "../race";
import type { RoutePoint } from "../modes/route";
import { Rewind, type RewindPart } from "./rewind";
import type { PadTimer } from "../world/sky-pads";
import { ROAD_HALF, type Spawn, type World } from "../world/world";

/** Speed (m/s) above which a reset faces the way the car travels rather than where its nose points. */
const RESET_MOVING = 2;
const RIDE_HEIGHT = 0.75;
/** Nose up at least this much, every wheel down and on the road: a spot a fall can come back to. */
const SAFE_UPRIGHT = 0.8;
/** A safe spot this near the circuit counts as on it, for the lap's checkpoint rule. */
const ON_CIRCUIT = ROAD_HALF * 2;
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
  private teleporting = false;
  /** After every placement: a reset, a teleport, a mode or lap restart. */
  placed = () => {};
  /** The last spot the car stood safely on a road, and the way it was going there. */
  private readonly safe = { x: 0, z: 0, fx: 0, fz: 1 };

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
    set_lights(this.view, dark);
    light.mount(this.view.root, dark);
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
        car.forget_slide();
      },
    };
    const nitro: RewindPart<NitroSnapshot> = { snapshot: () => this.car.nitro.snapshot(), restore: (s) => this.car.nitro.restore(s) };
    this.rewind = new Rewind([body, race, nitro, pads]);
  }

  /** `spot.y` is the car's height, not the ground's. */
  place(spot: Spawn) {
    this.car.place(spot.x, spot.y, spot.z, spot.heading);
    this.keep_safe(spot.x, spot.z, spot.heading);
    this.pads.clear();
    this.chase.size = this.size;
    this.chase.snap(this.car);
    this.placed();
  }

  /** At rest on the ground under (x, z), tilted to its slope: a level drop onto a steep site can roll the car. */
  park(x: number, z: number, heading: number) {
    this.car.park(x, z, heading, this.world);
    this.keep_safe(x, z, heading);
    this.pads.clear();
    this.chase.size = this.size;
    this.chase.snap(this.car);
    this.placed();
  }

  road_spot(index: number, reverse = false): Spawn {
    const { world } = this;
    const p = world.road[world.clear_spawn(index, reverse ? -1 : 1)];
    return { x: p.x, y: world.height(p.x, p.z) + drop_height(this.car.spec, RIDE_HEIGHT), z: p.z, heading: Math.atan2(p.tx, p.tz) + (reverse ? Math.PI : 0) };
  }

  // In a lobby race a reset stays on the circuit; free driving drops the car on the nearest street.
  reset(on_circuit: boolean): Promise<void> {
    const { car, world } = this;
    if (on_circuit) return this.place_road(world.road.indexOf(world.nearest_road(car.pos.x, car.pos.z)));
    // A spun or sideways car points across the road; the way it was travelling is what the driver meant.
    const moving = Math.hypot(car.vel.x, car.vel.z) > RESET_MOVING;
    const f = moving ? new THREE.Vector3(car.vel.x, 0, car.vel.z) : new THREE.Vector3(0, 0, 1).applyQuaternion(car.quat);
    return this.teleport(car.pos.x, car.pos.z, () => {
      const spot = world.spawn_near(car.pos.x, car.pos.z, f.x, f.z);
      return { ...spot, y: spot.y + drop_height(car.spec, RIDE_HEIGHT) };
    });
  }

  /** Called every frame the car has not fallen. */
  track_safe(upright: number) {
    const { car, world } = this;
    if (upright < SAFE_UPRIGHT || !world.on_road(car.pos.x, car.pos.z)) return;
    for (const w of car.wheels) if (!w.contact) return;
    this.keep_safe(car.pos.x, car.pos.z, Math.hypot(car.vel.x, car.vel.z) > RESET_MOVING ? Math.atan2(car.vel.x, car.vel.z) : car.heading);
  }

  private keep_safe(x: number, z: number, heading: number) {
    this.safe.x = x;
    this.safe.z = z;
    this.safe.fx = Math.sin(heading);
    this.safe.fz = Math.cos(heading);
  }

  // Never the nearest road to where the car fell: that can be a later section, and a fall would be a shortcut. A route
  // run puts it back on its last gate; a lap on the circuit on the lap's last checkpoint; free driving where it last stood safely.
  fall_back(route: { respawn?: RoutePoint } | null) {
    const { world, race, safe, car } = this;
    const lift = drop_height(car.spec, RIDE_HEIGHT);
    const p = route?.respawn;
    if (p) {
      return this.teleport(p.x, p.z, () => ({ x: p.x, y: world.height(p.x, p.z) + lift, z: p.z, heading: Math.atan2(p.tx, p.tz) }));
    }
    const near = world.nearest_road(safe.x, safe.z);
    if (race.started && Math.hypot(near.x - safe.x, near.z - safe.z) < ON_CIRCUIT) {
      const n = world.checkpoints.length;
      const cp = world.checkpoints[(race.next - 1 + n) % n];
      return this.place_road(world.road.indexOf(world.nearest_road(cp.x, cp.z)));
    }
    const { x, z, fx, fz } = safe;
    return this.teleport(x, z, () => {
      const spot = world.spawn_near(x, z, fx, fz);
      return { ...spot, y: spot.y + lift };
    });
  }

  place_road(index: number): Promise<void> {
    const { world } = this;
    const p = world.road[world.clear_spawn(index)];
    return this.teleport(p.x, p.z, () => this.road_spot(index));
  }

  // One at a time: the frame loop asks again every frame while the car still looks fallen or stuck.
  private async teleport(x: number, z: number, spot: () => Spawn) {
    if (this.teleporting) return;
    this.teleporting = true;
    try {
      await this.arrive(x, z);
      this.place(spot());
    } catch (error) {
      console.error(error);
    } finally {
      this.teleporting = false;
    }
  }

  /** `spec` stands in for the build's own (the feel lab's overrides); the build still draws the car. */
  swap(build: Build, timed: boolean, spec: CarSpec = build_spec(build)) {
    const { pos, heading } = this.car;
    const tank = this.car.nitro;
    this.car = new Car(spec);
    this.car.nitro.carry(tank, timed);
    this.pads.clear();
    this.car.park(pos.x, pos.z, heading, this.world);
    this.size = oversize(this.car.spec);
    fit_contact_shadow(this.shadow, this.car.spec);
    const { lights } = this.view;
    this.scene.remove(this.view.root);
    dispose_car_view(this.view);
    this.view = build_view(build, this.car.spec);
    set_lights(this.view, lights);
    this.scene.add(this.view.root);
    this.light.mount(this.view.root, lights);
    sync_car_view(this.view, this.car);
  }

  /** Headlamps on or off for the rest of the session, across car swaps. */
  toggle_lights(): boolean {
    const on = !this.view.lights;
    set_lights(this.view, on);
    this.light.beam(on);
    return on;
  }

  begin_step() {
    this.step_from.pos.copy(this.car.pos);
    this.step_from.quat.copy(this.car.quat);
  }

  /** The drawn ground's lift over the felt ground, averaged under the wheels, so the view stands the tyres on the road mesh. */
  private drawn_lift(): number {
    const { wheels } = this.car;
    let lift = 0;
    for (const w of wheels) lift += this.world.drawn_lift(w.point.x, w.point.z, w.point.y);
    return lift / wheels.length;
  }

  /** `held`: the car did not step this frame (rewind, garage, countdown), so nothing to blend from. */
  draw(held: boolean, blend: number, now: number) {
    const { car, view, step_from, drawn, chase } = this;
    if (held || step_from.pos.distanceToSquared(car.pos) > TELEPORT_SQ) this.begin_step();
    drawn.pos.lerpVectors(step_from.pos, car.pos, blend);
    drawn.quat.slerpQuaternions(step_from.quat, car.quat, blend);
    drawn.vel.copy(car.vel);
    sync_car_view(view, car);
    show_flame(view, car.nitro.boosting, now / 1000, car.ang.y);
    view.root.position.copy(drawn.pos);
    view.root.position.y += this.drawn_lift();
    view.root.quaternion.copy(drawn.quat);
    view.heads.visible = chase.mode !== 1 || chase.top;
    chase.eye = view.eye;
    chase.size = this.size;
    place_contact_shadow(this.shadow, drawn.pos.x, drawn.pos.y, drawn.pos.z, car.heading, this.world);
  }
}
