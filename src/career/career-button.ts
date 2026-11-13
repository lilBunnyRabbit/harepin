import { $ } from "../hud/hud";
import type { TierBadge } from "../net/net";
import { tier_badge } from "./badge";
import { TIERS, type Tier } from "./career";
import { badge_text } from "./rewards";
import "./career-button.css";

export class CareerButton {
  private readonly button = $("career-btn", HTMLButtonElement);
  private tier: Tier | null = null;
  private earned = false;

  /** The tier's champion shield stays muted until its final is won, since that win is what awards it. */
  show(tier: Tier, earned: boolean) {
    if (tier === this.tier && earned === this.earned) return;
    this.tier = tier;
    this.earned = earned;
    const badge = (TIERS.indexOf(tier) + 1) as TierBadge;
    const shield = tier_badge(badge);
    shield.classList.toggle("muted", !earned);
    shield.removeAttribute("title");
    shield.removeAttribute("role");
    shield.removeAttribute("aria-label");
    shield.setAttribute("aria-hidden", "true");
    const label = `Career: ${earned ? badge_text(badge) : tier.name}`;
    this.button.replaceChildren(shield);
    this.button.setAttribute("aria-label", label);
    this.button.title = label;
  }
}
