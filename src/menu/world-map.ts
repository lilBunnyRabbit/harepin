import type { MapMarker } from "../career/markers";
import { brand, linear, rgba, tones } from "../theme/palette";
import { sky_tones } from "../render/sky";
import { mesh_tones } from "../render/scene";
import { MAP_SIDE, MapLineKind, type MapData, type MapMark, type MapTones } from "../worldgen/map";
import type { MapRequest } from "../worldgen/map-worker";
import type { WorldKind } from "../worldgen/types";
import { WORLDS } from "../worlds/worlds";
import { world_look, type RoadInk } from "../worlds/world-def";
import { snow_of } from "../worldgen/kinds/kinds";
import "./world-map.css";

const DEBOUNCE_MS = 300;

interface Stroke {
  width: number;
  casing: number;
}

const LINE_STYLE: Record<MapLineKind, Stroke> = {
  street: { width: 1.5, casing: 0 },
  local: { width: 1.75, casing: 0 },
  highway: { width: 2, casing: 0 },
  circuit: { width: 3, casing: 2 },
};
const CIRCUIT = rgba(brand.accent);
const LINE_ORDER: MapLineKind[] = [MapLineKind.STREET, MapLineKind.LOCAL, MapLineKind.HIGHWAY, MapLineKind.CIRCUIT];
const CASING = rgba(brand.background_darkest, 0.7);
const JUMP = rgba(brand.secondary);
const PAD = rgba(tones.pad);
const CHECKPOINT = rgba(brand.foreground);
const START = rgba(brand.primary);
const LABEL = rgba(brand.foreground);
const PLAYER = rgba(brand.secondary);
const YOU = rgba(brand.cottontail);

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type MapAt = (x: number, z: number) => [number, number];

const MapStatus = { DRAWING: "drawing", READY: "ready", FAILED: "failed" } as const;
type MapStatus = (typeof MapStatus)[keyof typeof MapStatus];

/** A car on the map, in world metres. */
export interface MapPlayer {
  name: string;
  x: number;
  z: number;
  you: boolean;
}

export class WorldMap {
  readonly root = document.createElement("div");
  on_ready: ((map: MapData) => void) | null = null;
  private readonly canvas = document.createElement("canvas");
  // Cars move on their own layer, so a 4 Hz refresh never repaints the terrain and roads under them.
  private readonly cars = document.createElement("canvas");
  private players: readonly MapPlayer[] = [];
  private markers: readonly MapMarker[] = [];
  private at: MapAt | null = null;
  private readonly note = document.createElement("span");
  private worker: Worker | null = null;
  private timer = 0;
  private wanted: { seed: number; kind: WorldKind; key: string } | null = null;
  private map: MapData | null = null;
  private map_key = "";
  private roads: RoadInk | null = null;
  private image: ImageBitmap | null = null;
  // What the canvas holds: showing the same map at the same size again only repaints the cars.
  private drawn: { map: MapData; side: number } | null = null;

  constructor() {
    this.root.className = "world-map";
    this.canvas.setAttribute("role", "img");
    this.note.className = "world-map-note";
    this.cars.className = "world-map-cars";
    this.cars.setAttribute("aria-hidden", "true");
    this.root.append(this.canvas, this.cars, this.note);
  }

  /** Draws `seed`'s world, after a pause unless `now`, so typing a seed or dragging a slider does not generate every step. */
  show(seed: number, kind: WorldKind, now = false, levels: readonly number[] = []) {
    const key = `${kind}:${seed}:${levels.join(".")}`;
    this.wanted = { seed, kind, key };
    clearTimeout(this.timer);
    this.show_players([]);
    this.show_markers([]);
    if (this.map && this.map_key === key) return this.draw();
    this.set_status(MapStatus.DRAWING);
    if (now) this.request(seed, kind, levels, key);
    else this.timer = window.setTimeout(() => this.request(seed, kind, levels, key), DEBOUNCE_MS);
  }

  stop() {
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.worker = null;
  }

  private request(seed: number, kind: WorldKind, levels: readonly number[], key: string) {
    // A generation can't be cancelled from outside, so a stale one is dropped with its worker.
    this.worker?.terminate();
    const worker = map_worker();
    this.worker = worker;
    worker.addEventListener("message", (event: MessageEvent<MapData>) => {
      worker.terminate();
      if (this.worker === worker) this.worker = null;
      void this.receive(event.data, key, road_ink(kind, levels));
    });
    worker.addEventListener("error", (event) => {
      worker.terminate();
      if (this.worker !== worker) return;
      this.worker = null;
      console.warn("world map: generation failed", event.message);
      this.set_status(MapStatus.FAILED);
    });
    worker.postMessage(map_request(seed, kind, levels));
  }

