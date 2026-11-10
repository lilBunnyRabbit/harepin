import { build_code, type Build } from "./build";
import type { Driver } from "./driver";
import type { Garage } from "./garage";
import type { CarState, Net } from "./net";
import type { Race } from "./race";

const HEARTBEAT_MS = 50;

// Builds before 0.5.0 reject suspension 3, builds before nitro reject its tail digit and builds before the aero kits
// reject aero 3 and 4, each showing the whole car as a stock coupe; peers never see suspension, see a kit as its wing,
// and see nitro by the `boost` flame flag.
export function peer_build(build: Build): string {
  return build_code({ ...build, parts: { ...build.parts, suspension: Math.min(build.parts.suspension, 2), aero: Math.min(build.parts.aero, 2), nitro: 0 } });
}

// A timer, not the render loop: rAF stops in a background tab, and a silent peer gets pruned by everyone else.
export class Heartbeat {
  private timer = 0;

  constructor(
    private readonly net: Net,
    private readonly garage: Garage,
    private readonly driver: Driver,
    private readonly race: Race,
    private readonly seed: number,
  ) {}

  start() {
    this.timer = window.setInterval(() => this.beat(), HEARTBEAT_MS);
  }

  stop() {
    clearInterval(this.timer);
  }

  private beat() {
    const { net, garage, race } = this;
    const car = this.driver.car;
    const state: CarState = {
      id: net.id,
      name: net.name,
      paint: garage.build.paint,
      b: peer_build(garage.build),
      seed: this.seed,
      t: performance.now(),
      p: car.pos.toArray() as CarState["p"],
      q: car.quat.toArray() as CarState["q"],
      v: car.vel.toArray() as CarState["v"],
      steer: car.steer,
      brake: car.braking > 0.05,
      boost: car.nitro.boosting,
      best: race.best,
    };
    net.send(state);
  }
}
