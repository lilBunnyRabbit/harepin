import { parse_seed } from "../net/net";
import { el, icon } from "../setting-rows";
import { WorldMap } from "../world-map";
import type { MapData } from "../worldgen/map";
import type { WorldKind } from "../worldgen/types";
import { WORLDS } from "../worlds/worlds";
import { MenuTab, invite_link, type Menu, type MenuPage } from "./page";
import { COPIED_MS, picture, random_seed } from "./widgets";

export class WorldPage implements MenuPage {
  readonly id = "world";
  readonly label = "New map";
  readonly parent = MenuTab.PLAY;
  private readonly world_map: WorldMap;
  private chosen: number;
  private chosen_kind: WorldKind;

  constructor(private readonly menu: Menu) {
    this.world_map = new WorldMap(menu.host.world_data);
    this.chosen = menu.host.seed;
    this.chosen_kind = menu.host.kind;
  }

  on_show() {
    this.world_map.show(this.chosen, this.chosen_kind, true);
  }

  on_hide() {
    this.world_map.stop();
  }

  build(): HTMLElement[] {
    const { host } = this.menu;
    const { room, seed } = host;
    const step = (n: number, text: string) => {
      const head = el("h3", "map-step");
      head.append(el("i", "", String(n)), el("span", "", text));
      return head;
    };

    const worlds = el("div", "map-worlds");
    worlds.setAttribute("role", "radiogroup");
    worlds.setAttribute("aria-label", "World");
    const world_buttons = Object.values(WORLDS).map(({ kind }) => {
      const button = el("button", "map-world");
      button.type = "button";
      button.setAttribute("role", "radio");
      const text = el("span", "map-world-text");
      text.append(el("b", "", WORLDS[kind].name), el("small", "", WORLDS[kind].pick));
      button.append(picture(kind), text);
      button.addEventListener("click", () => {
        this.chosen_kind = kind;
        choose(this.chosen, true);
      });
      worlds.append(button);
      return [kind, button] as const;
    });

    const field = el("input", "settings-input map-code");
    field.type = "text";
    field.inputMode = "numeric";
    field.maxLength = 10;
    field.autocomplete = "off";
    field.enterKeyHint = "go";
    field.value = String(seed);
    field.setAttribute("aria-label", "Map code");
    const dice = el("button", "map-dice");
    dice.type = "button";
    dice.append(icon("icon-dice"), el("span", "", "New random map"));
    const code = el("div", "map-code-row");
    code.append(field, dice);

    const drive = el("button", "map-drive");
    drive.type = "button";
    drive.addEventListener("click", () => this.menu.drive(this.chosen, this.chosen_kind));
    const share = el("button", "map-share");
    share.type = "button";
    const share_label = el("span", "", "Share code");
    share.append(icon("icon-share"), share_label);
    share.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(invite_link(room, this.chosen, this.chosen_kind));
        share_label.textContent = "Link copied";
      } catch (error) {
        console.warn("settings: clipboard refused", error);
        share_label.textContent = "Copy failed";
      }
      setTimeout(() => (share_label.textContent = "Share code"), COPIED_MS);
    });

    const title = el("b", "map-title");
    const facts = el("dl", "map-facts");
    const legend = el("ul", "world-legend");
    for (const [label, token] of [
      ["Circuit", "accent"],
      ["Start", "primary"],
      ["Checkpoints", "foreground"],
      ["Jumps", "secondary"],
    ]) {
      const item = el("li", "", label);
      item.style.setProperty("--swatch", `var(--${token})`);
      legend.append(item);
    }
    const boost = el("li", "", "Boost");
    // The map's pad tone, tones.pad: the accent a step lighter, never mixed with another brand colour.
    boost.style.setProperty("--swatch", "oklch(from var(--accent) calc(l + 0.14) c h)");
    legend.append(boost);

    const show_facts = (map: MapData | null) => {
      const ready = map !== null && map.seed === this.chosen && map.kind === this.chosen_kind;
      facts.replaceChildren(
        ...WORLDS[this.chosen_kind].facts(ready ? map.facts : null).map(([value, label]) => {
          const item = el("div");
          item.append(el("dt", "", label), el("dd", "", value));
          return item;
        }),
      );
    };
    this.world_map.on_ready = show_facts;

    const choose = (next: number, now: boolean) => {
      this.chosen = next;
      const here = next === seed && this.chosen_kind === host.kind;
      drive.textContent = here ? "You're on this map" : "Drive this map";
      drive.disabled = here;
      drive.title = here ? "" : `Reloads room ${room} on ${WORLDS[this.chosen_kind].name} ${next}`;
      title.textContent = `${WORLDS[this.chosen_kind].name} · map ${next}`;
      for (const [kind, button] of world_buttons) button.setAttribute("aria-checked", String(kind === this.chosen_kind));
      boost.hidden = !WORLDS[this.chosen_kind].pads;
      show_facts(null);
      this.world_map.show(next, this.chosen_kind, now);
    };
    field.addEventListener("input", () => {
      const next = parse_seed(field.value.trim());
      field.setCustomValidity(next === null ? "A whole number from 0 to 4294967295" : "");
      if (next === null) drive.disabled = true;
      else choose(next, false);
    });
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !drive.disabled) drive.click();
    });
    dice.addEventListener("click", () => {
      const next = random_seed();
      field.value = String(next);
      field.setCustomValidity("");
      choose(next, true);
    });
    choose(this.chosen, false);

    const picks = el("div", "map-picks");
    const actions = el("div", "map-actions");
    actions.append(drive, share);
    picks.append(step(1, "Pick a world"), worlds, step(2, "Pick a map"), code, el("p", "map-hint", "Got a code from a friend? Type it in."), actions);
    const preview = el("div", "map-preview");
    preview.append(this.world_map.root);
    const about = el("div", "map-about");
    about.append(title, facts, legend);
    const page = el("div", "map-page");
    page.append(picks, preview, about);
    return [page];
  }
}
