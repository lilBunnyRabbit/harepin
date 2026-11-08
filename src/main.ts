import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Audio } from "./audio";
import { town_meshes } from "./buildings";
import { ChaseCamera } from "./camera";
import { build_code, build_spec, type Build } from "./build";
import { Car } from "./car";
import { Chat } from "./chat";
import { Skids, Smoke } from "./effects";
import { Garage, load_build } from "./garage";
import { Ghost } from "./ghost";
import { $, Hud } from "./hud";
import { Input } from "./input";
import { Lobby, min_lap_ms } from "./lobby";
import { Modes } from "./modes/modes";
import { car_view, contact_shadow, dispose_car_view, gates, place_contact_shadow, roadside, sync_car_view } from "./models";
import { Net, parse_seed, type CarState } from "./net";
import { Quality } from "./quality";
import { brand, car_paints, color, rgba, theme_name, tones } from "./palette";
import { THEMES, choose_theme } from "./theme";
import { Race, type RaceSnapshot } from "./race";
import { Remotes } from "./remotes";
import { seed_of } from "./rng";
import { road_meshes, terrain_mesh, tree_meshes, water_mesh } from "./scene";
import { clouds, sky } from "./sky";
import { Lighting } from "./lighting";
import { CameraView, Settings, load_settings, type SettingsState } from "./settings";
import { World } from "./world";
import "./style.css";

const params = new URLSearchParams(location.search);
const room = params.get("room") ?? "lobby";
const seed = parse_seed(params.get("seed")) ?? seed_of(room);
const ADJECTIVES = ["Swift", "Fuzzy", "Lucky", "Bouncy", "Sly", "Brave", "Zippy", "Mellow"];
const random_name = `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]} Bunny`;
const prefs = load_settings(params);

await new Promise((r) => setTimeout(r, 30));
const world = new World(seed);

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

const light = new Lighting(scene, prefs.light);
const sun = light.sun;
quality.apply(renderer, scene, sun);

scene.add(...light.dress(sky(), clouds(world.seed)), terrain_mesh(world), road_meshes(world), roadside(world), water_mesh(), tree_meshes(world), town_meshes(world));
const gate_views = gates(world);
for (const g of gate_views) scene.add(g.group);

const net = new Net(room, seed, prefs.name ?? random_name);
const chat = new Chat(net);
chat.start();
const build = load_build(params.get("car"));
const build_view = (b: Build, spec = build_spec(b)) => car_view(color(car_paints[b.paint % car_paints.length]), spec, b.spoiler);
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
if (!bisect.has("nobloom")) composer.addPass(bloom);
composer.addPass(new OutputPass());

const garage = new Garage(document.body, build);
const input = new Input($("touch"));
input.blocked = () => garage.is_open || settings.is_open;
input.touch.start();
const audio = new Audio();
for (const event of ["keydown", "pointerdown", "gamepadconnected"]) addEventListener(event, () => audio.start(), { once: true });

const race = new Race(world);
const chase = new ChaseCamera(camera);
const remotes = new Remotes(scene, $("labels"), net, world);
const lobby = new Lobby(net, min_lap_ms(world.checkpoints), seed);
lobby.start();
const hud = new Hud(world, race, net, room, lobby, prefs.hud);
const ghost = new Ghost(scene, world.seed);
race.on_lap = (improved) => {
  ghost.finish(improved);
  lobby.lap(performance.now());
};
const SPAWN_INDEX = -40;
lobby.on_start = () => {
  modes.exit();
  spawn_at(SPAWN_INDEX);
  race.reset();
  history.length = 0;
};
race.on_start = () => ghost.start();

const settings = new Settings(document.body, {
  room,
  seed,
  name: () => net.name,
  quality_status: () => ({ tier: quality.tier_name, ratio: quality.ratio, bloom: quality.tier.bloom, shadow_size: quality.tier.shadow_size }),
  race_busy: () => lobby.busy,
  toggle_race: (laps) => (lobby.busy ? lobby.leave() : lobby.call(laps)),
}, prefs);

function apply_car_settings(state: SettingsState) {
  Object.assign(car, { tcs: state.tcs, abs: state.abs, assist: state.assist, auto: state.auto });
}

