import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { build_spec, parse_build, type Build } from "../car/build";
import { ackermann, ride_height } from "../car/car";
import type { CarSpec, Triple } from "../car/cars";
import { contact_shadow, fit_contact_shadow } from "../car/contact-shadow";
import { set_lights, snap_lights, swing_popups } from "../car/lights";
import { build_view, dispose_car_view, rest_wheels, type CarView } from "../car/models";
import { Lighting } from "../render/lighting";
import { sanitise_bloom } from "../render/postfx";
import { Quality } from "../render/quality";
import { brand, color, mix, rgba, tones } from "../theme/palette";
import { on_fill } from "../theme/theme";
import { ASSET_LOOKS } from "./asset-looks";
import { cam_position, type Frame } from "./orbit";
import { view_key, type Cam, type ViewState } from "./view-state";

const STAGE_RADIUS = 80;
/** Metres past the car's far side over which the floor fogs into the backdrop, so the floor shows no horizon. */
const FADE = 14;
const STAGE_RINGS = 24;
const STAGE_SIDES = 64;
const COMPOSER_SAMPLES = 4;
const PIN_PX = 64;
/** Pin size as a share of the view height; it keeps one size on screen at every zoom. */
const PIN_SIZE = 0.045;
const NEAR = 0.05;
const FAR = 400;

export interface PinMark {
  at: Triple;
  n: number;
  picked: boolean;
}

