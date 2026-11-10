import { clean_password, save_lock, type Announce } from "../net/directory";
import { el } from "./setting-rows";
import { world_query } from "../world/world-pick";
import { kind_of_world } from "../worldgen/kinds/kinds";
import type { Menu } from "./page";
import { action, invalid, password_input } from "./widgets";

export interface Unlock {
  form: HTMLFormElement;
  ask(target: Announce): void;
}

export function join_game(menu: Menu, target: Announce, password: string | null) {
  save_lock(target.room, password === null ? null : { password, asked: true });
  menu.go(world_query(target.room, target.seed, kind_of_world(target.world)));
}

export function join_or_ask(menu: Menu, unlock: Unlock, target: Announce) {
  if (target.locked) unlock.ask(target);
  else join_game(menu, target, null);
}

export function unlock_form(menu: Menu): Unlock {
  const form = el("form", "servers-unlock");
  form.hidden = true;
  const label = el("span", "servers-unlock-label");
  const secret = password_input("Room password");
  const join = el("button", "settings-action", "Join");
  join.type = "submit";
  const cancel = action("Cancel", () => (form.hidden = true));
  const row = el("div", "settings-inline");
  row.append(secret, join, cancel);
  form.append(label, row);
  let locked: Announce | null = null;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const password = clean_password(secret.value);
    if (!locked || password === null) return invalid(secret, "Enter the room password");
    join_game(menu, locked, password);
  });
  return {
    form,
    ask: (target) => {
      locked = target;
      label.textContent = `Password for ${target.room}`;
      secret.value = "";
      form.hidden = false;
      secret.focus();
    },
  };
}
