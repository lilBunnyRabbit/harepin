import "./style.css";
import { read_saved_pick } from "./menu/saved-pick";
import { LOBBY_ROOM, clean_room } from "./net/room-name";
import { pick_world } from "./world/world-pick";
import { start_early } from "./world/world-worker";

// The game bundle takes over a second to evaluate on a phone; the world's plan generates meanwhile. main.ts picks the
// world again with the full settings and takes this worker over only if both picks agree.
const params = new URLSearchParams(location.search);
const { seed, kind } = pick_world(params, clean_room(params.get("room")) ?? LOBBY_ROOM, read_saved_pick());
start_early(seed, kind);
await import("./main");
