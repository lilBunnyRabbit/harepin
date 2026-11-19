import * as THREE from "three";
import { Audio, type SoundFrame } from "./audio/audio";
import { idle_sound } from "./audio/held-sound";
import { EVENTS, EVENT_PARAM, TUNE_PARAM, event_of, type CareerEvent } from "./career/career";
import { SERIES_PAGE, SERIES_PARAM, is_open, next_open, season_done } from "./career/series";
import { series_event } from "./career/series-seasons";
import { Wallet } from "./career/wallet";
import { WalletDb } from "./career/wallet-db";
import { series_list, series_open } from "./career/series-store";
import { SeriesDb } from "./career/series-db";
import { on_series_map, series_host, series_map, series_ticket } from "./career/series-run";
import { Career, event_map } from "./career/career-store";
import { place_of } from "./career/place";
import { EventMarkers } from "./career/event-markers";
import { fits } from "./career/gate";
import { RUN_PARAM, run_of, type RunPick } from "./runs/runs";
import { Runs } from "./runs/runs-store";
import { daily_want, run_play } from "./runs/run-play";
import { board_rows } from "./runs/daily-board";
import { open_presets, unlocks } from "./career/rewards";
import { ChaseCamera } from "./render/camera";
import { Driver } from "./car/driver";
import { Directory, load_lock } from "./net/directory";
import { LOBBY_ROOM, clean_room } from "./net/room-name";
import { own_country } from "./net/country";
import { Chat } from "./net/chat";
import { Skids, Smoke } from "./render/effects";
import { Sparks } from "./render/sparks";
import { Mirror } from "./render/mirror";
import { MirrorFrame } from "./hud/mirror-frame";
import { build_code, build_spec, parse_build } from "./car/build";
import { load_builds } from "./car/builds";
import { car_shelves, limit_text, type CarLimit, type CarShelf } from "./car/car-pick";
import { Garage } from "./menu/garage.svelte";
import { load_build, save_build } from "./menu/garage-builds";
import { Ghost } from "./car/ghost";
import { sweep_ghosts } from "./car/ghost-store";
import { load_records } from "./store/records";
import { Heartbeat } from "./net/heartbeat";
import { $, Hud } from "./hud/hud";
import { Presence } from "./hud/presence";
import { TRAVEL_BUTTON, type Action } from "./hud/bindings";
import { Input } from "./hud/input";
import { modal_open, watch_modals } from "./hud/modals";
import { Rumble, sense_drive, type RumbleSense } from "./hud/rumble";
import { show_key_hints } from "./hud/key-hints";
import { PICTURE_SIDE } from "./hud/minimap";
import { COUNTDOWN_MS as LOBBY_COUNTDOWN_MS, Lobby, SITTING_OUT, lobby_routes } from "./net/lobby";
import { GREEN_MS, StartSteps } from "./modes/start-steps";
import { MODES, Modes } from "./modes/modes";
import { local_store } from "./modes/track";
import { GoalId, Goals } from "./goals/goals";
import { build_goals, is_handling, proven, saved_entries } from "./goals/catch-up";
import { show_first_run } from "./goals/first-run-view.svelte";
import { FINAL_PAGE, FINAL_PARAM } from "./modes/final";
import { ToastQueue } from "./goals/toast-queue";
import { race_choices } from "./modes/races";
import { CUSTOM_PARAM, custom_host, custom_route, custom_travel } from "./modes/custom-race";
import { field_routes } from "./modes/field-route";
import { CUSTOM_PAGE } from "./menu/events-view";
import { ChunkTrackside, gates, type Gate } from "./car/trackside";
import { light_gate } from "./car/gate-kit";
import { kept_random_name } from "./menu/guide-rules";
import { watch_enter_focus } from "./menu/enter-key";
import { PadMenu } from "./menu/pad-menu";
import { Net, WRONG_PASSWORD } from "./net/net";
import { Quality } from "./render/quality";
import { CursorIdle } from "./theme/cursor";
import { brand, rgba } from "./theme/palette";
import { Race } from "./race";
import { Remotes } from "./net/remotes";
import { warm_rtc } from "./net/warm";
import { Render } from "./render/render";
import { WorldView, mesh_tones } from "./render/scene";
import { kit_meshes } from "./render/prop-kit";
import { clouds, sky } from "./render/sky";
import { Lighting } from "./render/lighting";
import { CAMERA_RETURN_SECONDS, CameraView, pad_settings, type SettingsState } from "./menu/prefs";
import { load_settings, mark_drive, pin_pick, take_drive } from "./menu/prefs-store";
import { read_saved_pick } from "./menu/saved-pick";
import { thumb_url } from "./menu/map-thumb";
import { MenuTab, invite_link } from "./menu/page";
import { Settings } from "./menu/settings";
import { BUILD, Updater, show_version } from "./menu/update";
import { card_closed_now, show_updated } from "./menu/updated-card";
import { when_idle } from "./menu/when-idle";
import { LAB_PARAM, NEW_PLAYER_SPAWN, names_world, new_player, pick_world } from "./world/world-pick";
import { briefed_car, travel_query } from "./world/travel";
import { Brief } from "./world/travel-brief.svelte";
import { travel_here } from "./world/travel-card";
import type { Lab } from "./lab/lab";
import { GUARD_STATE, SystemBack, type Watcher } from "./menu/system-back";
import { SPAWN_INDEX } from "./world/world";
import { WorldStream } from "./world/world-stream";
import { AreaFade } from "./hud/area-fade";
import { start_lobby } from "./modes/lobby-start";
import { WORLDS } from "./worlds/worlds";
import { map_id, snow_of } from "./worldgen/kinds/kinds";
import { world_look } from "./worlds/world-def";
import { custom_code, map_code, parse_map_code, pick_problem, read_pick } from "./worldgen/kinds/map-code";
import { map_note } from "./menu/map-note";
import { MAPS_PAGE } from "./menu/maps";
import { plain_map } from "./worldgen/kinds/kinds";
import { Replay } from "./replay/replay";
import { save_replay } from "./replay/replay-store";
import { pack_replay, type SavedReplay } from "./replay/saved";
import { REVIEW_BUILD, review_wanted } from "./review/params";
import { show_map_overlay } from "./hud/map-overlay.svelte";
import { show_next_up } from "./hud/next-up-view.svelte";
import { roam_card, run_card } from "./hud/pause-card";
import { show_pause, type PauseAct } from "./hud/pause-view.svelte";
import { map_name, short_name } from "./worlds/map-name";
import { StuckPrompt } from "./hud/stuck-prompt";
import { pushing } from "./hud/stuck";
import { LocalSim, open_sim_worker, SIM_MAIN_PARAM, SIM_WORKER_PARAM, start_sim, WorkerSim } from "./sim/sim-client";
import { DT, FrameKind, type FrameRequest } from "./sim/sim-host";
import { WorldJournal } from "./world/world-journal";
import { AI_CARS, AI_CARS_PARAM, AI_RACE_PARAM, FieldView } from "./ai/field-view";
import { LEVEL_3 } from "./ai/field";
import { rating } from "./car/pi";
import { WorldKind } from "./worldgen/types";
import { AI_DRIVE_PARAM, Difficulty } from "./ai/difficulty";
import "./style.css";

