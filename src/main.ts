import * as THREE from "three";
import { Audio } from "./audio/audio";
import { ChaseCamera } from "./render/camera";
import { Driver } from "./car/driver";
import { Directory, LOBBY_ROOM, clean_room, load_lock } from "./net/directory";
import { own_country } from "./net/country";
import { Chat } from "./net/chat";
import { Skids, Smoke } from "./render/effects";
import { Garage } from "./menu/garage";
import { load_build } from "./menu/garage-builds";
import { Ghost } from "./car/ghost";
import { Heartbeat } from "./net/heartbeat";
import { $, Hud } from "./hud/hud";
import { Presence } from "./hud/presence";
import type { Action } from "./hud/bindings";
import { Input } from "./hud/input";
import { show_key_hints } from "./hud/key-hints";
import { Lobby, lobby_routes } from "./net/lobby";
import { MODES, Modes } from "./modes/modes";
import { local_store } from "./modes/track";
import { GoalId, Goals } from "./goals/goals";
import { build_goals, proven, saved_entries } from "./goals/catch-up";
import { ToastQueue } from "./goals/toast-queue";
import { race_choices } from "./modes/races";
import { gates } from "./car/trackside";
import { GUIDE_PARAM, ROLLED_VISIT } from "./menu/guide";
import { random_name as make_random_name } from "./menu/guide-rules";
import { PadMenu } from "./menu/pad-menu";
import { Net, WRONG_PASSWORD } from "./net/net";
import { peer_pass, type Near } from "./car/nitro";
import { Quality } from "./render/quality";
import { brand, color, rgba, tones } from "./theme/palette";
import { Race } from "./race";
import { Remotes } from "./net/remotes";
import { Render } from "./render/render";
import { WorldView, load_world } from "./render/scene";
import { clouds, sky } from "./render/sky";
import { PadTimer } from "./world/sky-pads";
import { Lighting } from "./render/lighting";
import { CAMERA_RETURN_SECONDS, CameraView, type SettingsState } from "./menu/prefs";
import { load_settings, take_drive } from "./menu/prefs-store";
import { MenuTab, invite_link } from "./menu/page";
import { Settings } from "./menu/settings";
import { BUILD, Updater, show_version } from "./menu/update";
import { pick_world } from "./world/world-pick";
import { GUARD_STATE, SystemBack, type Watcher } from "./menu/system-back";
import { SPAWN_INDEX } from "./world/world";
import { WORLDS } from "./worlds/worlds";
import { world_id, world_key } from "./worldgen/kinds/kinds";
import "./style.css";

const params = new URLSearchParams(location.search);
const room = clean_room(params.get("room")) ?? LOBBY_ROOM;
const prefs = load_settings(params);
const { seed, kind } = pick_world(params, room, prefs);
const random_name = make_random_name();

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
const { world, chunks } = await load_world(seed, kind);

const quality = new Quality(params, prefs.quality);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 5000);

const light = new Lighting(scene);
const render = new Render(params, quality, scene, camera, light);
const app = $("app");
render.mount(app);
render.apply_quality();

const world_view = new WorldView(world, chunks, quality.mobile);
scene.add(...light.dress(sky(), clouds(world.seed)), world_view.root, ...WORLDS[world.kind].dress(world));
const gate_views = gates(world);
for (const g of gate_views) scene.add(g.group);

const lock = load_lock(room);
const net = new Net(room, seed, prefs.name ?? random_name, lock, world_id(kind), BUILD.version);
const country = own_country();
net.set_country(prefs.show_country ? country : null);
const directory = new Directory(
  () => ({
    room, seed, host: net.name, players: 1 + net.remotes.size, locked: lock !== null, version: BUILD.version, world: world_id(kind),
    ...(lobby.busy ? { racing: true } : {}),
    roster: net.roster(lobby.busy),
  }),
  () => net.leader,
);
const chat = new Chat(net);
chat.start();
const build = load_build(params.get("car"));
const mode_ids = MODES.map((mode) => mode.id);
const goals = new Goals(local_store(), mode_ids);
goals.catch_up(() => proven(saved_entries(), { kind, build, cockpit: prefs.camera === CameraView.COCKPIT }, mode_ids));
const race = new Race(world);
const chase = new ChaseCamera(camera);
const pads = new PadTimer();
const driver = new Driver(scene, light, world, race, pads, chase, build);

const smoke = new Smoke();
const skids = new Skids();
scene.add(smoke.mesh, skids.mesh);

