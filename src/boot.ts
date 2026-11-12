import { read_saved_pick } from "./menu/saved-pick";
import { LOBBY_ROOM, clean_room } from "./net/room-name";
import { apply_theme, current_theme } from "./theme/theme";
import { pick_world } from "./world/world-pick";
import { start_early } from "./world/world-worker";
import { SHOWCASE_PARAM } from "./review/params";

// The loading screen, and the failure note if the bundle never arrives, wear the player's theme from the first frame.
apply_theme(current_theme());
// The game bundle takes over a second to evaluate on a phone; the world's plan generates meanwhile. main.ts picks the
// world again with the full settings and takes this worker over only if both picks agree.
const params = new URLSearchParams(location.search);
// Tested inline, not through `REVIEW_BUILD`, so a production build drops the showcase chunk outright.
const showcase = (import.meta.env.MODE === "review" || import.meta.env.DEV) && params.has(SHOWCASE_PARAM);
if (!showcase) start_early(pick_world(params, clean_room(params.get("room")) ?? LOBBY_ROOM, read_saved_pick()));
try {
  if ((import.meta.env.MODE === "review" || import.meta.env.DEV) && showcase) await import("./review/showcase");
  else await import("./main");
} catch (error) {
  console.error(error);
  boot_failed();
}

// A stale tab after a deploy, or a dropped connection, fails the game chunk's download; the loading screen says so.
function boot_failed() {
  const loading = document.getElementById("loading");
  if (!loading) return;
  const text = loading.querySelector("span");
  if (text) text.textContent = "Harepin failed to load";
  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Reload";
  reload.addEventListener("click", () => location.reload());
  loading.append(reload);
}
