import { first_input } from "./hud/last-input";
import { read_saved_pick } from "./menu/saved-pick";
import { LOBBY_ROOM, clean_room } from "./net/room-name";
import { apply_theme, current_theme } from "./theme/theme";
import { pick_world } from "./world/world-pick";
import { start_early } from "./world/world-worker";
import { RELEASE_PARAM, SHOWCASE_PARAM } from "./review/params";
import { CARS_PARAM } from "./viewer/params";

// The loading screen, and the failure note if the bundle never arrives, wear the player's theme from the first frame.
apply_theme(current_theme());
// The travel briefing stands before main.ts builds the input, and its glyphs read this.
document.documentElement.dataset.input = first_input();
// The game bundle takes over a second to evaluate on a phone; the world's plan generates meanwhile. main.ts picks the
// world again with the full settings and takes this worker over only if both picks agree.
const params = new URLSearchParams(location.search);
// Tested inline, not through `REVIEW_BUILD`, so a production build drops the showcase chunk outright.
const showcase = (import.meta.env.MODE === "review" || import.meta.env.DEV) && params.has(SHOWCASE_PARAM);
const release = (import.meta.env.MODE === "review" || import.meta.env.DEV) && params.has(RELEASE_PARAM);
const cars = params.has(CARS_PARAM);
const game = !showcase && !release && !cars;
let failed = false;
if (game) start_early(pick_world(params, clean_room(params.get("room")) ?? LOBBY_ROOM, read_saved_pick()));
// A load bound for an event, a run or a Series race shows where it is going while the bundle arrives; reading that needs
// the career and the kinds, so it comes in beside main.ts rather than in this entry.
if (game) {
  import("./world/travel-card")
    .then(({ travel_here, show_backdrop }) => {
      const loading = document.getElementById("loading");
      const travel = travel_here(params, read_saved_pick());
      if (loading && travel && !failed) show_backdrop(loading, travel);
    })
    .catch((error: unknown) => console.error(error));
}
try {
  if ((import.meta.env.MODE === "review" || import.meta.env.DEV) && showcase) await import("./review/showcase");
  else if ((import.meta.env.MODE === "review" || import.meta.env.DEV) && release) await import("./review/release");
  else if (cars) await import("./viewer/viewer");
  else await import("./main");
} catch (error) {
  console.error(error);
  boot_failed();
}

// A stale tab after a deploy, or a dropped connection, fails the game chunk's download; the loading screen says so.
function boot_failed() {
  failed = true;
  const loading = document.getElementById("loading");
  if (!loading) return;
  delete loading.dataset.travel;
  const text = loading.querySelector("span");
  if (text) text.textContent = "Harepin failed to load";
  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Reload";
  reload.addEventListener("click", () => location.reload());
  loading.append(reload);
}