const params = new URLSearchParams(location.search);
const room = clean_room(params.get("room")) ?? LOBBY_ROOM;
const event = event_of(params.get(EVENT_PARAM));
const run = event ? null : run_of(params.get(RUN_PARAM));
const lab_id = params.get(LAB_PARAM);
// `?airace` (dev and review builds): free-play races on a circuit run against an AI field; `?airace=<level>` starts one.
const ai_race = REVIEW_BUILD && params.has(AI_RACE_PARAM);
const ai_level = ai_race ? params.get(AI_RACE_PARAM) : null;
// `?series`: the Harepin Series page; `?series=<event>` starts that event on its map.
const series_on = params.has(SERIES_PARAM);
const series_pick = series_on ? series_event(params.get(SERIES_PARAM)) : null;
let series_starting = series_on;
const custom_on = params.has(CUSTOM_PARAM);
// Any peer on the map can call a lobby race, and that ends a mode run: an event link without a room of its own runs
// alone in an unlisted room, as does a review shot, which no peer should drive into. The menu still names `room`, so
// the next world picked lands back in it.
const solo = (event !== null || run !== null || lab_id !== null || series_on || custom_on || review_wanted(params)) && !params.has("room");
// getRandomValues, not randomUUID: the latter only exists in a secure context, and a phone on the LAN dev server is not one.
const net_room = solo ? `solo-${[...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, "0")).join("")}` : room;
const RECORDS_WAIT_MS = 1500;
const saved_pick = read_saved_pick();
const pick = pick_world(params, room, saved_pick);
const map = read_pick(pick);
pin_pick(params, saved_pick, map);
const { seed, kind } = map;
const prefs = load_settings(params);
const random_name = kept_random_name();

show_version($("loading"));
const travelling = travel_here(params, saved_pick);
const brief = travelling && new Brief($("loading"), travelling, load_build(params.get("car")));
brief?.step("Building the map", 0.3);
const audio = new Audio();
// Each client beeps its lobby start off its own clock, on the frame its countdown digit changes.
const lobby_start = new StartSteps(LOBBY_COUNTDOWN_MS / 1000);
// Built and unlocked before the island loads, so the first taps on the loading screen already count.
audio.prepare();
// A touch only counts as a user gesture on release, so pointerdown alone never unlocked sound on phones.
const UNLOCK_EVENTS = ["keydown", "pointerup", "touchend", "click", "gamepadconnected"];
const unlock_audio = () => {
  audio.start();
  if (audio.running) for (const event of UNLOCK_EVENTS) removeEventListener(event, unlock_audio);
};
for (const event of UNLOCK_EVENTS) addEventListener(event, unlock_audio);
// The renderer needs only the world's kind, so it sets up while the worker plans the world.
const snowy = snow_of(map) !== null;
const look = world_look(WORLDS[kind], snowy);
// The lab records every physics step and a review shot sets the pose itself, so both keep the sim on main.
const sim_worker = params.has(SIM_WORKER_PARAM) && !params.has(SIM_MAIN_PARAM) && lab_id === null && !review_wanted(params) ? open_sim_worker() : null;
const journal = sim_worker ? new WorldJournal() : null;
const opening = WorldStream.open(pick, map, mesh_tones(snowy, WORLDS[kind].upland, WORLDS[kind].deck), journal);
const mode_ids = MODES.map((mode) => mode.id);
// Read beside the world's generation; a slow or refused IndexedDB leaves the records in localStorage for this session.
const records = load_records(mode_ids, opening, RECORDS_WAIT_MS);
const quality = new Quality(params, prefs.quality);
const scene = new THREE.Scene();
// The scene never moves. Left on, its own matrix update would force every world matrix under it each frame, frozen chunks too.
scene.matrixAutoUpdate = false;
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 5000);

const light = new Lighting(scene, look.mood, quality.mobile);
const render = new Render(params, quality, scene, camera, light);
const app = $("app");
render.mount(app);
render.start(app);
render.apply_quality();
const area_fade = new AreaFade(app);
warm_rtc();
const [stream] = await Promise.all([opening, records]);
brief?.step("Placing flags", 0.8);
const world = stream.world;
// A custom map with no drivable build stands in as its seed's plain map everywhere: peers, records and the menu.
const built = stream.fallback ? plain_map(kind, seed) : map;
const { levels } = built;
const code = custom_code(built);
const note = map_note(pick_problem(pick), stream.fallback);
// `?debug&at=<road index>` starts the car anywhere on the circuit, for checking a stretch of track by eye; a race run, such
// as a descent event, starts at that index along its own route instead. View only: the run still waits for its first gate.
const debug_at = (params.has("debug") && Math.trunc(Number(params.get("at")))) || 0;
const chase = new ChaseCamera(camera);
chase.wall_bank = WORLDS[world.kind].wall_view?.(world) ?? Infinity;
// `?view=` and `?replay=` (src/review): shots of the world with nothing driving, for reviewing how it looks.
const review = (import.meta.env.MODE === "review" || import.meta.env.DEV) && review_wanted(params) ? await (await import("./review/review")).Review.open(world, chase) : null;
const start_index = review?.start_index ?? (debug_at || (new_player(params, saved_pick) ? NEW_PLAYER_SPAWN : SPAWN_INDEX));
const start_point = world.road[world.clear_spawn(start_index)];
// `?debug&pose=x,y,z,tx,ty,tz` pins the camera at a point looking at another, for menu pictures.
const pose = params.has("debug") ? (params.get("pose")?.split(",").map(Number) ?? []) : [];
const posed = pose.length === 6 && pose.every(Number.isFinite);
// The spawn chunks build while the rest of the game sets up; nothing before `driver.place` reads terrain.
const spawn_ready = world.tiles.ensure(start_point.x, start_point.z);

const world_view = new WorldView(world, quality.mobile, WORLDS[world.kind].kit.trees);
const dome = sky();
scene.add(...(WORLDS[world.kind].backdrop === "sky" ? [dome.add(clouds(world.seed))] : []), world_view.root);
let gate_views: readonly (Gate | undefined)[] = [];
// Dressing and gates stand on terrain all round the world, so they go in once every chunk has arrived. A streamed
// world never holds every chunk: its dress stands on nothing it reads, and its curbs and gates come and go per chunk.
// Modes are built after the spawn wait; a chunk in before then has no run's marks to lay again.
let chunk_in = (_index: number) => {};
if (world.tiles.streamed) {
  const trackside = new ChunkTrackside(world, WORLDS[world.kind].start_gantry);
  gate_views = trackside.gates;
  scene.add(...WORLDS[world.kind].dress(world), trackside.root);
  stream.listen({
    add: (chunk, trees) => {
      world_view.add(chunk, trees);
      trackside.add(chunk.index);
      chunk_in(chunk.index);
    },
    drop: (index) => {
      world_view.drop(index);
      trackside.drop(index);
    },
  });
} else {
  stream.listen(world_view);
  void world.tiles.whole().then(() => {
    performance.mark("world:whole");
    const dressing = [...WORLDS[world.kind].dress(world), ...kit_meshes(world, WORLDS[world.kind].kit.pieces, quality.mobile)];
    if (dressing.length > 0) scene.add(...dressing);
    const all = gates(world, WORLDS[world.kind].start_gantry);
    gate_views = all;
    for (const g of all) scene.add(g.group);
  }, (error: unknown) => area_fade.fail(error));
}

const lock = load_lock(room);
const net = new Net(net_room, seed, prefs.name ?? random_name, lock, map_id(built), BUILD.version, undefined, code);
const country = own_country();
net.set_country(prefs.show_country ? country : null);
const directory = new Directory(
  () => ({
    room, seed, host: net.name, players: 1 + net.remotes.size, locked: lock !== null, version: BUILD.version, world: map_id(built),
    ...(code ? { map: code } : {}),
    ...(lobby.busy ? { racing: true } : {}),
    roster: net.roster(lobby.busy),
  }),
  () => net.leader && !solo,
);
const chat = new Chat(net);
chat.start();
const build = load_build(params.get("car"));
const career = new Career(local_store());
const series = series_list(new SeriesDb(), new Wallet(new WalletDb()));
const runs = new Runs(local_store());
const goals = new Goals(local_store(), mode_ids);
goals.catch_up(() => proven(saved_entries(), { kind, build, cockpit: prefs.camera === CameraView.COCKPIT }, mode_ids));
const race = new Race(world, local_store());
const worker = await sim_worker;
const sim = start_sim(worker, world, stream.plan, journal, build_spec(build));
const driver = new Driver(scene, light, world, race, sim, chase, build);
driver.arrive = (x, z) => area_fade.cover(world.tiles.ensure(x, z));
if (review) review.place = (index) => driver.place_road(index);

