import { mount, unmount, type Component } from "svelte";
import type { Menu, MenuPage, MenuTab } from "../page";
import { MenuState } from "./menu-state.svelte";

export interface PageProps {
  menu: Menu;
  live: MenuState;
  shown: boolean;
}

export interface PageMeta {
  id: string;
  label: string;
  parent?: MenuTab;
}

export interface SveltePage extends MenuPage {
  destroy(): void;
}

// One rune view per menu, shared by its pages, so each refresh pulls once.
const states = new WeakMap<Menu, MenuState>();

export function menu_state(menu: Menu): MenuState {
  let live = states.get(menu);
  if (!live) {
    live = new MenuState(menu);
    states.set(menu, live);
  }
  return live;
}

export function svelte_page<E extends object = object>(menu: Menu, meta: PageMeta, component: Component<PageProps & E>, extra = {} as E): SveltePage {
  let shown = $state(false);
  let instance: Record<string, unknown> | null = null;
  return {
    ...meta,
    build() {
      const target = document.createElement("div");
      target.className = "svelte-page";
      // A getter, not a `$state` object: that would deep-proxy the menu and its host.
      const props = {
        ...extra,
        menu,
        live: menu_state(menu),
        get shown() {
          return shown;
        },
      };
      instance = mount(component, { target, props });
      return [target];
    },
    on_show() {
      shown = true;
    },
    on_hide() {
      shown = false;
    },
    destroy() {
      if (instance) void unmount(instance);
      instance = null;
    },
  };
}
