import { PASSWORD_LENGTH, ROOM_LENGTH, clean_password, clean_room, locked_name, save_lock } from "../net/directory";
import { parse_seed } from "../net/net";
import { el } from "./setting-rows";
import { MenuTab, type Menu, type MenuPage } from "./page";
import { invalid, password_input, random_seed, row } from "./widgets";

function random_code() {
  return Math.random().toString(36).slice(2, 8);
}

export class RoomPage implements MenuPage {
  readonly id = "room";
  readonly label = "New room";
  readonly parent = MenuTab.ONLINE;

  constructor(private readonly menu: Menu) {}

  build(): HTMLElement[] {
    const create = el("form", "servers-create");
    const name = el("input", "settings-input");
    name.type = "text";
    name.maxLength = ROOM_LENGTH;
    name.autocomplete = "off";
    name.placeholder = "Random code";
    name.setAttribute("aria-label", "Room name");
    const password = password_input("Password");
    password.placeholder = "Optional, locks the room";
    const seed = el("input", "settings-input");
    seed.type = "text";
    seed.inputMode = "numeric";
    seed.maxLength = 10;
    seed.autocomplete = "off";
    seed.placeholder = "Random";
    seed.setAttribute("aria-label", "Map code");
    const submit = el("button", "settings-action", "Create room");
    submit.type = "submit";
    for (const input of [name, password, seed]) input.addEventListener("input", () => input.setCustomValidity(""));
    create.addEventListener("submit", (event) => {
      event.preventDefault();
      const room = name.value.trim() ? clean_room(name.value) : random_code();
      if (room === null) return invalid(name, `Up to ${ROOM_LENGTH} characters`);
      const lock = password.value ? clean_password(password.value) : null;
      if (password.value && lock === null) return invalid(password, `Up to ${PASSWORD_LENGTH} characters`);
      const map = seed.value.trim() ? parse_seed(seed.value.trim()) : random_seed();
      if (map === null) return invalid(seed, "A whole number from 0 to 4294967295");
      const named = lock === null ? room : locked_name(room);
      save_lock(named, lock === null ? null : { password: lock, asked: false });
      this.menu.go({ room: named, seed: String(map) });
    });
    create.append(
      row("Room name", name),
      row("Password", password, "Locked rooms show a lock and get a short code on their name; only players with the password can connect"),
      row("Map code", seed, "Empty for a random map"),
      submit,
    );

    return [el("p", "servers-note", "Everything is optional: leave it empty for a random code and map."), create];
  }
}