const smoke = new Smoke(look.ground_puff);
const skids = new Skids();
const sparks = new Sparks();
scene.add(smoke.mesh, skids.mesh, sparks.mesh);
const mirror = new Mirror();
mirror.skip = [smoke.mesh, sparks.mesh, ...world_view.tree_meshes];
const mirror_frame = new MirrorFrame($("mirror"), app, (left, top, width, height, radius) => mirror.place(left, top, width, height, radius));
if (!quality.mobile) mirror_frame.start();

const garage = new Garage(build);
garage.rewards = () => unlocks(career.stars);
const input = new Input($("touch"), render.renderer.domElement);
const rumble = new Rumble();
const rumble_sense: RumbleSense = { scrub: 0, speed: 0, loose: 0, kerb: 0, airborne: false, vy: 0, impact: 0, x: 0, y: 0, z: 0 };
const pause = show_pause({
  solo: () => net.remotes.size === 0,
  card: () => (modes.active ? run_card(modes.running ?? "Event") : roam_card({ stars: career.stars, here: built, map: map_name(built, world.towns), flags: markers.map_markers.length, players: 1 + net.remotes.size })),
  aids: () => ({ ...settings.state, lights: driver.view.lights }),
  bindings: () => settings.state.bindings,
  toggle: (aid) => (aid === "lights" ? toggle_lights() : toggle_aid(aid)),
  act: (act) => PAUSE_ACTS[act](),
});
const open_pause = () => {
  input.hold_pad();
  pause.open();
};
// The road map is built after the world loads; input asks before that.
let map_open = () => false;
input.blocked = () => garage.is_open || settings.is_open || pad_menu.is_open || pause.is_open || map_open();
new CursorIdle(() => !input.blocked()).start();
const menu_over = () => garage.is_open || settings.is_open || pause.is_open || map_open();
chat.blocked = menu_over;
input.touch.start();
input.mouse.start();
const recenter = $("recenter", HTMLButtonElement);
recenter.addEventListener("click", () => chase.recenter());
render.renderer.domElement.addEventListener("dblclick", () => chase.recenter());

const remotes = new Remotes(scene, $("labels"), net, world);
const lobby = new Lobby(net, lobby_routes(world.routes), world.key);
lobby.start();
const hud = new Hud(world, race, net, lobby);
hud.set_place(map_name(built, world.towns), () => thumb_url(built, PICTURE_SIDE));
hud.field = () => sim.field_cars;
/** The map-code note can be an error to read, so it stays up well past a goal toast. */
const MAP_NOTE_MS = 4500;
/** A lab that failed to open leaves a plain free-roam page: the toast says so for longer than a passing note. */
const LAB_FAIL_MS = 20_000;
const toast_up = () => $("toast").dataset.shown !== undefined;
// These say why a map or a page came up, so they show over a menu too.
const notes = new ToastQueue((text, hold) => hud.toast(text, "", hold), toast_up);
// A goal waits for the road: one done while a menu is open shows once it closes.
const goal_toasts = new ToastQueue((text) => hud.toast(text), () => input.blocked() || toast_up());
if (note) notes.push(note, MAP_NOTE_MS);
goals.on_done = (goal) => goal_toasts.push(`Goal done: ${goal.title}`);
const ghost = new Ghost(scene, world, `harepin:ghost:${world.key}`, world.routes.find((r) => r.id === "circuit")?.length);
requestIdleCallback(() => void sweep_ghosts());
race.on_lap = (improved, first) => {
  goals.done(improved && !first ? GoalId.BEST : GoalId.LAP);
  ghost.finish(improved);
  if (lobby.route === "circuit") lobby.lap(performance.now());
};
function reset_lap() {
  sim.send({ type: "refill" });
  race.reset();
  driver.clear_rewind();
}
async function restart_lap() {
  await driver.place_road(SPAWN_INDEX);
  reset_lap();
}
function restart_action() {
  if (modes.active) modes.restart();
  else if (markers.start_here()) return;
  else if (lobby.busy) hud.toast("Lobby race is running");
  else void restart_lap();
}
$("restart-lap").addEventListener("click", (event) => {
  (event.currentTarget as HTMLElement).blur();
  restart_action();
});
lobby.on_start = () => {
  settings.close();
  modes.exit();
  void start_lobby(lobby.route, {
    restart: restart_lap,
    reset: reset_lap,
    race: (route) =>
      modes.lobby_race(route, () => {
        lobby.lap(performance.now());
        return lobby.state.kind === "racing";
      }),
  });
};
lobby.on_unanswered = () => hud.toast("No race leader answered");
lobby.on_notice = (notice) => hud.toast(notice);
lobby.on_sit_out = () => {
  settings.close();
  hud.toast(SITTING_OUT);
};
lobby.car = () => driver.car.spec.id;
race.on_start = () => ghost.start();

const run_busy = () => lobby.busy || modes.active || lab_id !== null;
const updater = new Updater({ busy: run_busy, menu_open: () => settings.is_open, show_notes: () => settings.open_changes() });
// A lobby race on a route runs as a mode: quitting it leaves the lobby race too, as Leave race does.
function quit_mode() {
  if (lobby.busy) lobby.leave();
  modes.exit();
}
const custom_routes = race_choices(field_routes(world));
const settings = new Settings(document.body, {
  room,
  seed,
  kind,
  levels,
  code,
  map_note: note,
  goals,
  career,
  start_event: (id, car) => (car === undefined ? go_event(id) : start_event(id, car)),
  series,
  start_series: (id, car) => start_series(id, car),
  runs,
  start_run: (id, car) => start_run(id, car),
  custom_routes,
  start_custom: (car) => start_custom(car),
  watch_replay: (saved) => watch_saved(saved),
  name: () => net.name,
  quality_status: () => ({ tier: quality.tier_name, ratio: quality.ratio, bloom: quality.tier.bloom, shadow_size: quality.tier.shadow_size }),
  race_busy: () => lobby.busy,
  toggle_race: (laps, route) => (lobby.busy ? lobby.leave() : lab_id === null ? lobby.call(laps, route) : hud.toast("No races in the lab")),
  race_ready: () => lobby.ready,
  toggle_ready: (laps, route) => lobby.set_ready(lobby.ready ? null : { laps, route }),
  repick_ready: (laps, route) => {
    if (lobby.ready) lobby.set_ready({ laps, route });
  },
  ready_status: () => lobby.ready_status(performance.now()),
  meet_drivers: () => {
    const now = performance.now();
    const ids = [net.id, ...net.same_map.keys()];
    return net.roster(false).map((entry, at) => {
      const id = ids[at];
      const state = net.remotes.get(id)?.latest;
      return { id, name: entry.name, country: entry.country ?? null, car: at === 0 ? garage.code : state && "b" in state ? (state.b ?? null) : null, you: at === 0, ready: at === 0 ? lobby.ready : lobby.peer_ready(id, now) };
    });
  },
  race_left_out: (route) => lobby.left_out(route),
  version: BUILD.version, changelog: () => updater.changelog_view(), show_updates: () => updater.open_notes(), updates_closed: () => updater.close_notes(), update_state: () => updater.state,
  servers: () => directory.list(),
  servers_status: () => directory.status,
  password_failed: () => net.status === WRONG_PASSWORD,
  browse_servers: (on) => directory.browse(on),
  players_online: () => directory.players(),
  online_count: () => presence.count,
  net_status: () => net.status,
  peers: () => net.peers,
  version_peers: () => ({ older: net.older_peers, newer: net.newer_peers }),
  daily_board: () => {
    const peers = net.dailies();
    runs.see_dailies(peers);
    const own = runs.own_daily;
    return board_rows(own?.k ?? daily_want(runs.today), own && { name: net.name, ...own }, peers, runs.seen_dailies);
  },
  garage,
  car_code: () => garage.code,
  use_car: (code) => garage.use_code(code),
  mode_list: () => modes.mode_list(),
  play_level: (id) => modes.play(id),
  mode_running: () => modes.running,
  quit_mode,
  lobby_record: () => modes.lobby_record(),
  race_routes: race_choices(world.routes),
  players: () => 1 + net.remotes.size,
  map_markers: () => markers.map_markers,
  map_name: () => map_name(built, world.towns),
  map_players: () => [
    { name: net.name, x: driver.car.pos.x, z: driver.car.pos.z, you: true },
    ...[...net.remotes.values()].map((r) => ({ name: net.display_name(r), x: r.latest.p[0], z: r.latest.p[2], you: false })),
  ],
  restart_lap: () => restart_action(),
  listen: (on) => input.listen(on),
}, prefs);
// Started once settings and lobby exist: the announce reads both.
directory.start();
const presence = new Presence({ net, elsewhere: () => directory.elsewhere(), watch: (on) => directory.watch(on), toast: (text) => !input.blocked() && hud.toast(text), open_online: () => settings.open(MenuTab.ONLINE) });
presence.start();

