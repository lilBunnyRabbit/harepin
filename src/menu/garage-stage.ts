import * as THREE from "three";
import { DEFAULT_PARTS, SLOTS, SLOT_NAMES, WHOLE_CAR, build_code, build_spec, type Build, type Part, type SlotView } from "../car/build";
import { contact_shadow } from "../car/contact-shadow";
import { build_view, dispose_car_view, rest_wheels, type CarView } from "../car/models";
import { brand, color, dark } from "../theme/palette";

const EYE_AZIMUTH = Math.atan2(4.6, 5.4);
const EYE_ELEVATION = Math.atan2(2.8, Math.hypot(4.6, 5.4));
/** How far a drag tilts the view above and below the stand's usual angle, radians. */
const PITCH_MIN = -0.25;
const PITCH_MAX = 0.55;
/** Zoom over the whole-car fit; 1 is the most a pinch or the wheel backs out. */
const ZOOM_MAX = 2.6;
const DRAG_YAW = 0.01;
const DRAG_PITCH = 0.006;
const WHEEL_ZOOM = 0.0015;
/** Camera distance over the tightest fit: room around the car so it reads as a car on a stand, not a crop. */
const FIT_SLACK = 1.5;
const EASE_MS = 600;
/** Breathing room between the car and the panels around it, CSS px. */
const FREE_PAD = 12;
/** Height of the stand's floor under the car, where the tyres sit whatever the ride height. */
const GROUND = -0.6;
/** Turns the fit is checked at, so the framing holds wherever the car is turned. */
const FIT_TURNS = 24;
/** Grid the stand's outline points snap to, metres: fewer points for the fit, nothing a pixel would show. */
const OUTLINE_GRID = 0.04;

