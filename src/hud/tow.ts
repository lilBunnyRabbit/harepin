import { TOW_PARAM } from "../review/params";
import "./tow.css";

// Stands in for `TOW` in `car/slipstream.ts`, which is not on master yet: export it there and import it here when slipstream lands.
const TOW_MAX = 0.4;
const FULL_SHARE = 0.95;
/** Steps the cue moves in, so a tow that drifts writes the DOM a few times a second at most. */
const STEPS = 20;
const SVG = "http://www.w3.org/2000/svg";
const ARC_PATH = "M 55.45 144.55 A 63 63 0 1 1 144.55 144.55";

function arc(): SVGElement {
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("class", "tow-arc");
  path.setAttribute("pathLength", "100");
  path.setAttribute("d", ARC_PATH);
  return path;
}

export class TowCue {
  private at = -1;

  constructor(private card: HTMLElement) {
    card.querySelector(".rpm")?.append(Object.assign(document.createElement("i"), { className: "tow-line" }));
    card.querySelector(".dial")?.append(arc());
  }

  set(tow: number) {
    const share = Math.min(1, Math.max(0, tow / TOW_MAX));
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

export function mock_tow(params: URLSearchParams) {
  const card = document.querySelector<HTMLElement>(".bottom-right");
  if (!card) throw new Error("the speedometer card is missing");
  new TowCue(card).set(Number(params.get(TOW_PARAM)) || 0);
}