// Feel A/B from the `?feel` panel, never saved: on is the shipped behaviour, off the old grip-limited drift wheel.
let drift_full_lock = true;

function apply_car_settings(state: SettingsState) {
  sim.send({ type: "aids", aids: { tcs: state.tcs, abs: state.abs, assist: state.assist, stability: state.stability, auto: state.auto, shift_mode: state.shift_mode, steer_mode: state.steer_mode, drift_full_lock } });
}

function apply_settings(state: SettingsState) {
  apply_car_settings(state);
  document.documentElement.dataset.hudSize = state.hud_size;
  document.documentElement.dataset.speedo = state.speedo;
  hud.set_map(state.minimap);
  for (const chip of document.querySelectorAll<HTMLElement>("[data-aid]")) chip.setAttribute("aria-pressed", String(state[chip.dataset.aid as Aid]));
  input.touch.set_steer_mode(state.touch_steer);
  input.touch.set_sensitivity(state.steer_sensitivity);
  input.precision = state.precision_key;
  input.pad_response = pad_settings(state);
  input.set_bindings(state.bindings);
  show_key_hints(state.bindings);
  chase.mode = state.camera === CameraView.COCKPIT ? 1 : 0;
  audio.set_view(state.camera === CameraView.COCKPIT);
  chase.return_delay = CAMERA_RETURN_SECONDS[state.camera_return];
  chase.invert_y = state.invert_y;
  chase.speed_zoom = state.speed_zoom;
  chase.tilt_on = state.camera_tilt;
  rumble.level = state.rumble;
  ghost.visible = state.ghost;
  audio.set_volume(state.volume);
  audio.set_muted(state.muted);
}

settings.on_change = (state, key) => {
  if (key === "camera" && lab_id === null) goals.done(GoalId.CAMERA);
  if (is_handling(key) && !settings.guide_open) goals.done(GoalId.HANDLING);
  if (key === "quality") {
    quality.set_mode(state.quality);
    render.apply_quality();
  } else if (key === "name") net.set_name(state.name ?? random_name);
  else if (key === "show_country") net.set_country(state.show_country ? country : null);
  else apply_settings(state);
};
apply_settings(prefs);
// The faded touch HUD comes back on any touch along the top, where its buttons sit.
const WAKE_ZONE = 0.4;
addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.clientY < innerHeight * WAKE_ZONE) hud.wake();
}, { capture: true });
const pad_menu = new PadMenu({ settings, chat, garage_open: () => garage.is_open, notice: (text) => hud.toast(text), pad: () => input.pad });
watch_modals();
watch_enter_focus();
settings.on_nav = (nav) => pad_menu.navigate([nav]);
garage.on_tab = (step) => settings.step_tab(step);
garage.on_back = () => settings.back();

await spawn_ready;
driver.place(driver.road_spot(start_index));
const field_view = await FieldView.open(params, scene, world, sim, build);

const modes = new Modes(scene, world, SPAWN_INDEX, () => lobby.record, (x, z, heading) => {
  driver.park(x, z, heading);
  reset_lap();
  // The lab runs no mode: a mode's records and stars would key to the lab world, and its spawns fight the trial's.
}, () => lobby.busy || lab_id !== null, () => audio.chime(), (beep) => audio.beep(beep), camera, () => driver.car.spec, career);
modes.route_at = Math.max(0, debug_at);
chunk_in = (index) => modes.chunk_in(index);
if (lab_id !== null) modes.closed = "Not in the lab: the lab keeps no records or stars";
modes.bindings = () => settings.state.bindings;
modes.ghosts = () => settings.state.ghost;
modes.cover = (wait) => area_fade.cover(wait);
modes.on_finish = (mode) => {
  if (lab_id === null) goals.played(mode);
};
modes.toast = (text, label, hold) => hud.toast(text, label, hold, true);
modes.start_event = (id) => start_event(id);
modes.try_reward = (reward) => {
  settings.open(MenuTab.GARAGE);
  garage.try_reward(reward);
};
const shelves_for = (limit: CarLimit, own = garage.code) => car_shelves(parse_build(own) ?? garage.build, load_builds(), open_presets(unlocks(career.stars).cars), limit, garage.code);
const pick_in = (title: string, limit: CarLimit, shelves: readonly CarShelf[], signal: AbortSignal) => settings.pick_car(title, limit.cap ? limit_text(limit.cap) : "Any car", shelves, signal);
// The car taken on the start sheet or picked on a flag's card runs its event when it fits the route; the picker opens only when it does not.
let taken: string | null = null;
modes.pick_car = (title, limit, own, signal) => {
  const shelves = shelves_for(limit, own);
  const pre = taken ?? markers.card.pick;
  return pre !== null && fits(shelves, pre) ? Promise.resolve(pre) : pick_in(title, limit, shelves, signal);
};
modes.fit_car = (code, save) => garage.use_code(code, save);
modes.car_code = () => garage.code;
modes.save_car = (code) => {
  const build = parse_build(code);
  if (build) save_build(build);
};
hud.run_route = () => modes.route;
hud.in_run = () => modes.active;
if (ai_race) {
  const cars = Math.max(1, Math.min(AI_CARS, Math.trunc(Number(params.get(AI_CARS_PARAM))) || AI_CARS));
  modes.field_host = { sim, build: () => garage.build, rating: () => rating(garage.build), autopilot: params.has(AI_DRIVE_PARAM), cars: Array.from({ length: cars }, () => LEVEL_3), difficulty: () => settings.state.ai_difficulty };
}
if (sim instanceof WorkerSim) sim.on_fall_back = (field) => field && modes.active && modes.restart();
modes.start();
modes.result_next.mount($("mode-result"));
chat.enter_taken = () => modes.result_up;
modes.covered = () => menu_over() || pad_menu.is_open;
const replay = new Replay(chase, world, scene, sim);
replay.view.mount(document.body);
replay.on_open = () => modes.cover_result(true);
replay.on_close = () => {
  modes.cover_result(false);
  driver.end_tape();
  chase.snap(driver.car);
};
modes.watch = (tape, field) =>
  replay.open(tape, field, () => {
    const at = Date.now();
    return save_replay(pack_replay(tape, { id: at.toString(36), at, name: tape.name, mode: tape.mode, map: map_code(built), place: short_name(built, world.towns), car: garage.code, cars: field?.builds.map(build_code) ?? [] }));
  });
