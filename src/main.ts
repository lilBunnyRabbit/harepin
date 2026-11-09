import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Audio } from "./audio";
import { ChaseCamera } from "./camera";
import { Directory, clean_room, load_lock } from "./directory";
import { build_code, build_spec } from "./build";
import { Car } from "./car";
import { Chat } from "./chat";
import { Skids, Smoke } from "./effects";
import { Garage, load_build } from "./garage";
import { Ghost } from "./ghost";
import { $, Hud } from "./hud";
import { Input } from "./input";
import { Lobby, lobby_routes } from "./lobby";
import { Modes } from "./modes/modes";
import { race_choices } from "./modes/races";
import { build_view, contact_shadow, dispose_car_view, gates, place_contact_shadow, roadside, show_flame, sync_car_view } from "./models";
import { PadMenu } from "./pad-menu";
import { Net, WRONG_PASSWORD, type CarState } from "./net";
import { peer_pass, type Near, type NitroSnapshot } from "./nitro";
import { Quality } from "./quality";
import { brand, color, rgba, tones } from "./palette";
import { Race, type RaceSnapshot } from "./race";
import { Remotes } from "./remotes";
import { WorldView, load_world, water_mesh } from "./scene";
import { cloud_floor, clouds, sky } from "./sky";
import { PadTimer, type PadSnapshot } from "./sky-pads";
import { Lighting } from "./lighting";
import { NanProbe, sanitise_bloom } from "./postfx";
import { CAMERA_RETURN_SECONDS, CameraView, MenuTab, Settings, invite_link, load_settings, take_drive, type SettingsState } from "./settings";
import { BUILD, Updater, show_version } from "./update";
import { pick_world } from "./world-pick";
import { GUARD_STATE, SystemBack, type Watcher } from "./system-back";
import { SPAWN_INDEX } from "./world";
import { WorldKind, world_id, world_key } from "./worldgen/types";
import "./style.css";

const params = new URLSearchParams(location.search);
const room = clean_room(params.get("room")) ?? "lobby";
const prefs = load_settings(params);
const { seed, kind } = pick_world(params, room, prefs);
const ADJECTIVES = ["Swift", "Fuzzy", "Lucky", "Bouncy", "Sly", "Brave", "Zippy", "Mellow"];
const random_name = `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]} Bunny`;

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
// Canvas-bug bisect switches for ?debug, combined with ?quality=medium: each drops one piece of the bloom path.
const BISECT = ["nobloom", "nocomposer", "noblur", "alpha", "bloomhalf"] as const;
const bisect = new Set(BISECT.filter((flag) => params.has(flag)));
document.body.classList.toggle("no-blur", bisect.has("noblur"));
const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: "high-performance", alpha: bisect.has("alpha"), premultipliedAlpha: true });
renderer.setPixelRatio(quality.ratio);
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.type = THREE.PCFShadowMap;
$("app").append(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 5000);

const light = new Lighting(scene);
const sun = light.sun;
quality.apply(renderer, scene, sun);

const world_view = new WorldView(world, chunks, quality.mobile);
scene.add(...light.dress(sky(), clouds(world.seed)), world_view.root, ...(world.kind === WorldKind.SKY ? [cloud_floor(world)] : [roadside(world), water_mesh()]));
const gate_views = gates(world);
for (const g of gate_views) scene.add(g.group);

const lock = load_lock(room);
const net = new Net(room, seed, prefs.name ?? random_name, lock, world_id(kind));
const directory = new Directory(
  () => ({ room, seed, host: net.name, players: 1 + net.remotes.size, locked: lock !== null, version: BUILD.version }),
  () => net.leader,
);
directory.start();
const chat = new Chat(net);
chat.start();
const build = load_build(params.get("car"));
let car = new Car(build_spec(build));
let view = build_view(build, car.spec);
scene.add(view.root);
const car_shadow = contact_shadow();
scene.add(car_shadow.mesh);

light.mount(view.root);

