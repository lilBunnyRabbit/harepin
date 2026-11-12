import { rgba } from "../theme/palette";
import { MAX_EVENT_STARS, TIERS, tier_of, type Stars } from "./career";
import { marker_tone } from "./marker-view";
import type { Marker } from "./markers";
import "./markers.css";

function part(tag: "span" | "b", class_name: string, text = ""): HTMLElement {
  const node = document.createElement(tag);
  node.className = class_name;
  node.textContent = text;
  return node;
}

export class MarkerCard {
  readonly el = document.createElement("div");
  private readonly id = part("b", "event-card-id");
  private readonly name = part("span", "event-card-name");
  private readonly stars = part("span", "event-card-stars");
  private readonly lock = part("span", "event-card-lock");
  private readonly start = document.createElement("button");
  private shown: Marker | null = null;
  private open = false;
  private have = -1;

  constructor(on_start: (id: string) => void) {
    this.el.className = "hud event-card";
    this.el.hidden = true;
    this.el.setAttribute("role", "status");
    this.start.type = "button";
    this.start.textContent = "Start";
    this.start.addEventListener("click", () => {
      if (this.shown) on_start(this.shown.event.id);
    });
    this.el.append(this.id, this.name, this.stars, this.lock, this.start);
  }

  show(marker: Marker | null, open: boolean, stars: Stars) {
    const have = marker ? (stars[marker.event.id] ?? 0) : 0;
    if (marker === this.shown && open === this.open && have === this.have) return;
    this.shown = marker;
    this.open = open;
    this.have = have;
    this.el.hidden = marker === null;
    if (!marker) return;
    const { event } = marker;
    this.id.textContent = event.id;
    this.id.style.setProperty("--metal", rgba(marker_tone(marker, open)));
    this.name.textContent = event.name;
    this.stars.textContent = "★".repeat(have) + "☆".repeat(MAX_EVENT_STARS - have);
    this.stars.setAttribute("aria-label", `${have} of ${MAX_EVENT_STARS} stars`);
    const tier = tier_of(event);
    const before = TIERS[TIERS.indexOf(tier) - 1];
    this.lock.textContent = open ? "" : `Opens at ${tier.opens_at} ★ in ${before?.name ?? "the tier before"}`;
    this.lock.hidden = open;
    this.start.hidden = !open;
  }
}
