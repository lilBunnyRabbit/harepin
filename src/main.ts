import * as THREE from "three";
import { Audio } from "./audio/audio";
import { EVENT_PARAM, TUNE_PARAM, event_of, type CareerEvent } from "./career/career";
import { Career, event_map } from "./career/career-store";
import { ChaseCamera } from "./render/camera";
import { Driver } from "./car/driver";
import { Directory, load_lock } from "./net/directory";
import { LOBBY_ROOM, clean_room } from "./net/room-name";
import { own_country } from "./net/country";
import { Chat } from "./net/chat";
import { Skids, Smoke } from "./render/effects";
import { parse_build } from "./car/build";
import { load_builds } from "./car/builds";
import { car_shelves, limit_text } from "./car/car-pick";
import { pick_car } from "./menu/car-pick";
import { Garage } from "./menu/garage";
import { load_build, save_build } from "./menu/garage-builds";
import { Ghost } from "./car/ghost";
import { Heartbeat } from "./net/heartbeat";
import { $, Hud } from "./hud/hud";
import { Presence } from "./hud/presence";
import type { Action } from "./hud/bindings";
import { Input, modal_open } from "./hud/input";
import { Rumble, sense_drive, type RumbleSense } from "./hud/rumble";
import { show_key_hints } from "./hud/key-hints";
import { Lobby, SITTING_OUT, lobby_routes } from "./net/lobby";
import { MODES, Modes } from "./modes/modes";
import { local_store } from "./modes/track";
import { GoalId, Goals } from "./goals/goals";
import { build_goals, proven, saved_entries } from "./goals/catch-up";
import { ToastQueue } from "./goals/toast-queue";
import { race_choices } from "./modes/races";
import { ChunkTrackside, gates, type Gate } from "./car/trackside";
import { GUIDE_PARAM, ROLLED_VISIT } from "./menu/guide";
import { kept_random_name } from "./menu/guide-rules";
import { PadMenu } from "./menu/pad-menu";
import { Net, WRONG_PASSWORD } from "./net/net";
import { peer_pass, type Near } from "./car/nitro";
import { Quality } from "./render/quality";
import { brand, color, rgba, tones } from "./theme/palette";
import { Race } from "./race";
import { Remotes } from "./net/remotes";
import { Render } from "./render/render";
import { WorldView, mesh_tones } from "./render/scene";
import { clouds, sky } from "./render/sky";
import { PadTimer } from "./world/sky-pads";
import { Lighting } from "./render/lighting";
import { CAMERA_RETURN_SECONDS, CameraView, pad_settings, type SettingsState } from "./menu/prefs";
import { load_settings, mark_drive, pin_pick, take_drive } from "./menu/prefs-store";
import { read_saved_pick } from "./menu/saved-pick";
import { MenuTab, invite_link } from "./menu/page";
import { Settings } from "./menu/settings";
import { BUILD, Updater, show_version } from "./menu/update";
import { card_closed_now, show_updated } from "./menu/updated-card";
import { pick_world } from "./world/world-pick";
import { GUARD_STATE, SystemBack, type Watcher } from "./menu/system-back";
import { SPAWN_INDEX } from "./world/world";
import { WorldStream } from "./world/world-stream";
import { AreaFade } from "./hud/area-fade";
import { start_lobby } from "./modes/lobby-start";
import { WORLDS } from "./worlds/worlds";
import { map_id, snow_of } from "./worldgen/kinds/kinds";
import { world_look } from "./worlds/world-def";
import { custom_code, map_code, pick_problem, read_pick } from "./worldgen/kinds/map-code";
import { map_note } from "./menu/world-page";
import { plain_map } from "./worldgen/kinds/kinds";
import "./style.css";

