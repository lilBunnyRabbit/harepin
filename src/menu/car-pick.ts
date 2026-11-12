import type { CarShelf } from "../car/car-pick";
import { class_badge } from "./class-badge";
import { el } from "./setting-rows";
import "./car-pick.css";

export function pick_car(title: string, limit: string, shelves: readonly CarShelf[]): Promise<string | null> {
  return new Promise((done) => {
    let picked: string | null = null;
    const card = el("dialog", "car-pick");
    card.setAttribute("aria-labelledby", "car-pick-title");
    const box = el("div", "car-pick-box");
    const head = el("header", "car-pick-head");
    const name = el("h2", "", title);
    name.id = "car-pick-title";
    head.append(name, el("p", "car-pick-limit", limit));

    const list = el("div", "car-pick-list");
    let first: HTMLButtonElement | null = null;
    for (const shelf of shelves) {
      const rows = el("ol", "car-pick-shelf");
      for (const choice of shelf.choices) {
        const button = el("button", "car-pick-car");
        button.type = "button";
        button.disabled = choice.blocked !== null;
        const meta = el("span", "car-pick-meta");
        meta.append(class_badge(choice.rating));
        if (choice.blocked) meta.append(el("span", "car-pick-why", choice.blocked));
        else if (choice.fitted) meta.append(el("span", "car-pick-tag", "Fitted"));
        button.append(el("b", "car-pick-name", choice.title), el("small", "car-pick-sub", choice.sub), meta);
        button.addEventListener("click", () => {
          picked = choice.code;
          card.close();
        });
        if (!button.disabled) first ??= button;
        const li = el("li");
        li.append(button);
        rows.append(li);
      }
      list.append(el("h3", "car-pick-shelf-head", shelf.head), rows);
    }

    const foot = el("footer", "car-pick-foot");
    const back = el("button", "car-pick-back", "Back");
    back.type = "button";
    back.addEventListener("click", () => card.close());
    foot.append(back);

    box.append(head, list, foot);
    card.append(box);
    // The box fills the dialog edge to edge, so a click on the dialog itself is the backdrop.
    card.addEventListener("click", (event) => {
      if (event.target === card) card.close();
    });
    // The car sits under the card: keys stay in it instead of steering.
    card.addEventListener("keydown", (event) => event.stopPropagation());
    card.addEventListener("close", () => {
      card.remove();
      done(picked);
    });
    document.body.append(card);
    card.showModal();
    (first ?? back).focus();
  });
}