function apply_settings(state: SettingsState) {
  apply_car_settings(state);
  chase.mode = state.camera === CameraView.COCKPIT ? 1 : 0;
  ghost.visible = state.ghost;
  document.body.classList.toggle("help-hidden", !state.help);
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
$("settings-btn").addEventListener("click", () => settings.open());

function spawn_at(index: number, reverse = false) {
  const p = world.road[(index + world.road.length) % world.road.length];
  car.place(p.x, world.height(p.x, p.z) + 0.75, p.z, Math.atan2(p.tx, p.tz) + (reverse ? Math.PI : 0));
  chase.snap(car);
}

// In a lobby race a reset stays on the circuit; free driving drops the car on the nearest street.
function reset() {
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(car.quat);
  if (lobby.busy) {
    const near = world.nearest_road(car.pos.x, car.pos.z);
    spawn_at(world.road.indexOf(near), f.x * near.tx + f.z * near.tz < 0);
    return;
  }
  const spot = world.spawn_near(car.pos.x, car.pos.z, f.x, f.z);
  car.place(spot.x, spot.y + 0.75, spot.z, spot.heading);
  chase.snap(car);
}

spawn_at(SPAWN_INDEX);

const modes = new Modes(scene, world, SPAWN_INDEX, () => lobby.record, (x, y, z, heading) => {
  car.place(x, y, z, heading);
  chase.snap(car);
  history.length = 0;
}, () => lobby.busy);
modes.start();

garage.on_change = (next) => {
  const { pos, heading } = car;
  car = new Car(build_spec(next));
  car.place(pos.x, Math.max(pos.y, world.height(pos.x, pos.z)) + 0.25, pos.z, heading);
  apply_car_settings(settings.state);
  scene.remove(view.root);
  dispose_car_view(view);
  view = build_view(next, car.spec);
  scene.add(view.root);
  light.mount(view.root);
  sync_car_view(view, car);
};

$("garage-btn").addEventListener("click", () => garage.open());

interface Frame {
  at: number;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  vel: THREE.Vector3;
  ang: THREE.Vector3;
  gear: number;
  omega: number[];
  race: RaceSnapshot;
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
  car.wheels.forEach((w, i) => (w.omega = f.omega[i]));
  race.restore(f.race, now - f.at);
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
    `composer ${quality.tier.bloom && !bisect.has("nocomposer") ? "on" : "off"} bloom ${quality.tier.bloom && !bisect.has("nocomposer") && !bisect.has("nobloom") && bloom.enabled ? "on" : "off"} shadows ${renderer.shadowMap.enabled ? "on" : "off"}`,
    `bisect ${[...bisect].join(" ") || "none"}`,
  ].join(" | ");
  if (report !== render_report) {
    render_report = report;
    console.info("render:", report);
  }
  if (debug_overlay && now - debug_at > DEBUG_MS) {
    debug_at = now;
    debug_overlay.textContent = report.replaceAll(" | ", "\n");
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

const DT = 1 / 360;
let acc = 0;
let last = performance.now();
let last_rumble = 0;

// A timer, not the render loop: rAF stops in a background tab, and a silent peer gets pruned by everyone else.
setInterval(() => {
  const state: CarState = {
    id: net.id,
    name: net.name,
    paint: garage.build.paint,
    b: build_code(garage.build),
    seed,
    t: performance.now(),
    p: car.pos.toArray() as CarState["p"],
    q: car.quat.toArray() as CarState["q"],
    v: car.vel.toArray() as CarState["v"],
    steer: car.steer,
    brake: car.braking > 0.05,
    best: race.best,
  };
  net.send(state);
}, 50);
let stuck = 0;
let rewinding = false;

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const { controls, actions } = input.read();
  for (const action of actions) {
    if (action === "reset") {
      if (modes.active) modes.restart();
      else reset();
    }
    const state = settings.state;
    if (action === "camera") settings.set("camera", state.camera === CameraView.CHASE ? CameraView.COCKPIT : CameraView.CHASE);
    if (action === "shift_up" || action === "shift_down") {
      settings.set("auto", false);
      car.shift(action === "shift_up" ? 1 : -1);
    }
    if (action === "auto") settings.set("auto", !state.auto);
    if (action === "tcs") settings.set("tcs", !state.tcs);
    if (action === "abs") settings.set("abs", !state.abs);
    if (action === "assist") settings.set("assist", !state.assist);
    if (action === "ghost") settings.set("ghost", !state.ghost);
    if (action === "help") settings.set("help", !state.help);
    if (action === "garage" && !settings.is_open) garage.is_open ? garage.close() : garage.open();
    if (action === "settings" && !garage.is_open) settings.open();
  }

  lobby.update(now);
  let stepped = 0;
  if (input.rewind && history.length > 1 && !lobby.busy && !modes.active) {
    rewinding = true;
    rewind_step(now);
    acc = 0;
  } else if (lobby.state.kind === "countdown" || garage.is_open || (settings.is_open && net.remotes.size === 0)) {
    rewinding = false;
    acc = 0;
  } else {
    rewinding = false;
    acc += dt;
    let impact = 0;
    while (acc >= DT) {
      car.step(DT, controls, world);
      stepped += DT;
      impact = Math.max(impact, world.collide(car));
      acc -= DT;
    }
    if (impact > 2) {
      audio.impact(impact / 20);
      chase.bump(Math.min(1, impact / 15));
      input.rumble(1, 1, true);
    }
    record(now);
    if (race.started) ghost.record(now - race.started, car);
  }

  const upright = new THREE.Vector3(0, 1, 0).applyQuaternion(car.quat).y;
  const drowned = world.height(car.pos.x, car.pos.z) < -0.4 && car.pos.y < 0.4;
  stuck = !rewinding && (drowned || (upright < 0.3 && car.vel.length() < 2)) ? stuck + dt : 0;
  if (stuck > 1.5) {
    reset();
    stuck = 0;
  }

  race.update(car.pos.x, car.pos.z, now);
  update_gates(now / 1000);
  ghost.update(race.started ? now - race.started : null);
  modes.update(stepped, car);
  sync_car_view(view, car);
  place_contact_shadow(car_shadow, car.pos.x, car.pos.y, car.pos.z, car.heading, world);
  const offroad = world.grip(car.pos.x, car.pos.z) < 1;
  chase.update(dt, car, world, offroad, now / 1000);
  light.follow(car.pos);

  smoke.update(dt, car, world);
  skids.update(car, world);

  net.prune();
  remotes.update(dt, camera, car.pos);

  const speed = car.vel.length();
  const scrub = car.scrub * Math.min(1, speed / 6) * (offroad ? 0.3 : 1);
  audio.update({ rpm: car.rpm, throttle: car.throttle, scrub, speed, offroad });
  if (now - last_rumble > 100) {
    last_rumble = now;
    const spin = Math.max(0, ...car.wheels.filter((w) => w.driven).map((w) => w.slip - 0.15));
    input.rumble(scrub * 0.6 + (offroad ? Math.min(0.4, speed / 50) : 0), Math.min(1, spin * 2));
  }

  hud.update(car, now, rewinding);
  if (quality.adapt(dt)) quality.apply(renderer, scene, sun);
  fit();
  if (quality.tier.bloom && !bisect.has("nocomposer")) composer.render();
  else renderer.render(scene, camera);
  if (import.meta.env.DEV || debug_overlay) check_size(now);
  requestAnimationFrame(frame);
}

const picker = $("theme", HTMLSelectElement);
for (const theme of Object.keys(THEMES)) picker.add(new Option(theme, theme, false, theme === theme_name));
picker.addEventListener("change", () => {
  choose_theme(picker.value);
  location.reload();
});
picker.addEventListener("keydown", (e) => {
  e.preventDefault();
  picker.blur();
});

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

const invite = $("invite", HTMLButtonElement);
invite.addEventListener("click", async () => {
  const link = `${location.origin}${location.pathname}?room=${encodeURIComponent(room)}&seed=${seed}`;
  try {
    await navigator.clipboard.writeText(link);
    invite.textContent = "Copied!";
  } catch {
    invite.textContent = link;
  }
  setTimeout(() => (invite.textContent = "Copy invite link"), 2000);
  invite.blur();
});
const laps = $("race-laps", HTMLSelectElement);
$("race-call").addEventListener("click", () => (lobby.busy ? lobby.leave() : lobby.call(Number(laps.value))));
laps.addEventListener("change", () => laps.blur());

$("private").addEventListener("click", () => {
  const code = Math.random().toString(36).slice(2, 8);
  location.search = `?room=${code}`;
});

document.addEventListener("click", (e) => {
  if (e.target instanceof HTMLButtonElement) e.target.blur();
});

$("loading").remove();
requestAnimationFrame(frame);
