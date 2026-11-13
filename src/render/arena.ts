import * as THREE from "three";
import { color, glow } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { DECK_STRIDE, DECK_THICK, type Deck } from "../worldgen/types";

/** A prop keeps this far, in metres along the lap, from deck it does not belong to: a crossover's other deck runs through it otherwise. */
const OWN_REACH = 90;
const PYLON_DEEP = 260;

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

  add(tone: THREE.Color, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0, pitch = 0) {
    this.q.setFromEuler(this.euler.set(pitch, yaw, 0));
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
  const lamp = glow(tones.lamp, 1.5);
  for (const bowl of track.bowls(min_bank)) {
    for (const i of track.steps(bowl, 32)) {
      const e = track.edge(i, bowl.side, 5);
      if (!track.clear(i, e.x, e.z, 3)) continue;
      const top = e.y + 13;
      posts.add(post, e.x, top - 30, e.z, 0.7, 60, 0.7, e.yaw);
      posts.add(post, e.x - e.ox * 1.2, top, e.z - e.oz * 1.2, 7.2, 2.6, 0.5, e.yaw, -0.5);
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 4; col++) {
          const across = (col - 1.5) * 1.7;
          const up = (row - 0.5) * 1.1;
          lamps.add(lamp, e.x - e.ox * (1.5 + up * 0.48) + e.oz * across, top + up * 0.88 - 0.14, e.z - e.oz * (1.5 + up * 0.48) - e.ox * across, 1.3, 0.8, 0.2, e.yaw, -0.5);
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
    next = track.f(i, 8) + pitch;
    const x = track.f(i, 0);
    const z = track.f(i, 2);
    if (!track.clear(i, x, z, 2)) continue;
    const y = track.f(i, 1) - DECK_THICK;
    const yaw = Math.atan2(track.f(i, 3), track.f(i, 4));
    boxes.add(c, x, y - 1.2, z, track.f(i, 6) * 2 + 2, 2.4, 2.2, yaw + Math.PI / 2);
    boxes.add(c, x, y - PYLON_DEEP / 2, z, 2.6, PYLON_DEEP, 2.6, yaw);
  }
  return boxes.mesh(plain());
}