const smoke = new Smoke();
const skids = new Skids();
scene.add(smoke.mesh, skids.mesh);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), light.bloom.strength, 0.45, light.bloom.threshold);
if (bisect.has("bloomhalf")) {
  const set_size = bloom.setSize.bind(bloom);
  bloom.setSize = (width, height) => set_size(Math.round(width / 2), Math.round(height / 2));
}
sanitise_bloom(bloom);
const nan_probe = params.has("debug") ? new NanProbe() : null;
if (nan_probe) composer.addPass(nan_probe);
if (!bisect.has("nobloom")) composer.addPass(bloom);
composer.addPass(new OutputPass());

const garage_stage = document.createElement("div");
garage_stage.className = "menu-garage";
const garage = new Garage(garage_stage, build);
const input = new Input($("touch"), renderer.domElement);
input.blocked = () => garage.is_open || settings.is_open || pad_menu.is_open;
chat.blocked = () => garage.is_open || settings.is_open;
input.touch.start();
input.touch.show_nitro(car.nitro.fitted);
input.mouse.start();
const recenter = $("recenter", HTMLButtonElement);
recenter.addEventListener("click", () => chase.recenter());
renderer.domElement.addEventListener("dblclick", () => chase.recenter());

const race = new Race(world);
const chase = new ChaseCamera(camera);
const remotes = new Remotes(scene, $("labels"), net, world);
const lobby = new Lobby(net, lobby_routes(world.routes), world_key(seed, kind));
lobby.start();
const hud = new Hud(world, race, net, room, lobby);
const ghost = new Ghost(scene, world.seed, `harepin:ghost:${world_key(world.seed, kind)}`);
race.on_lap = (improved) => {
  ghost.finish(improved);
  if (lobby.route === "circuit") lobby.lap(performance.now());
};
function restart_lap() {
  spawn_at(SPAWN_INDEX);
  car.nitro.refill();
  race.reset();
  history.length = 0;
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
  modes.exit();
  restart_lap();
  if (lobby.route !== "circuit")
    modes.lobby_race(lobby.route, () => {
      lobby.lap(performance.now());
      return lobby.state.kind === "racing";
    });
};
race.on_start = () => ghost.start();

const settings = new Settings(document.body, {
  room,
  seed,
  kind,
  name: () => net.name,
  quality_status: () => ({ tier: quality.tier_name, ratio: quality.ratio, bloom: quality.tier.bloom, shadow_size: quality.tier.shadow_size }),
  race_busy: () => lobby.busy,
  toggle_race: (laps, route) => (lobby.busy ? lobby.leave() : lobby.call(laps, route)),
  version: BUILD.version, show_changelog: () => updater.show_changelog(),
  servers: () => directory.list(),
  servers_status: () => directory.status,
  password_failed: () => net.status === WRONG_PASSWORD,
  browse_servers: (on) => directory.browse(on),
  garage_stage,
  show_garage: (on) => (on ? garage.open() : garage.close()),
  mode_list: () => modes.mode_list(),
  play_level: (id) => modes.play(id),
  mode_active: () => modes.active,
  free_drive: () => modes.exit(),
  lobby_record: () => modes.lobby_record(),
  race_routes: race_choices(world.routes),
  players: () => 1 + net.remotes.size,
  restart_lap: () => restart_action(),
}, prefs);

function apply_car_settings(state: SettingsState) {
  Object.assign(car, { tcs: state.tcs, abs: state.abs, assist: state.assist, auto: state.auto, steer_mode: state.steer_mode });
}

function apply_settings(state: SettingsState) {
  apply_car_settings(state);
  document.documentElement.dataset.hud = state.hud;
  document.documentElement.dataset.dash = state.dash;
  for (const chip of document.querySelectorAll<HTMLElement>("[data-aid]")) chip.setAttribute("aria-pressed", String(state[chip.dataset.aid as Aid]));
  input.touch.set_steer_mode(state.touch_steer);
  input.precision = state.precision_key;
  chase.mode = state.camera === CameraView.COCKPIT ? 1 : 0;
  audio.set_view(state.camera === CameraView.COCKPIT);
  chase.return_delay = CAMERA_RETURN_SECONDS[state.camera_return];
  chase.invert_y = state.invert_y;
  ghost.visible = state.ghost;
  audio.set_volume(state.volume);
  audio.set_muted(state.muted);
}

