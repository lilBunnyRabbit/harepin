import { paint_lab } from "../car/paint";
import { DECAL_NAMES } from "../menu/garage-items";
import { decal_tile } from "../menu/garage-widgets";
import type { TierBadge } from "../net/net";
import { rgba } from "../theme/palette";
import { tier_badge } from "./badge";
import { TIERS } from "./career";
import { metal_ink } from "./marker-view";
import { badge_text, reward_paint_name, type Reward } from "./rewards";
import "./unlock-card.css";

const KIND_LABEL: Record<Reward["kind"], string> = { paint: "Paint", decal: "Decal", badge: "Badge" };

function look(reward: Reward): Element {
  const { tier } = reward;
  if (reward.kind === "badge") return tier_badge((TIERS.indexOf(tier) + 1) as TierBadge);
  if (reward.kind === "decal") return decal_tile(tier.rewards.decal);
  const swatch = document.createElement("i");
  swatch.className = "garage-swatch";
  swatch.dataset.metal = "";
  swatch.style.setProperty("--swatch", rgba(paint_lab(tier.rewards.paint)));
  return swatch;
}

function title(reward: Reward): string {
  const { tier } = reward;
  if (reward.kind === "paint") return reward_paint_name(tier);
  if (reward.kind === "decal") return DECAL_NAMES[tier.rewards.decal];
  return badge_text((TIERS.indexOf(tier) + 1) as TierBadge);
}

/** The rewards a run just earned; the button tries the first garage one on, a badge alone has none. */
export function unlock_card(rewards: Reward[], try_on: (reward: Reward) => void): HTMLElement {
  const card = document.createElement("section");
  card.className = "unlock-card";
  card.setAttribute("aria-label", "Unlocked");
  const head = document.createElement("h3");
  head.textContent = "Unlocked";
  const list = document.createElement("ul");
  for (const reward of rewards) {
    const paint = paint_lab(reward.tier.rewards.paint);
    const row = document.createElement("li");
    row.style.setProperty("--decal-paint", rgba(paint));
    row.style.setProperty("--decal-ink", rgba(metal_ink(paint)));
    const name = document.createElement("b");
    name.textContent = title(reward);
    const kind = document.createElement("small");
    kind.textContent = KIND_LABEL[reward.kind];
    const text = document.createElement("span");
    text.className = "unlock-text";
    text.append(name, kind);
    row.title = `${title(reward)} · ${KIND_LABEL[reward.kind]}`;
    row.append(look(reward), text);
    list.append(row);
  }
  card.append(head, list);
  const target = rewards.find((reward) => reward.kind !== "badge");
  if (target) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Try it in the garage";
    button.addEventListener("click", () => try_on(target));
    card.append(button);
  }
  return card;
}
