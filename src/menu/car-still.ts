import * as THREE from "three";
import { DEFAULT_BUILD, build_code, build_spec, type Build } from "../car/build";
import { contact_shadow } from "../car/contact-shadow";
import { dispose_car_view, rest_wheels, view_steps, type CarView } from "../car/models";
import { advance } from "../car/steps";
import { brand, color, dark } from "../theme/palette";
import { StillView } from "./still-build";

interface Eye {
  azimuth: number;
  elevation: number;
  shadow: boolean;
}

const EYES: Record<StillView, Eye> = {
  [StillView.QUARTER]: { azimuth: -0.62, elevation: 0.3, shadow: true },
  [StillView.PROFILE]: { azimuth: -Math.PI / 2, elevation: 0.05, shadow: false },
};

export const STILL_WIDTH = 640;
export const STILL_HEIGHT = 360;
const FOV = 28;
/** The car's box in the picture, in normalised device coordinates: every still stands its car on the same line. */
const REACH = 0.94;
const FLOOR = -0.78;
const ROOF = 0.92;
const FIT_PASSES = 6;

class Stage {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, STILL_WIDTH / STILL_HEIGHT, 0.1, 200);
  private readonly shadow = contact_shadow();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas = document.createElement("canvas");
  /** The last car drawn. three frees a shader with the last material that uses it, so this one's materials hold the compiled shaders for the next car. */
  private kept: CarView | null = null;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(STILL_WIDTH, STILL_HEIGHT, false);
    // The garage stand's light (showroom/car-stage.ts): a still is the car as the garage shows it.
    const light = dark ? brand.foreground : brand.background_lightest;
    this.scene.add(new THREE.HemisphereLight(color(light), color(brand.background_darkest), 2.2));
    const sun = new THREE.DirectionalLight(color(light), 2.4);
    sun.position.set(4, 6, 3);
    this.scene.add(sun);
    // No ground here to multiply: the patch blends over the clear canvas as a transparent mesh, as on the garage stand.
    // The blob's fade is in the green channel the alpha map reads; used as a colour map it drew a hard dark square.
    this.shadow.material.transparent = true;
    this.shadow.material.blending = THREE.NormalBlending;
    this.shadow.material.premultipliedAlpha = false;
    this.scene.add(this.shadow.mesh);
  }

  /** Builds the model a slice at a time, a `wait` apart. */
  async build(build: Build, wait: () => Promise<void>): Promise<CarView> {
    const spec = build_spec(build);
    const steps = view_steps(build, spec);
    let step = advance(steps);
    while (!step.done) {
      await wait();
      step = advance(steps);
    }
    const car = step.value;
    rest_wheels(car, spec);
    car.root.updateMatrixWorld(true);
    return car;
  }

  /** Resolves when the shaders `car` needs have linked, so `shoot` never blocks on one. */
  place(car: CarView, view: StillView): Promise<unknown> {
    const eye = EYES[view];
    const points = outline(car.root);
    const box = new THREE.Box3().setFromPoints(points);
    const center = box.getCenter(new THREE.Vector3());
    const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    this.shadow.mesh.visible = eye.shadow;
    this.shadow.mesh.position.set(center.x, box.min.y + 0.02, center.z);
    this.shadow.mesh.scale.set(half.x, 1, half.z / 2);
    this.scene.add(car.root);
    this.frame(points, center, eye);
    return this.renderer.compileAsync(this.scene, this.camera);
  }

  shoot(car: CarView): Promise<string> {
    this.renderer.render(this.scene, this.camera);
    // The drawing buffer is read in this task, before the browser clears it.
    const blob = new Promise<string>((resolve, reject) => this.canvas.toBlob((file) => (file ? resolve(URL.createObjectURL(file)) : reject(new Error("still: canvas gave no image"))), "image/webp", 0.9));
    this.rest(car);
    return blob;
  }

  rest(car: CarView) {
    this.scene.remove(car.root);
    if (this.kept) dispose_car_view(this.kept);
    this.kept = car;
  }

  /** Backs the camera off and slides it until the car fills its box, standing on the floor line. */
  private frame(points: readonly THREE.Vector3[], center: THREE.Vector3, eye: Eye) {
    const forward = new THREE.Vector3(Math.sin(eye.azimuth) * Math.cos(eye.elevation), Math.sin(eye.elevation), Math.cos(eye.azimuth) * Math.cos(eye.elevation)).negate();
    const side = forward.clone().cross(THREE.Object3D.DEFAULT_UP).normalize();
    const up = side.clone().cross(forward);
    const tan_v = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const tan_h = tan_v * this.camera.aspect;
    const aim = center.clone();
    const seen = new THREE.Vector3();
    let distance = 12;
    for (let pass = 0; pass < FIT_PASSES; pass++) {
      this.camera.position.copy(aim).addScaledVector(forward, -distance);
      this.camera.lookAt(aim);
      this.camera.updateMatrixWorld(true);
      let left = Infinity;
      let right = -Infinity;
      let low = Infinity;
      let high = -Infinity;
      for (const point of points) {
        seen.copy(point).project(this.camera);
        left = Math.min(left, seen.x);
        right = Math.max(right, seen.x);
        low = Math.min(low, seen.y);
        high = Math.max(high, seen.y);
      }
      const grow = Math.max((right - left) / (2 * REACH), (high - low) / (ROOF - FLOOR));
      aim.addScaledVector(side, ((left + right) / 2) * distance * tan_h).addScaledVector(up, (low - FLOOR * grow) * distance * tan_v);
      distance *= grow;
    }
    this.camera.position.copy(aim).addScaledVector(forward, -distance);
    this.camera.lookAt(aim);
  }

}