settings.on_change = (state, key) => {
  if (key === "quality") {
    quality.set_mode(state.quality);
    quality.apply(renderer, scene, sun);
  } else if (key === "name") net.set_name(state.name ?? random_name);
  else apply_settings(state);
};
apply_settings(prefs);
$("menu-btn").addEventListener("click", () => settings.open());
// The faded touch HUD comes back on any touch along the top, where its buttons sit.
const WAKE_ZONE = 0.4;
addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.clientY < innerHeight * WAKE_ZONE) hud.wake();
}, { capture: true });
const pads = new PadTimer();
const pad_menu = new PadMenu({ settings, chat, garage_open: () => garage.is_open });
settings.on_nav = (nav) => pad_menu.navigate([nav]);
garage.on_tab = (step) => settings.step_tab(step);
garage.on_back = () => settings.back();

function spawn_at(index: number, reverse = false) {
  const p = world.road[world.clear_spawn(index, reverse ? -1 : 1)];
  car.place(p.x, world.height(p.x, p.z) + 0.75, p.z, Math.atan2(p.tx, p.tz) + (reverse ? Math.PI : 0));
  pads.clear();
  chase.snap(car);
}

// Back on the last checkpoint passed, not the nearest deck: that can be a later section, and a fall would be a shortcut.
function fall_back() {
  const n = world.checkpoints.length;
  const cp = world.checkpoints[(race.next - 1 + n) % n];
  spawn_at(race.started ? world.road.indexOf(world.nearest_road(cp.x, cp.z)) : SPAWN_INDEX);
}

// In a lobby race a reset stays on the circuit; free driving drops the car on the nearest street.
function reset() {
  pads.clear();
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(car.quat);
  if (lobby.busy && lobby.route === "circuit") {
    const near = world.nearest_road(car.pos.x, car.pos.z);
    spawn_at(world.road.indexOf(near), f.x * near.tx + f.z * near.tz < 0);
    return;
  }
  const spot = world.spawn_near(car.pos.x, car.pos.z, f.x, f.z);
  car.place(spot.x, spot.y + 0.75, spot.z, spot.heading);
  chase.snap(car);
}

// `?debug&at=<road index>` starts the car anywhere on the circuit, for checking a stretch of track by eye.
spawn_at((params.has("debug") && Number(params.get("at"))) || SPAWN_INDEX);

const modes = new Modes(scene, world, SPAWN_INDEX, () => lobby.record, (x, y, z, heading) => {
  car.place(x, y, z, heading);
  car.nitro.refill();
  pads.clear();
  chase.snap(car);
  history.length = 0;
}, () => lobby.busy, () => audio.chime(), camera);
modes.start();
const updater = new Updater(() => lobby.busy || modes.active);
updater.start();
const system_back = new SystemBack(
  {
    create_watcher: "CloseWatcher" in window ? () => new (window as unknown as { CloseWatcher: new () => Watcher }).CloseWatcher() : null,
    push_guard: () => window.history.pushState(GUARD_STATE, ""),
  },
  () => {
    const changelog = document.querySelector<HTMLDialogElement>("dialog.changelog[open]");
    const popover = document.querySelector<HTMLElement>(":popover-open");
    if (changelog) changelog.close();
    else if (settings.is_open) settings.back();
    else if (popover) popover.hidePopover();
    else if (chat.is_open) chat.close();
    else settings.open();
  },
);
system_back.start();
if (!take_drive()) settings.open();
// Typing a name on a phone would raise the keyboard over the menu, so only a mouse and keyboard get the cursor.
if (prefs.name === null && matchMedia("(pointer: fine)").matches) settings.focus_name();

