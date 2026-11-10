import { keys_text } from "../hud/bindings";
import { GOALS, type Goal, type GoTo } from "../goals/goals";
import { el, icon } from "./setting-rows";
import { MenuTab, type Menu, type MenuPage } from "./page";
import "./goals.css";

const NEXT_SHOWN = 3;

function hint_of(menu: Menu, goal: Goal): string {
  const keys = goal.key ? keys_text(menu.state().bindings[goal.key]) : "";
  return goal.hint.replace("{key}", keys || "its key");
}

function progress(menu: Menu): { done: number; text: string; bar: HTMLElement } {
  const done = menu.host.goals.count;
  const bar = el("span", "goals-bar");
  bar.style.setProperty("--done", String(done / GOALS.length));
  return { done, text: `${done} / ${GOALS.length}`, bar };
}

function keep_drawn(menu: Menu, draw: () => void) {
  let drawn = "";
  menu.sync(() => {
    const key = `${menu.host.goals.version}|${GOALS.map((goal) => hint_of(menu, goal)).join("|")}`;
    if (key === drawn) return;
    drawn = key;
    draw();
  });
}

export function goals_card(menu: Menu, go: (to: GoTo) => void): HTMLElement {
  const card = el("div", "menu-tile goals-card");
  card.dataset.area = "goals";
  keep_drawn(menu, () => {
    const { done, text, bar } = progress(menu);
    const head = el("div", "goals-head");
    const all = el("button", "goals-all");
    all.type = "button";
    all.dataset.section = "goals";
    all.append(el("span", "", "See all"), icon("icon-back"));
    head.append(el("span", "menu-eyebrow", "Things to try"), el("span", "goals-count", text), bar, all);
    const next = el("div", "goals-next");
    const open = menu.host.goals.sorted().filter((goal) => !menu.host.goals.is_done(goal.id)).slice(0, NEXT_SHOWN);
    for (const goal of open) {
      const pick = el("button", "goals-pick");
      pick.type = "button";
      const words = el("span", "goals-words");
      words.append(el("b", "", goal.title), el("span", "", hint_of(menu, goal)));
      pick.append(words, el("span", "goals-go", "Go"));
      pick.addEventListener("click", () => go(goal.go));
      next.append(pick);
    }
    if (!open.length) next.append(all_done(done));
    card.replaceChildren(head, next);
  });
  return card;
}

function all_done(done: number): HTMLElement {
  const node = el("p", "goals-done");
  node.append(icon("icon-check"), el("span", "", `All ${done} tried: you've seen everything Harepin has.`));
  return node;
}

export class GoalsPage implements MenuPage {
  readonly id = "goals";
  readonly label = "Things to try";
  readonly parent = MenuTab.PLAY;
  private readonly root = el("div", "goals-page");

  constructor(
    private readonly menu: Menu,
    private readonly go: (to: GoTo) => void,
  ) {
    keep_drawn(menu, () => this.render());
  }

  build(): HTMLElement[] {
    return [this.root];
  }

  private render() {
    const { goals } = this.menu.host;
    const { done, text, bar } = progress(this.menu);
    const summary = el("div", "goals-summary");
    const line = el("p", "goals-lead", "Nothing here is locked. These are the things Harepin has, in no particular order.");
    const count = el("span", "goals-count", text);
    summary.append(count, bar, line);
    const list = el("ol", "goals-list");
    for (const goal of goals.sorted()) {
      const finished = goals.is_done(goal.id);
      const row = el("li", "goals-row");
      row.toggleAttribute("data-done", finished);
      const mark = el("span", "goals-mark");
      if (finished) mark.append(icon("icon-check"));
      const words = el("span", "goals-words");
      const steps = goals.steps(goal.id);
      const title = el("b", "", goal.title);
      if (steps && !finished) title.append(el("small", "", ` ${steps.done} / ${steps.total}`));
      words.append(title, el("span", "", hint_of(this.menu, goal)));
      row.append(mark, words);
      if (!finished) {
        const button = el("button", "settings-action goals-row-go", "Go");
        button.type = "button";
        button.setAttribute("aria-label", `Go: ${goal.title}`);
        button.addEventListener("click", () => this.go(goal.go));
        row.append(button);
      }
      list.append(row);
    }
    this.root.replaceChildren(summary, ...(done === GOALS.length ? [all_done(done)] : []), list);
  }
}
