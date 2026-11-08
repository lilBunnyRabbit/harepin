import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Audio } from "./audio";
import { ChaseCamera } from "./camera";
import { Car } from "./car";
import { Chat } from "./chat";
import { Skids, Smoke } from "./effects";
import { Ghost } from "./ghost";
import { $, Hud } from "./hud";
import { Input } from "./input";
import { Lobby, min_lap_ms } from "./lobby";
import { car_view, contact_shadow, gates, place_contact_shadow, roadside, sync_car_view } from "./models";
import { Net, parse_seed, type CarState } from "./net";
import { Quality } from "./quality";
import { brand, car_paints, color, dark, rgba, theme_name, tones } from "./palette";
import { THEMES, choose_theme } from "./theme";
import { Race, type RaceSnapshot } from "./race";
import { Remotes } from "./remotes";
import { seed_of } from "./rng";
import { road_meshes, terrain_mesh, tree_meshes, water_mesh } from "./scene";
import { FOG, SUN_DIR, clouds, sky, sky_tones } from "./sky";
import { World } from "./world";
import "./style.css";

const params = new URLSearchParams(location.search);
const room = params.get("room") ?? "lobby";
const seed = parse_seed(params.get("seed")) ?? seed_of(room);
const ADJECTIVES = ["Swift", "Fuzzy", "Lucky", "Bouncy", "Sly", "Brave", "Zippy", "Mellow"];
const name = params.get("name") ?? `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]} Bunny`;

await new Promise((r) => setTimeout(r, 30));
const world = new World(seed);

const quality = new Quality(params);
const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: "high-performance" });
renderer.setPixelRatio(quality.ratio);
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.type = THREE.PCFShadowMap;
$("app").append(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(FOG, 180, 1300);
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 5000);

scene.add(new THREE.HemisphereLight(color(sky_tones.skylight), color(brand.background_dark), dark ? 1.9 : 1.5));
const sun = new THREE.DirectionalLight(color(sky_tones.sunlight), dark ? 3.3 : 2.6);
Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 900 });
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.015;
scene.add(sun, sun.target);
quality.apply(renderer, scene, sun);

scene.add(sky(), clouds(world.seed), terrain_mesh(world), road_meshes(world), roadside(world), water_mesh(), tree_meshes(world));
const gate_views = gates(world);
for (const g of gate_views) scene.add(g.group);

const net = new Net(room, seed);
const chat = new Chat(net, name);
chat.start();
const paint = Number(params.get("paint") ?? [...net.id].reduce((s, c) => s + c.charCodeAt(0), 0) % car_paints.length);
const car = new Car();
const view = car_view(color(car_paints[paint]));
scene.add(view.root);
const car_shadow = contact_shadow();
scene.add(car_shadow.mesh);

const headlight = new THREE.SpotLight(color(tones.head), dark ? 140 : 30, 90, 0.42, 0.55, 1.4);
headlight.position.set(0, 0.1, 2.0);
headlight.target.position.set(0, -1.2, 14);
view.root.add(headlight, headlight.target);

const smoke = new Smoke();
const skids = new Skids();
scene.add(smoke.mesh, skids.mesh);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), dark ? 0.6 : 0.2, 0.45, dark ? 0.9 : 0.98);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const input = new Input($("touch"));
input.touch.start();
const audio = new Audio();
for (const event of ["keydown", "pointerdown", "gamepadconnected"]) addEventListener(event, () => audio.start(), { once: true });

const race = new Race(world);
const chase = new ChaseCamera(camera);
const remotes = new Remotes(scene, $("labels"), net, world);
const lobby = new Lobby(net, name, min_lap_ms(world.checkpoints));
lobby.start();
const hud = new Hud(world, race, net, name, room, lobby);
const ghost = new Ghost(scene);
race.on_lap = (improved) => {
  ghost.finish(improved);
  lobby.lap(performance.now());
};
lobby.on_start = () => {
  spawn_at(-40);
  race.restore({ next: 0, started: 0, splits: [] }, 0);
  history.length = 0;
};
race.on_start = () => ghost.start();

const HELP_KEY = "harepin:help";
const set_help = (shown: boolean) => {
  document.body.classList.toggle("help-hidden", !shown);
  try {
    localStorage.setItem(HELP_KEY, String(shown));
  } catch {}
};
set_help((() => {
  try {
    return localStorage.getItem(HELP_KEY) !== "false";
  } catch {
    return true;
  }
})());

function spawn_at(index: number, reverse = false) {
  const p = world.road[(index + world.road.length) % world.road.length];
  car.place(p.x, world.height(p.x, p.z) + 0.75, p.z, Math.atan2(p.tx, p.tz) + (reverse ? Math.PI : 0));
  chase.snap(car);
}

function reset() {
  const near = world.nearest_road(car.pos.x, car.pos.z);
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(car.quat);
  spawn_at(world.road.indexOf(near), f.x * near.tx + f.z * near.tz < 0);
}

spawn_at(-40);

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
    name,
    paint,
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
    if (action === "reset") reset();
    if (action === "camera") chase.mode = (chase.mode + 1) % 2;
    if (action === "shift_up" || action === "shift_down") {
      car.auto = false;
      car.shift(action === "shift_up" ? 1 : -1);
    }
    if (action === "auto") car.auto = !car.auto;
    if (action === "tcs") car.tcs = !car.tcs;
    if (action === "abs") car.abs = !car.abs;
    if (action === "assist") car.assist = !car.assist;
    if (action === "ghost") ghost.visible = !ghost.visible;
    if (action === "help") set_help(document.body.classList.contains("help-hidden"));
  }

  lobby.update(now);
  if (input.rewind && history.length > 1 && !lobby.busy) {
    rewinding = true;
    rewind_step(now);
    acc = 0;
  } else if (lobby.state.kind === "countdown") {
    rewinding = false;
    acc = 0;
  } else {
    rewinding = false;
    acc += dt;
    let impact = 0;
    while (acc >= DT) {
      car.step(DT, controls, world);
      impact = Math.max(impact, world.collide(car.pos, car.vel, car.ang, car.heading));
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
  sync_car_view(view, car);
  place_contact_shadow(car_shadow, car.pos.x, car.pos.y, car.pos.z, car.heading, world);
  const offroad = world.grip(car.pos.x, car.pos.z) < 1;
  chase.update(dt, car, world, offroad, now / 1000);
  sun.position.copy(car.pos).addScaledVector(SUN_DIR, 400);
  sun.target.position.copy(car.pos);

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
  if (quality.tier.bloom) composer.render();
  else renderer.render(scene, camera);
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
      car,
      input,
      lobby,
      race,
      world,
      ghost,
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