garage.on_change = (next) => {
  const { pos, heading } = car;
  const tank = car.nitro;
  car = new Car(build_spec(next));
  car.nitro.carry(tank, lobby.busy || modes.active);
  pads.clear();
  car.park(pos.x, pos.z, heading, world);
  apply_car_settings(settings.state);
  input.touch.show_nitro(car.nitro.fitted);
  scene.remove(view.root);
  dispose_car_view(view);
  view = build_view(next, car.spec);
  scene.add(view.root);
  light.mount(view.root);
  sync_car_view(view, car);
};

$("garage-btn").addEventListener("click", () => settings.open(MenuTab.GARAGE));
$("modes-btn").addEventListener("click", () => settings.open("modes"));

interface Frame {
  at: number;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  vel: THREE.Vector3;
  ang: THREE.Vector3;
  gear: number;
  omega: number[];
  race: RaceSnapshot;
  nitro: NitroSnapshot;
  pads: PadSnapshot;
}
const REWIND_SECONDS = 10;
const history: Frame[] = [];

function record(now: number) {
  history.push({
    at: now,
    pos: car.pos.clone(),
    quat: car.quat.clone(),
    vel: car.vel.clone(),
    ang: car.ang.clone(),
    gear: car.gear,
    omega: car.wheels.map((w) => w.omega),
    race: race.snapshot(),
    nitro: car.nitro.snapshot(),
    pads: pads.snapshot(),
  });
  while (history.length && now - history[0].at > REWIND_SECONDS * 1000) history.shift();
}

function rewind_step(now: number) {
  if (history.length > 1) history.pop();
  const f = history[history.length - 1];
  if (!f) return;
  car.pos.copy(f.pos);
  car.quat.copy(f.quat);
  car.vel.copy(f.vel);
  car.ang.copy(f.ang);
  car.gear = f.gear;
  car.parked = false;
  car.wheels.forEach((w, i) => (w.omega = f.omega[i]));
  race.restore(f.race, now - f.at);
  car.nitro.restore(f.nitro);
  pads.restore(f.pads);
  if (race.started) ghost.rewind_to(now - race.started);
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

const app = $("app");
let fitted = "";
// CSS owns the canvas size; this only matches the drawing buffer to it. Polled every frame because a resize event can
// be missed (tab opened in the background, snapped window, zoom while hidden) and would leave the buffer stale.
let size_report = "";
let render_report = "";
const DEBUG_MS = 250;
const debug_overlay = params.has("debug") ? document.body.appendChild(Object.assign(document.createElement("pre"), { id: "debug" })) : null;
let debug_at = 0;
const composer_on = () => quality.tier.bloom && !bisect.has("nocomposer");
// Runs after the frame is drawn, so viewport and scissor are what that frame actually left behind.
function check_size(now: number) {
  const gl = renderer.getContext();
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  const viewport = gl.getParameter(gl.VIEWPORT) as Int32Array;
  const scissor = gl.getParameter(gl.SCISSOR_BOX) as Int32Array;
  const report = [
    `window ${innerWidth}x${innerHeight} @${devicePixelRatio}`,
    `canvas css ${rect.left},${rect.top} ${rect.width}x${rect.height}`,
    `buffer ${canvas.width}x${canvas.height}`,
    `drawing ${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`,
    `viewport ${[...viewport].join(",")}`,
    `scissor ${gl.isEnabled(gl.SCISSOR_TEST) ? "on" : "off"} ${[...scissor].join(",")}`,
    `ratio ${renderer.getPixelRatio()} tier ${quality.level}`,
    `target ${renderer.getRenderTarget() === null ? "screen" : "offscreen"}`,
    `composer ${composer_on() ? "on" : "off"} bloom ${composer_on() && !bisect.has("nobloom") && bloom.enabled ? "on" : "off"} shadows ${renderer.shadowMap.enabled ? "on" : "off"}`,
    `bisect ${[...bisect].join(" ") || "none"}`,
  ].join(" | ");
  if (report !== render_report) {
    render_report = report;
    console.info("render:", report);
  }
  if (debug_overlay && now - debug_at > DEBUG_MS) {
    debug_at = now;
    const probe = composer_on() ? (nan_probe?.status ?? "") : "scene n/a (no composer)";
    debug_overlay.textContent = `${report.replaceAll(" | ", "\n")}\n${probe}`;
  }
  const ok =
    Math.abs(rect.width - innerWidth) < 1 &&
    Math.abs(rect.height - innerHeight) < 1 &&
    canvas.width === gl.drawingBufferWidth &&
    canvas.height === gl.drawingBufferHeight &&
    viewport[2] === canvas.width &&
    viewport[3] === canvas.height;
  if (!ok && report !== size_report) console.warn("canvas size mismatch:", report);
  size_report = ok ? "" : report;
}

function fit() {
  const width = app.clientWidth;
  const height = app.clientHeight;
  const ratio = quality.ratio;
  const key = `${width}x${height}@${ratio}`;
  if (key === fitted || !width || !height) return;
  fitted = key;
  renderer.setPixelRatio(ratio);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(ratio);
  composer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
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

const DT = 1 / 360;
// Farther than a step can move: the car was placed (reset, mode restart), so drawing it does not slide from the old spot.
const TELEPORT_SQ = 1;
let acc = 0;
/** The car before its last physics step; the drawn car and the camera sit between this and `car`, `acc / DT` of the way. */
const step_from = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const drawn = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), vel: new THREE.Vector3() };
let last = performance.now();
let last_rumble = 0;

