import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Lighting } from "./lighting";
import { NanProbe, sanitise_bloom } from "./postfx";
import type { Quality } from "./quality";

// Canvas-bug bisect switches for ?debug, combined with ?quality=medium: each changes one piece of the bloom path.
const BISECT = ["nobloom", "nocomposer", "noblur", "alpha", "bloomfull"] as const;
type Bisect = (typeof BISECT)[number];
const DEBUG_MS = 250;
const COMPOSER_SAMPLES = 4;

export class Render {
  readonly renderer: THREE.WebGLRenderer;
  readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly bisect: Set<Bisect>;
  private readonly nan_probe: NanProbe | null;
  private readonly debug: boolean;
  private debug_overlay: HTMLPreElement | null = null;
  private debug_at = 0;
  private fitted = "";
  private size_report = "";
  private render_report = "";

  constructor(
    params: URLSearchParams,
    private readonly quality: Quality,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly light: Lighting,
  ) {
    this.bisect = new Set(BISECT.filter((flag) => params.has(flag)));
    this.debug = params.has("debug");
    this.renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: "high-performance", alpha: this.bisect.has("alpha"), premultipliedAlpha: true });
    this.renderer.setPixelRatio(quality.ratio);
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // The composer draws into its own target, so the backbuffer's antialias never reaches the screen: the target multisamples instead.
    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(buffer.x, buffer.y, { type: THREE.HalfFloatType, samples: quality.antialias ? COMPOSER_SAMPLES : 0 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), light.bloom.strength, 0.45, light.bloom.threshold);
    if (!this.bisect.has("bloomfull")) {
      const set_size = bloom.setSize.bind(bloom);
      bloom.setSize = (width, height) => set_size(Math.round(width / 2), Math.round(height / 2));
    }
    sanitise_bloom(bloom);
    this.bloom = bloom;
    this.nan_probe = this.debug ? new NanProbe() : null;
    if (this.nan_probe) this.composer.addPass(this.nan_probe);
    if (!this.bisect.has("nobloom")) this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());
  }

  mount(app: HTMLElement) {
    document.body.classList.toggle("no-blur", this.bisect.has("noblur"));
    app.append(this.renderer.domElement);
  }

  apply_quality() {
    this.quality.apply(this.renderer, this.scene, this.light.sun);
  }

  private get composer_on() {
    return this.quality.tier.bloom && !this.bisect.has("nocomposer");
  }

  // CSS owns the canvas size; this only matches the drawing buffer to it. Polled every frame because a resize event can
  // be missed (tab opened in the background, snapped window, zoom while hidden) and would leave the buffer stale.
  fit(app: HTMLElement) {
    const width = app.clientWidth;
    const height = app.clientHeight;
    const ratio = this.quality.ratio;
    const key = `${width}x${height}@${ratio}`;
    if (key === this.fitted || !width || !height) return;
    this.fitted = key;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  draw() {
    if (this.composer_on) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // Runs after the frame is drawn, so viewport and scissor are what that frame actually left behind.
  check_size(now: number) {
    if (!import.meta.env.DEV && !this.debug) return;
    if (this.debug && !this.debug_overlay) this.debug_overlay = document.body.appendChild(Object.assign(document.createElement("pre"), { id: "debug" }));
    const { renderer, bisect } = this;
    const gl = renderer.getContext();
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const viewport = gl.getParameter(gl.VIEWPORT) as Int32Array;
    const scissor = gl.getParameter(gl.SCISSOR_BOX) as Int32Array;
    const report = [
      `window ${innerWidth}x${innerHeight} @${devicePixelRatio}`,
      `canvas css ${rect.left},${rect.top} ${rect.width}x${rect.height}`,
      `buffer ${canvas.width}x${canvas.height}`,
      `drawing ${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`,
      `viewport ${[...viewport].join(",")}`,
      `scissor ${gl.isEnabled(gl.SCISSOR_TEST) ? "on" : "off"} ${[...scissor].join(",")}`,
      `ratio ${renderer.getPixelRatio()} tier ${this.quality.level}`,
      `target ${renderer.getRenderTarget() === null ? "screen" : "offscreen"}`,
      `composer ${this.composer_on ? "on" : "off"} bloom ${this.composer_on && !bisect.has("nobloom") && this.bloom.enabled ? "on" : "off"} shadows ${renderer.shadowMap.enabled ? "on" : "off"}`,
      `bisect ${[...bisect].join(" ") || "none"}`,
    ].join(" | ");
    if (report !== this.render_report) {
      this.render_report = report;
      console.info("render:", report);
    }
    if (this.debug_overlay && now - this.debug_at > DEBUG_MS) {
      this.debug_at = now;
      const probe = this.composer_on ? (this.nan_probe?.status ?? "") : "scene n/a (no composer)";
      this.debug_overlay.textContent = `${report.replaceAll(" | ", "\n")}\n${probe}`;
    }
    const ok =
      Math.abs(rect.width - innerWidth) < 1 &&
      Math.abs(rect.height - innerHeight) < 1 &&
      canvas.width === gl.drawingBufferWidth &&
      canvas.height === gl.drawingBufferHeight &&
      viewport[2] === canvas.width &&
      viewport[3] === canvas.height;
    if (!ok && report !== this.size_report) console.warn("canvas size mismatch:", report);
    this.size_report = ok ? "" : report;
  }
}
