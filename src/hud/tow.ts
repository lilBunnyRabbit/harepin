import { TOW_LOOK_PARAM, TOW_PARAM } from "../review/params";
import "./tow.css";

export const TowLook = {
  ICON: "icon",
  EDGE: "edge",
  LINE: "line",
} as const;
export type TowLook = (typeof TowLook)[keyof typeof TowLook];


/** The tow on the bumper of a fast car: the cue reads full there. */
const TOW_FULL = 0.6;
/** Steps the cue moves in, so a tow that drifts writes the DOM a few times a second at most. */
const STEPS = 20;
const SVG = "http://www.w3.org/2000/svg";
const ICON_PATHS = ["M3 7h8", "M2 12h12", "M5 17h6", "M17 8l4 4-4 4"];

const ARC_PATH = "M 55.45 144.55 A 63 63 0 1 1 144.55 144.55";

const look_of = (value: string | null): TowLook => Object.values(TowLook).find((look) => look === value) ?? TowLook.ICON;

function icon(): SVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "tow-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const d of ICON_PATHS) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

function arc(): SVGElement {
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("class", "tow-arc");
  path.setAttribute("pathLength", "100");
  path.setAttribute("d", ARC_PATH);
  return path;
}

export class TowCue {
  private at = -1;

  constructor(
    private card: HTMLElement,
    look: TowLook,
  ) {
    card.dataset.towLook = look;
    if (look === TowLook.ICON) card.querySelector(".speedo")?.append(icon());
    if (look === TowLook.LINE) {
      card.append(Object.assign(document.createElement("i"), { className: "tow-line" }));
      card.querySelector(".dial")?.append(arc());
    }
  }

  set(tow: number) {
    const step = Math.round(Math.min(1, Math.max(0, tow / TOW_FULL)) * STEPS);
    if (step === this.at) return;
    this.at = step;
    this.card.style.setProperty("--tow", String(step / STEPS));
    this.card.toggleAttribute("data-tow", step > 0);
  }
}

export function mock_tow(params: URLSearchParams) {
  const card = document.querySelector<HTMLElement>(".bottom-right");
  if (!card) throw new Error("the speedometer card is missing");
  new TowCue(card, look_of(params.get(TOW_LOOK_PARAM))).set(Number(params.get(TOW_PARAM)) || 0);
}
