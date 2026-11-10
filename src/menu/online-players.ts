import { DirectoryStatus, LOBBY_ROOM } from "../net/directory";
import { country_name, flag } from "../net/country";
import { ping_class, type Player } from "../net/players";
import { el, icon } from "./setting-rows";
import { kind_of_world } from "../worldgen/kinds/kinds";
import { WORLDS } from "../worlds/worlds";
import type { Menu } from "./page";
import { join_or_ask, unlock_form } from "./online-join";
import { action, info } from "./widgets";

const NOTE: Record<DirectoryStatus, string> = {
  connecting: "Looking for players…",
  online: "Players with the Online tab open",
  offline: "Nobody else has the Online tab open right now.",
};

function place(player: Player): HTMLElement {
  const line = el("small", "players-place");
  const parts: (string | Node)[] = [];
  if (player.country) parts.push(`${flag(player.country)} ${country_name(player.country)}`);
  const map = `${WORLDS[kind_of_world(player.world)].name} ${player.seed}`;
  if (player.room === LOBBY_ROOM) parts.push(`Free roam · ${map}`);
  else {
    const room = el("span", "players-room");
    if (player.locked) {
      const lock = icon("icon-lock");
      lock.setAttribute("aria-label", "Locked");
      lock.setAttribute("aria-hidden", "false");
      room.append(lock);
    }
    room.append(player.room);
    parts.push(room, map);
  }
  if (player.racing) parts.push("racing");
  parts.forEach((part, i) => line.append(...(i ? [" · ", part] : [part])));
  return line;
}

export function players_tile(menu: Menu): HTMLElement {
  const note = el("p", "servers-note");
  const list = el("ol", "servers-list");
  const scroll = el("div", "menu-scroll");
  const unlock = unlock_form(menu);
  scroll.append(list);
  const pings = new Map<string, HTMLElement>();
  let list_key = "";

  const row = (player: Player): HTMLLIElement => {
    const li = el("li", "servers-row");
    const name = el("div", "servers-name");
    name.append(el("b", "", player.host), place(player));
    const ping = el("span", "players-ping");
    pings.set(player.id, ping);
    li.append(name, ping);
    if (player.you) li.append(el("span", "servers-tag", "You"));
    else if (player.here) li.append(el("span", "servers-tag", "Here"));
    else if (player.racing) li.append(el("span", "servers-tag", "Racing"));
    else if (player.version !== menu.host.version) li.append(el("span", "servers-tag", "Different version"));
    else li.append(action("Join", () => join_or_ask(menu, unlock, player)));
    return li;
  };

  menu.sync(() => {
    const players = menu.host.players_online();
    note.textContent = NOTE[menu.host.servers_status()];
    const key = JSON.stringify(players.map(({ ping: _, ...rest }) => rest));
    if (key !== list_key) {
      list_key = key;
      pings.clear();
      list.replaceChildren(...players.map(row));
    }
    for (const player of players) {
      const ping = pings.get(player.id);
      if (!ping || player.you) continue;
      const text = player.ping === null ? "–" : `${player.ping} ms`;
      if (ping.textContent === text) continue;
      ping.dataset.ping = ping_class(player.ping);
      ping.textContent = text;
    }
  });
  return info("players", "Players online", note, scroll, unlock.form);
}
