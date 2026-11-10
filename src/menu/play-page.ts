import type { GoTo } from "../goals/goals";
import { mainland_seed } from "../world/world-pick";
import { WorldKind } from "../worldgen/types";
import { MINIS, WORLDS } from "../worlds/worlds";
import { goals_card } from "./goals-view";
import { MenuTab, type Menu, type MenuPage } from "./page";
import { el, icon } from "./setting-rows";
import { picture } from "./widgets";
import { WorldMap } from "./world-map";
import "./play.css";

const PLAYERS_MS = 250;
const MAINLAND = WorldKind.MAINLAND;

// Cars are drawn only on the mainland being driven, so their entries show only there.
const LEGEND = [
  ["You", "cottontail", true],
  ["Circuit", "accent", false],
  ["Players", "secondary", true],
] as const;

const MORE = [
  ["New map", "Any world, any map code", "icon-dice", "world"],
  ["Modes", "Races, drift, gymkhana", "icon-modes", "modes"],
] as const;

export class PlayPage implements MenuPage {
  readonly id = MenuTab.PLAY;
  readonly label = "Play";
  private readonly world_map = new WorldMap();
  private players_timer = 0;

  constructor(
    private readonly menu: Menu,
    private readonly go_to: (to: GoTo) => void,
  ) {}

  private get here(): boolean {
    return this.menu.host.kind === MAINLAND;
  }

  private get seed(): number {
    return mainland_seed(this.menu.host, this.menu.state().last_mainland_seed);
  }

  on_show() {
    this.world_map.show(this.seed, MAINLAND, true);
    clearInterval(this.players_timer);
    if (!this.here) return;
    this.players_timer = window.setInterval(() => this.show_players(), PLAYERS_MS);
    this.show_players();
  }

  on_hide() {
    clearInterval(this.players_timer);
    this.players_timer = 0;
    this.world_map.stop();
  }

  private show_players() {
    if (!document.hidden) this.world_map.show_players(this.menu.host.map_players());
  }

  build(): HTMLElement[] {
    const page = el("div", "play");
    page.append(this.map(), this.side());
    return [page];
  }

  private map(): HTMLElement {
    const badge = el("div", "play-badge");
    badge.append(el("span", "menu-eyebrow", this.here ? "You are here" : "Main world"), el("b", "", `Mainland ${this.seed}`));
    const legend = el("ul", "world-legend play-legend");
    for (const [label, token, cars] of LEGEND) {
      if (cars && !this.here) continue;
      const item = el("li", "", label);
      item.style.setProperty("--swatch", `var(--${token})`);
      legend.append(item);
    }
    legend.append(el("li", "play-soon", "Race events appear here soon"));
    const map = el("div", "play-map");
    map.append(this.world_map.root, badge, legend);
    return map;
  }

  private side(): HTMLElement {
    const side = el("div", "play-side");
    const minis = el("section", "play-group");
    minis.append(el("h3", "play-head", "Mini maps"), this.minis());
    side.append(this.drive(), minis, this.more(), goals_card(this.menu, this.go_to));
    return side;
  }

  private drive(): HTMLElement {
    const title = el("div", "play-title");
    title.append(el("b", "", WORLDS[MAINLAND].name), el("span", "", WORLDS[MAINLAND].pick));
    const go = el("button", "play-go", this.here ? "Keep driving" : "Drive Mainland");
    go.type = "button";
    go.addEventListener("click", () => this.menu.drive(this.seed, MAINLAND));
    const row = el("div", "play-actions");
    row.append(go);
    const card = el("div", "play-drive");
    card.append(title, row);
    return card;
  }

  private minis(): HTMLElement {
    const { host } = this.menu;
    const list = el("div", "play-minis");
    for (const { kind, name, note } of MINIS) {
      const button = el("button", "play-mini");
      button.type = "button";
      button.title = kind === host.kind ? "Keep driving here" : `Reloads room ${host.room} on ${name}`;
      const words = el("span", "play-words");
      words.append(el("b", "", name), el("span", "", note));
      button.append(picture(kind), words);
      if (kind === host.kind) words.prepend(el("span", "menu-tag", "You're here"));
      button.addEventListener("click", () => this.menu.drive(host.seed, kind));
      list.append(button);
    }
    return list;
  }

  private more(): HTMLElement {
    const row = el("div", "play-more");
    for (const [label, note, art, section] of MORE) {
      const button = el("button", "play-link");
      button.type = "button";
      const words = el("span", "play-words");
      words.append(el("b", "", label), el("span", "", note));
      button.append(icon(art), words);
      button.addEventListener("click", () => this.menu.show(section));
      row.append(button);
    }
    return row;
  }
}