const params = new URLSearchParams(location.search);
const room = clean_room(params.get("room")) ?? LOBBY_ROOM;
const event = event_of(params.get(EVENT_PARAM));
// Any peer on the map can call a lobby race, and that ends a mode run: an event link without a room of its own runs
// alone in an unlisted room. The menu still names `room`, so the next world picked lands back in it.
const solo = event !== null && !params.has("room");
// getRandomValues, not randomUUID: the latter only exists in a secure context, and a phone on the LAN dev server is not one.
const net_room = solo ? `solo-${[...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, "0")).join("")}` : room;
// A room the player chose stays theirs across events; without one the event runs solo.
const KEPT_ON_EVENT = ["room", "car", TUNE_PARAM];
const saved_pick = read_saved_pick();
const pick = pick_world(params, room, saved_pick);
pin_pick(params, saved_pick, pick);
const map = read_pick(pick);
const { seed, kind } = map;
const prefs = load_settings(params);
const random_name = kept_random_name();

show_version($("loading"));
const audio = new Audio();
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
const opening = WorldStream.open(pick, map, mesh_tones(snowy));
const quality = new Quality(params, prefs.quality);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 5000);

const light = new Lighting(scene, look.mood, quality.mobile);
const render = new Render(params, quality, scene, camera, light);
const app = $("app");
render.mount(app);
render.apply_quality();
const area_fade = new AreaFade(app);
const stream = await opening;
const world = stream.world;
// A custom map with no drivable build stands in as its seed's plain map everywhere: peers, records and the menu.
const built = stream.fallback ? plain_map(kind, seed) : map;
const { levels } = built;
const code = custom_code(built);
const note = map_note(pick_problem(pick), stream.fallback);
// `?debug&at=<road index>` starts the car anywhere on the circuit, for checking a stretch of track by eye; a race run, such
// as a descent event, starts at that index along its own route instead.
const debug_at = (params.has("debug") && Math.trunc(Number(params.get("at")))) || 0;
const start_index = debug_at || SPAWN_INDEX;
const start_point = world.road[world.clear_spawn(start_index)];
// `?debug&pose=x,y,z,tx,ty,tz` pins the camera at a point looking at another, for menu pictures.
const pose = params.has("debug") ? (params.get("pose")?.split(",").map(Number) ?? []) : [];
const posed = pose.length === 6 && pose.every(Number.isFinite);
// The spawn chunks build while the rest of the game sets up; nothing before `driver.place` reads terrain.
const spawn_ready = world.tiles.ensure(start_point.x, start_point.z);