function outline(root: THREE.Object3D): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  root.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld));
  });
  return points;
}

const stills = new Map<string, Promise<string>>();
let stage: Stage | null = null;
let turn: Promise<void> = Promise.resolve();

/** Resolves after the next frame is on screen: whatever asked for a still paints first, and each step of a still gets a frame of its own. */
const painted = () => new Promise<void>((done) => requestAnimationFrame(() => setTimeout(done)));

const IDLE_WAIT_MS = 1000;
const idle = () => new Promise<void>((done) => requestIdleCallback(() => done(), { timeout: IDLE_WAIT_MS }));

/**
 * Opens the stills' renderer and compiles a stock car's shaders in idle time, so the first stills a page asks for pay
 * for neither. A load that has already drawn a still has both. It waits while `held`: a step in a frame of a drag
 * is a dropped frame.
 */
export function warm_stills(held: () => boolean) {
  const free = async () => {
    do await idle();
    while (held());
  };
  turn = turn.then(async () => {
    if (stage) return;
    await free();
    try {
      stage = new Stage();
      await free();
      const car = await stage.build(DEFAULT_BUILD, free);
      await free();
      await stage.place(car, StillView.QUARTER);
      stage.rest(car);
    } catch (error) {
      console.warn("still: renderer not warmed", error);
    }
  });
}

/**
 * A picture of the car, drawn once and kept for the session: an object URL of a clear-backed image. Stills draw on one
 * renderer of their own, kept for the session so its shaders compile once. A still takes its tasks a frame apart:
 * the model in slices, the fit and shader link, the draw. No loop runs.
 */
export function car_still(build: Build, view: StillView = StillView.QUARTER): Promise<string> {
  const key = `${build_code(build)} ${view}`;
  const kept = stills.get(key);
  if (kept) return kept;
  const still = new Promise<string>((resolve, reject) => {
    // The next still waits for this one's draw, not for its image to encode.
    turn = turn.then(async () => {
      await painted();
      try {
        // WebGL can refuse a context: the still fails, and whatever asked for it shows its empty slot.
        if (!stage) {
          stage = new Stage();
          await painted();
        }
        const car = await stage.build(build, painted);
        await painted();
        await stage.place(car, view);
        await painted();
        resolve(stage.shoot(car));
      } catch (error) {
        reject(error);
      }
    });
  });
  stills.set(key, still);
  return still;
}
