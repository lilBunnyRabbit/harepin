import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Lighting } from "../render/lighting";
import { sanitise_bloom } from "../render/postfx";
import { Quality } from "../render/quality";
import { sky } from "../render/sky";
import { brand, color, rgba } from "../theme/palette";
import { SHEETS, type Sheet } from "./catalog";
import { SHOWCASE_PARAM } from "./params";
import { SHEET_LAYOUTS, type Tile } from "./showcase-tiles";
import "../style.css";

const MIN_CELL = 280;
const ASPECT = 0.62;
const LABEL = 22;
const FOV = 30;
const MARGIN = 1.05;
const GROUND_REACH = 1.25;
const COMPOSER_SAMPLES = 4;
// From the showcase chunk, not a CSS import, so none of it reaches the game's stylesheet.
const SHEET_CSS = `
html:has(canvas.showcase) body > :not(canvas.showcase) { display: none !important; }
html:has(canvas.showcase), html:has(canvas.showcase) body { overflow: auto; height: auto; background: var(--background); }
html body canvas.showcase { display: block; visibility: visible !important; }`;

const params = new URLSearchParams(location.search);
const asked = params.get(SHOWCASE_PARAM);
const sheet: Sheet = SHEETS.find((name) => name === asked) ?? "cars";
const root = document.documentElement;
root.dataset.review = "busy";
document.getElementById("loading")?.remove();
document.head.append(Object.assign(document.createElement("style"), { textContent: SHEET_CSS }));
await document.fonts.ready;

const layout = SHEET_LAYOUTS[sheet]();
const width = innerWidth;
const columns = layout.columns ?? Math.max(2, Math.floor(width / MIN_CELL));
const cell_w = Math.floor(width / columns);
const cell_h = Math.round(cell_w * ASPECT);
const rows = Math.ceil(layout.tiles.length / columns);
const ratio = devicePixelRatio;

const quality = new Quality(params, "high");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, cell_w / cell_h, 0.1, 5000);
const light = new Lighting(scene, {}, quality.mobile);
const dome = sky();
scene.add(dome);
const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(ratio, quality.tier.max_ratio));
renderer.setSize(cell_w, cell_h, false);
renderer.shadowMap.type = THREE.PCFShadowMap;
quality.apply(renderer, scene, light.sun);
const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(buffer.x, buffer.y, { type: THREE.HalfFloatType, samples: quality.antialias ? COMPOSER_SAMPLES : 0 }));
composer.addPass(new RenderPass(scene, camera));
if (quality.tier.bloom) {
  const bloom = new UnrealBloomPass(new THREE.Vector2(cell_w / 2, cell_h / 2), light.bloom.strength, 0.45, light.bloom.threshold);
  sanitise_bloom(bloom);
  composer.addPass(bloom);
}
composer.addPass(new OutputPass());

const sheet_canvas = document.createElement("canvas");
sheet_canvas.className = "showcase";
sheet_canvas.width = width * ratio;
sheet_canvas.height = rows * (cell_h + LABEL) * ratio;
sheet_canvas.style.width = `${width}px`;
sheet_canvas.style.height = `${rows * (cell_h + LABEL)}px`;
document.body.append(sheet_canvas);
const ctx = sheet_canvas.getContext("2d");
if (!ctx) throw new Error("showcase: no 2d canvas");
ctx.scale(ratio, ratio);
ctx.fillStyle = rgba(brand.background);
ctx.fillRect(0, 0, width, rows * (cell_h + LABEL));
ctx.font = `600 13px ${getComputedStyle(document.body).fontFamily}`;
ctx.textBaseline = "middle";

const bounds = layout.tiles.map((tile) => new THREE.Box3().setFromObject(tile.object));
const radius = (box: THREE.Box3) => box.getBoundingSphere(new THREE.Sphere()).radius;
const shared = Math.max(...bounds.map(radius));
const ground_geometry = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);

layout.tiles.forEach((tile, i) => {
  const box = bounds[i];
  const reach = layout.same_scale ? shared : radius(box);
  shoot(tile, box.getCenter(new THREE.Vector3()), reach);
  const x = (i % columns) * cell_w;
  const y = Math.floor(i / columns) * (cell_h + LABEL);
  ctx.drawImage(renderer.domElement, x, y, cell_w, cell_h);
  ctx.fillStyle = rgba(brand.foreground);
  ctx.fillText(tile.label, x + 8, y + cell_h + LABEL / 2, cell_w - 16);
});
root.dataset.review = `sheet:${sheet}`;

function shoot(tile: Tile, centre: THREE.Vector3, reach: number) {
  const ground = new THREE.Mesh(ground_geometry, new THREE.MeshLambertMaterial({ color: color(tile.ground) }));
  ground.scale.setScalar(reach * GROUND_REACH);
  ground.position.set(centre.x, 0, centre.z);
  ground.receiveShadow = true;
  scene.add(tile.object, ground);
  tile.object.traverse((node) => {
    if (node instanceof THREE.Mesh) node.castShadow = true;
  });
  const distance = (reach * MARGIN) / Math.sin(THREE.MathUtils.degToRad(FOV / 2) * Math.min(1, camera.aspect));
  const yaw = THREE.MathUtils.degToRad(tile.yaw);
  const pitch = THREE.MathUtils.degToRad(tile.pitch);
  camera.position.set(centre.x + Math.sin(yaw) * Math.cos(pitch) * distance, centre.y + Math.sin(pitch) * distance, centre.z + Math.cos(yaw) * Math.cos(pitch) * distance);
  camera.lookAt(centre);
  dome.position.copy(camera.position);
  light.follow(centre);
  composer.render();
  scene.remove(tile.object, ground);
  ground.material.dispose();
}
