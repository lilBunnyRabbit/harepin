import { save_lock, type Announce } from "../../net/directory";
import { world_query } from "../../world/world-pick";
import { kind_of_world } from "../../worldgen/kinds/kinds";
import type { Menu } from "../page";

export function join_game(menu: Menu, target: Announce, password: string | null) {
  save_lock(target.room, password === null ? null : { password, asked: true });
  menu.go(world_query(target.room, target.seed, kind_of_world(target.world), target.map ?? null));
}

/** A field of the submitted form, for `setCustomValidity` on the one that is wrong. */
export function field(form: HTMLFormElement, name: string): HTMLInputElement {
  return form.elements.namedItem(name) as HTMLInputElement;
}

export function clear_validity(event: Event & { currentTarget: HTMLInputElement }) {
  event.currentTarget.setCustomValidity("");
}
