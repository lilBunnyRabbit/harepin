import { el, icon } from "./setting-rows";
import { WorldMap } from "./world-map";
import { keep_thumb, map_thumb } from "./map-thumb";
import type { MapData } from "../worldgen/map";
import type { WorldKind } from "../worldgen/types";
import { KINDS, plain_map, type MapSpec } from "../worldgen/kinds/kinds";
import { custom_code, map_code, parse_map_code } from "../worldgen/kinds/map-code";
import type { OptionDef } from "../worldgen/kinds/options";
import { LISTED, WORLDS } from "../worlds/worlds";
import { MenuTab, invite_link, type Menu, type MenuPage } from "./page";
import { MAP_NAME_LENGTH, SAVED_MAPS_MAX } from "./prefs";
import { COPIED_MS, picture, random_seed } from "./widgets";
import { GoalId } from "../goals/goals";

const PLAYERS_MS = 250;
const NEWER = "Made in a newer Harepin: update to drive it";
const BAD = "Not a map code";
const FALLBACK = "These settings can't build a drivable world; showing the plain map";
const HINT = "Got a code from a friend? Type it in.";

/** What a load tells the player when it is not on the map it was sent to; null when it is. */
export function map_note(problem: "newer" | "bad" | null, fallback: boolean): string | null {
  if (problem === "newer") return "This map was made in a newer Harepin: update to drive it";
  if (problem === "bad") return "That link's map is not a map code; showing the room's map";
  return fallback ? FALLBACK : null;
}

export class WorldPage implements MenuPage {
  readonly id = "world";
  readonly label = "Create world";
  readonly parent = MenuTab.PLAY;
  private readonly world_map: WorldMap;
  private chosen: MapSpec;
  private players_timer = 0;

  constructor(private readonly menu: Menu) {
    this.world_map = new WorldMap();
    const { seed, kind, levels } = menu.host;
    this.chosen = { seed, kind, levels: KINDS[kind].options.map((o, i) => levels[i] ?? o.normal) };
  }

  on_show() {
    this.menu.host.goals.done(GoalId.MAP);
    this.world_map.show(this.chosen.seed, this.chosen.kind, true, this.chosen.levels);
    clearInterval(this.players_timer);
    this.players_timer = window.setInterval(() => this.show_players(), PLAYERS_MS);
    this.show_players();
  }

  on_hide() {
    clearInterval(this.players_timer);
    this.players_timer = 0;
    this.world_map.stop();
  }

  private get here(): boolean {
    const { host } = this.menu;
    return this.chosen.seed === host.seed && this.chosen.kind === host.kind && custom_code(this.chosen) === host.code;
  }

  private show_players() {
    if (document.hidden) return;
    const { host } = this.menu;
    this.world_map.show_players(this.here ? host.map_players() : []);
    this.world_map.show_markers(this.here ? host.map_markers() : []);
  }