const garage_stage = document.createElement("div");
garage_stage.className = "menu-garage";
const garage = new Garage(garage_stage, build);
const input = new Input($("touch"), render.renderer.domElement);
input.blocked = () => garage.is_open || settings.is_open || pad_menu.is_open;
chat.blocked = () => garage.is_open || settings.is_open;
input.touch.start();
input.touch.show_nitro(driver.car.nitro.fitted);
input.mouse.start();
const recenter = $("recenter", HTMLButtonElement);
recenter.addEventListener("click", () => chase.recenter());
render.renderer.domElement.addEventListener("dblclick", () => chase.recenter());

const remotes = new Remotes(scene, $("labels"), net, world);
const lobby = new Lobby(net, lobby_routes(world.routes), world_key(seed, kind));
lobby.start();
const hud = new Hud(world, race, net, room, lobby);
const goal_toasts = new ToastQueue((text) => hud.toast(text), () => $("toast").dataset.shown !== undefined);
goals.on_done = (goal) => goal_toasts.push(`Goal done: ${goal.title}`);
const ghost = new Ghost(scene, world.seed, `harepin:ghost:${world_key(world.seed, kind)}`);
race.on_lap = (improved, first) => {
  goals.done(improved && !first ? GoalId.BEST : GoalId.LAP);
  ghost.finish(improved);
  if (lobby.route === "circuit") lobby.lap(performance.now());
};
function restart_lap() {
  driver.place(driver.road_spot(SPAWN_INDEX));
  driver.car.nitro.refill();
  race.reset();
  driver.rewind.clear();
}
function restart_action() {
  if (modes.active) modes.restart();
  else if (lobby.busy) hud.toast("Lobby race is running");
  else restart_lap();
}
$("restart-lap").addEventListener("click", (event) => {
  (event.currentTarget as HTMLElement).blur();
  restart_action();
});
lobby.on_start = () => {
  settings.close();
  modes.exit();
  restart_lap();
  if (lobby.route !== "circuit")
    modes.lobby_race(lobby.route, () => {
      lobby.lap(performance.now());
      return lobby.state.kind === "racing";
    });
};
lobby.on_unanswered = () => hud.toast("No race leader answered");
race.on_start = () => ghost.start();

