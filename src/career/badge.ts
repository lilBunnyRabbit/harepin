import type { TierBadge } from "../net/net";
import { rgba, tier_metals } from "../theme/palette";
import { TIERS } from "./career";
import { metal_ink } from "./marker-view";
import { badge_text } from "./rewards";
import "./badge.css";

export function tier_badge(tier: TierBadge): HTMLElement {
  const metal = tier_metals[tier - 1];
  const badge = document.createElement("span");
  badge.className = "career-badge";
  badge.style.setProperty("--metal", rgba(metal));
  badge.style.setProperty("--metal-ink", rgba(metal_ink(metal)));
  badge.setAttribute("role", "img");
  badge.setAttribute("aria-label", badge_text(tier));
  badge.title = badge_text(tier);
  const letter = document.createElement("b");
  letter.textContent = TIERS[tier - 1].rewards.badge;
  badge.append(letter);
  return badge;
}
