import * as THREE from "three";
import { DEFAULT_BUILD, DEFAULT_PARTS, build_code, build_spec, type Build } from "../car/build";
import { CARS, type CarId } from "../car/cars";
import { contact_shadow } from "../car/contact-shadow";
import { build_view, dispose_car_view, rest_wheels } from "../car/models";
import { brand, color, dark } from "../theme/palette";

export const StillView = {
  /** Front three-quarter, on its shadow. */
  QUARTER: "quarter",
  /** Side on, no shadow: the alpha is the car's outline, for a mask. */
  PROFILE: "profile",
} as const;
export type StillView = (typeof StillView)[keyof typeof StillView];

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

/** One paint per car, the same wherever a still of it shows. */
export const still_paint = (car: CarId) => Object.keys(CARS).indexOf(car);

export const still_build = (car: CarId, aero = 0): Build => ({ ...DEFAULT_BUILD, car, paint: still_paint(car), parts: { ...DEFAULT_PARTS, aero } });

class Stage {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, STILL_WIDTH / STILL_HEIGHT, 0.1, 200);
  private readonly shadow = contact_shadow();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas = document.createElement("canvas");

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(STILL_WIDTH, STILL_HEIGHT, false);
    // The garage stand's light (garage-stage.ts): a still is the car as the garage shows it.
    const light = dark ? brand.foreground : brand.background_lightest;
    this.scene.add(new THREE.HemisphereLight(color(light), color(brand.background_darkest), 2.2));
    const sun = new THREE.DirectionalLight(color(light), 2.4);
    sun.position.set(4, 6, 3);
    this.scene.add(sun);
    // No ground here to multiply: the patch blends over the clear canvas, its alpha fading it out.
    this.shadow.material.transparent = true;
    this.shadow.material.blending = THREE.NormalBlending;
    this.shadow.material.premultipliedAlpha = false;
    this.shadow.material.map = this.shadow.material.alphaMap;
    this.shadow.material.alphaMap = null;
    this.scene.add(this.shadow.mesh);
  }

  draw(build: Build, view: StillView): Promise<string> {
    const eye = EYES[view];
    const spec = build_spec(build);
    const car = build_view(build, spec);
    rest_wheels(car, spec);
    car.root.updateMatrixWorld(true);
    const points = outline(car.root);
    const box = new THREE.Box3().setFromPoints(points);
    const center = box.getCenter(new THREE.Vector3());
    const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    this.shadow.mesh.visible = eye.shadow;
    this.shadow.mesh.position.set(center.x, box.min.y + 0.02, center.z);
    this.shadow.mesh.scale.set(half.x, 1, half.z / 2);
    this.scene.add(car.root);
    this.frame(points, center, eye);
    this.renderer.render(this.scene, this.camera);
    // The drawing buffer is read in this task, before the browser clears it.
    const blob = new Promise<string>((resolve, reject) => this.canvas.toBlob((file) => (file ? resolve(URL.createObjectURL(file)) : reject(new Error("still: canvas gave no image"))), "image/webp", 0.9));
    this.scene.remove(car.root);
    dispose_car_view(car);
    return blob;
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

  dispose() {
    this.shadow.mesh.geometry.dispose();
    this.shadow.material.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
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
let waiting = 0;
let turn: Promise<void> = Promise.resolve();

/**
 * A picture of the car, drawn once and kept for the session: an object URL of a clear-backed image. Stills draw one per
 * task on a renderer of their own, which closes when none is waiting, so no loop runs and no context stays open.
 */
export function car_still(build: Build, view: StillView = StillView.QUARTER): Promise<string> {
  const key = `${build_code(build)} ${view}`;
  const kept = stills.get(key);
  if (kept) return kept;
  waiting++;
  const still = new Promise<string>((resolve, reject) => {
    // The next still waits for this one's draw, not for its image to encode.
    turn = turn.then(
      () =>
        new Promise<void>((next) =>
          setTimeout(() => {
            try {
              // WebGL can refuse a context: the still fails, and whatever asked for it shows its empty slot.
              stage ??= new Stage();
              resolve(stage.draw(build, view));
            } catch (error) {
              reject(error);
            } finally {
              if (--waiting === 0) {
                stage?.dispose();
                stage = null;
              }
              next();
            }
          }),
        ),
    );
  });
  stills.set(key, still);
  return still;
}
