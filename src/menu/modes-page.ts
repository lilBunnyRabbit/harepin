import { MAX_STARS } from "../modes/track";
import { el, icon } from "./setting-rows";
import { MenuTab, type Menu, type MenuPage } from "./page";
import { action } from "./widgets";

const minutes = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export class ModesPage implements MenuPage {
  readonly id = "modes";
  readonly label = "Modes";
  readonly parent = MenuTab.PLAY;
  private readonly root = el("div", "modes-page");
  private mode_id = "";

  constructor(private readonly menu: Menu) {}

  build(): HTMLElement[] {
    return [this.root];
  }

  on_show() {
    this.render();
  }

  private render() {
    const modes = this.menu.host.mode_list();
    const mode = modes.find((m) => m.id === this.mode_id) ?? modes[0];
    if (!mode) return this.root.replaceChildren();
    this.mode_id = mode.id;
    const focused = document.activeElement instanceof HTMLElement && this.root.contains(document.activeElement) ? document.activeElement.dataset.mode : undefined;

    const nav = el("nav", "modes-nav");
    nav.setAttribute("aria-label", "Modes");
    const total = modes.reduce((sum, m) => sum + m.stars, 0);
    const max = modes.reduce((sum, m) => sum + m.max, 0);
    nav.append(el("span", "modes-total", `★ ${total} / ${max}`));
    for (const m of modes) {
      const button = el("button", "modes-tab");
      button.type = "button";
      button.dataset.mode = m.id;
      button.setAttribute("aria-current", String(m.id === mode.id));
      button.append(el("b", "", m.name), el("small", "", `${m.stars} / ${m.max} ★`));
      button.addEventListener("click", () => {
        this.mode_id = m.id;
        this.render();
      });
      nav.append(button);
    }

    const title = el("b");
    const text = el("span");
    const describe = (level: { name: string; brings: string } | null, locked = "") => {
      title.textContent = level?.name ?? mode.name;
      text.textContent = locked || (level ? level.brings : (mode.blocked ?? ""));
    };
    const grid = el("section", "modes-levels");
    grid.setAttribute("aria-label", mode.name);
    mode.levels.forEach((level, i) => {
      const tile = el("button", "modes-level");
      tile.type = "button";
      const locked = level.blocked ?? (level.open ? "" : `Finish ${mode.levels[i - 1]?.name ?? "the level before"} to open it.`);
      tile.disabled = !level.open || mode.blocked !== null || level.blocked !== null;
      tile.append(el("small", "modes-n", `Level ${i + 1}`), el("b", "", level.name));
      if (level.length !== null && level.par_ms !== null) tile.append(el("small", "modes-meta", `${(level.length / 1000).toFixed(1)} km · par ${minutes(level.par_ms)}`));
      const foot = el("span", "modes-foot");
      if (level.open) {
        const stars = el("span", "modes-stars");
        stars.append("★".repeat(level.stars), el("i", "", "★".repeat(Math.max(0, MAX_STARS - level.stars))));
        foot.append(stars, el("small", level.best ? "" : "modes-new", level.best ?? "New"));
      } else {
        foot.append(icon("icon-lock"), el("small", "", `Finish ${mode.levels[i - 1]?.name}`));
      }
      tile.append(foot);
      const show = () => describe(level, locked);
      tile.addEventListener("focus", show);
      tile.addEventListener("pointerenter", show);
      tile.addEventListener("click", () => {
        this.menu.close();
        this.menu.host.play_level(level.id);
      });
      grid.append(tile);
    });

    const bar = el("div", "modes-bar");
    const about = el("p", "modes-about");
    about.append(title, text);
    bar.append(about);
    const running = this.menu.host.mode_running();
    if (running !== null)
      bar.append(
        action(`Quit ${running}`, () => {
          this.menu.close();
          this.menu.host.quit_mode();
        }),
      );
    const first = mode.levels.find((level) => level.open) ?? null;
    describe(mode.blocked ? null : first);
    if (mode.blocked) grid.append(el("p", "servers-note", mode.blocked));
    this.root.replaceChildren(nav, grid, bar);
    if (focused) this.root.querySelector<HTMLElement>(`[data-mode="${focused}"]`)?.focus({ focusVisible: true });
  }
}
