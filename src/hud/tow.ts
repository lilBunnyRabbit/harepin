import { TOW } from "../car/slipstream";
import "./tow.css";

/** Share of the most tow past which the cue reads as full: the wake's edge and taper rarely give all of it. */
const FULL_SHARE = 0.95;
/** Steps the cue moves in, so a tow that drifts writes the DOM a few times a second at most. */
const STEPS = 20;

export class TowCue {
  private at = -1;

  constructor(private readonly card: HTMLElement) {}

  set(tow: number) {
    const share = Math.min(1, Math.max(0, tow / TOW));
    const full = share >= FULL_SHARE;
    const step = full ? STEPS : Math.round(share * STEPS);
    const key = full ? STEPS + 1 : step;
    if (key === this.at) return;
    this.at = key;
    this.card.style.setProperty("--tow", String(step / STEPS));
    if (step === 0) delete this.card.dataset.tow;
    else this.card.dataset.tow = full ? "full" : "part";
  }
}
