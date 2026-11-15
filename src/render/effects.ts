import * as THREE from "three";
import type { Car } from "../car/car";
import { CAR_ORDER, DECAL_ORDER } from "../car/contact-shadow";
import { brand, color, dark, lighten, mix, tones } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { FOG } from "./sky";
import type { World } from "../world/world";
import { SurfaceId } from "../worldgen/types";

const PUFFS = 420;
const SMOKE_LIFE = 0.7;
const SMOKE_SIZE = 0.7;
const DUST_LIFE = 0.5;
const DUST_SIZE = 0.25;
const GROWTH = 1;
/** Seconds a puff takes to swell from nothing, so it never appears at size. */
const RISE = 0.08;
/** Share of its size a puff starts above the contact point: its centre on the ground left half of it buried. */
const SEAT = 0.3;
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

/** Water this deep under a wheel throws spray instead of smoke or dust. */
const SPLASH = 0.05;
const SPRAY_RATE = 30;

/** Seconds a wheel must be off the ground before its touchdown throws a burst. */
const LAND_AIR = 0.25;
/** Metres a second the car must be dropping at touchdown; a kerb hop or a crest at speed throws nothing. */
const LAND_SINK = 2.5;
const LAND_PUFFS = 7;
const LAND_SIZE = 0.45;
// Tarmac throws no dirt, only a breath of tyre smoke: a full burst read as a cloud.
const ROAD_LAND_PUFFS = 4;
const ROAD_LAND_SIZE = 0.3;
const ROAD_LAND_SPREAD = 2.5;
const LAND_LIFE = 0.6;
/** Sideways kick of a burst puff, wider than a trail's so the burst fans out round the tyre. */
const LAND_SPREAD = 5;
const TRAIL_SPREAD = 1.5;

/** What a kind's open ground throws up; a laid surface (trail, scree, packed snow) throws its own. */
export type GroundPuff = "grass" | "dust" | "snow";

// Dust is the ground it came off a step lighter, so it shows against that ground by day and at dusk.
const DUST_LIFT = 0.1;
const kicked = (tone: Lab) => color(lighten(tone, DUST_LIFT));

export class Smoke {
  readonly mesh: THREE.InstancedMesh;
  private puffs: Puff[] = [];
  private next = 0;
  private matrix = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  // Tinted halfway to the fog so tyre smoke sits in the atmosphere instead of reading as solid rock.
  private smoke = FOG.clone().lerp(color(dark ? brand.foreground : brand.background_lightest), 0.5);
  private dust = kicked(tones.dirt);
  // Tyres tear turf down to the soil, and the forest floor is this ground too; the shore throws sand.
  private grass = kicked(mix(tones.grass, tones.dirt, 0.5));
  private sand = kicked(tones.sand);
  private scree = kicked(tones.rock);
  private snow = color(tones.snow);
  private spray = color(mix(tones.snow, tones.water, 0.7));
  private readonly ground: THREE.Color;
  private readonly shoulder: THREE.Color;
  /** What each laid surface throws; the kind's own ground sits in the grass row. */
  private readonly laid: Record<SurfaceId, THREE.Color>;
  private carry: number[] = [];
  /** Seconds each wheel has been off the ground. */
  private air: number[] = [];
  /** How fast the car was dropping last frame: by the touchdown frame the suspension has already caught it. */
  private sink = 0;
  private kick = new THREE.Vector3();
  private at = new THREE.Vector3();

