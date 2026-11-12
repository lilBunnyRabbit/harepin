import * as THREE from "three";
import { brand, tones } from "../theme/palette";
import { ROAD_HALF } from "../world/world";
import { Beams } from "./beams";
import { LEAD, type Zone } from "./drift";
import { Marks, type Ground } from "./marks";

const LINE = 2;
const TICK_EVERY = 12;
const TICK = { half: 0.5, width: 1.6 };

export class DriftView {
  private readonly marks: Marks;
  private readonly beams: Beams;

  constructor(zone: Zone, ground: Ground) {
    this.marks = new Marks(ground);
    const { points } = zone;
    this.marks.across(points[LEAD], ROAD_HALF, LINE, this.marks.paint(brand.accent));
    this.marks.across(points[points.length - 1], ROAD_HALF, LINE, this.marks.paint(brand.success));
    this.beams = new Beams(this.marks, ground, [points[LEAD], points[points.length - 1]]);
    const tick = this.marks.paint(tones.line, 0.75);
    for (let i = LEAD + TICK_EVERY; i < points.length - TICK_EVERY / 2; i += TICK_EVERY) {
      const p = points[i];
      for (const side of [-1, 1]) {
        const edge = ROAD_HALF + TICK.half;
        this.marks.across({ ...p, x: p.x + p.tz * side * edge, z: p.z - p.tx * side * edge }, TICK.half, TICK.width, tick);
      }
    }
  }

  /** 0 lights the start line's beam, 1 the finish's; past the start its beam goes. */
  aim(index: number) {
    this.beams.aim(index);
    this.beams.groups[0].visible = index === 0;
  }

  update(dt: number) {
    this.beams.update(dt);
  }

  get root(): THREE.Group {
    return this.marks.root;
  }

  dispose() {
    this.marks.dispose();
  }
}
