import { $ } from "./hud";
import "./phone.css";

// Tiles press the desktop buttons they stand for, so each action keeps its one handler.
export class HudSheet {
  private readonly sheet = $("hud-sheet");
  private readonly title = $("hud-sheet-title");
  private readonly players = $("sheet-players");
  private readonly players_count = $("sheet-players-count");
  private readonly career = $("sheet-career");

  constructor(private readonly online: () => boolean) {
    for (const tile of this.sheet.querySelectorAll<HTMLElement>("[data-proxy]")) {
      const target = $(tile.dataset.proxy ?? "");
      tile.addEventListener("click", () => target.click());
    }
    this.sheet.addEventListener("beforetoggle", (e) => {
      if (e.newState === "open") this.fill();
    });
  }

  get open() {
    return this.sheet.matches(":popover-open");
  }

  private fill() {
    this.title.textContent = this.online() ? "Menu" : "Paused";
    this.players.hidden = $("online-chip").hidden;
    this.players_count.textContent = $("online-here").textContent;
    this.career.replaceChildren(...[...$("career-btn").childNodes].map((node) => node.cloneNode(true)));
  }
}