const world_view = new WorldView(world, quality.mobile);
const dome = sky();
scene.add(...(WORLDS[world.kind].backdrop === "sky" ? light.dress(dome, clouds(world.seed)) : []), world_view.root);
let gate_views: readonly (Gate | undefined)[] = [];
// Dressing and gates stand on terrain all round the world, so they go in once every chunk has arrived. A streamed
// world never holds every chunk: its dress stands on nothing it reads, and its curbs and gates come and go per chunk.
if (world.tiles.streamed) {
  const trackside = new ChunkTrackside(world);
  gate_views = trackside.gates;
  scene.add(...WORLDS[world.kind].dress(world), trackside.root);
  stream.listen({
    add: (chunk, trees) => {
      world_view.add(chunk, trees);
      trackside.add(chunk.index);
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
    scene.add(...WORLDS[world.kind].dress(world));
    const all = gates(world);
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
const mode_ids = MODES.map((mode) => mode.id);
const career = new Career(local_store());
const goals = new Goals(local_store(), mode_ids);
goals.catch_up(() => proven(saved_entries(), { kind, build, cockpit: prefs.camera === CameraView.COCKPIT }, mode_ids));
const race = new Race(world);
const chase = new ChaseCamera(camera);
const pads = new PadTimer();
const driver = new Driver(scene, light, world, race, pads, chase, build);
driver.arrive = (x, z) => area_fade.cover(world.tiles.ensure(x, z));

const smoke = new Smoke(look.ground_puff);
const skids = new Skids();
scene.add(smoke.mesh, skids.mesh);

const garage_stage = document.createElement("div");
garage_stage.className = "menu-garage";
const garage = new Garage(garage_stage, build);
const input = new Input($("touch"), render.renderer.domElement);
const rumble = new Rumble();
const rumble_sense: RumbleSense = { scrub: 0, speed: 0, loose: 0, kerb: 0, airborne: false, vy: 0, impact: 0, x: 0, y: 0, z: 0 };
input.blocked = () => garage.is_open || settings.is_open || pad_menu.is_open;
chat.blocked = () => garage.is_open || settings.is_open;
input.touch.start();
input.touch.show_nitro(driver.car.nitro.fitted);
input.mouse.start();
const recenter = $("recenter", HTMLButtonElement);
recenter.addEventListener("click", () => chase.recenter());
render.renderer.domElement.addEventListener("dblclick", () => chase.recenter());

const remotes = new Remotes(scene, $("labels"), net, world);
const lobby = new Lobby(net, lobby_routes(world.routes), world.key);
lobby.start();
const hud = new Hud(world, race, net, room, lobby);
/** The map-code note can be an error to read, so it stays up well past a goal toast. */
const MAP_NOTE_MS = 4500;
const goal_toasts = new ToastQueue((text, hold) => hud.toast(text, "", hold), () => $("toast").dataset.shown !== undefined);
if (note) goal_toasts.push(note, MAP_NOTE_MS);
goals.on_done = (goal) => goal_toasts.push(`Goal done: ${goal.title}`);
const ghost = new Ghost(scene, world.seed, `harepin:ghost:${world.key}`, world.routes.find((r) => r.id === "circuit")?.length);
race.on_lap = (improved, first) => {
  goals.done(improved && !first ? GoalId.BEST : GoalId.LAP);
  ghost.finish(improved);
  if (lobby.route === "circuit") lobby.lap(performance.now());
};
function reset_lap() {
  driver.car.nitro.refill();
  race.reset();
  driver.rewind.clear();
}
async function restart_lap() {
  await driver.place_road(SPAWN_INDEX);
  reset_lap();
}
function restart_action() {
  if (modes.active) modes.restart();
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

const updater = new Updater({ busy: () => lobby.busy || modes.active, menu_open: () => settings.is_open, show_notes: () => settings.open_changes() });
const settings = new Settings(document.body, {
  room,
  seed,
  kind,
  levels,
  code,
  map_note: note,
  goals,
  career,
  start_event: (id) => start_event(id),
  name: () => net.name,
  quality_status: () => ({ tier: quality.tier_name, ratio: quality.ratio, bloom: quality.tier.bloom, shadow_size: quality.tier.shadow_size }),
  race_busy: () => lobby.busy,
  toggle_race: (laps, route) => (lobby.busy ? lobby.leave() : lobby.call(laps, route)),
  race_ready: () => lobby.ready,
  toggle_ready: (laps, route) => lobby.set_ready(lobby.ready ? null : { laps, route }),
  repick_ready: (laps, route) => {
    if (lobby.ready) lobby.set_ready({ laps, route });
  },
  ready_status: () => lobby.ready_status(performance.now()),
  race_left_out: (route) => lobby.left_out(route),
  version: BUILD.version, changelog: () => updater.changelog_view(), update_state: () => updater.state,
  servers: () => directory.list(),
  servers_status: () => directory.status,
  password_failed: () => net.status === WRONG_PASSWORD,
  browse_servers: (on) => directory.browse(on),
  players_online: () => directory.players(),
  net_status: () => net.status,
  peers: () => net.peers,
  version_peers: () => ({ older: net.older_peers, newer: net.newer_peers }),
  garage_stage,
  show_garage: (on) => (on ? garage.open() : garage.close()),
  car_code: () => garage.code,
  use_car: (code) => garage.use_code(code),
  mode_list: () => modes.mode_list(),
  play_level: (id) => modes.play(id),
  mode_running: () => modes.running,
  quit_mode: () => {
    // A lobby race on a route runs as a mode: quitting it leaves the lobby race too, as Leave race does.
    if (lobby.busy) lobby.leave();
    modes.exit();
  },
  lobby_record: () => modes.lobby_record(),
  race_routes: race_choices(world.routes),
  players: () => 1 + net.remotes.size,
  map_players: () => [
    { name: net.name, x: driver.car.pos.x, z: driver.car.pos.z, you: true },
    ...[...net.remotes.values()].map((r) => ({ name: net.display_name(r), x: r.latest.p[0], z: r.latest.p[2], you: false })),
  ],
  restart_lap: () => restart_action(),
  listen: (on) => input.listen(on),
}, prefs);
// Started once settings and lobby exist: the announce reads both.
directory.start();
new Presence({ net, elsewhere: () => directory.elsewhere(), watch: (on) => directory.watch(on), toast: (text) => hud.toast(text), open_online: () => settings.open(MenuTab.ONLINE) }).start();

function apply_car_settings(state: SettingsState) {
  Object.assign(driver.car, { tcs: state.tcs, abs: state.abs, assist: state.assist, stability: state.stability, auto: state.auto, steer_mode: state.steer_mode });
}

function apply_settings(state: SettingsState) {
  apply_car_settings(state);
  hud.set_layout(state.hud);
  document.documentElement.dataset.dash = state.dash;
  document.documentElement.dataset.speedo = state.speedo;
  document.documentElement.dataset.mapCorner = state.map_corner;
  hud.set_map(state.map);
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
  if (key === "camera") goals.done(GoalId.CAMERA);
  if (key === "quality") {
    quality.set_mode(state.quality);
    render.apply_quality();
  } else if (key === "name") net.set_name(state.name ?? random_name);
  else if (key === "show_country") net.set_country(state.show_country ? country : null);
  else apply_settings(state);
};
apply_settings(prefs);
$("menu-btn").addEventListener("click", () => settings.open());
// The faded touch HUD comes back on any touch along the top, where its buttons sit.
const WAKE_ZONE = 0.4;
addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.clientY < innerHeight * WAKE_ZONE) hud.wake();
}, { capture: true });
const pad_menu = new PadMenu({ settings, chat, garage_open: () => garage.is_open });
settings.on_nav = (nav) => pad_menu.navigate([nav]);
garage.on_tab = (step) => settings.step_tab(step);
garage.on_back = () => settings.back();

await spawn_ready;
driver.place(driver.road_spot(start_index));

const modes = new Modes(scene, world, SPAWN_INDEX, () => lobby.record, (x, z, heading) => {
  driver.park(x, z, heading);
  reset_lap();
}, () => lobby.busy, () => audio.chime(), camera, () => driver.car.spec, career);
modes.route_at = Math.max(0, debug_at);
modes.bindings = () => settings.state.bindings;
modes.ghosts = () => settings.state.ghost;
modes.cover = (wait) => area_fade.cover(wait);
modes.on_finish = (mode) => goals.played(mode);
modes.toast = (text, label, hold) => hud.toast(text, label, hold);
modes.start_event = (id) => start_event(id);
modes.pick_car = (title, limit, own, signal) =>
  pick_car(title, limit.cap ? limit_text(limit.cap) : "Any car", car_shelves(parse_build(own) ?? garage.build, load_builds(), limit), signal);
modes.fit_car = (code, save) => garage.use_code(code, save);
modes.car_code = () => garage.code;
modes.save_car = (code) => {
  const build = parse_build(code);
  if (build) save_build(build);
};
hud.run_route = () => modes.route;
hud.in_run = () => modes.active;
modes.start();
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
    else settings.open();
  },
);
system_back.start();
const guide_step = params.get(GUIDE_PARAM);
if (guide_step !== null) {
  const clean = new URL(location.href);
  clean.searchParams.delete(GUIDE_PARAM);
  window.history.replaceState(window.history.state, "", clean);
  settings.open_guide("look", guide_step === ROLLED_VISIT);
} else if (!take_drive() && !event) {
  if (prefs.guide_seen) settings.open();
  else settings.open_guide();
}
// Typing a name on a phone would raise the keyboard over the menu, so only a mouse and keyboard get the cursor.
if (prefs.name === null && matchMedia("(pointer: fine)").matches) settings.focus_name();