function watch_saved(saved: SavedReplay): string {
  if (lobby.busy || (modes.engaged && !modes.result_done)) return "Finish the run first.";
  if (modes.engaged) quit_mode();
  settings.close();
  replay.open_saved(saved);
  return "";
}
updater.start();
const system_back = new SystemBack(
  {
    create_watcher: "CloseWatcher" in window ? () => new (window as unknown as { CloseWatcher: new () => Watcher }).CloseWatcher() : null,
    push_guard: () => window.history.pushState(GUARD_STATE, ""),
  },
  () => {
    if (card_closed_now()) return;
    const popover = document.querySelector<HTMLElement>(":popover-open");
    if (settings.is_open) settings.back();
    else if (popover) popover.hidePopover();
    else if (chat.is_open) chat.close();
    else if (replay.is_open) replay.close();
    else settings.open();
    wake();
  },
);
system_back.start();

garage.on_save = () => goals.done(GoalId.BUILD);
garage.on_change = (next) => {
  driver.swap(next, lobby.busy || modes.active);
  if (lobby.car_changed()) modes.exit();
  modes.car_changed();
  // After `car_changed`, which settles whether the change stays on a borrowed event car or becomes the player's own.
  if (!modes.fitting && !modes.borrowed) for (const id of build_goals(next)) goals.done(id);
  apply_car_settings(settings.state);
};

// A build from chat fits at once only with no run or lobby race up; otherwise the garage's own Load fits it, under that run's rules.
chat.use_build = (code) => {
  if (code === garage.code) return hud.toast("That build is already on your car");
  if (lobby.busy || modes.engaged) {
    chat.close();
    settings.open(MenuTab.GARAGE);
    garage.offer(code);
    return hud.toast("Run in progress: Load it from Builds");
  }
  garage.use_code(code);
  hud.toast("Build fitted");
};

const on_this_map = (to: CareerEvent) => place_of(event_map(to), built).here;

/** `car` is the one taken on the start sheet, null when the event brings its own or nothing was picked yet. */
function start_event(id: string, car: string | null = null) {
  const to = event_of(id);
  if (!to) return;
  if (!on_this_map(to)) return travel({ [EVENT_PARAM]: to.id }, car);
  settings.close();
  play_taken(car, () => modes.play_event(to));
}
// Another map: the taken car becomes the player's own, so it is the one on the road when the map loads.
function travel(to: Record<string, string>, car: string | null) {
  if (car) garage.use_code(car);
  mark_drive();
  location.search = `?${travel_query(to, params, car !== null)}`;
}
// A start asks for its car before it returns, so the taken car meets this start's ask and no later one.
function play_taken(car: string | null, play: () => void) {
  taken = car;
  play();
  taken = null;
}
// An event on this map is a drive to its flag, where the card shows its marks and car; elsewhere it travels.
function go_event(id: string) {
  const flag = markers.flag(id);
  if (!flag) return start_event(id);
  if (lobby.busy) return hud.toast("Lobby race is running");
  settings.close();
  if (modes.active) modes.exit();
  void driver.place_near(flag.x, flag.z, () => markers.arrive(flag));
}
function start_series(id: string, car: string | null = null) {
  if (car) garage.use_code(car);
  const one = series.find((each) => each.event(id));
  const to = one?.ready ? one.event(id) : null;
  if (!one || !to) return;
  const at = series.indexOf(one);
  const { season } = one;
  if (!series_open(series)[at] || !is_open(season, one.progress, to)) return settings.open(SERIES_PAGE);
  const fault = one.car_fault(garage.build);
  if (fault) {
    notes.push(fault, MAP_NOTE_MS);
    return settings.open(SERIES_PAGE);
  }
  if (!on_series_map(season, to, built)) return travel({ [SERIES_PARAM]: to.id, seed: String(to.seed), world: season.world }, car);
  settings.close();
  const base = { sim, build: () => garage.build, rating: () => rating(garage.build), autopilot: params.has(AI_DRIVE_PARAM), difficulty: () => settings.state.ai_difficulty };
  const won = () => Boolean(to.final) && season_done(one.season, one.progress);
  const after = () => (won() ? null : next_open(one.season, one.progress, to));
  const next = {
    get label() {
      const up = after();
      return up ? `Next: Round ${one.season.events.indexOf(up) + 1}` : won() ? "Season podium" : "Back to Series";
    },
    ticket() {
      const up = after();
      return up && series_ticket(one.season, up, place_of(series_map(one.season, up), built));
    },
    go() {
      const up = after();
      if (up) settings.open_round(up.id);
      else settings.open(won() ? FINAL_PAGE : SERIES_PAGE);
    },
  };
  const host = series_host(base, one, to, next);
  modes.series_race(to.route, host);
}
function start_custom(car: string | null = null) {
  const setup = settings.state.custom_race;
  if (setup.map && custom_travel(setup, built)) return travel({ [CUSTOM_PARAM]: "1", map: setup.map }, car);
  const route = custom_route(custom_routes, setup.route);
  if (!route) return notes.push("No circuit on this map for an AI field", MAP_NOTE_MS);
  if (car) garage.use_code(car);
  settings.close();
  const base = { sim, build: () => garage.build, rating: () => rating(garage.build), autopilot: params.has(AI_DRIVE_PARAM) };
  modes.series_race(route.id, custom_host(base, setup, route.name, { label: "Custom race", go: () => settings.open(CUSTOM_PAGE) }));
}
// A run's map is the plain map of its kind and seed (world-pick.ts).
const run_on_map = (to: RunPick) => place_of(plain_map(to.kind, to.seed), built).here;

function start_run(id: string, car: string | null = null) {
  const to = run_of(id);
  if (!to) return;
  if (!run_on_map(to)) return travel({ [RUN_PARAM]: to.id }, car);
  settings.close();
  play_taken(car, () => play_run(to));
}

