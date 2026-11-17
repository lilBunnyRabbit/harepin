import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import type { Size } from "../car/cars";
import type { CarPose } from "./camera";

const WIDTH = 384;
const HEIGHT = 96;
const SAMPLES = 4;
/** Vertical, degrees: about 64 across the 4:1 strip. */
const FOV = 18;
const NEAR = 0.4;
// The fog closes just before the far plane, so nothing pops at it.
const FAR = 260;
const FOG_NEAR = 90;
const FOG_FAR = 250;
// Over the tail of a car-sized body, so the player's own car is never in the picture.
const EYE_RISE = 1.05;
const EYE_BACK = 2.45;

/**
 * The rear view, kept cheap: a small target redrawn every other frame, no shadow pass (the main view's map is read as
 * it stands), a short far plane, and `skip` left out. The picture is put on the canvas under the HUD's mirror frame.
 * Desktop only: on the phone tier the second pass cost 1.2-1.9 ms of CPU a frame.
 */
export class Mirror {
  /**
   * Particles, and the trees: their batches are unculled, so a second pass draws every tree in the main view's reach
   * again (1.6 ms of GPU a frame on Mainland).
   */
  skip: readonly THREE.Object3D[] = [];
  private readonly camera = new THREE.PerspectiveCamera(FOV, WIDTH / HEIGHT, NEAR, FAR);
  private readonly target: THREE.WebGLRenderTarget;
  private readonly material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { map: { value: null }, size: { value: new THREE.Vector2(1, 1) }, radius: { value: 0 } },
    vertexShader: `
      varying vec2 v_uv;
      void main() {
        v_uv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    // A mirror swaps left and right: a car on the player's left shows on the left.
    fragmentShader: `
      uniform sampler2D map;
      uniform vec2 size;
      uniform float radius;
      varying vec2 v_uv;
      void main() {
        vec2 corner = abs(v_uv - 0.5) * size - (size * 0.5 - radius);
        if (length(max(corner, 0.0)) > radius) discard;
        gl_FragColor = texture2D(map, vec2(1.0 - v_uv.x, v_uv.y));
        #include <colorspace_fragment>
      }
    `,
  });
  private readonly quad = new FullScreenQuad(this.material);
  private readonly look = new THREE.Vector3();
  private readonly view = new THREE.Vector4();
  private readonly canvas = new THREE.Vector2();
  private readonly shown: boolean[] = [];
  private left = 0;
  private top = 0;
  private width = 0;
  private height = 0;
  private fresh = false;

  constructor() {
    this.target = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, { type: THREE.HalfFloatType, samples: SAMPLES });
    this.material.uniforms.map.value = this.target.texture;
  }

  /** CSS px from the canvas's top left; a zero size draws nothing. */
  place(left: number, top: number, width: number, height: number, radius: number) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
    this.material.uniforms.size.value.set(width, height);
    this.material.uniforms.radius.value = radius;
    this.fresh = false;
  }

  /** Call after the main view is drawn: the picture goes over it. */
  draw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, car: CarPose, size: Size) {
    if (!this.width || !this.height) return;
    if (!this.fresh) this.shoot(renderer, scene, car, size);
    this.fresh = !this.fresh;
    const { view, canvas } = this;
    renderer.getViewport(view);
    renderer.getSize(canvas);
    const clear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setViewport(this.left, canvas.y - this.top - this.height, this.width, this.height);
    this.quad.render(renderer);
    renderer.setViewport(view);
    renderer.autoClear = clear;
  }

  private shoot(renderer: THREE.WebGLRenderer, scene: THREE.Scene, car: CarPose, size: Size) {
    const { camera, skip, shown } = this;
    camera.position.set(0, EYE_RISE * size.height, -EYE_BACK * size.length).applyQuaternion(car.quat).add(car.pos);
    camera.up.set(0, 1, 0).applyQuaternion(car.quat);
    camera.lookAt(this.look.set(0, 0, -1).applyQuaternion(car.quat).add(camera.position));

    const fog = scene.fog instanceof THREE.Fog ? scene.fog : null;
    const fog_near = fog?.near ?? 0;
    const fog_far = fog?.far ?? 0;
    if (fog) {
      fog.near = FOG_NEAR;
      fog.far = FOG_FAR;
    }
    for (let i = 0; i < skip.length; i++) {
      shown[i] = skip[i].visible;
      skip[i].visible = false;
    }
    const shadows = renderer.shadowMap.autoUpdate;
    const matrices = scene.matrixWorldAutoUpdate;
    renderer.shadowMap.autoUpdate = false;
    // The main view has just updated every world matrix.
    scene.matrixWorldAutoUpdate = false;
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    scene.matrixWorldAutoUpdate = matrices;
    renderer.shadowMap.autoUpdate = shadows;
    for (let i = 0; i < skip.length; i++) skip[i].visible = shown[i];
    if (fog) {
      fog.near = fog_near;
      fog.far = fog_far;
    }
  }
}