  private async receive(map: MapData, key: string, roads: RoadInk) {
    const image = await createImageBitmap(new ImageData(map.pixels, MAP_SIDE, MAP_SIDE));
    this.image?.close();
    this.image = image;
    this.map = map;
    this.roads = roads;
    this.map_key = key;
    // The raster's corner is open water, so a frame wider than the square map continues the sea instead of a band.
    const [r, g, b] = map.pixels;
    this.root.style.setProperty("--map-edge", `rgb(${r} ${g} ${b})`);
    if (key === this.wanted?.key) this.draw();
  }

  private set_status(status: MapStatus) {
    this.root.dataset.status = status;
    const drawing = this.wanted ? WORLDS[this.wanted.kind].drawing : "";
    this.note.textContent = status === MapStatus.DRAWING ? drawing : status === MapStatus.FAILED ? "Preview failed" : "";
  }

  private draw() {
    const { map, image, roads, canvas } = this;
    const ctx = canvas.getContext("2d");
    if (!map || !image || !roads || !ctx) return;
    this.set_status(MapStatus.READY);
    this.on_ready?.(map);
    canvas.setAttribute("aria-label", `Map of ${WORLDS[map.kind].map_label} ${map.seed}`);
    const ratio = devicePixelRatio;
    const side = Math.round((Math.min(canvas.clientWidth, canvas.clientHeight) || MAP_SIDE) * ratio);
    if (this.drawn?.map === map && this.drawn.side === side) return this.draw_players();
    this.drawn = { map, side };
    canvas.width = canvas.height = side;
    this.cars.width = this.cars.height = side;
    const at = paint_map(ctx, map, image, roads, side, ratio);
    paint_marks(ctx, map, at, ratio);
    paint_towns(ctx, map, at, side, ratio, getComputedStyle(this.root).fontFamily);
    this.at = at;
    this.draw_players();
  }

  show_players(players: readonly MapPlayer[]) {
    if (!players.length && !this.players.length) return;
    this.players = players;
    this.draw_players();
  }

  /** Career event starts on the map being driven; empty on any other. */
  show_markers(markers: readonly MapMarker[]) {
    if (markers === this.markers || (!markers.length && !this.markers.length)) return;
    this.markers = markers;
    this.draw_players();
  }

