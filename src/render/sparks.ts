import * as THREE from "three";
import type { Car } from "../car/car";
import { brand, color, dark, lighten, mix } from "../theme/palette";

const SPARKS = 96;
/** Speed along a solid (m/s) a scrape needs to throw sparks, and the speed over that where it throws them at full rate. */
const SCRAPE_MIN = 3;
const SCRAPE_FULL = 20;
const SCRAPE_RATE = 220;
/** Speed into a solid (m/s) that throws a burst, and the burst it throws at `HIT_FULL`. */
const HIT_MIN = 5;
const HIT_FULL = 20;
const HIT_SPARKS = 18;
/** Seconds after a burst before another: a car pinned on a wall reports a hit every step. */
const HIT_GAP = 0.25;
const SPARK_LIFE = 0.45;
const SPARK_GRAVITY = 9.8;
/** Share of the car's speed a spark keeps: thrown off a face the car slides past, it stays near where it was struck. */
const SPARK_CARRY = 0.15;
/** Spark speeds (m/s): out of the face, up, and the random fan across both. */
const SPARK_OUT = 2;
const SPARK_UP = 1.5;
const SPARK_FAN = 4;
/** Seconds of travel one streak shows, so a fast spark draws long, and its width in metres. */
const SPARK_STREAK = 0.05;
const SPARK_WIDTH = 0.07;
const FORWARD = new THREE.Vector3(0, 0, 1);
// Hot metal: amber at dusk, a step past the warm orange by day so it shows on asphalt and concrete alike.
const SPARK_TONE = dark ? lighten(mix(brand.warning, brand.error, 0.7), 0.15) : lighten(mix(brand.error, brand.background_darkest, 0.35), 0.08);

interface Spark {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
}

export class Sparks {
  readonly mesh: THREE.InstancedMesh;
  private sparks: Spark[] = [];
  private next = 0;
  private carry = 0;
  private seen = 0;
  private since_hit = HIT_GAP;
  private alive = false;
  private matrix = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private dir = new THREE.Vector3();

  constructor() {
    // Unlit and past tone mapping, so a spark reads hot against a dusk sky and a noon wall the same.
    const material = new THREE.MeshBasicMaterial({ color: color(SPARK_TONE), toneMapped: false, fog: false });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, SPARKS);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < SPARKS; i++) {
      this.sparks.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 1, life: 0 });
      this.mesh.setMatrixAt(i, this.matrix.makeScale(0, 0, 0));
    }
  }

  update(dt: number, car: Pick<Car, "scrape" | "vel">) {
    const { scrape } = car;
    this.since_hit += dt;
    if (scrape.hits !== this.seen) {
      this.seen = scrape.hits;
      const scrape_share = Math.min(1, (scrape.slide - SCRAPE_MIN) / (SCRAPE_FULL - SCRAPE_MIN));
      if (scrape_share > 0) this.carry += scrape_share * SCRAPE_RATE * dt;
      if (scrape.into > HIT_MIN && this.since_hit >= HIT_GAP) {
        this.since_hit = 0;
        this.carry += HIT_SPARKS * Math.min(1, scrape.into / HIT_FULL);
      }
      while (this.carry >= 1) {
        this.carry -= 1;
        this.emit(car);
      }
    } else this.carry = 0;
    if (!this.alive) return;
    let alive = false;
    for (let i = 0; i < SPARKS; i++) {
      const p = this.sparks[i];
      if (p.age >= p.life) continue;
      p.age += dt;
      if (p.age >= p.life) {
        this.mesh.setMatrixAt(i, this.matrix.makeScale(0, 0, 0));
        continue;
      }
      alive = true;
      p.vel.y -= SPARK_GRAVITY * dt;
      p.pos.addScaledVector(p.vel, dt);
      const speed = p.vel.length();
      const fade = 1 - p.age / p.life;
      this.q.setFromUnitVectors(FORWARD, this.dir.copy(p.vel).divideScalar(speed || 1));
      this.s.set(SPARK_WIDTH * fade, SPARK_WIDTH * fade, Math.max(SPARK_WIDTH, speed * SPARK_STREAK) * fade);
      this.mesh.setMatrixAt(i, this.matrix.compose(p.pos, this.q, this.s));
    }
    this.alive = alive;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  // Thrown off the face along the way the car slides, up and out of the solid, fanned so a burst never reads as a line.
  private emit(car: Pick<Car, "scrape" | "vel">) {
    const { scrape, vel } = car;
    const i = this.next;
    this.next = (this.next + 1) % SPARKS;
    const p = this.sparks[i];
    const out = SPARK_OUT * (1 + Math.random() * 2);
    p.pos.set(scrape.x, scrape.y, scrape.z);
    p.vel.set(
      vel.x * SPARK_CARRY + scrape.nx * out + (Math.random() - 0.5) * SPARK_FAN,
      SPARK_UP * (1 + Math.random() * 2),
      vel.z * SPARK_CARRY + scrape.nz * out + (Math.random() - 0.5) * SPARK_FAN,
    );
    p.age = 0;
    p.life = SPARK_LIFE * (0.5 + Math.random() * 0.5);
    this.alive = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
