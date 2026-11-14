import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { build_spec, parse_build } from "../car/build";
import { ackermann, ride_height } from "../car/car";
import type { CarSpec, Triple } from "../car/cars";
import { contact_shadow, fit_contact_shadow } from "../car/contact-shadow";
import { build_view, dispose_car_view, rest_wheels, type CarView } from "../car/models";
import { Lighting } from "../render/lighting";
import { sanitise_bloom } from "../render/postfx";
import { Quality } from "../render/quality";
import { brand, color, mix, rgba, tones } from "../theme/palette";
import { on_fill } from "../theme/theme";
import { cam_position, type Frame } from "./orbit";
import type { Cam } from "./view-state";

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
  private code = "";

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
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), this.light.bloom.strength, 0.45, this.light.bloom.threshold);
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

  show(code: string): Frame | null {
    if (code !== this.code || !this.view) {
      const build = parse_build(code);
      if (!build) return null;
      if (this.view) {
        this.holder.remove(this.view.root);
        dispose_car_view(this.view);
      }
      const spec = build_spec(build);
      const view = build_view(build, spec);
      rest_wheels(view, spec);
      view.root.position.y = ride_height(spec);
      view.root.traverse((node) => {
        if (node instanceof THREE.Mesh) node.castShadow = true;
      });
      fit_contact_shadow(this.shadow, spec);
      this.holder.add(view.root);
      this.view = view;
      this.spec = spec;
      this.code = code;
    }
    return this.frame();
  }

  private frame(): Frame {
    const box = new THREE.Box3().setFromObject(this.holder);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.radius = sphere.radius;
    return { centre: [0, sphere.center.y, 0], radius: sphere.radius };
  }

  /** `share` of the car's lock, Ackermann per wheel as the sim turns them. */
  steer(share: number) {
    const { view, spec } = this;
    if (!view || !spec) return;
    const steer = share * spec.lock;
    view.wheels.forEach((wheel, i) => (wheel.rotation.y = view.steered[i] ? -ackermann(steer, spec.wheelbase, spec.wheel.mounts[i][0]) : 0));
  }

  mark(pins: readonly PinMark[]) {
    for (const sprite of this.pins.children)
      if (sprite instanceof THREE.Sprite) {
        sprite.material.map?.dispose();
        sprite.material.dispose();
      }
    this.pins.clear();
    const root = this.view?.root;
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

  hit(x: number, y: number): Triple | null {
    const root = this.view?.root;
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