function play_run(to: RunPick) {
  const play = run_play(to, world, runs, (next) => start_run(next));
  modes.play_event(play.event, play);
}
const markers = new EventMarkers(scene, career, params.has(TUNE_PARAM), {
  start: (id) => start_event(id),
  limit: (event) => modes.event_limit(event),
  shelves: (limit) => shelves_for(limit),
  pick: (title, limit, signal) => pick_in(title, limit, shelves_for(limit), signal),
  map: () => map_name(built, world.towns),
});
const next_ticket = show_next_up({
  stars: () => career.stars,
  here: built,
  flags: () => markers.map_markers,
  // The first run's flag on another map is reached by travelling: its event starts as that map loads.
  travel: (id) => {
    first_run.reach();
    start_event(id);
  },
  blocked: () => input.blocked(),
});
const first_run = show_first_run({ goals, flag: next_ticket, input: () => document.documentElement.dataset.input, bindings: () => settings.state.bindings, touch_steer: () => settings.state.touch_steer, open_steps: () => settings.open("goals") });
$("toast").after(markers.card.el);
const road_map = show_map_overlay({
  here: built,
  map_name: () => map_name(built, world.towns),
  stars: () => career.stars,
  flags: () => markers.map_markers,
  you: () => ({ x: driver.car.pos.x, z: driver.car.pos.z }),
  map_keys: () => settings.state.bindings.map.keys,
  go: (id) => go_event(id),
  other_maps: () => settings.open(MAPS_PAGE),
  run: () => {
    if (!modes.active) return null;
    const route = world.routes.find((one) => one.id === modes.route?.id);
    return {
      name: modes.run_name ?? "Event",
      route: route?.points ?? [],
      closed: route?.closed ?? false,
      rivals: [
        ...sim.field_cars.filter((car) => Number.isFinite(car.pos.x)).map((car) => ({ name: "", x: car.pos.x, z: car.pos.z })),
        ...[...net.remotes.values()].map((r) => ({ name: net.display_name(r), x: r.latest.p[0], z: r.latest.p[2] })),
      ],
    };
  },
});
map_open = () => road_map.is_open;
markers.on_map = (list) => hud.set_markers(list);
// A lab trial on a race world keeps the career out of it, as the lab world does.
markers.place(world, SPAWN_INDEX, lab_id === null ? EVENTS.filter(on_this_map) : []).catch((error: unknown) => console.error(error));
// A map that fell back to its plain one would reload onto itself forever, so a load starts the event only where it landed.
// The briefing named the car above Start, so the start asks again only when that car does not fit.
const briefed = briefed_car(travelling, garage.code);
if (event && on_this_map(event)) play_taken(briefed, () => modes.play_event(event));
else if (event) notes.push("This event's map did not load", MAP_NOTE_MS);
if (run && run_on_map(run)) play_taken(briefed, () => play_run(run));
else if (run) notes.push("This run's map did not load", MAP_NOTE_MS);
if (ai_level) modes.play(ai_level);
// A code that fell back to its plain map would travel to itself forever, so a load starts the race only where it landed.
if (custom_on && custom_travel(settings.state.custom_race, built)) notes.push("This race's map did not load", MAP_NOTE_MS);
else if (custom_on) start_custom();
// A link without its map reloads onto it; one that names a map which fell back would reload onto itself forever.
// An event's opening rule reads saved progress, so a link starts once it has loaded.
void Promise.all(series.map((one) => one.load())).then(() => {
  series_starting = false;
  if (!series_on) return;
  const one = series.find((each) => each.base === series_pick?.season);
  const pick = series_pick && one?.event(series_pick.event.id);
  if (one && pick && (!names_world(params) || on_series_map(one.season, pick, built))) start_series(pick.id);
  else {
    if (series_pick) notes.push("This series event's map did not load", MAP_NOTE_MS);
    settings.open(SERIES_PAGE);
  }
});
// After `markers`: the Play page reads its map markers as soon as the menu opens.
if (REVIEW_BUILD && params.has(FINAL_PARAM)) settings.open(FINAL_PAGE);
else if (!take_drive() && !event && !run && !review && lab_id === null && !ai_level && !series_on && !custom_on) {
  if (prefs.guide_seen) settings.open_title();
  else settings.open_guide();
}
// Typing a name on a phone would raise the keyboard over the menu, so only a mouse and keyboard get the cursor.
if (prefs.name === null && matchMedia("(pointer: fine)").matches) settings.focus_name();

// In a class-capped event the car button and its key pick the event's car; the garage stays in the menu.
const open_car = () => (modes.can_change_car ? void modes.change_car() : settings.open(MenuTab.GARAGE));

function rewind_step(now: number) {
  if (driver.rewind.step(now) && race.started) ghost.rewind_to(now - race.started);
}

function update_gates(t: number) {
  // In a mode run the arch lit is the run's next gate, when one stands there; the free lap's next would point elsewhere.
  const target = modes.active ? (modes.route?.gate ?? null) : null;
  for (let i = 0; i < gate_views.length; i++) {
    const g = gate_views[i];
    if (!g) continue;
    const cp = world.checkpoints[i];
    const next = modes.active ? target !== null && Math.hypot(cp.x - target.x, cp.z - target.z) < 1 : i === race.next;
    light_gate(g.material, next, t);
  }
}

const TOGGLE_LABEL = { tcs: "TCS", abs: "ABS", assist: "Steering assist", stability: "Stability", ghost: "Ghost" } as const;
type Aid = keyof typeof TOGGLE_LABEL | "auto";
function toggle_aid(aid: Aid) {
  const state = settings.state;
  settings.set(aid, !state[aid]);
  if (aid === "auto") hud.toast(state.auto ? "Manual gearbox" : "Auto gearbox", "Driving aid");
  else hud.toast(`${TOGGLE_LABEL[aid]} ${state[aid] ? "off" : "on"}`, "Driving aid");
}
for (const chip of document.querySelectorAll<HTMLButtonElement>("button[data-aid]"))
  chip.addEventListener("click", () => {
    chip.blur();
    toggle_aid(chip.dataset.aid as Aid);
  });
const gear = $("gear");
gear.addEventListener("click", () => {
  gear.blur();
  toggle_aid("auto");
});
gear.addEventListener("keydown", (event) => {
  if (event.repeat || (event.code !== "Enter" && event.code !== "Space")) return;
  event.preventDefault();
  event.stopPropagation();
  toggle_aid("auto");
});

function toggle_lights() {
  hud.toast(driver.toggle_lights() ? "Lights on" : "Lights off");
}

function shift(step: 1 | -1) {
  if (settings.state.auto) hud.toast("Manual gearbox");
  settings.set("auto", false);
  sim.send({ type: "shift", by: step });
}

const ACTIONS: Record<Action, () => void> = {
  reset: () => (modes.active ? modes.restart() : driver.reset(lobby.busy && lobby.route === "circuit")),
  restart: () => restart_action(),
  recenter: () => chase.recenter(),
  lights: () => toggle_lights(),
  camera: () => {
    if (modes.parking) modes.toggle_view();
    else settings.set("camera", settings.state.camera === CameraView.CHASE ? CameraView.COCKPIT : CameraView.CHASE);
  },
  shift_up: () => shift(1),
  shift_down: () => shift(-1),
  auto: () => toggle_aid("auto"),
  tcs: () => toggle_aid("tcs"),
  abs: () => toggle_aid("abs"),
  assist: () => toggle_aid("assist"),
  stability: () => toggle_aid("stability"),
  ghost: () => toggle_aid("ghost"),
  help: () => settings.open_keys(),
  map: () => road_map.toggle(),
  garage: open_car,
  menu: () => (pause.is_open ? pause.close() : !input.pad && markers.card.leave() ? undefined : settings.is_open || pad_menu.is_open || (input.pad && pad_menu.card_waiting()) ? pad_menu.toggle() : open_pause()),
};
const REPLAY_ACTIONS: Partial<Record<Action, () => void>> = {
  camera: () => replay.swap_camera(),
  menu: () => replay.close(),
};
const PAUSE_ACTS: Record<PauseAct, () => void> = {
  reset: ACTIONS.reset,
  leave: quit_mode,
  camera: ACTIONS.camera,
  chat: () => chat.toggle(),
  settings: () => settings.open(MenuTab.SETTINGS),
  showroom: () => settings.open(),
  map: ACTIONS.map,
  events: () => settings.open("career"),
  garage: open_car,
  online: () => settings.open(MenuTab.ONLINE),
};
$("hud-menu-btn").addEventListener("click", open_pause);
if (params.has("feel")) void import("./hud/feel-panel").then(({ feel_panel }) => feel_panel({
  set: (key, value) => settings.set(key, value),
  use_car: (code) => garage.use_code(code),
  respawn: ACTIONS.reset,
  drift_full_lock: (on) => {
    drift_full_lock = on;
    apply_car_settings(settings.state);
  },
}));

