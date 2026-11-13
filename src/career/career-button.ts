import { $ } from "../hud/hud";
import type { TierBadge } from "../net/net";
import { tier_badge } from "./badge";
import { TIERS, type Tier } from "./career";
import "./career-button.css";

export class CareerButton {
  private readonly button = $("career-btn", HTMLButtonElement);
  private tier: Tier | null = null;

  show(tier: Tier) {
    if (tier === this.tier) return;
    this.tier = tier;
    const shield = tier_badge((TIERS.indexOf(tier) + 1) as TierBadge);
    shield.removeAttribute("title");
    shield.removeAttribute("role");
    shield.removeAttribute("aria-label");
    shield.setAttribute("aria-hidden", "true");
    const label = `Career: ${tier.name}`;
    this.button.replaceChildren(shield);
    this.button.setAttribute("aria-label", label);
    this.button.title = label;
  }
}