  build(): HTMLElement[] {
    const { host, rows } = this.menu;
    const { room } = host;
    const step = (n: number, text: string) => {
      const head = el("h3", "map-step");
      head.append(el("i", "", String(n)), el("span", "", text));
      return head;
    };

    const worlds = el("div", "map-worlds");
    worlds.setAttribute("role", "radiogroup");
    worlds.setAttribute("aria-label", "World");
    const world_buttons = LISTED.map(({ kind }) => {
      const button = el("button", "map-world");
      button.type = "button";
      button.setAttribute("role", "radio");
      const text = el("span", "map-world-text");
      text.append(el("b", "", WORLDS[kind].name), el("small", "", WORLDS[kind].pick));
      button.append(picture(kind), text);
      button.addEventListener("click", () => choose(plain_map(kind, this.chosen.seed), true));
      worlds.append(button);
      return [kind, button] as const;
    });

    const field = el("input", "settings-input map-code");
    field.type = "text";
    field.maxLength = 64;
    field.autocomplete = "off";
    field.autocapitalize = "characters";
    field.spellcheck = false;
    field.enterKeyHint = "go";
    field.setAttribute("aria-label", "Map code");
    const dice = el("button", "map-dice");
    dice.type = "button";
    dice.append(icon("icon-dice"), el("span", "", "New random map"));
    const code_row = el("div", "map-code-row");
    code_row.append(field, dice);
    const hint = el("p", "map-hint");

    const drive = el("button", "map-drive");
    drive.type = "button";
    drive.addEventListener("click", () => this.menu.drive(this.chosen.seed, this.chosen.kind, this.chosen.levels));
    const copy = (label: string, text: () => string) => {
      const button = el("button", "map-share");
      button.type = "button";
      const shown = el("span", "", label);
      button.setAttribute("aria-label", label);
      button.title = label;
      button.append(icon(label === "Copy code" ? "icon-edit" : "icon-share"), shown);
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(text());
          shown.textContent = "Copied";
        } catch (error) {
          console.warn("settings: clipboard refused", error);
          shown.textContent = "Copy failed";
        }
        setTimeout(() => (shown.textContent = label), COPIED_MS);
      });
      return button;
    };
    const share = el("div", "map-shares");
    share.append(
      copy("Copy code", () => map_code(this.chosen)),
      copy("Copy link", () => invite_link(room, this.chosen.seed, this.chosen.kind, custom_code(this.chosen))),
    );

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

    const set_hint = (text: string, error: boolean) => {
      hint.textContent = text;
      hint.toggleAttribute("data-error", error);
    };
    const show_facts = (map: MapData | null) => {
      if (map?.fallback) {
        title.textContent = `${WORLDS[this.chosen.kind].name} · ${map_code(plain_map(this.chosen.kind, this.chosen.seed))}`;
        set_hint(FALLBACK, true);
      }
      facts.replaceChildren(
        ...WORLDS[this.chosen.kind].facts(map ? map.facts : null).filter(([value]) => value !== "0").map(([value, label]) => {
          const item = el("div");
          item.append(el("dt", "", label), el("dd", "", value));
          return item;
        }),
      );
    };
    let ready: MapData | null = null;
    this.world_map.on_ready = (map) => {
      ready = map;
      show_facts(map);
    };

    // Every kind's rows are built once and shown with their kind, so switching worlds never piles up row syncs.
    const tune_rows: { kind: WorldKind; more: boolean; row: HTMLElement }[] = [];
    let advanced = false;
    const set_level = (kind: WorldKind, at: number, level: number) => {
      if (this.chosen.kind !== kind || this.chosen.levels[at] === level) return;
      const levels = this.chosen.levels.map((l, i) => (i === at ? level : l));
      choose({ ...this.chosen, levels: KINDS[kind].clamp?.(levels) ?? levels }, false);
    };
    const level_of = (kind: WorldKind, at: number, o: OptionDef) => (this.chosen.kind === kind ? this.chosen.levels[at] : o.normal);
    for (const { kind } of LISTED)
      KINDS[kind].options.forEach((o, at) => {
        const value = { get: () => level_of(kind, at, o), set: (level: number) => set_level(kind, at, level) };
        const row = o.slider
          ? rows.slider(o.name, o.help, value, { step: 1, min: 0, max: o.labels.length - 1, format: (level) => o.labels[level] ?? "" })
          : rows.segmented(o.name, o.help, value, o.labels.map((label, level) => [level, label] as const));
        tune_rows.push({ kind, more: o.more === true, row });
      });
    const fold_text = el("span", "", "More settings");
    const fold_shown = el("span", "row-link pad-fold");
    fold_shown.append(fold_text, icon("icon-steer-right"));
    const fold = rows.action("Advanced", "Ridges, water, town size and the rest of this world's settings.", fold_shown, () => {
      advanced = !advanced;
      show_rows();
      this.menu.refresh();
    });
    const reset = el("button", "map-reset", "Reset");
    reset.type = "button";
    reset.addEventListener("click", () => choose(plain_map(this.chosen.kind, this.chosen.seed), true));
    const none = el("p", "map-hint map-none", "This world has no settings yet.");
    const show_rows = () => {
      const { kind } = this.chosen;
      const mine = tune_rows.filter((t) => t.kind === kind);
      for (const t of tune_rows) t.row.hidden = t.kind !== kind || (t.more && !advanced);
      fold.hidden = !mine.some((t) => t.more);
      fold.setAttribute("aria-expanded", String(advanced));
      reset.hidden = !mine.length;
      none.hidden = mine.length > 0;
    };
    const tune_head = el("div", "map-tune-head");
    tune_head.append(step(3, "Tune it"), reset);
    const tune_list = el("div", "set-rows map-rows");
    tune_list.append(...tune_rows.filter((t) => !t.more).map((t) => t.row), fold, ...tune_rows.filter((t) => t.more).map((t) => t.row));

    const name = el("input", "settings-input map-name");
    name.type = "text";
    name.maxLength = MAP_NAME_LENGTH;
    name.autocomplete = "off";
    name.placeholder = "Name this map";
    name.setAttribute("aria-label", "Map name");
    const save = el("button", "map-save", "Save");
    save.type = "button";
    const save_row = el("div", "map-code-row map-save-row");
    save_row.append(name, save);
    const saved_list = el("div", "set-rows map-saved");
    const show_saved = () => {
      const maps = this.menu.state().saved_maps;
      saved_list.replaceChildren(
        ...maps.map((map, index) => {
          const remove = el("button", "map-remove");
          remove.type = "button";
          remove.setAttribute("aria-label", `Delete ${map.name}`);
          remove.append(icon("icon-close"));
          remove.addEventListener("click", (event) => {
            event.stopPropagation();
            this.menu.set("saved_maps", maps.filter((_, i) => i !== index));
            show_saved();
          });
          const read = parse_map_code(map.code);
          const control = el("span", "map-saved-code");
          if (read.ok) control.append(map_thumb(read.map));
          control.append(el("span", "", map.code), remove);
          return rows.action(map.name, `Load ${map.name}: ${map.code}`, control, () => {
            if (read.ok) choose(read.map, true);
          });
        }),
      );
    };
    const save_map = () => {
      const label = [...name.value.replace(/\p{C}/gu, "").trim()].slice(0, MAP_NAME_LENGTH).join("").trim();
      if (!label) return name.focus();
      const code = map_code(this.chosen);
      if (ready) keep_thumb(this.chosen, ready);
      const others = this.menu.state().saved_maps.filter((m) => m.name !== label);
      this.menu.set("saved_maps", [{ name: label, code }, ...others].slice(0, SAVED_MAPS_MAX));
      name.value = "";
      show_saved();
    };
    save.addEventListener("click", save_map);
    name.addEventListener("keydown", (event) => {
      if (event.key === "Enter") save_map();
    });

    const choose = (next: MapSpec, now: boolean) => {
      this.chosen = next;
      const { seed, kind, levels } = next;
      const here = this.here;
      const code = map_code(next);
      drive.textContent = here ? "You're on this map" : "Drive this map";
      drive.disabled = here;
      drive.title = here ? "" : `Reloads room ${room} on ${WORLDS[kind].name} ${code}`;
      title.textContent = `${WORLDS[kind].name} · ${code}`;
      if (document.activeElement !== field) field.value = code;
      field.setCustomValidity("");
      set_hint(HINT, false);
      for (const [k, button] of world_buttons) button.setAttribute("aria-checked", String(k === kind));
      boost.hidden = !WORLDS[kind].pads;
      show_rows();
      show_facts(null);
      ready = null;
      this.menu.refresh();
      this.world_map.show(seed, kind, now, levels);
    };
    field.addEventListener("input", () => {
      const read = parse_map_code(field.value, this.chosen.kind);
      if (read.ok) return choose(read.map, false);
      const message = read.why === "newer" ? NEWER : BAD;
      field.setCustomValidity(message);
      set_hint(message, true);
      drive.disabled = true;
    });
    field.addEventListener("blur", () => {
      if (field.validity.valid) field.value = map_code(this.chosen);
    });
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !drive.disabled) drive.click();
    });
    dice.addEventListener("click", () => choose({ ...this.chosen, seed: random_seed() }, true));
    choose(this.chosen, false);
    if (host.map_note) set_hint(host.map_note, true);
    show_saved();

    const picks = el("div", "map-picks");
    picks.append(step(1, "Pick a world"), worlds, step(2, "Pick a map"), code_row, hint);
    const tune = el("div", "map-tune");
    tune.append(tune_head, tune_list, none, step(4, "Save it"), save_row, saved_list);
    const side = el("div", "map-side");
    side.append(picks, tune);
    const actions = el("div", "map-actions");
    actions.append(drive, share);
    const preview = el("div", "map-preview");
    preview.append(this.world_map.root);
    const about = el("div", "map-about");
    about.append(title, facts, legend);
    const page = el("div", "map-page");
    page.append(side, preview, about, actions);
    return [page];
  }
}
