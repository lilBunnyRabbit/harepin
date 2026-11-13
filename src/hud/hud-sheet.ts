import { $ } from "./hud";
import "./phone.css";

export type SheetAction = "reset" | "camera";

// Tiles press the desktop buttons they stand for, so each action keeps its one handler.
export class HudSheet {
  private readonly sheet = $("hud-sheet");
  private readonly title = $("hud-sheet-title");
  private readonly players = $("sheet-players");
  private readonly players_count = $("sheet-players-count");
  private readonly career = $("sheet-career");
  /** Called as the sheet opens, before the frame loop sees it. */
  on_open = () => {};

  // Reset and Camera run on click: the touch layer queues them on pointerdown, while the sheet still blocks input.
  constructor(
    private readonly online: () => boolean,
    act: (action: SheetAction) => void,
  ) {
    for (const tile of this.sheet.querySelectorAll<HTMLElement>("[data-proxy]")) {
      const target = $(tile.dataset.proxy ?? "");
      tile.addEventListener("click", () => target.click());
    }
    for (const tile of this.sheet.querySelectorAll<HTMLElement>("[data-act]")) {
      const action = tile.dataset.act as SheetAction;
      tile.addEventListener("click", () => act(action));
    }
    this.sheet.addEventListener("beforetoggle", (e) => {
      if (e.newState !== "open") return;
      this.fill();
      this.on_open();
    });
  }

  get open() {
    return this.sheet.matches(":popover-open");
  }

  close() {
    this.sheet.hidePopover();
  }

  /** Each frame: a peer joining or leaving with the sheet up flips whether it pauses. */
  update() {
    if (!this.open) return;
    const title = this.online() ? "Menu" : "Paused";
    if (this.title.textContent !== title) this.title.textContent = title;
  }

  private fill() {
    this.title.textContent = this.online() ? "Menu" : "Paused";
    this.players.hidden = $("online-chip").hidden;
    this.players_count.textContent = $("online-here").textContent;
    this.career.replaceChildren(...[...$("career-btn").childNodes].map((node) => node.cloneNode(true)));
  }
}