// `?lab=<pack>`: the feel lab loads on demand and drives trial cars that never touch the garage build.
let lab: Lab | null = null;
if (lab_id !== null)
  void import("./lab/lab")
    .then(({ open_lab }) =>
      open_lab(lab_id, {
        drive: (build, spec, aids) => {
          driver.swap(build, false, spec);
          apply_car_settings({ ...settings.state, ...aids });
        },
        aids: () => settings.state,
        place: async (spot, current) => {
          await driver.arrive(spot.x, spot.z);
          if (current()) driver.park(spot.x, spot.z, spot.heading);
        },
        car: () => driver.car,
        toast: (text) => hud.toast(text),
        on_map: (code) => {
          if (code === null) return built.kind === WorldKind.LAB;
          const read = parse_map_code(code);
          return read.ok && map_code(read.map) === map_code(built);
        },
        race: (r, attach) => {
          const host = { sim, build: () => r.build, rating: () => ({ class: r.class, pi: r.pi }), autopilot: false, cars: r.trial.field.cars, difficulty: () => r.trial.field.difficulty ?? Difficulty.NORMAL, attach };
          return modes.lab_race(r.lane.name, host) ? (world.routes.find((route) => route.id === r.lane.name)?.points ?? null) : null;
        },
        route: (id) => world.routes.find((route) => route.id === id && route.closed)?.points ?? null,
        field_stats: () => (sim instanceof LocalSim ? (sim.host.field?.racers.map((racer) => racer.stats) ?? []) : []),
        field: () => (sim instanceof LocalSim ? sim.host.field : null),
        end_race: () => modes.exit(),
      }),
    )
    .then((opened) => {
      lab = opened;
      if (sim instanceof LocalSim) sim.host.on_step = (dt, car, controls) => opened.step(dt, car, controls);
    })
    .catch((error: unknown) => {
      console.error(error);
      hud.toast(`Lab: ${error instanceof Error ? error.message : String(error)}`, "", LAB_FAIL_MS);
    });

let acc = 0;
const drag_car = (keep: number) => sim.send({ type: "drag", keep });
const NO_PEERS: readonly never[] = [];
const request: FrameRequest = { kind: FrameKind.HOLD, steps: 0, controls: { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: false }, now: 0, blend: 0, peers: NO_PEERS };
let last = review?.now ?? performance.now();
/** The menu's blur sits over a still scene while it holds the sim, so it redraws at this rate. */
const MENU_DRAW_MS = 100;
/** With peers the sim keeps running under the menu; behind its blur half of a 60 Hz redraw is enough. */
const COVERED_DRAW_MS = 30;
let last_draw = 0;
/** Seconds the world's own motion has run (turbines, beacons, the lit gate's pulse, camera shake): it stops while a menu holds the sim. */
let world_time = 0;
/** Time the draw side (chase cam, smoke, remote cars) has not yet advanced by, from frames the menu skipped. */
let draw_dt = 0;
/** The timer a held menu sleeps on until its next redraw, 0 while the loop runs on animation frames. */
let sleep = 0;
// A key, a click or the system Back can close the menu, so it wakes a sleeping loop rather than leave the scene frozen until the next redraw;
// a gamepad's first press connects it, and the loop then polls every frame.
const wake = () => {
  if (!sleep) return;
  clearTimeout(sleep);
  sleep = 0;
  requestAnimationFrame(frame);
};
// The redraw runs in the timer's own task: an animation frame after it carries the vsync time, which can fall short of
// the redraw slot and skip it once more.
const redraw = () => {
  sleep = 0;
  frame(performance.now());
};
window.addEventListener("keydown", wake, { capture: true });
window.addEventListener("pointerup", wake, { capture: true });
window.addEventListener("gamepadconnected", wake);

new Heartbeat(net, garage, driver, race, seed).start();
let stuck = 0;
const stuck_prompt = new StuckPrompt();
driver.placed = () => {
  stuck_prompt.clear();
  lab?.placed(driver.car);
};

const up_scratch = new THREE.Vector3();
const sound: SoundFrame = { rpm: 0, throttle: 0, scrub: 0, speed: 0, offroad: false, sound: driver.car.spec.sound, redline: 0, boost: false, held: false };

// The online badge follows the career's stars: a finished final shows to peers at once.
let rewarded = -1;
// The season tag and today's daily best follow the runs save: a new best reaches peers at once.
let runs_sent = -1;

