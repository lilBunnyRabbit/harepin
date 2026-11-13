import type { TierBadge } from "../net/net";
import { rgba, tier_metals } from "../theme/palette";
import { TIERS } from "./career";
import { metal_ink } from "./marker-view";
import { badge_text } from "./rewards";
import "./badge.css";

export interface TierLook {
  metal: string;
  ink: string;
  letter: string;
  text: string;
}

export function tier_look(tier: TierBadge): TierLook {
  const metal = tier_metals[tier - 1];
  return { metal: rgba(metal), ink: rgba(metal_ink(metal)), letter: TIERS[tier - 1].rewards.badge, text: badge_text(tier) };
}

export function tier_badge(tier: TierBadge): HTMLElement {
  const look = tier_look(tier);
  const badge = document.createElement("span");
  badge.className = "career-badge";
  badge.style.setProperty("--metal", look.metal);
  badge.style.setProperty("--metal-ink", look.ink);
  badge.setAttribute("role", "img");
  badge.setAttribute("aria-label", look.text);
  badge.title = look.text;
  const letter = document.createElement("b");
  letter.textContent = look.letter;
  badge.append(letter);
  return badge;
}
