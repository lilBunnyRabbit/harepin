import { $ } from "../hud/hud";
import "./race-lights.css";

/** Ms the lights stay green once the race is on. */
const GREEN_MS = 1000;

/** The start gantry over the grid: one red more each second of the countdown, all green at the go. */
export class RaceLights {
  private readonly el = $("race-lights");
  private readonly lamps = [...this.el.querySelectorAll("i")];
  private key = "";

  /** `countdown`: ms left before the go; `since_go`: ms since it, negative before. */
  update(countdown: number, since_go: number) {
    const lit = countdown > 0 ? this.lamps.length - Math.ceil(countdown / 1000) + 1 : 0;
    const key = countdown > 0 ? `red${lit}` : since_go < GREEN_MS ? "green" : "off";
    if (key === this.key) return;
    this.key = key;
    this.el.hidden = key === "off";
    this.lamps.forEach((lamp, i) => {
      if (key === "green") lamp.dataset.on = "green";
      else if (i < lit) lamp.dataset.on = "red";
      else delete lamp.dataset.on;
    });
  }

  hide() {
    this.key = "off";
    this.el.hidden = true;
  }
}
