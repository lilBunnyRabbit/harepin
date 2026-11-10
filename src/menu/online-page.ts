import { DirectoryStatus, clean_password, save_lock, type Server } from "../net/directory";
import { el, icon } from "./setting-rows";
import { world_query } from "../world/world-pick";
import { kind_of_world } from "../worldgen/kinds/kinds";
import { WORLDS } from "../worlds/worlds";
import { MenuTab, invite_link, type Menu, type MenuPage } from "./page";
import { LAPS } from "./prefs";
import { action, copy_action, info, invalid, mosaic, password_input, tile } from "./widgets";

const DIRECTORY_NOTE: Record<DirectoryStatus, string> = {
  connecting: "Looking for other games…",
  online: "Games running right now",
  offline: "No other games found. Invite links still work.",
};

export class OnlinePage implements MenuPage {
  readonly id = MenuTab.ONLINE;
  readonly label = "Online";
  private race_route = "circuit";

  constructor(private readonly menu: Menu) {}

  on_show() {
    this.menu.host.browse_servers(true);
  }

  on_hide() {
    this.menu.host.browse_servers(false);
  }

  build(): HTMLElement[] {
    const { room, seed, kind } = this.menu.host;
    const players = el("span", "menu-caption");
    this.menu.sync(() => (players.textContent = `${this.menu.host.players()} here · ${WORLDS[kind].name} ${seed}`));
    const invite = el("div", "settings-inline");
    invite.append(copy_action("Copy invite link", invite_link(room, seed, kind)));
    const room_tile = info("room", "Your room", el("b", "menu-code", room), players, invite, el("small", "menu-caption", "Friends who open the link join this room on this map"));

    const scroll = el("div", "menu-scroll");
    scroll.append(...this.games());
    const games = info("games", "Games running", scroll);

    const routes = this.menu.host.race_routes;
    const route_of = () => routes.find((r) => r.id === this.race_route) ?? routes[0];
    const picker = el("div", "race-routes");
    picker.setAttribute("role", "radiogroup");
    picker.setAttribute("aria-label", "Route");
    const route_buttons = routes.map((choice) => {
      const button = el("button", "race-route");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.append(el("b", "", choice.name), el("small", "", `${(choice.length / 1000).toFixed(1)} km · ${choice.closed ? "loop" : "A to B"}`));
      button.addEventListener("click", () => {
        this.race_route = choice.id;
        this.menu.refresh();
      });
      picker.append(button);
      return [choice.id, button] as const;
    });
    const laps = el("div", "settings-choice race-laps");
    laps.setAttribute("role", "radiogroup");
    laps.setAttribute("aria-label", "Laps");
    const lap_buttons = LAPS.map((count) => {
      const button = el("button", "", String(count));
      button.type = "button";
      button.setAttribute("role", "radio");
      button.addEventListener("click", () => this.menu.set("laps", count));
      laps.append(button);
      return [count, button] as const;
    });
    const lap_row = el("div", "race-lap-row");
    lap_row.append(el("span", "", "Laps"), laps);
    const note = el("small", "menu-caption");
    const race = el("button", "settings-action", "Start race");
    race.type = "button";
    race.addEventListener("click", () => {
      const route = route_of();
      this.menu.host.toggle_race(route?.closed === false ? 1 : this.menu.state().laps, route?.id ?? "circuit");
      this.menu.refresh();
    });
    const record = el("small", "menu-caption");
    this.menu.sync(() => {
      const route = route_of();
      const loop = route?.closed !== false;
      for (const [id, button] of route_buttons) button.setAttribute("aria-checked", String(id === route?.id));
      for (const [count, button] of lap_buttons) {
        button.setAttribute("aria-checked", String(loop ? this.menu.state().laps === count : count === 1));
        button.disabled = !loop && count !== 1;
      }
      note.textContent = loop ? "Everyone in the room starts together." : "A to B routes are one run, start to finish.";
      race.textContent = this.menu.host.race_busy() ? "Leave race" : "Start race";
      record.textContent = this.menu.host.lobby_record();
    });
    const race_tile = info("race", "Lobby race", picker, lap_row, note, race, record);

    const fresh = tile("new", "New room", "A fresh code, a map, an optional password", icon("icon-dice"), () => this.menu.show("room"));
    return mosaic(MenuTab.ONLINE, room_tile, games, race_tile, fresh);
  }

  private join(server: Server, password: string | null) {
    save_lock(server.room, password === null ? null : { password, asked: true });
    this.menu.go(world_query(server.room, server.seed, kind_of_world(server.world)));
  }

  private games(): HTMLElement[] {
    const note = el("p", "servers-note");
    const list = el("ol", "servers-list");
    let list_key = "";

    const unlock = el("form", "servers-unlock");
    unlock.hidden = true;
    const unlock_label = el("span", "servers-unlock-label");
    const secret = password_input("Room password");
    const unlock_join = el("button", "settings-action", "Join");
    unlock_join.type = "submit";
    const unlock_cancel = action("Cancel", () => (unlock.hidden = true));
    const unlock_row = el("div", "settings-inline");
    unlock_row.append(secret, unlock_join, unlock_cancel);
    unlock.append(unlock_label, unlock_row);
    let locked: Server | null = null;
    unlock.addEventListener("submit", (event) => {
      event.preventDefault();
      const password = clean_password(secret.value);
      if (!locked || password === null) return invalid(secret, "Enter the room password");
      this.join(locked, password);
    });
    const ask = (server: Server) => {
      locked = server;
      unlock_label.textContent = `Password for ${server.room}`;
      secret.value = "";
      unlock.hidden = false;
      secret.focus();
    };

    this.menu.sync(() => {
      const servers = this.menu.host.servers();
      note.textContent = DIRECTORY_NOTE[this.menu.host.servers_status()];
      const key = JSON.stringify([servers, this.menu.host.password_failed()]);
      if (key === list_key) return;
      list_key = key;
      list.replaceChildren(...servers.map((server) => this.server_row(server, ask)));
    });
    return [note, list, unlock];
  }

  private server_row(server: Server, ask: (server: Server) => void): HTMLLIElement {
    const li = el("li", "servers-row");
    const name = el("div", "servers-name");
    const room = el("b");
    if (server.locked) {
      const lock = icon("icon-lock");
      lock.setAttribute("aria-label", "Locked");
      lock.setAttribute("aria-hidden", "false");
      room.append(lock);
    }
    room.append(el("span", "", server.room));
    name.append(room, el("small", "", `${server.host} · map ${server.seed}`));
    const players = el("span", "servers-players", `${server.players} ${server.players === 1 ? "player" : "players"}`);
    li.append(name, players);
    if (server.here && server.locked && this.menu.host.password_failed()) li.append(action("Retry password", () => ask(server)));
    else if (server.here) li.append(el("span", "servers-tag", "You're here"));
    else if (server.version !== this.menu.host.version) li.append(el("span", "servers-tag", "Different version"));
    else li.append(action("Join", () => (server.locked ? ask(server) : this.join(server, null))));
    return li;
  }
}
