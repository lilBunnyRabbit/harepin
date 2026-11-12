import { CLASS_LABELS } from "../car/pi";
import { MAX_EVENT_STARS, TIERS, current_tier, suggested, tier_max, tier_open, tier_stars, type CareerEvent, type Tier } from "../career/career";
import { event_map, owner_times, type Career } from "../career/career-store";
import { tier_badge } from "../career/badge";
import { badge_open } from "../career/rewards";
import type { TierBadge } from "../net/net";
import { MODES } from "../modes/modes";
import { run_text } from "../modes/result";
import { plain_map, snow_of } from "../worldgen/kinds/kinds";
import { WORLDS } from "../worlds/worlds";
import { MenuTab, type Menu, type MenuPage } from "./page";
import { el, icon } from "./setting-rows";
import { copy_action } from "./widgets";
import "./career.css";

const SUGGESTED = 2;

function world_label(event: CareerEvent): string {
  const map = event_map(event);
  const name = WORLDS[map.kind].name;
  const winter = snow_of(map) !== null && snow_of(plain_map(map.kind, map.seed)) === null;
  return winter ? `Winter ${name.toLowerCase()}` : name;
}

const mode_name = (event: CareerEvent) => MODES.find((mode) => mode.id === event.mode)?.name ?? event.mode;

function car_limit(event: CareerEvent): HTMLElement {
  if ("preset" in event.car) return el("span", "career-preset", event.car.preset);
  const badge = el("span", "class-badge");
  badge.dataset.class = event.car.cap;
  badge.setAttribute("aria-label", `Class ${CLASS_LABELS[event.car.cap]} or lower`);
  badge.append(el("b", "class-badge-letter", CLASS_LABELS[event.car.cap]), el("span", "class-badge-pi", "max"));
  return badge;
}

function stars_of(have: number): HTMLElement {
  const row = el("span", "career-stars");
  row.setAttribute("aria-label", `${have} of ${MAX_EVENT_STARS} stars`);
  row.append("★".repeat(have), el("i", "", "★".repeat(MAX_EVENT_STARS - have)));
  return row;
}

function bar(done: number, of: number): HTMLElement {
  const node = el("span", "goals-bar");
  node.style.setProperty("--done", String(done / of));
  return node;
}

function keep_drawn(menu: Menu, career: Career, draw: () => void) {
  let drawn = -1;
  menu.sync(() => {
    if (career.version === drawn) return;
    drawn = career.version;
    draw();
  });
}

export function career_card(menu: Menu, career: Career): HTMLElement {
  const card = el("div", "menu-tile goals-card career-card");
  keep_drawn(menu, career, () => {
    const tier = current_tier(career.stars);
    const have = tier_stars(career.stars, tier);
    const head = el("div", "goals-head");
    const all = el("button", "goals-all");
    all.type = "button";
    all.dataset.section = "career";
    all.append(el("span", "", "All events"), icon("icon-back"));
    head.append(el("span", "menu-eyebrow", `Career · ${tier.name}`), el("span", "goals-count", `${have} / ${tier_max(tier)} ★`), bar(have, tier_max(tier)), all);
    const next = el("div", "goals-next career-next");
    for (const event of suggested(career.stars, SUGGESTED)) {
      const pick = el("button", "goals-pick");
      pick.type = "button";
      const words = el("span", "goals-words");
      words.append(el("b", "", event.name), el("span", "", `${mode_name(event)} · ${world_label(event)}`));
      pick.append(words, el("span", "goals-go", "Go"));
      pick.addEventListener("click", () => menu.host.start_event(event.id));
      next.append(pick);
    }
    card.replaceChildren(head, next);
  });
  return card;
}

export class CareerPage implements MenuPage {
  readonly id = "career";
  readonly label = "Career";
  readonly parent = MenuTab.PLAY;
  private readonly root = el("div", "career-page");

  constructor(
    private readonly menu: Menu,
    private readonly career: Career,
    /** `?tune`: the owner sets the non-race events' stars from their own runs. */
    private readonly tune: boolean,
  ) {}

  build(): HTMLElement[] {
    return [this.root];
  }

  on_show() {
    const times = this.tune ? [copy_action("Copy my times", owner_times(this.career))] : [];
    this.root.replaceChildren(...times, ...TIERS.map((tier) => this.tier(tier)));
  }

  private tier(tier: Tier): HTMLElement {
    const { stars } = this.career;
    const open = this.tune || tier_open(stars, tier);
    const before = TIERS[TIERS.indexOf(tier) - 1];
    const have = tier_stars(stars, tier);
    const section = el("section", "career-tier");
    section.toggleAttribute("data-locked", !open);
    const head = el("div", "career-head");
    head.append(el("h3", "", tier.name), el("span", "goals-count", `${have} / ${tier_max(tier)} ★`), bar(have, tier_max(tier)));
    if (badge_open(stars, tier)) head.append(tier_badge((TIERS.indexOf(tier) + 1) as TierBadge));
    if (!open && before) {
      const lock = el("span", "career-lock");
      lock.append(icon("icon-lock"), el("span", "", `${tier.opens_at} ★ in ${before.name}`));
      head.append(lock);
    }
    const list = el("ol", "career-list");
    for (const event of tier.events) list.append(this.row(event, open));
    section.append(head, list);
    return section;
  }

  private row(event: CareerEvent, open: boolean): HTMLElement {
    const row = el("li", "career-row");
    const words = el("span", "goals-words");
    const title = el("b", "", event.name);
    if (event.final) title.append(el("small", "career-final", "Final"));
    words.append(title, el("span", "", `${mode_name(event)} · ${world_label(event)}`));
    const best = this.career.best(event);
    const result = el("span", "career-result");
    result.append(stars_of(this.career.stars[event.id] ?? 0), el("small", "", best ? run_text(best) : "--"));
    const go = el("button", "settings-action", "Go");
    go.type = "button";
    go.disabled = !open;
    go.setAttribute("aria-label", `Go: ${event.name}`);
    go.addEventListener("click", () => this.menu.host.start_event(event.id));
    row.append(el("span", "career-id", event.id), words, car_limit(event), result, go);
    return row;
  }
}
