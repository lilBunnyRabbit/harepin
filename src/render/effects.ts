import * as THREE from "three";
import type { Car } from "../car/car";
import { brand, color, dark, mix, tones } from "../theme/palette";
import { FOG } from "./sky";
import type { World } from "../world";

const PUFFS = 420;
const SMOKE_LIFE = 0.7;
const SMOKE_SIZE = 0.7;
const DUST_LIFE = 0.5;
const DUST_SIZE = 0.25;
const GROWTH = 1;
const SMOKE_RATE = 45;
/** Metres of road a tyre-smoke trail covers before its puffs are gone. */
const SMOKE_TRAIL = 3;
const UP = new THREE.Vector3(0, 1, 0);

interface Puff {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
  size: number;
  spin: number;
}

export class Smoke {
  readonly mesh: THREE.InstancedMesh;
  private puffs: Puff[] = [];
  private next = 0;
  private matrix = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  // Tinted halfway to the fog so tyre smoke sits in the atmosphere instead of reading as solid rock.
  private smoke = FOG.clone().lerp(color(dark ? brand.foreground : brand.background_lightest), 0.5);
  private dust = color(mix(brand.warning, brand.background, 0.3));
  private grass = color(mix(brand.success, brand.background, 0.28));
  private carry: number[] = [];
  private kick = new THREE.Vector3();

