import type * as THREE from "three";
import { brand, tones } from "../theme/palette";
import { ramp_world } from "../worldgen/jumps";
import type { Jump, Landing } from "./jump";
import { Marks, type Ground } from "./marks";

const LINE = 0.8;
const TICK = { half: 0.6, width: 2.4, out: 1.6 };
const LANDING = { half: 2.2, width: 0.9 };

export class JumpView {
  private readonly marks: Marks;
  private readonly landing: THREE.MeshBasicMaterial;
  private readonly best: THREE.MeshBasicMaterial;
  private best_mark: THREE.Mesh | null = null;

  constructor(
    private readonly jump: Jump,
    ground: Ground,
  ) {
    this.marks = new Marks(ground);
    const { ramp, lip, marks } = jump;
    this.marks.across(lip, ramp.hw, LINE, this.marks.paint(brand.accent));
    // The star distances stand beside the landing, clear of where the car comes down, as drift's ticks do along a zone.
    const ticks = [
      { d: marks.two, material: this.marks.paint(tones.line, 0.75) },
      { d: marks.three, material: this.marks.paint(brand.warning) },
    ];
    for (const { d, material } of ticks)
      for (const side of [-1, 1]) {
        const [x, z] = ramp_world(ramp, side * (ramp.hw + TICK.out), ramp.length + d);
        this.marks.across({ x, z, tx: ramp.fx, tz: ramp.fz }, TICK.half, TICK.width, material);
      }
    this.landing = this.marks.paint(tones.line, 0.6);
    this.best = this.marks.paint(brand.success);
  }

  land(at: Landing, best: boolean) {
    const { ramp } = this.jump;
    const mark = this.marks.across({ x: at.x, z: at.z, tx: ramp.fx, tz: ramp.fz }, LANDING.half, LANDING.width, best ? this.best : this.landing);
    if (!best) return;
    if (this.best_mark) this.best_mark.material = this.landing;
    this.best_mark = mark;
  }

  get root(): THREE.Group {
    return this.marks.root;
  }

  dispose() {
    this.marks.dispose();
  }
}