const updater = new Updater({ busy: () => lobby.busy || modes.active, menu_open: () => settings.is_open, show_notes: () => settings.open_changes() });
const settings = new Settings(document.body, {
  room,
  seed,
  kind,
  goals,
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
  version: BUILD.version, changelog: () => updater.changelog_view(), update_ready: () => updater.ready,
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
  mode_list: () => modes.mode_list(),
  play_level: (id) => modes.play(id),
  mode_active: () => modes.active,
  free_drive: () => modes.exit(),
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
  Object.assign(driver.car, { tcs: state.tcs, abs: state.abs, assist: state.assist, auto: state.auto, steer_mode: state.steer_mode });
}

function apply_settings(state: SettingsState) {
  apply_car_settings(state);
  document.documentElement.dataset.hud = state.hud;
  document.documentElement.dataset.dash = state.dash;
  hud.set_map(state.map);
  for (const chip of document.querySelectorAll<HTMLElement>("[data-aid]")) chip.setAttribute("aria-pressed", String(state[chip.dataset.aid as Aid]));
  input.touch.set_steer_mode(state.touch_steer);
  input.touch.set_sensitivity(state.steer_sensitivity);
  input.precision = state.precision_key;
  input.set_bindings(state.bindings);
  show_key_hints(state.bindings);
  chase.mode = state.camera === CameraView.COCKPIT ? 1 : 0;
  audio.set_view(state.camera === CameraView.COCKPIT);
  chase.return_delay = CAMERA_RETURN_SECONDS[state.camera_return];
  chase.invert_y = state.invert_y;
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

// `?debug&at=<road index>` starts the car anywhere on the circuit, for checking a stretch of track by eye.
driver.place(driver.road_spot((params.has("debug") && Number(params.get("at"))) || SPAWN_INDEX));

const modes = new Modes(scene, world, SPAWN_INDEX, () => lobby.record, (x, y, z, heading) => {
  driver.place({ x, y, z, heading });
  driver.car.nitro.refill();
  driver.rewind.clear();
}, () => lobby.busy, () => audio.chime(), camera, () => driver.car.spec);
modes.bindings = () => settings.state.bindings;
modes.on_finish = (mode) => goals.played(mode);
hud.run_route = () => modes.route;
modes.start();
updater.start();
const system_back = new SystemBack(
  {
    create_watcher: "CloseWatcher" in window ? () => new (window as unknown as { CloseWatcher: new () => Watcher }).CloseWatcher() : null,
    push_guard: () => window.history.pushState(GUARD_STATE, ""),
  },
  () => {
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
} else if (!take_drive()) {
  if (prefs.guide_seen) settings.open();
  else settings.open_guide();
}
// Typing a name on a phone would raise the keyboard over the menu, so only a mouse and keyboard get the cursor.
if (prefs.name === null && matchMedia("(pointer: fine)").matches) settings.focus_name();

garage.on_save = () => goals.done(GoalId.BUILD);
garage.on_change = (next) => {
  for (const id of build_goals(next)) goals.done(id);
  driver.swap(next, lobby.busy || modes.active);
  apply_car_settings(settings.state);
  input.touch.show_nitro(driver.car.nitro.fitted);
};

$("garage-btn").addEventListener("click", () => settings.open(MenuTab.GARAGE));
$("modes-btn").addEventListener("click", () => settings.open("modes"));

function rewind_step(now: number) {
  if (driver.rewind.step(now) && race.started) ghost.rewind_to(now - race.started);
}

const lit = color(brand.accent);
const unlit = color(tones.gate);
const black = new THREE.Color(0, 0, 0);
function update_gates(t: number) {
  gate_views.forEach((g, i) => {
    const next = i === race.next;
    g.material.color.copy(next ? lit : unlit);
    g.material.emissive.copy(next ? lit : black).multiplyScalar(next ? 0.55 + Math.sin(t * 6) * 0.25 : 0);
  });
}

const TOGGLE_LABEL = { tcs: "TCS", abs: "ABS", assist: "Steer assist", ghost: "Ghost" } as const;
type Aid = keyof typeof TOGGLE_LABEL | "auto";
function toggle_aid(aid: Aid) {
  const state = settings.state;
  settings.set(aid, !state[aid]);
  if (aid === "auto") hud.toast(state.auto ? "Manual gearbox" : "Auto gearbox");
  else hud.toast(`${TOGGLE_LABEL[aid]} ${state[aid] ? "off" : "on"}`);
}
for (const chip of document.querySelectorAll<HTMLButtonElement>("button[data-aid]"))
  chip.addEventListener("click", () => {
    chip.blur();
    toggle_aid(chip.dataset.aid as Aid);
  });

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
  ghost: () => toggle_aid("ghost"),
  help: () => settings.open_keys(),
  map: () => settings.open("world"),
  garage: () => settings.open(MenuTab.GARAGE),
  settings: () => settings.open(),
  menu: () => pad_menu.toggle(),
};

const DT = 1 / 360;
let acc = 0;
let last = performance.now();
let last_rumble = 0;
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
  if (garage.is_open) garage.navigate(input.nav);
  else pad_menu.navigate(input.nav);
  for (const action of actions) ACTIONS[action]();
  const car = driver.car;

  lobby.update(now);
  const menu_hold = settings.is_open && net.remotes.size === 0;
  let stepped = 0;
  let simulated = false;
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
    let impact = 0;
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
      input.rumble(1, 1, true);
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
    driver.fall_back();
    stuck = 0;
  }
  const drowned = world.height(car.pos.x, car.pos.z) < -0.4 && car.pos.y < 0.4;
  stuck = !rewinding && (drowned || (upright < 0.3 && car.vel.length() < 2)) ? stuck + dt : 0;
  if (stuck > 1.5) {
    driver.reset(lobby.busy && lobby.route === "circuit");
    stuck = 0;
  }

  race.update(car.pos.x, car.pos.z, now);
  update_gates(now / 1000);
  ghost.update(race.started && !modes.active ? now - race.started : null, camera.position);
  modes.update(stepped, car);
  // Rewind, the garage and the countdown don't step the car, so a held boost would never let go of the flame.
  if (!simulated) car.nitro.cut();
  chase.top = modes.high_view;
  chase.boost = car.nitro.boosting;
  driver.draw(!simulated, acc / DT, now);
  const offroad = world.grip(car.pos.x, car.pos.z) < 1;
  chase.update(dt, driver.drawn, world, offroad, now / 1000, input.look);
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
  if (now - last_rumble > 100) {
    last_rumble = now;
    const spin = Math.max(0, ...car.wheels.filter((w) => w.driven && w.contact).map((w) => w.slip - 0.15));
    input.rumble(scrub * 0.6 + (offroad ? Math.min(0.4, speed / 50) : 0), Math.min(1, spin * 2));
  }

  if (input.touch.nitro && car.nitro.fill <= 0) input.touch.tank_empty();
  hud.update(car, now, rewinding);
  if (quality.adapt(dt)) render.apply_quality();
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
  const link = invite_link(room, seed, kind);
  try {
    await navigator.clipboard.writeText(link);
    invite.textContent = "Copied!";
  } catch {
    invite.textContent = link;
  }
  setTimeout(() => (invite.textContent = "Copy invite link"), 2000);
  invite.blur();
});

document.addEventListener("click", (e) => {
  if (e.target instanceof HTMLButtonElement) e.target.blur();
});

$("loading").remove();
requestAnimationFrame(frame);
