import { mount } from "svelte";
import type { GoTo } from "../goals/goals";
import GoalsCard from "./GoalsCard.svelte";
import type { Menu } from "./page";
import { menu_state } from "./ui/svelte-page.svelte";

export function goals_card(menu: Menu, go: (to: GoTo) => void): HTMLElement {
  const slot = document.createElement("div");
  slot.dataset.area = "goals";
  slot.style.gridArea = "goals";
  mount(GoalsCard, { target: slot, props: { menu, live: menu_state(menu), go } });
  return slot;
}