function frame(time: number) {
  if (review?.waits(stream)) {
    stream.follow(driver.car.pos.x, driver.car.pos.z, quality.tier.fog_far + quality.tier.stream_pad);
    requestAnimationFrame(frame);
    return;
  }
  // A review shot runs on its own frame clock, so what it shows never depends on how long the world took to stream.
  const now = review?.now ?? time;
  if (career.version !== rewarded) {
    rewarded = career.version;
    net.set_tier(unlocks(career.stars).badge);
  }
  if (runs.version !== runs_sent) {
    runs_sent = runs.version;
    net.set_tag(runs.tag);
    net.set_daily(runs.own_daily);
  }
  const { controls, actions } = input.read();
  if (garage.is_open && !modal_open()) garage.navigate(input.nav);
  else pad_menu.navigate(input.nav);
  for (const action of actions) (replay.is_open ? REPLAY_ACTIONS[action] : ACTIONS[action])?.();
  // A retry, a next run or a lobby start takes the result away, and its replay with it; a saved one plays over the open road.
  if (replay.is_open && modes.engaged && !modes.result_done) replay.close();
  const car = driver.car;

  lobby.update(now);
  const { state: lobby_state } = lobby;
  const lobby_beep = lobby_start.next(lobby_state.kind === "countdown" ? lobby_state.go - now : 0, lobby_state.kind === "racing" ? now - lobby_state.go : GREEN_MS);
  if (lobby_beep) audio.beep(lobby_beep);
  // A lab card holds the trial under it, as the menu does: the clock and the car wait for the answers.
  const menu_hold = (settings.is_open || pause.is_open || road_map.is_open || (lab_id !== null && modal_open())) && net.remotes.size === 0;
  const draw_ms = menu_hold ? MENU_DRAW_MS : settings.is_open ? COVERED_DRAW_MS : 0;
  const skips = draw_ms > 0 && !review && now - last_draw < draw_ms;
  // A held sim behind the menu has nothing to step on a frame the redraw rate skips: `last` stays, so the next drawn
  // frame's dt carries the skipped time and the chase cam, smoke and audio advance by all of it. Waking on every
  // display frame only to skip it costs Blink a full frame each time, so the loop sleeps until the redraw instead; a
  // gamepad is read only by polling, so with one connected the loop keeps every frame to catch its presses.
  if (skips && menu_hold) {
    if (input.pad) requestAnimationFrame(frame);
    else sleep = window.setTimeout(redraw, draw_ms - (now - last_draw));
    return;
  }
  // A timer redraw stamps `last` with performance.now(), which can run ahead of the next animation frame's vsync time.
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = now;
  if (!menu_hold) world_time += dt;
  render.fit();
  let kind: FrameKind = FrameKind.HOLD;
  let steps = 0;
  if (input.rewind && driver.rewind.can_step && !lobby.busy && !modes.active) {
    kind = FrameKind.REWIND;
    if (lab_id === null) goals.done(GoalId.REWIND);
    rewind_step(now);
    acc = 0;
  } else if (review?.replaying) {
    kind = FrameKind.FREE;
    acc = 0;
    review.drive(car, dt);
  } else if (lobby.state.kind === "countdown" || modes.holding || garage.is_open || menu_hold || replay.is_open) {
    acc = 0;
  } else {
    kind = FrameKind.STEP;
    acc += dt;
    while (acc >= DT) {
      steps++;
      acc -= DT;
    }
    driver.rewind.record(now);
  }
  request.kind = kind;
  request.steps = steps;
  request.controls = controls;
  request.now = now;
  request.blend = acc / DT;
  request.peers = net.remotes.size ? remotes.spots() : NO_PEERS;
  const out = sim.frame(request);
  const simulated = out.kind === FrameKind.STEP;
  const held = out.kind === FrameKind.HOLD;
  const rewinding = out.kind === FrameKind.REWIND;
  const { stepped, impact } = out;
  if (simulated) {
    if (impact > 2) {
      if (world_view.jumps.bonked(car.pos.x, car.pos.z)) audio.bonk(impact);
      else audio.impact(impact / 20);
      chase.bump(Math.min(1, impact / 15));
      input.buzz();
    }
    if (world_view.jumps.update(dt, car, drag_car).clean) {
      hud.toast("Clean!");
      audio.chime();
    }
    if (race.started) ghost.record(now - race.started, car);
  }

  const upright = up_scratch.set(0, 1, 0).applyQuaternion(car.quat).y;
  if (world.fallen(car.pos)) {
    void driver.fall_back(modes.route);
    stuck = 0;
  } else driver.track_safe(upright);
  let touching = false;
  for (const w of car.wheels) touching ||= w.contact;
  const drowned = touching && world.drowned(car.pos.x, car.pos.z);
  stuck = !rewinding && (drowned || (upright < 0.3 && car.vel.length() < 2)) ? stuck + dt : 0;
  if (stuck > 1.5) {
    void driver.reset(lobby.busy && lobby.route === "circuit");
    stuck = 0;
  }
  if (lobby.state.kind === "countdown") stuck_prompt.clear();
  else stuck_prompt.update(simulated ? dt : 0, car.vel.length(), pushing(controls.throttle, controls.brake, car.gear, car.auto), driver.rewind.can_step && !lobby.busy && !modes.active, rewinding);
  pause.update();

  // A mode spawns the car anywhere, the circuit start included: its lap clock would count that as a lap.
  // A review replay is a dev ghost driving, not the player: it never sets a lap record; nor does the lab, which keys none.
  if (!modes.active && !review && lab_id === null) race.update(car.pos.x, car.pos.z, now);
  update_gates(world_time);
  ghost.update(race.started && !modes.active ? now - race.started : null, camera.position);
  modes.update(stepped, car);
  markers.update(car.pos.x, car.pos.z, car.vel.length(), !modes.active && !modes.holding && !lobby.busy && !replay.is_open);
  next_ticket.update(car.pos.x, car.pos.z, car.heading, !modes.engaged && !lobby.busy && !settings.is_open && !replay.is_open, input.pad?.buttons[TRAVEL_BUTTON]?.pressed === true);
  first_run.update(car.vel.length(), car.heading, next_ticket.shown && !input.blocked() && !review && lab_id === null);
  // With peers the sim steps every frame, so the heartbeat sends a fresh pose; the draw side waits for the frame that
  // draws and advances by the time it skipped.
  draw_dt = Math.min(0.1, draw_dt + dt);
  if (skips) {
    requestAnimationFrame(frame);
    return;
  }
  const view_dt = draw_dt;
  draw_dt = 0;
  chase.top = modes.high_view;
  chase.boost = car.nitro.boosting;
  chase.rewinding = rewinding;
  driver.draw(!simulated, out.blend, now);
  replay.draw(menu_hold ? 0 : view_dt, driver);
  const focus = replay.is_open ? replay.focus : car.pos;
  field_view?.update(camera);
  const offroad = !world.on_road(focus.x, focus.z);
  if (replay.flying) replay.aim(view_dt, input.look, controls.throttle - controls.brake, controls.steer);
  else chase.update(view_dt, driver.drawn, world, offroad, world_time, input.look);
  if (!review?.aim(camera) && posed) {
    camera.position.set(pose[0], pose[1], pose[2]);
    camera.lookAt(pose[3], pose[4], pose[5]);
  }
  recenter.toggleAttribute("data-shown", chase.orbited);
  light.follow(focus);

  smoke.update(view_dt, car, world);
  skids.update(car, world);
  sparks.update(view_dt, car);

  net.prune();
  remotes.update(view_dt, camera, car.pos, render.view_width, render.view_height);
  if (net.remotes.size) goals.done(GoalId.FRIEND);

  const speed = car.vel.length();
  const scrub = car.scrub * Math.min(1, speed / 6) * (offroad ? 0.3 : 1);
  sound.rpm = car.rpm;
  sound.throttle = car.throttle;
  sound.scrub = scrub;
  sound.speed = speed;
  sound.offroad = offroad;
  sound.sound = car.spec.sound;
  sound.redline = car.spec.redline;
  sound.boost = car.nitro.boosting;
  sound.held = false;
  audio.update(held ? idle_sound(sound, car.spec.idle) : sound);
  // Off behind any menu, a lobby keeps driving with one open; a held sim (rewind, countdown) has no drive to feel.
  if (simulated && !input.blocked()) {
    const effect = rumble.update(now, dt, sense_drive(rumble_sense, car, world, impact));
    if (effect) input.rumble(effect);
  } else rumble.reset(now);

  input.touch.show_nitro(car.nitro.usable);
  if (input.touch.nitro && car.nitro.fill <= 0) input.touch.tank_empty();
  // The menu covers the HUD, so its writes and the minimap wait for the frame the menu closes on.
  if (!settings.is_open) hud.update(car, now, rewinding);
  mirror_frame.show(settings.state.mirror && !quality.mobile && !settings.is_open && !replay.is_open);
  chat.show_key(!modes.holding && lobby.state.kind !== "countdown" && !replay.is_open);
  lab?.frame();
  // Behind the menu each frame carries the redraw gap, which would read as a slow frame.
  if (!draw_ms && quality.adapt(dt)) render.apply_quality();
  stream.follow(focus.x, focus.z, quality.tier.fog_far + quality.tier.stream_pad);
  // The dome is 2.4 km across and the mainland is wider, so it rides with the camera instead of the world origin.
  dome.position.copy(camera.position);
  world_view.update(camera, quality.tier.fog_far, world_time);
  driver.view.root.visible = driver.shadow.mesh.visible = !settings.staged;
  light.show(!settings.staged);
  if (driver.view.neon) driver.view.neon.mesh.visible = !settings.staged;
  if (!draw_ms || now - last_draw >= draw_ms) {
    last_draw = now;
    render.draw();
    mirror.draw(render.renderer, scene, driver.drawn, chase.size);
  }
  review?.drawn(stream);
  render.check_size(now);
  requestAnimationFrame(frame);
}

if (import.meta.env.DEV)
  Object.assign(window, {
    open_road: {
      get car() {
        return driver.car;
      },
      garage,
      modes,
      settings,
      quality,
      audio,
      chase,
      net,
      input,
      lobby,
      race,
      world,
      ghost,
      renderer: render.renderer,
      composer: render.composer,
      step_quality: () => quality.step() && render.apply_quality(),
    },
  });

document.head.append(Object.assign(document.createElement("meta"), { name: "theme-color", content: rgba(brand.background_darker) }));

const invite = $("chat-invite", HTMLButtonElement);
invite.addEventListener("click", async () => {
  const link = invite_link(room, seed, kind, code);
  try {
    await navigator.clipboard.writeText(link);
    invite.textContent = "Copied!";
  } catch {
    invite.textContent = link;
  }
  setTimeout(() => (invite.textContent = "Copy invite link"), 2000);
  invite.blur();
});

// The garage rail keeps focus so pad users stay on the row they acted on.
document.addEventListener("click", (e) => {
  if (e.target instanceof HTMLButtonElement && !e.target.closest(".garage-rail")) e.target.blur();
});

const linked = render.link();
// A travel holds on its briefing until the player starts: they may have looked away while the map built.
if (brief) {
  brief.ready();
  await brief.started;
}
await linked;
performance.mark("world:first");
requestAnimationFrame(frame);
// The first frame links what `link` cannot reach (shadow depth, the composer's passes), so it draws under the loading screen.
await new Promise(requestAnimationFrame);
$("loading").remove();
// The Updated card waits out a run as the update's reload does, its car picker, and a series link's start, which loads its progress first.
when_idle(() => run_busy() || modes.engaged || modes.holding || series_starting, () => show_updated(updater.open_notes));
settings.warm();
requestIdleCallback(() => void import("./menu/car-still").then(({ warm_stills }) => warm_stills(() => settings.stage_held)));