garage.on_save = () => goals.done(GoalId.BUILD);
garage.on_change = (next) => {
  if (!modes.fitting) for (const id of build_goals(next)) goals.done(id);
  driver.swap(next, lobby.busy || modes.active);
  if (lobby.car_changed()) modes.exit();
  modes.car_changed();
  apply_car_settings(settings.state);
  input.touch.show_nitro(driver.car.nitro.fitted);
};

const on_this_map = (to: CareerEvent) => map_code(event_map(to)) === map_code(built);

function start_event(id: string) {
  const to = event_of(id);
  if (!to) return;
  if (!on_this_map(to)) {
    mark_drive();
    const query = new URLSearchParams({ [EVENT_PARAM]: to.id });
    for (const kept of KEPT_ON_EVENT) {
      const value = params.get(kept);
      if (value !== null) query.set(kept, value);
    }
    location.search = `?${query}`;
    return;
  }
  settings.close();
  modes.play_event(to);
}
// A map that fell back to its plain one would reload onto itself forever, so a load starts the event only where it landed.
if (event && on_this_map(event)) modes.play_event(event);
else if (event) goal_toasts.push("This event's map did not load", MAP_NOTE_MS);

$("garage-btn").addEventListener("click", () => settings.open(MenuTab.GARAGE));
$("modes-btn").addEventListener("click", () => settings.open("modes"));

