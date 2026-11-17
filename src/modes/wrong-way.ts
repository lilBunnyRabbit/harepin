import { cos, sin } from "../sim-math";
import type { RoutePoint } from "./route";

/** Facing (1 along the route, -1 against it) below which the car counts as turned round: past about 105 degrees off. */
const TURNED = -0.25;
/** Facing it must regain to count as back: within 60 degrees of the route. */
const BACK = 0.5;
/** Metres past the route's half width that still count as on it. */
const SLACK = 4;

/** Latches when the car faces back down its route and holds until it points along it again, on the route. */
export class WrongWay {
  on = false;

  /** `p`: the route point nearest the car; `offset`: metres from it; `half`: the route's half width. */
  update(p: RoutePoint, heading: number, offset: number, half: number): boolean {
    const facing = sin(heading) * p.tx + cos(heading) * p.tz;
    if (this.on) this.on = facing < BACK || offset > half + SLACK;
    else this.on = facing < TURNED;
    return this.on;
  }

  reset() {
    this.on = false;
  }
}