  private draw_players() {
    const { cars, at } = this;
    const ctx = cars.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cars.width, cars.height);
    if (!at || (!this.players.length && !this.markers.length)) return;
    const ratio = devicePixelRatio;
    ctx.font = `600 ${12 * ratio}px ${getComputedStyle(this.root).fontFamily}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const marker of this.markers) {
      const [x, y] = at(marker.x, marker.z);
      diamond(ctx, x, y, 7 * ratio, marker.ink);
      label(ctx, marker.label, x, y, cars.width, ratio);
    }
    // Others first, so your own marker always sits on top; it goes unlabelled, like the minimap's arrow.
    for (let pass = 0; pass < 2; pass++) {
      for (const player of this.players) {
        if (player.you !== (pass === 1)) continue;
        const [x, y] = at(player.x, player.z);
        ctx.beginPath();
        ctx.arc(x, y, (player.you ? 6 : 5) * ratio, 0, Math.PI * 2);
        ctx.fillStyle = player.you ? YOU : PLAYER;
        ctx.fill();
        stroke(ctx, null, CASING, 2 * ratio);
        if (!player.you) label(ctx, player.name, x, y, cars.width, ratio);
      }
    }
  }
}

export function map_worker(): Worker {
  return new Worker(new URL("../worldgen/map-worker.ts", import.meta.url), { type: "module" });
}

export function map_request(seed: number, kind: WorldKind, levels: readonly number[]): MapRequest {
  return { seed, kind, levels, tones: map_tones(kind) };
}

/** Snow worlds draw their roads in the winter ink. */
export function road_ink(kind: WorldKind, levels: readonly number[]): RoadInk {
  return world_look(WORLDS[kind], snow_of({ kind, levels }) !== null).roads;
}

/** Paints the map's terrain and roads onto a `side`-pixel square; returns world metres to canvas pixels. */
export function paint_map(ctx: Ctx2D, map: MapData, image: ImageBitmap, roads: RoadInk, side: number, ratio: number): MapAt {
  const scale = (side / MAP_SIDE) * ((MAP_SIDE - 1) / map.size);
  const at = (x: number, z: number): [number, number] => [(x + map.size / 2) * scale + side / MAP_SIDE / 2, (z + map.size / 2) * scale + side / MAP_SIDE / 2];
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, side, side);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const kind of LINE_ORDER) {
    const style = LINE_STYLE[kind];
    const color = kind === MapLineKind.CIRCUIT ? CIRCUIT : rgba(...roads[kind]);
    const path = new Path2D();
    for (const line of map.lines) {
      if (line.kind !== kind) continue;
      const p = line.points;
      path.moveTo(...at(p[0], p[1]));
      for (let i = 2; i < p.length; i += 2) path.lineTo(...at(p[i], p[i + 1]));
      if (line.closed) path.closePath();
    }
    if (style.casing) stroke(ctx, path, CASING, (style.width + 2 * style.casing) * ratio);
    stroke(ctx, path, color, style.width * ratio);
  }
  return at;
}

function paint_marks(ctx: Ctx2D, map: MapData, at: MapAt, ratio: number) {
  for (const jump of map.jumps) arrow(ctx, at(jump.x, jump.z), jump, 7 * ratio, JUMP);
  for (const pad of map.pads) arrow(ctx, at(pad.x, pad.z), pad, 6 * ratio, PAD);
  for (const checkpoint of map.checkpoints.slice(1)) {
    ctx.beginPath();
    ctx.arc(...at(checkpoint.x, checkpoint.z), 3 * ratio, 0, Math.PI * 2);
    ctx.fillStyle = CHECKPOINT;
    ctx.fill();
    stroke(ctx, null, CASING, ratio);
  }
  const [sx, sy] = at(map.start.x, map.start.z);
  const bar = 9 * ratio;
  const start = new Path2D();
  start.moveTo(sx - map.start.fz * bar, sy + map.start.fx * bar);
  start.lineTo(sx + map.start.fz * bar, sy - map.start.fx * bar);
  stroke(ctx, start, CASING, 6 * ratio);
  stroke(ctx, start, START, 3 * ratio);
  arrow(ctx, [sx + map.start.fx * bar, sy + map.start.fz * bar], map.start, 8 * ratio, START);
}

function paint_towns(ctx: Ctx2D, map: MapData, at: MapAt, side: number, ratio: number, font: string) {
  ctx.font = `600 ${12 * ratio}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const town of map.towns) {
    const [tx, y] = at(town.x, town.z);
    const half = ctx.measureText(town.name).width / 2 + 3 * ratio;
    const x = Math.min(side - half, Math.max(half, tx));
    ctx.lineWidth = 3 * ratio;
    ctx.strokeStyle = CASING;
    ctx.strokeText(town.name, x, y);
    ctx.fillStyle = LABEL;
    ctx.fillText(town.name, x, y);
  }
}

function map_tones(kind: WorldKind): MapTones {
  return { terrain: mesh_tones(false, kind).terrain, water: linear(tones.water), cloud: linear(sky_tones.cloud), lava: linear(tones.lava) };
}

function stroke(ctx: Ctx2D, path: Path2D | null, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (path) ctx.stroke(path);
  else ctx.stroke();
}

function label(ctx: Ctx2D, text: string, x: number, y: number, side: number, ratio: number) {
  const width = ctx.measureText(text).width;
  const right = x + 10 * ratio + width < side;
  const lx = right ? x + 10 * ratio : x - 10 * ratio - width;
  ctx.lineWidth = 3 * ratio;
  ctx.strokeStyle = CASING;
  ctx.strokeText(text, lx, y);
  ctx.fillStyle = LABEL;
  ctx.fillText(text, lx, y);
}

function diamond(ctx: Ctx2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  stroke(ctx, null, CASING, 2 * r / 7);
}

function arrow(ctx: Ctx2D, [x, y]: [number, number], mark: MapMark, size: number, color: string) {
  const { fx, fz } = mark;
  ctx.beginPath();
  ctx.moveTo(x + fx * size, y + fz * size);
  ctx.lineTo(x - fx * size * 0.7 + fz * size * 0.7, y - fz * size * 0.7 - fx * size * 0.7);
  ctx.lineTo(x - fx * size * 0.7 - fz * size * 0.7, y - fz * size * 0.7 + fx * size * 0.7);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  stroke(ctx, null, CASING, size / 5);
}
