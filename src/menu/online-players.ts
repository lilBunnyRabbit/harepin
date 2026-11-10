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
  online: "Everyone in a game right now",
  offline: "No other games found. Invite links still work.",
};

function place(player: Player): HTMLElement {
  const line = el("small", "players-place");
  const parts: (string | Node)[] = [];
  const { game } = player;
  if (player.country) parts.push(`${flag(player.country)} ${country_name(player.country)}`);
  const map = `${WORLDS[kind_of_world(game.world)].name} ${game.seed}`;
  if (game.room === LOBBY_ROOM) parts.push(`Free roam · ${map}`);
  else {
    const room = el("span", "players-room");
    if (game.locked) {
      const lock = icon("icon-lock");
      lock.setAttribute("aria-label", "Locked");
      lock.setAttribute("aria-hidden", "false");
      room.append(lock);
    }
    room.append(game.room);
    parts.push(room, map);
  }
  const where = el("span", "players-where");
  parts.forEach((part, i) => where.append(...(i ? [" · ", part] : [part])));
  line.append(where);
  if (player.racing) line.append(el("span", "players-racing", " · racing"));
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
    name.append(el("b", "", player.name), place(player));
    const ping = el("span", "players-ping");
    pings.set(player.key, ping);
    li.append(name, ping);
    if (player.you) li.append(el("span", "servers-tag", "You"));
    else if (player.game.here) li.append(el("span", "servers-tag", "Here"));
    else if (player.racing) li.append(el("span", "servers-tag", "Racing"));
    else if (player.game.version !== menu.host.version) li.append(el("span", "servers-tag", "Different version"));
    else li.append(action("Join", () => join_or_ask(menu, unlock, player.game)));
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
      const ping = pings.get(player.key);
      if (!ping || player.game.here) continue;
      const text = player.ping === null ? "–" : `${player.ping} ms`;
      if (ping.textContent === text) continue;
      ping.dataset.ping = ping_class(player.ping);
      ping.textContent = text;
    }
  });
  return info("players", "Players online", note, scroll, unlock.form);
}