function rewind_step(now: number) {
  if (driver.rewind.step(now) && race.started) ghost.rewind_to(now - race.started);
}

const lit = color(brand.accent);
const unlit = color(tones.gate);
const black = new THREE.Color(0, 0, 0);
function update_gates(t: number) {
  // In a mode run the arch lit is the run's next gate, when one stands there; the free lap's next would point elsewhere.
  const target = modes.active ? (modes.route?.gate ?? null) : null;
  gate_views.forEach((g, i) => {
    if (!g) return;
    const cp = world.checkpoints[i];
    const next = modes.active ? target !== null && Math.hypot(cp.x - target.x, cp.z - target.z) < 1 : i === race.next;
    g.material.color.copy(next ? lit : unlit);
    g.material.emissive.copy(next ? lit : black).multiplyScalar(next ? 0.55 + Math.sin(t * 6) * 0.25 : 0);
  });
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
document.getElementById("gear")?.addEventListener("click", () => toggle_aid("auto"));

function shift(step: 1 | -1) {
  if (settings.state.auto) hud.toast("Manual gearbox");
  settings.set("auto", false);
  driver.car.shift(step);
}

const ACTIONS: Record<Action, () => void> = {
  reset: () => (modes.active ? modes.restart() : driver.reset(lobby.busy && lobby.route === "circuit")),
  restart: () => restart_action(),
  recenter: () => chase.recenter(),
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
  map: () => settings.open("world"),
  garage: () => settings.open(MenuTab.GARAGE),
  settings: () => settings.open(),
  menu: () => pad_menu.toggle(),
};
if (params.has("feel")) void import("./hud/feel-panel").then(({ feel_panel }) => feel_panel({ set: (key, value) => settings.set(key, value), use_car: (code) => garage.use_code(code), respawn: ACTIONS.reset }));

const DT = 1 / 360;
let acc = 0;
let last = performance.now();
/** The menu's blur sits over a scene that only turbines and gates animate while it holds the sim, so it redraws at this rate. */
const MENU_DRAW_MS = 100;
let last_draw = 0;

new Heartbeat(net, garage, driver, race, seed).start();
let stuck = 0;
let rewinding = false;

const NEAR_GAP = 1.2;
const NEAR_PEER = 4;
/** Something close this frame, and whether the pass touched it (a crash, or driving through a ghost peer). */
function near_miss(impact: number): { near: Near; touched: boolean } {
  const car = driver.car;
  if (!car.nitro.fitted) return { near: null, touched: false };
  const solid = world.grazes(car, NEAR_GAP);
  if (solid) return { near: solid, touched: impact > 0 };
  const ghost = remotes.nearest(car.pos);
  const pass = ghost ? peer_pass(ghost.distance, NEAR_PEER) : null;
  return ghost && pass?.close ? { near: ghost.id, touched: pass.touched } : { near: null, touched: impact > 0 };
}

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  // Before any HUD write this frame: the size read would otherwise force a layout.
  render.fit(app);
  const { controls, actions } = input.read();
  if (garage.is_open && !modal_open()) garage.navigate(input.nav);
  else pad_menu.navigate(input.nav);
  for (const action of actions) ACTIONS[action]();
  const car = driver.car;

  lobby.update(now);
  const menu_hold = settings.is_open && net.remotes.size === 0;
  let stepped = 0;
  let simulated = false;
  let impact = 0;
  if (input.rewind && driver.rewind.can_step && !lobby.busy && !modes.active) {
    rewinding = true;
    goals.done(GoalId.REWIND);
    rewind_step(now);
    acc = 0;
  } else if (lobby.state.kind === "countdown" || modes.holding || garage.is_open || menu_hold) {
    rewinding = false;
    acc = 0;
  } else {
    simulated = true;
    rewinding = false;
    acc += dt;
    while (acc >= DT) {
      driver.begin_step();
      car.step(DT, controls, world);
      pads.step(DT, car, world);
      stepped += DT;
      impact = Math.max(impact, world.collide(car));
      acc -= DT;
    }
    const { near, touched } = near_miss(impact);
    car.nitro.pass(near, touched, car.vel.length());
    if (impact > 2) {
      if (world_view.jumps.bonked(car.pos.x, car.pos.z)) audio.bonk(impact);
      else audio.impact(impact / 20);
      chase.bump(Math.min(1, impact / 15));
      input.buzz();
    }
    driver.rewind.record(now);
    if (world_view.jumps.update(dt, car).clean) {
      hud.toast("Clean!");
      audio.chime();
    }
    if (race.started) ghost.record(now - race.started, car);
  }

  const upright = new THREE.Vector3(0, 1, 0).applyQuaternion(car.quat).y;
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

  // A mode spawns the car anywhere, the circuit start included: its lap clock would count that as a lap.
  if (!modes.active) race.update(car.pos.x, car.pos.z, now);
  update_gates(now / 1000);
  ghost.update(race.started && !modes.active ? now - race.started : null, camera.position);
  modes.update(stepped, car);
  // Rewind, the garage and the countdown don't step the car, so a held boost would never let go of the flame.
  if (!simulated) car.nitro.cut();
  chase.top = modes.high_view;
  chase.boost = car.nitro.boosting;
  chase.rewinding = rewinding;
  driver.draw(!simulated, acc / DT, now);
  const offroad = !world.on_road(car.pos.x, car.pos.z);
  chase.update(dt, driver.drawn, world, offroad, now / 1000, input.look);
  if (posed) {
    camera.position.set(pose[0], pose[1], pose[2]);
    camera.lookAt(pose[3], pose[4], pose[5]);
  }
  recenter.toggleAttribute("data-shown", chase.orbited);
  light.follow(car.pos);

  smoke.update(dt, car, world);
  skids.update(car, world);

  net.prune();
  remotes.update(dt, camera, car.pos);
  if (net.remotes.size) goals.done(GoalId.FRIEND);

  const speed = car.vel.length();
  const scrub = car.scrub * Math.min(1, speed / 6) * (offroad ? 0.3 : 1);
  audio.update({ rpm: car.rpm, throttle: car.throttle, scrub, speed, offroad, sound: car.spec.sound, redline: car.spec.redline, boost: car.nitro.boosting });
  // Off behind any menu, a lobby keeps driving with one open; a held sim (rewind, countdown) has no drive to feel.
  if (simulated && !input.blocked()) {
    const effect = rumble.update(now, dt, sense_drive(rumble_sense, car, world, impact));
    if (effect) input.rumble(effect);
  } else rumble.reset(now);

  if (input.touch.nitro && car.nitro.fill <= 0) input.touch.tank_empty();
  hud.update(car, now, rewinding);
  if (quality.adapt(dt)) render.apply_quality();
  stream.follow(car.pos.x, car.pos.z, quality.tier.fog_far + quality.tier.stream_pad);
  // The dome is 2.4 km across and the mainland is wider, so it rides with the camera instead of the world origin.
  dome.position.copy(camera.position);
  world_view.update(camera, quality.tier.fog_far);
  // The garage covers the screen and draws the car with its own renderer; the next frame after it closes draws the world.
  if (!garage.is_open && (!menu_hold || now - last_draw >= MENU_DRAW_MS)) {
    last_draw = now;
    render.draw();
  }
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

$("loading").remove();
show_updated(() => settings.open_changes());
performance.mark("world:first");
requestAnimationFrame(frame);
settings.warm();
