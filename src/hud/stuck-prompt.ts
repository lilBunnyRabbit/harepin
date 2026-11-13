import { $ } from "./hud";

const PUSH_S = 2;
const LET_GO_S = 1.5;
const STILL = 1;
const MOVING = 3;

// The auto reset only rights a flipped or drowned car; this catches one wedged upright, where touch has no Reset key.
export class StuckPrompt {
  private readonly el = $("stuck-prompt");
  private readonly rewind = $("stuck-rewind");
  private pushed = 0;
  private idle = 0;

  // Hiding the prompt under a held rewind would drop that finger mid-rewind.
  update(dt: number, speed: number, pushing: boolean, can_rewind: boolean, rewinding: boolean) {
    if (rewinding) return;
    if (speed > MOVING) this.pushed = 0;
    else if (pushing) {
      this.idle = 0;
      if (speed < STILL) this.pushed += dt;
    } else if ((this.idle += dt) > LET_GO_S) this.pushed = 0;
    this.el.hidden = this.pushed < PUSH_S;
    this.rewind.hidden = !can_rewind;
  }
}
