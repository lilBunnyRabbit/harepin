import * as THREE from "three";
import { color, glow } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { DECK_STRIDE, DECK_THICK, type Deck } from "../worldgen/types";

/** A prop keeps this far, in metres along the lap, from deck it does not belong to: a crossover's other deck runs through it otherwise. */
const OWN_REACH = 90;
const PYLON_DEEP = 260;
const PYLON_WIDE = 2.6;
/** The beam a pylon carries the deck on: this much wider than the deck, this deep, this long down the track. */
const BEAM = { over: 2, deep: 2.4, long: 2.2 };
const PYLON_ROOM = 2;
/** Most a rigid beam may sink below a twisting deck to clear it; a pylon due where it would sink more moves on down the lap. */
const BEAM_SINK = 0.2;

const MAST_PITCH = 32;
/** A mast stands this far outside the deck's high edge, its head this far over the edge's top. */
const MAST_OUT = 5;
const MAST_OVER = 13;
const MAST_ROOM = 3;
/** No mast this far, in metres along the lap, from an edge whose rail is off: a car carried over the top flies through it. */
const MAST_OPEN_REACH = 15;
/** Furthest past an open rail's end, in metres along the lap, a launched car's line is followed on a gentle bend. */
const MAST_LAUNCH_MOST = 60;
const POST = { wide: 0.7, tall: 60 };
/** The lamp frame leans down at the deck, set back toward it from the post. */
const HEAD = { wide: 7.2, high: 2.6, deep: 0.5, tilt: -0.5, back: 1.2 };
const LAMP = { rows: 2, cols: 4, wide: 1.3, high: 0.8, deep: 0.2, pitch_x: 1.7, pitch_y: 1.1, back: 1.5 };
// At the bloom threshold, not over it: a tier with no bloom clipped a brighter lamp to a plain white grid.
const LAMP_LUMA = 1;

export interface Bowl {
  from: number;
  to: number;
  side: 1 | -1;
}

interface Edge {
  x: number;
  z: number;
  y: number;
  ox: number;
  oz: number;
  yaw: number;
}

class Boxes {
  private readonly matrices: THREE.Matrix4[] = [];
  private readonly tones: THREE.Color[] = [];
  private readonly q = new THREE.Quaternion();
  private readonly euler = new THREE.Euler(0, 0, 0, "YXZ");

  add(tone: THREE.Color, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0, pitch = 0, roll = 0) {
    this.q.setFromEuler(this.euler.set(pitch, yaw, roll));
    this.matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(sx, sy, sz)));
    this.tones.push(tone);
  }

  mesh(material: THREE.Material): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, this.matrices.length);
    this.matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, this.tones[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }
}

class Track {
  readonly n: number;
  readonly length: number;

  constructor(private readonly deck: Deck) {
    this.n = deck.line.length / DECK_STRIDE;
    this.length = this.f(this.n - 1, 8);
  }

  f(i: number, k: number) {
    return this.deck.line[(((i % this.n) + this.n) % this.n) * DECK_STRIDE + k];
  }

  edge(i: number, side: number, out: number): Edge {
    const h = this.f(i, 6);
    const u = side * (h + out);
    const ox = this.f(i, 4) * side;
    const oz = -this.f(i, 3) * side;
    return { x: this.f(i, 0) + this.f(i, 4) * u, z: this.f(i, 2) - this.f(i, 3) * u, y: this.f(i, 1) + side * h * Math.tan(this.f(i, 5)), ox, oz, yaw: Math.atan2(ox, oz) };
  }

  /** Rise of the centreline per metre along the lap, from the samples either side. */
  grade(i: number): number {
    const run = this.run(i);
    return run > 0 ? (this.f(i + 1, 1) - this.f(i - 1, 1)) / run : 0;
  }

  /** How fast the deck's cross slope changes per metre along the lap: where a bank rolls in, the deck twists. */
  twist(i: number): number {
    const run = this.run(i);
    return run > 0 ? Math.abs(Math.tan(this.f(i + 1, 5)) - Math.tan(this.f(i - 1, 5))) / run : 0;
  }

  private run(i: number): number {
    return Math.hypot(this.f(i + 1, 0) - this.f(i - 1, 0), this.f(i + 1, 2) - this.f(i - 1, 2));
  }

  /** Heading change per metre along the lap. */
  curve(i: number): number {
    const run = this.run(i);
    const turn = Math.abs(this.f(i + 1, 3) * this.f(i - 1, 4) - this.f(i + 1, 4) * this.f(i - 1, 3));
    return run > 0 ? Math.asin(Math.min(1, turn)) / run : 0;
  }

  /**
   * Within `reach` of an edge whose rail is off, or on the line a car leaving its far end straight on crosses `out` metres
   * outside the edge: the bend falls away from it as d²/2r, so that is √(2·out·r) on down the lap.
   */
  open_near(i: number, side: number, reach: number, out: number): boolean {
    const s = this.f(i, 8);
    const k = this.curve(i);
    const launch = k > 0 ? Math.min(Math.sqrt((2 * out) / k), MAST_LAUNCH_MOST) : MAST_LAUNCH_MOST;
    return this.deck.open.some((o) => (o.side === 0 || o.side === side) && s >= o.s0 - reach && s <= o.s1 + Math.max(reach, launch));
  }

