import type * as THREE from "three";
import { brand } from "../theme/palette";
import { ROAD_HALF } from "../world/world";
import { DUEL_LEAD, type Route } from "./duel";
import { Marks, type Ground } from "./marks";

const LINE = 0.6;

export class DuelView {
  private readonly marks: Marks;

  constructor(route: Route, ground: Ground) {
    this.marks = new Marks(ground);
    this.marks.across(route.points[DUEL_LEAD], ROAD_HALF, LINE, this.marks.paint(brand.accent));
    this.marks.across(route.points[route.points.length - 1], ROAD_HALF, LINE, this.marks.paint(brand.success));
  }

  get root(): THREE.Group {
    return this.marks.root;
  }

  dispose() {
    this.marks.dispose();
  }
}