  constructor() {
    const material = new THREE.MeshLambertMaterial({ flatShading: true, transparent: true, opacity: 0.35, depthWrite: false, emissive: this.smoke, emissiveIntensity: dark ? 0.3 : 0 });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), material, PUFFS);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < PUFFS; i++) {
      this.puffs.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 1, life: 1, size: 0, spin: 0 });
      this.mesh.setMatrixAt(i, this.matrix.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, this.smoke);
    }
  }

  private emit(at: THREE.Vector3, vel: THREE.Vector3, tint: THREE.Color, size: number, life: number) {
    const i = this.next;
    this.next = (this.next + 1) % PUFFS;
    const p = this.puffs[i];
    p.pos.copy(at);
    p.vel.copy(vel).multiplyScalar(0.25).add(this.kick.set((Math.random() - 0.5) * 1.5, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5));
    p.age = 0;
    p.life = life;
    p.size = size;
    p.spin = Math.random() * 6;
    this.mesh.setColorAt(i, tint);
  }

  update(dt: number, car: Car, world: World) {
    const speed = car.vel.length();
    while (this.carry.length < car.wheels.length) this.carry.push(0);
    car.wheels.forEach((w, i) => {
      if (!w.contact) return;
      const on_road = world.grip(w.point.x, w.point.z) >= 1;
      const slide = Math.max(w.lateral - 1.1, Math.abs(w.slip) - 0.18);
      let rate = 0;
      let tint = this.smoke;
      let size = SMOKE_SIZE;
      // Puffs left behind stream toward the chase camera; capping trail length keeps them from filling the screen at speed.
      let life = Math.min(SMOKE_LIFE, SMOKE_TRAIL / speed);
      if (on_road && slide > 0 && speed > 2) {
        rate = Math.min(1, slide * 1.2) * SMOKE_RATE;
      } else if (!on_road && speed > 4) {
        rate = Math.min(1, speed / 25) * 12 + Math.max(0, slide) * 20;
        tint = world.grip(w.point.x, w.point.z) < 0.8 ? this.grass : this.dust;
        size = DUST_SIZE;
        life = DUST_LIFE;
      }
      this.carry[i] += rate * dt;
      while (this.carry[i] >= 1) {
        this.carry[i] -= 1;
        this.emit(w.point, car.vel, tint, size, life);
      }
    });
    for (let i = 0; i < PUFFS; i++) {
      const p = this.puffs[i];
      if (p.age >= p.life) continue;
      p.age += dt;
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - dt * 1.8);
      p.vel.y += dt * 0.6;
      const t = p.age / p.life;
      const scale = t >= 1 ? 0 : p.size * (0.4 + t * GROWTH) * (1 - t * t);
      this.q.setFromAxisAngle(UP, p.spin + t * 2);
      this.mesh.setMatrixAt(i, this.matrix.compose(p.pos, this.q, this.s.setScalar(scale)));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

const SKID_QUADS = 3000;
/** Share of the ring buffer, oldest first, that fades out before it is overwritten. */
const SKID_FADE = 0.2;
// Dark asphalt is the darkest token, so a mark can only read by sitting a step above it.
const SKID_TONE = dark ? mix(brand.error, brand.background_darkest, 0.1) : tones.skid;

export class Skids {
  readonly mesh: THREE.Mesh;
  private positions = new Float32Array(SKID_QUADS * 6 * 3);
  /** Write count when each vertex was laid, so the shader can fade by age without rewriting the buffer. */
  private laid = new Float32Array(SKID_QUADS * 6).fill(-SKID_QUADS);
  /** Each wheel's last mark point, valid while `marking`. */
  private last: THREE.Vector3[] = [];
  private marking: boolean[] = [];
  private here = new THREE.Vector3();
  private side = new THREE.Vector3();
  private next = 0;
  private written = 0;
  private attribute: THREE.BufferAttribute;
  private laid_attribute: THREE.BufferAttribute;
  private readonly head = { value: 0 };

  constructor() {
    const geometry = new THREE.BufferGeometry();
    this.attribute = new THREE.BufferAttribute(this.positions, 3);
    this.attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", this.attribute);
    this.laid_attribute = new THREE.BufferAttribute(this.laid, 1);
    this.laid_attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("laid", this.laid_attribute);
    const material = new THREE.MeshBasicMaterial({
      color: color(SKID_TONE),
      transparent: true,
      opacity: dark ? 0.6 : 0.4,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.head = this.head;
      shader.vertexShader = shader.vertexShader
        .replace(
          "void main() {",
          `attribute float laid;
          uniform float head;
          varying float v_fade;
          void main() {
            v_fade = clamp((${SKID_QUADS.toFixed(1)} - (head - laid)) / ${(SKID_QUADS * SKID_FADE).toFixed(1)}, 0.0, 1.0);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "varying float v_fade;\nvoid main() {")
        .replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.a *= v_fade;");
    };
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
  }

  update(car: Car, world: World) {
    const { here, side } = this;
    while (this.last.length < car.wheels.length) {
      this.last.push(new THREE.Vector3());
      this.marking.push(false);
    }
    for (let i = 0; i < car.wheels.length; i++) {
      const w = car.wheels[i];
      const sliding = w.contact && car.vel.length() > 3 && (w.lateral > 1.15 || Math.abs(w.slip) > 0.2) && world.grip(w.point.x, w.point.z) >= 1;
      if (!sliding) {
        this.marking[i] = false;
        continue;
      }
      here.copy(w.point);
      here.y = world.height(here.x, here.z, here.y) + 0.1;
      const prev = this.last[i];
      if (!this.marking[i]) {
        prev.copy(here);
        this.marking[i] = true;
        continue;
      }
      if (prev.distanceToSquared(here) < 0.25) continue;
      side.subVectors(here, prev).cross(UP).normalize().multiplyScalar(0.13);
      const o = this.next * 18;
      this.corner(o, prev, 1);
      this.corner(o + 3, here, 1);
      this.corner(o + 6, prev, -1);
      this.corner(o + 9, prev, -1);
      this.corner(o + 12, here, 1);
      this.corner(o + 15, here, -1);
      this.laid.fill(this.written, this.next * 6, this.next * 6 + 6);
      grow_range(this.attribute, o, 18);
      grow_range(this.laid_attribute, this.next * 6, 6);
      this.head.value = ++this.written;
      this.next = (this.next + 1) % SKID_QUADS;
      this.attribute.needsUpdate = true;
      this.laid_attribute.needsUpdate = true;
      prev.copy(here);
    }
  }

  private corner(o: number, at: THREE.Vector3, sign: 1 | -1) {
    const { side } = this;
    this.positions[o] = at.x + sign * side.x;
    this.positions[o + 1] = at.y + sign * side.y;
    this.positions[o + 2] = at.z + sign * side.z;
  }
}

// The renderer uploads and clears the ranges; quads are laid in ring order, so one frame's marks extend the last range.
function grow_range(attribute: THREE.BufferAttribute, start: number, count: number) {
  const last = attribute.updateRanges.at(-1);
  if (last && last.start + last.count === start) last.count += count;
  else attribute.addUpdateRange(start, count);
}