  clear(i: number, x: number, z: number, room: number): boolean {
    const s = this.f(i, 8);
    for (let k = 0; k < this.n; k++) {
      const away = Math.abs(this.f(k, 8) - s);
      if (Math.min(away, this.length - away) < OWN_REACH) continue;
      if (Math.hypot(this.f(k, 0) - x, this.f(k, 2) - z) < this.f(k, 6) + room) return false;
    }
    return true;
  }

  bowls(min_bank: number): Bowl[] {
    const out: Bowl[] = [];
    let from = -1;
    for (let i = 0; i <= this.n; i++) {
      const banked = i < this.n && Math.abs(this.f(i, 5)) >= min_bank && this.f(i, 7) > 0;
      if (banked && from < 0) from = i;
      if (!banked && from >= 0) {
        out.push({ from, to: i - 1, side: this.f(from, 5) > 0 ? 1 : -1 });
        from = -1;
      }
    }
    return out;
  }

  steps(bowl: Bowl, pitch: number): number[] {
    const out: number[] = [];
    let next = this.f(bowl.from, 8) + pitch / 2;
    for (let i = bowl.from; i <= bowl.to; i++) {
      if (this.f(i, 8) < next) continue;
      out.push(i);
      next += pitch;
    }
    return out;
  }
}

const plain = () => new THREE.MeshLambertMaterial({ flatShading: true });

export interface MastTones {
  post: Lab;
  lamp: Lab;
}

export function masts(deck: Deck, tones: MastTones, min_bank: number): THREE.Object3D[] {
  const track = new Track(deck);
  const posts = new Boxes();
  const lamps = new Boxes();
  const post = color(tones.post);
  const lamp = glow(tones.lamp, LAMP_LUMA);
  const lean = [Math.sin(-HEAD.tilt), Math.cos(HEAD.tilt)];
  for (const bowl of track.bowls(min_bank)) {
    for (const i of track.steps(bowl, MAST_PITCH)) {
      if (track.open_near(i, bowl.side, MAST_OPEN_REACH, MAST_OUT + MAST_ROOM)) continue;
      const e = track.edge(i, bowl.side, MAST_OUT);
      if (!track.clear(i, e.x, e.z, MAST_ROOM)) continue;
      const top = e.y + MAST_OVER;
      posts.add(post, e.x, top - POST.tall / 2, e.z, POST.wide, POST.tall, POST.wide, e.yaw);
      posts.add(post, e.x - e.ox * HEAD.back, top, e.z - e.oz * HEAD.back, HEAD.wide, HEAD.high, HEAD.deep, e.yaw, HEAD.tilt);
      for (let row = 0; row < LAMP.rows; row++) {
        for (let col = 0; col < LAMP.cols; col++) {
          const across = (col - (LAMP.cols - 1) / 2) * LAMP.pitch_x;
          const up = (row - (LAMP.rows - 1) / 2) * LAMP.pitch_y;
          const back = LAMP.back + up * lean[0];
          lamps.add(lamp, e.x - e.ox * back + e.oz * across, top + up * lean[1] + (HEAD.back - LAMP.back) * lean[0], e.z - e.oz * back - e.ox * across, LAMP.wide, LAMP.high, LAMP.deep, e.yaw, HEAD.tilt);
        }
      }
    }
  }
  return [posts.mesh(plain()), lamps.mesh(new THREE.MeshBasicMaterial({ fog: false }))];
}

export function pylons(deck: Deck, tone: Lab, pitch: number): THREE.Object3D {
  const track = new Track(deck);
  const boxes = new Boxes();
  const c = color(tone);
  let next = 0;
  for (let i = 0; i < track.n; i++) {
    if (track.f(i, 8) < next || !track.f(i, 7)) continue;
    const twist = track.twist(i);
    const span = track.f(i, 6) + BEAM.over / 2;
    if ((BEAM.long / 2) * span * twist > BEAM_SINK) continue;
    next = track.f(i, 8) + pitch;
    const x = track.f(i, 0);
    const z = track.f(i, 2);
    if (!track.clear(i, x, z, PYLON_ROOM)) continue;
    // The deck shears with its bank: a point u across lies u·tan(bank) up, its underside DECK_THICK below that. The beam
    // rolls into that plane, and both drop by what the grade and the bank's twist lift their far corners, so neither breaks
    // through the deck.
    const tx = track.f(i, 3);
    const tz = track.f(i, 4);
    const bank = track.f(i, 5);
    const slope = Math.abs(Math.tan(bank));
    const grade = Math.abs(track.grade(i));
    const under = track.f(i, 1) - DECK_THICK;
    const yaw = Math.atan2(tx, tz);
    const beam_top = under - (BEAM.long / 2) * (grade + span * twist);
    const lean = (BEAM.deep / 2) * Math.sin(bank);
    const beam_y = beam_top - (BEAM.deep / 2) * Math.cos(bank);
    boxes.add(c, x + tz * lean, beam_y, z - tx * lean, (span * 2) / Math.cos(bank), BEAM.deep, BEAM.long, yaw, 0, bank);
    const top = under - (PYLON_WIDE / 2) * (slope + grade + (PYLON_WIDE / 2) * twist);
    boxes.add(c, x, top - PYLON_DEEP / 2, z, PYLON_WIDE, PYLON_DEEP, PYLON_WIDE, yaw);
  }
  return boxes.mesh(plain());
}
