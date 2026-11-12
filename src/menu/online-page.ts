import { DirectoryStatus, type Server } from "../net/directory";
import { LOBBY_ROOM } from "../net/room-name";
import { NETWORK_BLOCKED, TURNED_AWAY, WRONG_PASSWORD } from "../net/net";
import { NOT_THIS_CAR } from "../net/lobby";
import { el, icon } from "./setting-rows";
import { world_query } from "../world/world-pick";
import { WORLDS } from "../worlds/worlds";
import type { RaceChoice } from "../modes/races";
import { MenuTab, invite_link, type Menu, type MenuPage } from "./page";
import { LAPS } from "./prefs";
import { join_or_ask, unlock_form, type Unlock } from "./online-join";
import { players_tile } from "./online-players";
import { action, copy_action, info, mosaic, tile } from "./widgets";

const DIRECTORY_NOTE: Record<DirectoryStatus, string> = {
  connecting: "Looking for other games…",
  online: "Games running right now",
  offline: "No other games found. Invite links still work.",
};

const NET_LABEL: Record<string, string> = {
  connecting: "Connecting",
  searching: "Searching for players",
  "local only": "Offline, this browser's tabs only",
  [WRONG_PASSWORD]: "Wrong password",
  [NETWORK_BLOCKED]: "Network blocked",
  [TURNED_AWAY]: "Searching, turned away a wrong password",
};

