import { $ } from "./hud";
import { StuckTimer } from "./stuck";

// The auto reset only rights a flipped or drowned car; this catches one wedged upright, where touch has no Reset key.
export class StuckPrompt {
  private readonly el = $("stuck-prompt");
  private readonly rewind = $("stuck-rewind");
  private readonly timer = new StuckTimer();

  /** A reset, teleport or countdown starts the car afresh: whatever it pushed against before no longer counts. */
  clear() {
    this.timer.clear();
    this.el.hidden = true;
  }

  // A rewind clears the count, but the prompt stays up while it is held: hiding it would drop that finger mid-rewind.
  update(dt: number, speed: number, pushing: boolean, can_rewind: boolean, rewinding: boolean) {
    if (rewinding) {
      this.timer.clear();
      return;
    }
    this.timer.update(dt, speed, pushing);
    this.el.hidden = !this.timer.stuck;
    this.rewind.hidden = !can_rewind;
  }
}