  constructor(ground: GroundPuff) {
    const { dust, sand, scree, snow } = this;
    this.ground = { grass: this.grass, dust: sand, snow }[ground];
    this.shoulder = ground === "snow" ? snow : dust;
    this.laid = {
      [SurfaceId.GRASS]: this.ground,
      [SurfaceId.DIRT]: dust,
      [SurfaceId.HARDPACK]: dust,
      [SurfaceId.SCREE]: scree,
      [SurfaceId.WET]: dust,
      [SurfaceId.SNOW]: snow,
      [SurfaceId.PACKED_SNOW]: snow,
      [SurfaceId.ICE]: snow,
      [SurfaceId.SLUSH]: snow,
      [SurfaceId.LAVA]: dust,
      [SurfaceId.SAND]: sand,
    };
    // Unlit, a puff is a soft flat disc in its own tint, the same by day and at dusk: lit, dusk left it near black.
    const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), material, PUFFS);
    this.mesh.frustumCulled = false;
    // Transparent meshes sort by their origin, and this one's sits at the world's: water drew over the spray on it.
    this.mesh.renderOrder = CAR_ORDER + 1;
    for (let i = 0; i < PUFFS; i++) {
      this.puffs.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 1, life: 1, size: 0, spin: 0 });
      this.mesh.setMatrixAt(i, this.matrix.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, this.smoke);
    }
  }

  private emit(at: THREE.Vector3, vel: THREE.Vector3, tint: THREE.Color, size: number, life: number, spread: number) {
    const i = this.next;
    this.next = (this.next + 1) % PUFFS;
    const p = this.puffs[i];
    p.pos.copy(at);
    p.pos.y += size * SEAT;
    p.vel.copy(vel).multiplyScalar(0.25).add(this.kick.set((Math.random() - 0.5) * spread, 0.8 + Math.random(), (Math.random() - 0.5) * spread));
    p.age = 0;
    p.life = life;
    p.size = size;
    p.spin = Math.random() * 6;
    this.mesh.setColorAt(i, tint);
  }

  /** What a wheel off the road at (x, z) throws: its laid surface, the shore's sand, the kind's own ground, or the shoulder. */
  dust_tint(world: World, x: number, z: number): THREE.Color {
    const laid = world.surface(x, z);
    if (laid !== SurfaceId.GRASS) return this.laid[laid];
    if (world.footing(x, z) !== world.own_ground) return this.shoulder;
    return this.ground === this.grass && world.shore(x, z) ? this.sand : this.ground;
  }

  update(dt: number, car: Car, world: World) {
    const speed = car.vel.length();
    while (this.carry.length < car.wheels.length) {
      this.carry.push(0);
      this.air.push(0);
    }
    for (let i = 0; i < car.wheels.length; i++) {
      const w = car.wheels[i];
      if (!w.contact) {
        this.air[i] += dt;
        continue;
      }
      const landed = this.air[i] > LAND_AIR && this.sink > LAND_SINK;
      this.air[i] = 0;
      const on_road = world.on_road(w.point.x, w.point.z);
      const slide = Math.max(w.lateral - 1.1, Math.abs(w.slip) - 0.18);
      let rate = 0;
      let tint = this.smoke;
      let size = SMOKE_SIZE;
      // Puffs left behind stream toward the chase camera; capping trail length keeps them from filling the screen at speed.
      let life = Math.min(SMOKE_LIFE, SMOKE_TRAIL / speed);
      this.at.copy(w.point);
      if (world.depth(w.point.x, w.point.z) > SPLASH && speed > 2) {
        rate = Math.min(1, speed / 15) * SPRAY_RATE;
        tint = this.spray;
        size = DUST_SIZE;
        life = DUST_LIFE;
        // The wheel stands on the bed: spray thrown from there stayed under the water.
        this.at.y = world.water_level(w.point.x, w.point.z);
      } else if (on_road && slide > 0 && speed > 2) {
        rate = Math.min(1, slide * 1.2) * SMOKE_RATE;
      } else if (!on_road && speed > 4) {
        rate = Math.min(1, speed / 25) * 12 + Math.max(0, slide) * 20;
        tint = this.dust_tint(world, w.point.x, w.point.z);
        size = DUST_SIZE;
        life = DUST_LIFE;
      }
      this.carry[i] += rate * dt;
      while (this.carry[i] >= 1) {
        this.carry[i] -= 1;
        this.emit(this.at, car.vel, tint, size, life, TRAIL_SPREAD);
      }
      if (landed) {
        const smoke = tint === this.smoke;
        const puffs = smoke ? ROAD_LAND_PUFFS : LAND_PUFFS;
        for (let k = 0; k < puffs; k++) this.emit(this.at, car.vel, tint, smoke ? ROAD_LAND_SIZE : LAND_SIZE, LAND_LIFE, smoke ? ROAD_LAND_SPREAD : LAND_SPREAD);
      }
    }
    this.sink = -car.vel.y;
    let alive = false;
    for (let i = 0; i < PUFFS; i++) {
      const p = this.puffs[i];
      if (p.age >= p.life) continue;
      alive = true;
      p.age += dt;
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - dt * 1.8);
      p.vel.y += dt * 0.6;
      const t = p.age / p.life;
      const scale = t >= 1 ? 0 : p.size * (0.4 + t * GROWTH) * (1 - t * t) * Math.min(1, p.age / RISE);
      this.q.setFromAxisAngle(UP, p.spin + t * 2);
      this.mesh.setMatrixAt(i, this.matrix.compose(p.pos, this.q, this.s.setScalar(scale)));
    }
    // A puff's last update writes its zero scale, so once none is left the buffers already hold what they should.
    if (!alive) return;
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
      // Laid 10 cm up to clear the ground between points, a mark drawn after the cars covered their tyres and sills from a
      // low camera. Drawn with the contact patch, before the cars, it blends as normal but in the opaque pass, where
      // NormalBlending would turn blending off.
      transparent: false,
      opacity: dark ? 0.6 : 0.4,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      // Custom blending runs the colour factors on alpha too, which left the frame see-through under every mark: the page
      // behind the canvas showed in them, pale by day.
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
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
    this.mesh.renderOrder = DECAL_ORDER;
  }

  update(car: Car, world: World) {
    const { here, side } = this;
    while (this.last.length < car.wheels.length) {
      this.last.push(new THREE.Vector3());
      this.marking.push(false);
    }
    for (let i = 0; i < car.wheels.length; i++) {
      const w = car.wheels[i];
      const sliding = w.contact && car.vel.length() > 3 && (w.lateral > 1.15 || Math.abs(w.slip) > 0.2) && world.on_road(w.point.x, w.point.z);
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
