import { EVENTS, MAX_EVENT_STARS, TIERS, current_tier, suggested, tier_max, tier_of, tier_open, tier_stars, type CareerEvent, type Stars, type Tier } from "../career/career";
import { event_map, type Career } from "../career/career-store";
import { tier_badge } from "../career/badge";
import type { TierBadge } from "../net/net";
import { car_limit, keep_drawn, mode_name, world_label } from "./career-view";
import type { Menu } from "./page";
import { el, icon } from "./setting-rows";
import { picture } from "./widgets";
import "./class-badge.css";
import "./career-hero.css";

const PICKS = 3;

// Only the last tier can be all 3-starred while open; then any open event short of 3 stars comes next.
function up_next(stars: Stars): CareerEvent[] {
  const here = suggested(stars, PICKS);
  if (here.length) return here;
  return EVENTS.filter((event) => (stars[event.id] ?? 0) < MAX_EVENT_STARS && tier_open(stars, tier_of(event))).slice(0, PICKS);
}

function head(tier: Tier, have: number): HTMLElement {
  const shield = tier_badge((TIERS.indexOf(tier) + 1) as TierBadge);
  shield.removeAttribute("title");
  shield.setAttribute("aria-hidden", "true");
  const name = el("span", "career-hero-tier");
  name.append(el("span", "menu-eyebrow", "Career"), el("b", "", tier.name));
  const count = el("span", "career-hero-count");
  count.append(el("b", "", String(have)), ` / ${tier_max(tier)} ★`);
  const row = el("div", "career-hero-head");
  row.append(shield, name, count);
  return row;
}

function track(stars: Stars, tier: Tier, have: number): HTMLElement {
  const max = tier_max(tier);
  const next = TIERS[TIERS.indexOf(tier) + 1];
  const bar = el("div", "career-hero-bar");
  bar.style.setProperty("--done", String(have / max));
  const words = el("div", "career-hero-words");
  words.append(el("span", "", `${have} stars in ${tier.name}`));
  if (next && !tier_open(stars, next)) {
    bar.append(el("span", "career-hero-gate"));
    bar.style.setProperty("--gate", String(next.opens_at / max));
    const lock = el("span", "career-hero-lock");
    lock.append(icon("icon-lock"), `${next.name} opens at ${next.opens_at} ★`);
    words.append(lock);
  } else {
    words.append(el("span", "career-hero-lock", have === max ? `Every ${tier.name} event at 3 ★` : "Last tier"));
  }
  const node = el("div", "career-hero-track");
  node.append(bar, words);
  return node;
}

function next_card(event: CareerEvent): HTMLElement {
  const title = el("span", "career-hero-title");
  title.append(el("b", "", event.name), car_limit(event));
  const words = el("span", "career-hero-text");
  words.append(el("span", "menu-eyebrow", `Next event · ${event.id}`), title, el("span", "career-hero-note", `${mode_name(event)} · ${world_label(event)}`));
  const card = el("div", "career-hero-next");
  card.append(picture(event_map(event).kind), words);
  return card;
}

function all_events(): HTMLElement {
  const all = el("button", "goals-all");
  all.type = "button";
  all.dataset.section = "career";
  all.append(el("span", "", "All events"), icon("icon-back"));
  return all;
}

function then_row(menu: Menu, events: CareerEvent[]): HTMLElement {
  const row = el("div", "career-hero-then");
  for (const event of events) {
    const pick = el("button", "career-hero-pick");
    pick.type = "button";
    pick.append(event.name);
    pick.title = `${mode_name(event)} · ${world_label(event)}`;
    pick.addEventListener("click", () => menu.host.start_event(event.id));
    row.append(pick);
  }
  row.append(all_events());
  return row;
}

export function career_hero(menu: Menu, career: Career): HTMLElement {
  const card = el("div", "career-hero");
  keep_drawn(menu, career, () => {
    const tier = current_tier(career.stars);
    const have = tier_stars(career.stars, tier);
    const [next, ...then] = up_next(career.stars);
    const go = el("button", "play-go", next ? "Continue career" : "All events");
    go.type = "button";
    if (next) go.addEventListener("click", () => menu.host.start_event(next.id));
    else go.dataset.section = "career";
    const top = [head(tier, have), track(career.stars, tier, have)];
    card.replaceChildren(...top, ...(next ? [next_card(next), go, then_row(menu, then)] : [go]));
  });
  return card;
}
