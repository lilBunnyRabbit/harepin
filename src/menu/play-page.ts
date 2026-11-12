import type { GoTo } from "../goals/goals";
import { mainland_seed } from "../world/world-pick";
import { WorldKind } from "../worldgen/types";
import { MINIS, WORLDS } from "../worlds/worlds";
import { career_card } from "./career-view";
import { goals_card } from "./goals-view";
import { MenuTab, type Menu, type MenuPage } from "./page";
import { el, icon } from "./setting-rows";
import { picture } from "./widgets";
import { WorldMap } from "./world-map";
import { map_thumb } from "./map-thumb";
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
  ["Create world", "Pick a world, tune it, share its code", "icon-dice", "world"],
  ["Modes", "Races, drift, gymkhana", "icon-modes", "modes"],
] as const;

export class PlayPage implements MenuPage {
  readonly id = MenuTab.PLAY;
  readonly label = "Play";
  private readonly world_map = new WorldMap();
  private players_timer = 0;
  private readonly quit = el("button", "play-quit");
  private readonly quit_label = el("span");

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
    const running = this.menu.host.mode_running();
    this.quit.hidden = running === null;
    this.quit_label.textContent = `Quit ${running ?? ""}`;
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
    if (document.hidden) return;
    this.world_map.show_players(this.menu.host.map_players());
    this.world_map.show_markers(this.menu.host.map_markers());
  }

  build(): HTMLElement[] {
    const page = el("div", "play");
    page.append(this.map(), this.top(), this.side());
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

  private top(): HTMLElement {
    const top = el("div", "play-top");
    this.quit.type = "button";
    this.quit.hidden = true;
    this.quit.append(icon("icon-close"), this.quit_label);
    this.quit.addEventListener("click", () => {
      this.menu.close();
      this.menu.host.quit_mode();
    });
    top.append(this.quit, this.drive());
    return top;
  }

  private side(): HTMLElement {
    const side = el("div", "play-side");
    // A div, not a section: the pad's nearest() keeps focus inside a section, which hid the mini maps from Drive.
    const minis = el("div", "play-group");
    minis.append(el("h3", "play-head", "Mini maps"), this.minis());
    const { career } = this.menu.host;
    side.append(minis, this.more(), career_card(this.menu, career), goals_card(this.menu, this.go_to));
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
      button.title = `${note}. ${kind === host.kind ? "You're here: keep driving" : `Reloads room ${host.room} on ${name}`}`;
      const custom = kind === host.kind && host.code !== null;
      button.append(custom ? map_thumb({ seed: host.seed, kind, levels: host.levels }) : picture(kind), el("b", "", name));
      if (kind === host.kind) button.setAttribute("aria-current", "true");
      button.addEventListener("click", () => this.menu.drive(host.seed, kind, kind === host.kind ? host.levels : undefined));
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