const BLOCKED_NOTE = "Found a player, but the network blocked the connection (mobile data often does). Try the same Wi-Fi.";

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
    const { room, seed, kind, code } = this.menu.host;
    const players = el("span", "menu-caption");
    this.menu.sync(() => (players.textContent = `${this.menu.host.players()} here · ${WORLDS[kind].name} ${seed}`));
    const invite = el("div", "settings-inline");
    invite.append(copy_action("Copy invite link", invite_link(room, seed, kind, code)));
    const leave_confirm = el("div", "online-confirm");
    if (room !== LOBBY_ROOM) {
      const leave = () => this.menu.go(world_query(LOBBY_ROOM, seed, kind, code));
      invite.append(action("Leave room", () => (this.menu.host.race_busy() || this.menu.host.mode_running() !== null ? (leave_confirm.hidden = false) : leave())));
      const buttons = el("div", "settings-inline");
      buttons.append(action("Leave anyway", leave), action("Stay", () => (leave_confirm.hidden = true)));
      leave_confirm.append(el("span", "", "Leaving ends your race or run."), buttons);
    }
    leave_confirm.hidden = true;
    const room_tile = info("room", "Your room", el("b", "menu-code", room), ...this.net_status(), players, invite, leave_confirm, el("small", "menu-caption", "Friends who open the link join this room on this map"));

    const scroll = el("div", "menu-scroll");
    scroll.append(...this.games());
    const games = info("games", "Games running", scroll);

    const routes = this.menu.host.race_routes;
    const route_of = () => routes.find((r) => r.id === this.race_route) ?? routes[0];
    const picked = () => {
      const route = route_of();
      return { laps: route?.closed === false ? 1 : this.menu.state().laps, route: route?.id ?? "circuit" };
    };
    const repick = () => {
      const { laps, route } = picked();
      this.menu.host.repick_ready(laps, route);
    };
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
        repick();
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
      button.addEventListener("click", () => {
        this.menu.set("laps", count);
        repick();
      });
      laps.append(button);
      return [count, button] as const;
    });
    const lap_row = el("div", "race-lap-row");
    lap_row.append(el("span", "", "Laps"), laps);
    const note = el("small", "menu-caption");
    const ready = action("Ready", () => {
      const { laps, route } = picked();
      this.menu.host.toggle_ready(laps, route);
      this.menu.refresh();
    });
    const race = action("Start race", () => {
      const { laps, route } = picked();
      this.menu.host.toggle_race(laps, route);
      this.menu.refresh();
    });
    const race_actions = el("div", "settings-inline");
    race_actions.append(ready, race);
    const ready_line = el("small", "menu-caption race-ready");
    const record = el("small", "menu-caption");
    this.menu.sync(() => {
      const route = route_of();
      const loop = route?.closed !== false;
      for (const [id, button] of route_buttons) button.setAttribute("aria-checked", String(id === route?.id));
      for (const [count, button] of lap_buttons) {
        button.setAttribute("aria-checked", String(loop ? this.menu.state().laps === count : count === 1));
        button.disabled = !loop && count !== 1;
      }
      const left_out = this.menu.host.race_left_out(picked().route);
      note.textContent = left_out ? NOT_THIS_CAR : loop ? "Everyone in the room starts together." : "A to B routes are one run, start to finish.";
      const busy = this.menu.host.race_busy();
      race.textContent = busy ? "Leave race" : "Start race";
      race.disabled = !busy && left_out;
      const is_ready = this.menu.host.race_ready();
      ready.hidden = busy;
      ready.disabled = !is_ready && left_out;
      ready.textContent = is_ready ? "Cancel ready" : "Ready";
      ready.setAttribute("aria-pressed", String(is_ready));
      ready_line.hidden = busy;
      ready_line.textContent = this.ready_text(routes);
      record.textContent = this.menu.host.lobby_record();
    });
    const race_tile = info("race", "Lobby race", picker, lap_row, note, race_actions, ready_line, record);

    const fresh = tile("new", "New room", "A fresh code, a map, an optional password", icon("icon-dice"), () => this.menu.show("room"));
    return mosaic(MenuTab.ONLINE, room_tile, players_tile(this.menu), games, race_tile, fresh);
  }

  private net_status(): HTMLElement[] {
    const line = el("span", "online-status");
    const blocked = el("small", "online-blocked", BLOCKED_NOTE);
    const versions = el("small", "online-blocked");
    versions.hidden = true;
    let shown = "";
    this.menu.sync(() => {
      const { older, newer } = this.menu.host.version_peers();
      const version_text = [older ? `${older} on an older version` : "", newer ? `${newer} on a newer version, reload to update` : ""].filter(Boolean).join(" · ");
      if (versions.textContent !== version_text) {
        versions.textContent = version_text;
        versions.hidden = !version_text;
      }
      const status = this.menu.host.net_status();
      const peers = this.menu.host.peers();
      const text = status === "online" ? `Online · ${peers} ${peers === 1 ? "player" : "players"} connected` : (NET_LABEL[status] ?? status);
      if (text === shown) return;
      shown = text;
      line.textContent = text;
      line.dataset.state = status === "online" ? "good" : status === "connecting" || status === "searching" ? "wait" : status === TURNED_AWAY ? "none" : "bad";
      blocked.hidden = status !== NETWORK_BLOCKED;
    });
    return [line, blocked, versions];
  }

  private ready_text(routes: readonly RaceChoice[]): string {
    const { names, waiting, total, next, electing, left_out } = this.menu.host.ready_status();
    if (total === 1) return electing ? "Looking for players in the room…" : "Ready starts the race when you're alone.";
    const who = names.length ? ` · ${names.join(", ")}` : "";
    const route = next && routes.find((r) => r.id === next.route);
    const runs = route ? ` · next: ${route.name}${route.closed ? `, ${next.laps} lap${next.laps === 1 ? "" : "s"}` : ""}${left_out ? ", not raced in your car: you sit it out" : ""}` : "";
    return `${names.length}/${total} ready${who} · waiting for ${waiting.join(", ")}${runs}.`;
  }

  private games(): HTMLElement[] {
    const note = el("p", "servers-note");
    const list = el("ol", "servers-list");
    let list_key = "";
    const unlock = unlock_form(this.menu);

    this.menu.sync(() => {
      const servers = this.menu.host.servers();
      note.textContent = DIRECTORY_NOTE[this.menu.host.servers_status()];
      const key = JSON.stringify([servers, this.menu.host.password_failed()]);
      if (key === list_key) return;
      list_key = key;
      list.replaceChildren(...servers.map((server) => this.server_row(server, unlock)));
    });
    return [note, list, unlock.form];
  }

  private server_row(server: Server, unlock: Unlock): HTMLLIElement {
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
    if (server.here && server.locked && this.menu.host.password_failed()) li.append(action("Retry password", () => unlock.ask(server)));
    else if (server.here) li.append(el("span", "servers-tag", "You're here"));
    else if (server.version !== this.menu.host.version) li.append(el("span", "servers-tag", "Different version"));
    else li.append(action("Join", () => join_or_ask(this.menu, unlock, server)));
    return li;
  }
}
