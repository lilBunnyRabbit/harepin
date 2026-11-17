import { $ } from "../hud/hud";
import { StartSteps, type Beep } from "./start-steps";
import "./race-lights.css";

/** The start gantry over the grid: one red more each second of the countdown, all green at the go. */
export class RaceLights {
  private readonly el = $("race-lights");
  private readonly lamps = [...this.el.querySelectorAll("i")];
  private readonly steps = new StartSteps(this.lamps.length);

  /** `countdown`: ms left before the go; `since_go`: ms since it, negative before. Returns the beep of a lamp change. */
  update(countdown: number, since_go: number): Beep | null {
    const from = this.steps.step;
    const beep = this.steps.next(countdown, since_go);
    const step = this.steps.step;
    if (step === from) return null;
    const green = step > this.steps.reds;
    this.el.hidden = step === 0;
    this.lamps.forEach((lamp, i) => {
      if (green) lamp.dataset.on = "green";
      else if (i < step) lamp.dataset.on = "red";
      else delete lamp.dataset.on;
    });
    return beep;
  }

  hide() {
    this.steps.reset();
    this.el.hidden = true;
  }
}