// A timer, not the render loop: rAF stops in a background tab, and a silent peer gets pruned by everyone else.
setInterval(() => {
  const state: CarState = {
    id: net.id,
    name: net.name,
    paint: garage.build.paint,
    // Builds before 0.5.0 reject suspension 3, builds before nitro reject its tail digit and builds before the aero kits
    // reject aero 3 and 4, each showing the whole car as a stock coupe; peers never see suspension, see a kit as its wing,
    // and see nitro by the `boost` flame flag.
    b: build_code({ ...garage.build, parts: { ...garage.build.parts, suspension: Math.min(garage.build.parts.suspension, 2), aero: Math.min(garage.build.parts.aero, 2), nitro: 0 } }),
    seed,
    t: performance.now(),
    p: car.pos.toArray() as CarState["p"],
    q: car.quat.toArray() as CarState["q"],
    v: car.vel.toArray() as CarState["v"],
    steer: car.steer,
    brake: car.braking > 0.05,
    boost: car.nitro.boosting,
    best: race.best,
  };
  net.send(state);
}, 50);
let stuck = 0;
let rewinding = false;

const NEAR_GAP = 1.2;
const NEAR_PEER = 4;
/** Something close this frame, and whether the pass touched it (a crash, or driving through a ghost peer). */
function near_miss(impact: number): { near: Near; touched: boolean } {
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
  const { controls, actions } = input.read();
  if (garage.is_open) garage.navigate(input.nav);
  else pad_menu.navigate(input.nav);
  for (const action of actions) {
    if (action === "reset") {
      if (modes.active) modes.restart();
      else reset();
    }
    if (action === "restart") restart_action();
    const state = settings.state;
    if (action === "recenter") chase.recenter();
    if (action === "camera") {
      if (modes.parking) modes.toggle_view();
      else settings.set("camera", state.camera === CameraView.CHASE ? CameraView.COCKPIT : CameraView.CHASE);
    }
    if (action === "shift_up" || action === "shift_down") {
      if (state.auto) hud.toast("Manual gearbox");
      settings.set("auto", false);
      car.shift(action === "shift_up" ? 1 : -1);
    }
    if (action === "auto" || action === "tcs" || action === "abs" || action === "assist" || action === "ghost") toggle_aid(action);
    if (action === "help") settings.is_open ? settings.close() : settings.open_keys();
    if (action === "garage") garage.is_open ? settings.close() : settings.open(MenuTab.GARAGE);
    if (action === "settings") settings.open();
    if (action === "menu") pad_menu.toggle();
  }

  lobby.update(now);
  let stepped = 0;
  let simulated = false;
  if (input.rewind && history.length > 1 && !lobby.busy && !modes.active) {
    rewinding = true;
    rewind_step(now);
    acc = 0;
  } else if (lobby.state.kind === "countdown" || modes.holding || garage.is_open || (settings.is_open && net.remotes.size === 0)) {
    rewinding = false;
    acc = 0;
  } else {
    simulated = true;
    rewinding = false;
    acc += dt;
    let impact = 0;
    while (acc >= DT) {
      step_from.pos.copy(car.pos);
      step_from.quat.copy(car.quat);
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
    record(now);
    if (world_view.jumps.update(dt, car).clean) {
      hud.toast("Clean!");
      audio.chime();
    }
    if (race.started) ghost.record(now - race.started, car);
  }

  const upright = new THREE.Vector3(0, 1, 0).applyQuaternion(car.quat).y;
  if (world.fallen(car.pos)) {
    fall_back();
    stuck = 0;
  }
  const drowned = world.height(car.pos.x, car.pos.z) < -0.4 && car.pos.y < 0.4;
  stuck = !rewinding && (drowned || (upright < 0.3 && car.vel.length() < 2)) ? stuck + dt : 0;
  if (stuck > 1.5) {
    reset();
    stuck = 0;
  }

  race.update(car.pos.x, car.pos.z, now);
  update_gates(now / 1000);
  ghost.update(race.started && !modes.active ? now - race.started : null, camera.position);
  modes.update(stepped, car);
  // Rewind, the garage and the countdown don't step the car, so a held boost would never let go of the flame.
  if (!simulated) car.nitro.cut();
  if (!simulated || step_from.pos.distanceToSquared(car.pos) > TELEPORT_SQ) {
    step_from.pos.copy(car.pos);
    step_from.quat.copy(car.quat);
  }
  drawn.pos.lerpVectors(step_from.pos, car.pos, acc / DT);
  drawn.quat.slerpQuaternions(step_from.quat, car.quat, acc / DT);
  drawn.vel.copy(car.vel);
  sync_car_view(view, car);
  show_flame(view, car.nitro.boosting, now / 1000);
  view.root.position.copy(drawn.pos);
  view.root.quaternion.copy(drawn.quat);
  chase.top = modes.high_view;
  chase.boost = car.nitro.boosting;
  view.heads.visible = chase.mode !== 1 || chase.top;
  if (view.halo) view.halo.visible = view.heads.visible;
  chase.eye = view.eye;
  place_contact_shadow(car_shadow, drawn.pos.x, drawn.pos.y, drawn.pos.z, car.heading, world);
  const offroad = world.grip(car.pos.x, car.pos.z) < 1;
  chase.update(dt, drawn, world, offroad, now / 1000, input.look);
  recenter.toggleAttribute("data-shown", chase.orbited);
  light.follow(car.pos);

  smoke.update(dt, car, world);
  skids.update(car, world);

  net.prune();
  remotes.update(dt, camera, car.pos);

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
  if (quality.adapt(dt)) quality.apply(renderer, scene, sun);
  fit();
  world_view.update(camera, quality.tier.fog_far);
  // The garage covers the screen and draws the car with its own renderer; the next frame after it closes draws the world.
  if (!garage.is_open) {
    if (composer_on()) composer.render();
    else renderer.render(scene, camera);
  }
  if (import.meta.env.DEV || debug_overlay) check_size(now);
  requestAnimationFrame(frame);
}

if (import.meta.env.DEV)
  Object.assign(window, {
    open_road: {
      get car() {
        return car;
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
      renderer,
      composer,
      step_quality: () => quality.step() && quality.apply(renderer, scene, sun),
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