// A floor that fades into the backdrop: the car stands on something without a horizon line to read as a world.
function stage_floor(): THREE.Mesh {
  const inner = new THREE.RingGeometry(0, STAGE_RADIUS, STAGE_SIDES, STAGE_RINGS).rotateX(-Math.PI / 2);
  const floor = color(mix(tones.asphalt, brand.background, 0.55));
  const back = color(brand.background);
  const position = inner.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const tone = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i)) / STAGE_RADIUS;
    tone.copy(floor).lerp(back, THREE.MathUtils.smoothstep(r, 0.1, 1));
    colors.set([tone.r, tone.g, tone.b], i * 3);
  }
  inner.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(inner, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

function pin_texture(n: number, picked: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PIN_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("cars: no 2d canvas for a pin");
  const r = PIN_PX / 2;
  ctx.fillStyle = rgba(brand.background_darkest);
  ctx.beginPath();
  ctx.arc(r, r, r - 1, 0, Math.PI * 2);
  ctx.fill();
  const fill = picked ? "cottontail" : "accent";
  ctx.fillStyle = rgba(brand[fill]);
  ctx.beginPath();
  ctx.arc(r, r, r - 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(brand[on_fill(brand, fill)]);
  ctx.font = `700 ${n > 9 ? 26 : 32}px ${getComputedStyle(document.body).fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), r, r + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Stage {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass | null = null;
  private readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, NEAR, FAR);
  private readonly light: Lighting;
  private readonly shadow = contact_shadow();
  private readonly fog = new THREE.Fog(color(brand.background), 1, 2);
  private radius = 2.5;
  private readonly holder = new THREE.Group();
  private readonly pins = new THREE.Group();
  private readonly ray = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private view: CarView | null = null;
  private spec: CarSpec | null = null;
  /** What stands when it is not the car: a part on its own or a world asset. */
  private asset: THREE.Object3D | null = null;
  private shown = "";
  private lamps = true;

  constructor(params: URLSearchParams) {
    const quality = new Quality(params, "high");
    this.light = new Lighting(this.scene, {}, quality.mobile);
    this.scene.background = color(brand.background);
    this.scene.fog = this.fog;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(quality.ratio);
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.className = "cars-canvas";
    this.scene.add(stage_floor(), this.shadow.mesh, this.holder, this.pins);
    this.shadow.mesh.position.y = 0.02;
    quality.apply(this.renderer, this.scene, this.light.sun);
    this.light.follow(new THREE.Vector3());
    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality.antialias ? COMPOSER_SAMPLES : 0 }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (quality.tier.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), this.light.bloom.strength, this.light.bloom.radius, this.light.bloom.threshold);
      sanitise_bloom(this.bloom);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  get aspect(): number {
    return this.camera.aspect;
  }

  /** The car, or the asset the view names; null when the view names one that is not there. */
  show(view: ViewState): Frame | null {
    const asset = view.asset && !("on" in view.asset && view.asset.on) ? view.asset : null;
    const shown = asset ? `${view_key(view)} ${"world" in asset ? "" : view.code}` : view.code;
    if (shown !== this.shown) {
      const build = asset ? null : parse_build(view.code);
      if (!asset && !build) return null;
      this.clear();
      this.shown = shown;
      if (build) this.show_car(build);
      else if (asset) {
        this.asset = ASSET_LOOKS[asset.kind].build(view);
        if (!this.asset) return null;
        this.asset.traverse((node) => {
          if (node instanceof THREE.Mesh) node.castShadow = true;
        });
        this.holder.add(this.asset);
      }
    }
    if (!this.view && !this.asset) return null;
    return this.frame(asset !== null);
  }

  /** Nothing drawn: an asset the view names is not there, or a part the build does not fit (a stock car's wing). */
  get empty(): boolean {
    return new THREE.Box3().setFromObject(this.holder).isEmpty();
  }

  private clear() {
    if (this.view) {
      this.holder.remove(this.view.root);
      dispose_car_view(this.view);
    }
    if (this.asset) {
      this.holder.remove(this.asset);
      // Shared materials (a sample's kit) are freed too: nothing else on this stage draws with them, and three re-uploads one on its next use.
      this.asset.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.geometry.dispose();
        for (const material of [node.material].flat()) material.dispose();
      });
    }
    this.view = this.spec = this.asset = null;
    this.shadow.mesh.visible = false;
  }

  private show_car(build: Build) {
    const spec = build_spec(build);
    const view = build_view(build, spec);
    rest_wheels(view, spec);
    snap_lights(view, this.lamps);
    view.root.position.y = ride_height(spec);
    view.root.traverse((node) => {
      if (node instanceof THREE.Mesh) node.castShadow = true;
    });
    fit_contact_shadow(this.shadow, spec);
    this.shadow.mesh.visible = true;
    this.holder.add(view.root);
    this.view = view;
    this.spec = spec;
  }

  // The car frames on its own axis; an asset round its box, since a part sits where it bolts on, off the car's middle.
  private frame(off_axis: boolean): Frame | null {
    const box = new THREE.Box3().setFromObject(this.holder);
    if (box.isEmpty()) return null;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.radius = sphere.radius;
    const round = (v: number) => Math.round(v * 1000) / 1000;
    return { centre: off_axis ? [round(sphere.center.x), round(sphere.center.y), round(sphere.center.z)] : [0, sphere.center.y, 0], radius: sphere.radius };
  }

  /** `share` of the car's lock, Ackermann per wheel as the sim turns them. */
  steer(share: number) {
    const { view, spec } = this;
    if (!view || !spec) return;
    const steer = share * spec.lock;
    view.wheels.forEach((wheel, i) => (wheel.rotation.y = view.steered[i] ? -ackermann(steer, spec.wheelbase, spec.wheel.mounts[i][0]) : 0));
  }

  /** Headlamps on or off; pop-up pods swing there over the next frames of `swing`. */
  lights(on: boolean) {
    this.lamps = on;
    if (this.view) set_lights(this.view, on);
  }

  /** Steps pop-up pods; `time` in seconds. True while they still move, so the frame needs drawing. */
  swing(time: number): boolean {
    return this.view ? swing_popups(this.view, time) : false;
  }

  mark(pins: readonly PinMark[]) {
    for (const sprite of this.pins.children)
      if (sprite instanceof THREE.Sprite) {
        sprite.material.map?.dispose();
        sprite.material.dispose();
      }
    this.pins.clear();
    const root = this.root;
    if (!root) return;
    root.updateMatrixWorld();
    for (const pin of pins) {
      const material = new THREE.SpriteMaterial({ map: pin_texture(pin.n, pin.picked), depthTest: false, sizeAttenuation: false, transparent: true });
      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = 10 + (pin.picked ? 1 : 0);
      sprite.scale.setScalar(PIN_SIZE);
      sprite.position.set(...pin.at).applyMatrix4(root.matrixWorld);
      this.pins.add(sprite);
    }
  }

  private get root(): THREE.Object3D | null {
    return this.view?.root ?? this.asset;
  }

  hit(x: number, y: number): Triple | null {
    const root = this.root;
    if (!root) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = this.ray.intersectObject(root, true).find((h) => h.object.visible);
    if (!hit) return null;
    const local = root.worldToLocal(hit.point.clone());
    const mm = (v: number) => Math.round(v * 1000) / 1000;
    return [mm(local.x), mm(local.y), mm(local.z)];
  }

  render(cam: Cam) {
    const [x, y, z] = cam_position(cam);
    this.camera.position.set(x, y, z);
    if (this.camera.fov !== cam.fov) {
      this.camera.fov = cam.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(...cam.target);
    this.fog.near = cam.dist + this.radius * 1.5;
    this.fog.far = this.fog.near + FADE;
    this.composer.render();
  }
}
