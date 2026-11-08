import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";
import type { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const BLOOM_INPUT_MAX = 32;
const HALF_MAX = 65504;
const PROBE_BLOCK = 16;
const PROBE_MS = 1000;

// The D3D shader compiler drops isnan()/isinf() as "value cannot be NaN" (warning X3577), so test the exponent bits instead.
const NON_FINITE = "any( equal( floatBitsToUint( texel ) & uvec4( 0x7f800000u ), uvec4( 0x7f800000u ) ) )";
const HIGH_PASS_READ = "vec4 texel = texture2D( tDiffuse, vUv );";

// One NaN/Inf scene pixel gets spread by the bloom blur and mip chain into screen-sized rectangles; the high-pass read is bloom's only input.
export function sanitise_bloom(bloom: UnrealBloomPass) {
  const material = bloom.materialHighPassFilter;
  if (!material.fragmentShader.includes(HIGH_PASS_READ)) throw new Error("UnrealBloomPass high-pass shader changed; bloom input is not sanitised");
  material.fragmentShader = material.fragmentShader.replace(
    HIGH_PASS_READ,
    `${HIGH_PASS_READ}
      texel = ${NON_FINITE} ? vec4( 0.0 ) : clamp( texel, 0.0, ${BLOOM_INPUT_MAX.toFixed(1)} );`,
  );
  material.needsUpdate = true;
}

export class NanProbe extends Pass {
  status = "nan probe waiting";
  private readonly material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { source: { value: null } },
    vertexShader: `
      void main() {
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D source;
      out vec4 result;
      void main() {
        ivec2 size = textureSize(source, 0);
        ivec2 origin = ivec2(gl_FragCoord.xy) * ${PROBE_BLOCK};
        float nan = 0.0, inf = 0.0, neg = 0.0, peak = 0.0;
        for (int y = 0; y < ${PROBE_BLOCK}; y++) {
          for (int x = 0; x < ${PROBE_BLOCK}; x++) {
            ivec2 at = origin + ivec2(x, y);
            if (at.x >= size.x || at.y >= size.y) continue;
            vec4 c = texelFetch(source, at, 0);
            uvec4 bits = floatBitsToUint(c);
            bvec4 special = equal(bits & uvec4(0x7f800000u), uvec4(0x7f800000u));
            if (any(special) && any(notEqual(bits & uvec4(0x007fffffu), uvec4(0u)))) nan += 1.0;
            else if (any(special) || any(greaterThan(abs(c), vec4(${HALF_MAX.toFixed(1)})))) inf += 1.0;
            else if (any(lessThan(c, vec4(0.0)))) neg += 1.0;
            else peak = max(peak, max(c.r, max(c.g, c.b)));
          }
        }
        result = vec4(nan, inf, neg, peak);
      }
    `,
  });
  private readonly quad = new FullScreenQuad(this.material);
  private readonly target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, depthBuffer: false });
  private pixels = new Float32Array(4);
  private at = 0;

  constructor() {
    super();
    this.needsSwap = false;
  }

  override setSize(width: number, height: number) {
    const w = Math.ceil(width / PROBE_BLOCK);
    const h = Math.ceil(height / PROBE_BLOCK);
    this.target.setSize(w, h);
    this.pixels = new Float32Array(w * h * 4);
  }

  override render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    const now = performance.now();
    if (now - this.at < PROBE_MS) return;
    this.at = now;
    const previous = renderer.getRenderTarget();
    this.material.uniforms.source.value = read.texture;
    renderer.setRenderTarget(this.target);
    this.quad.render(renderer);
    const { width, height } = this.target;
    renderer.readRenderTargetPixels(this.target, 0, 0, width, height, this.pixels);
    renderer.setRenderTarget(previous);

    let nan = 0;
    let inf = 0;
    let neg = 0;
    let peak = 0;
    let first = -1;
    for (let i = 0; i < width * height; i++) {
      const [n, f, g, p] = this.pixels.subarray(i * 4, i * 4 + 4);
      nan += n;
      inf += f;
      neg += g;
      peak = Math.max(peak, p);
      if (first < 0 && n + f + g > 0) first = i;
    }
    if (first < 0) {
      this.status = `scene finite, peak ${peak.toFixed(2)}`;
      return;
    }
    // Render targets are bottom-up.
    const x = ((first % width) + 0.5) / width;
    const y = 1 - (Math.floor(first / width) + 0.5) / height;
    this.status = `scene NaN ${nan} Inf ${inf} neg ${neg}, first at ${(x * 100).toFixed(0)}%,${(y * 100).toFixed(0)}%`;
    console.warn("render:", this.status);
  }

  override dispose() {
    this.material.dispose();
    this.quad.dispose();
    this.target.dispose();
  }
}