export const ease = (u: number) => 1 - (1 - u) ** 3;
const turn = (from: number, to: number) => ((((to - from + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

interface Pose {
  yaw: number;
  /** Tilt added to the stand's camera angle by a drag, radians. */
  pitch: number;
  zoom: number;
}

const pose_of = (view: SlotView): Pose => ({ yaw: view.yaw, pitch: 0, zoom: 1 });

export class GarageStage {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  private readonly shadow = contact_shadow();
  private renderer: THREE.WebGLRenderer | null = null;
  private view: CarView | null = null;
  private shown_code = "";
  private frame = 0;
  /** The outline of every part this car can wear, unturned: the framing is fitted to it once per car, so swapping a part never moves the camera. */
  private points: THREE.Vector3[] = [];
  private stand_car: string | null = null;
  /** The point the camera looks at and its distance there before zoom; set by `frame_car`. */
  private readonly aim_at = new THREE.Vector3();
  private fit_distance = 10;
  /** The clear area between the panels in normalised device coordinates, -1..1, +y up. */
  private readonly clear = { left: -1, right: 1, bottom: -1, top: 1 };
  private pose: Pose = pose_of(WHOLE_CAR);
  private from: Pose = pose_of(WHOLE_CAR);
  private to: Pose = pose_of(WHOLE_CAR);
  private moved = 0;
  private readonly calm = matchMedia("(prefers-reduced-motion: reduce)");
  private readonly pointers = new Map<number, { x: number; y: number }>();

  constructor(readonly canvas: HTMLCanvasElement) {
    // Light themes have a dark foreground, which would light the car like dusk; their light comes from the page white.
    const light = dark ? brand.foreground : brand.background_lightest;
    this.scene.add(new THREE.HemisphereLight(color(light), color(brand.background_darkest), 2.2));
    const sun = new THREE.DirectionalLight(color(light), 2.4);
    sun.position.set(4, 6, 3);
    this.scene.add(sun);
    // The game's patch multiplies the ground under it; here there is no ground, only the page behind a clear canvas. As an
    // alpha map the blob reads its green channel, which is solid out to the rim; as a map its alpha fades it out.
    this.shadow.material.blending = THREE.NormalBlending;
    this.shadow.material.premultipliedAlpha = false;
    this.shadow.material.map = this.shadow.material.alphaMap;
    this.shadow.material.alphaMap = null;
    this.scene.add(this.shadow.mesh);
  }

  start(view: SlotView) {
    this.renderer ??= new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.canvas.addEventListener("pointerdown", this.grab);
    this.canvas.addEventListener("pointermove", this.drag);
    this.canvas.addEventListener("lostpointercapture", this.release);
    this.canvas.addEventListener("wheel", this.wheel, { passive: false });
    this.pose = pose_of(view);
    this.to = this.pose;
    this.shown_code = "";
  }

  stop() {
    this.canvas.removeEventListener("pointerdown", this.grab);
    this.canvas.removeEventListener("pointermove", this.drag);
    this.canvas.removeEventListener("lostpointercapture", this.release);
    this.canvas.removeEventListener("wheel", this.wheel);
    this.pointers.clear();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  show(build: Build) {
    const code = build_code(build);
    if (code === this.shown_code) return;
    this.shown_code = code;
    if (this.view) {
      this.scene.remove(this.view.root);
      dispose_car_view(this.view);
    }
    this.view = stand_view(build);
    this.scene.add(this.view.root);
    if (build.car !== this.stand_car) this.stand(build);
    this.draw();
  }

  /** Outlines the car with every part it can wear, so the framing and shadow fit them all and stay put across swaps. */
  private stand(build: Build) {
    this.stand_car = build.car;
    const base: Build = { ...build, parts: { ...DEFAULT_PARTS } };
    // Only parts that change the shape: a look of their own, or a ride height or centre of mass that moves the body.
    const shaped = ({ look, mod }: Part) => look !== undefined || [mod.add, mod.scale].some((m) => m?.rest !== undefined || m?.cog !== undefined);
    const builds = [base];
    for (const slot of SLOT_NAMES) {
      const parts: Part[] = SLOTS[slot].parts;
      parts.forEach((part, i) => shaped(part) && builds.push({ ...base, parts: { ...base.parts, [slot]: i } }));
    }
    const seen = new Set<string>();
    const vertex = new THREE.Vector3();
    const box = new THREE.Box3();
    this.points = [];
    for (const variant of builds) {
      const view = stand_view(variant);
      view.root.traverseVisible((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const position = object.geometry.getAttribute("position");
        for (let i = 0; i < position.count; i++) {
          vertex.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
          box.expandByPoint(vertex);
          const key = `${Math.round(vertex.x / OUTLINE_GRID)},${Math.round(vertex.y / OUTLINE_GRID)},${Math.round(vertex.z / OUTLINE_GRID)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          this.points.push(vertex.clone());
        }
      });
      dispose_car_view(view);
    }
    const center = box.getCenter(new THREE.Vector3());
    const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    this.shadow.mesh.position.set(center.x, GROUND + 0.02, center.z);
    this.shadow.mesh.scale.set(half.x, 1, half.z / 2);
    this.frame_car();
  }

  aim(view: SlotView) {
    this.from = { ...this.pose };
    this.to = pose_of(view);
    this.moved = performance.now();
    if (this.calm.matches) {
      this.pose = this.to;
      this.draw();
    } else if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number) => {
    const u = Math.min(1, (now - this.moved) / EASE_MS);
    const e = ease(u);
    this.pose = {
      yaw: this.from.yaw + turn(this.from.yaw, this.to.yaw) * e,
      pitch: THREE.MathUtils.lerp(this.from.pitch, this.to.pitch, e),
      zoom: THREE.MathUtils.lerp(this.from.zoom, this.to.zoom, e),
    };
    this.draw();
    this.frame = u < 1 ? requestAnimationFrame(this.tick) : 0;
  };

  private stop_easing() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private readonly grab = (event: PointerEvent) => {
    this.canvas.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.stop_easing();
  };

  // One pointer turns the car on its stand and tilts the view; two pinch the zoom. Each move draws one frame, so a car
  // left alone runs no loop.
  private readonly drag = (event: PointerEvent) => {
    const last = this.pointers.get(event.pointerId);
    if (!last) return;
    const spread = () => {
      const [a, b] = [...this.pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    if (this.pointers.size === 2) {
      const before = spread();
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (before > 0) this.zoom_by(spread() / before);
      return;
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.pose.yaw += (event.clientX - last.x) * DRAG_YAW;
    this.pose.pitch = THREE.MathUtils.clamp(this.pose.pitch + (event.clientY - last.y) * DRAG_PITCH, PITCH_MIN, PITCH_MAX);
    this.draw();
  };

  private readonly release = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
  };

  private readonly wheel = (event: WheelEvent) => {
    event.preventDefault();
    this.stop_easing();
    this.zoom_by(Math.exp(-event.deltaY * WHEEL_ZOOM));
  };

  private zoom_by(factor: number) {
    this.pose.zoom = THREE.MathUtils.clamp(this.pose.zoom * factor, 1, ZOOM_MAX);
    this.draw();
  }

  /** Frames the car in the part of the screen the `panels` leave clear. */
  resize(panels: readonly HTMLElement[]) {
    const renderer = this.renderer;
    if (!renderer) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    renderer.setSize(width, height, false);
    const area = { left: 0, top: 0, right: width, bottom: height };
    // The stage sits inside the menu, so panel rects are taken relative to the canvas, not the window.
    const stage = this.canvas.getBoundingClientRect();
    // Each panel names the side of the stage it takes in `--garage-side`: the layouts move panels between sides.
    for (const panel of panels) {
      const box = panel.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const r = { left: box.left - stage.left, right: box.right - stage.left, top: box.top - stage.top, bottom: box.bottom - stage.top };
      const side = getComputedStyle(panel).getPropertyValue("--garage-side").trim();
      if (side === "top") area.top = Math.max(area.top, r.bottom + FREE_PAD);
      else if (side === "left") area.left = Math.max(area.left, r.right + FREE_PAD);
      else if (side === "right") area.right = Math.min(area.right, r.left - FREE_PAD);
      else if (side === "bottom") area.bottom = Math.min(area.bottom, r.top - FREE_PAD);
    }
    this.clear.left = (2 * area.left) / width - 1;
    this.clear.right = (2 * Math.max(area.right, area.left + 80)) / width - 1;
    this.clear.top = 1 - (2 * area.top) / height;
    this.clear.bottom = 1 - (2 * Math.max(area.bottom, area.top + 80)) / height;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.frame_car();
    this.draw();
  }

  /**
   * Fits the stand outline into the clear area at every turn and finds one camera for all of them, so turning the car
   * to a slot, or swapping its parts, never moves the camera. Runs per car and per resize, not per frame.
   */
  private frame_car() {
    const n = this.points.length;
    if (!n) return;
    const { forward, side, up } = axes(0);
    const tan_v = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const tan_h = tan_v * this.camera.aspect;
    const { left, right, bottom, top } = this.clear;
    const total = n * FIT_TURNS;
    const along = { side: new Float64Array(total), up: new Float64Array(total), depth: new Float64Array(total) };
    const turned = new THREE.Vector3();
    for (let t = 0; t < FIT_TURNS; t++)
      this.points.forEach((point, i) => {
        turned.copy(point).applyAxisAngle(THREE.Object3D.DEFAULT_UP, (t / FIT_TURNS) * 2 * Math.PI);
        along.side[t * n + i] = turned.dot(side);
        along.up[t * n + i] = turned.dot(up);
        along.depth[t * n + i] = turned.dot(forward);
      });
    // With the view direction fixed, a camera `d` behind the stand's axis and slid by (x, y) across the view shows a point
    // at screen x = (side_i - x) / (depth_i + d) / tan_h; keeping every point of every turn inside the clear area bounds
    // x and y to an interval per distance, and the intervals only widen as the camera backs off.
    const slide = (d: number) => {
      const range = { x0: -Infinity, x1: Infinity, y0: -Infinity, y1: Infinity };
      for (let i = 0; i < total; i++) {
        const w = along.depth[i] + d;
        if (w <= 0.05) return null;
        range.x0 = Math.max(range.x0, along.side[i] - right * w * tan_h);
        range.x1 = Math.min(range.x1, along.side[i] - left * w * tan_h);
        range.y0 = Math.max(range.y0, along.up[i] - top * w * tan_v);
        range.y1 = Math.min(range.y1, along.up[i] - bottom * w * tan_v);
      }
      return range.x0 <= range.x1 && range.y0 <= range.y1 ? range : null;
    };
    let near = 0.1;
    let far = 400;
    for (let i = 0; i < 40 && slide(far) === null; i++) far *= 2;
    for (let i = 0; i < 28; i++) {
      const mid = (near + far) / 2;
      if (slide(mid)) far = mid;
      else near = mid;
    }
    this.fit_distance = far * FIT_SLACK;
    const range = slide(this.fit_distance) ?? { x0: 0, x1: 0, y0: 0, y1: 0 };
    this.aim_at.set(0, 0, 0).addScaledVector(side, (range.x0 + range.x1) / 2).addScaledVector(up, (range.y0 + range.y1) / 2);
  }

  private draw() {
    const renderer = this.renderer;
    if (!renderer || !this.view) return;
    const { yaw, pitch, zoom } = this.pose;
    this.view.root.rotation.y = yaw;
    this.shadow.mesh.rotation.y = yaw;
    this.camera.position.copy(this.aim_at).addScaledVector(axes(pitch).forward, -this.fit_distance / zoom);
    this.camera.lookAt(this.aim_at);
    renderer.render(this.scene, this.camera);
  }
}

/** The camera's view direction and screen axes, tilted by a drag's `pitch` above the stand's usual angle. */
function axes(pitch: number) {
  const elevation = EYE_ELEVATION + pitch;
  const forward = new THREE.Vector3(Math.sin(EYE_AZIMUTH) * Math.cos(elevation), Math.sin(elevation), Math.cos(EYE_AZIMUTH) * Math.cos(elevation)).negate();
  const side = forward.clone().cross(THREE.Object3D.DEFAULT_UP).normalize();
  return { forward, side, up: side.clone().cross(forward) };
}

/** The car on its stand: unturned, tyres on the floor, so a lower ride shows as the body dropping. */
function stand_view(build: Build): CarView {
  const spec = build_spec(build);
  const view = build_view(build, spec);
  rest_wheels(view, spec);
  view.root.position.y = GROUND - view.body.position.y;
  view.root.updateMatrixWorld(true);
  return view;
}
