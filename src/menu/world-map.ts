import { brand, linear, rgba, tones } from "../theme/palette";
import { sky_tones } from "../render/sky";
import { mesh_tones } from "../render/scene";
import { MAP_SIDE, MapLineKind, type MapData, type MapMark, type MapTones } from "../worldgen/map";
import type { MapRequest } from "../worldgen/map-worker";
import type { WorldKind } from "../worldgen/types";
import { WORLDS } from "../worlds/worlds";
import "./world-map.css";

const DEBOUNCE_MS = 300;

interface Stroke {
  color: string;
  width: number;
  casing: number;
}

const LINE_STYLE: Record<MapLineKind, Stroke> = {
  street: { color: rgba(tones.sidewalk), width: 1.5, casing: 0 },
  highway: { color: rgba(brand.foreground, 0.8), width: 2, casing: 0 },
  circuit: { color: rgba(brand.accent), width: 3, casing: 2 },
};
const LINE_ORDER: MapLineKind[] = [MapLineKind.STREET, MapLineKind.HIGHWAY, MapLineKind.CIRCUIT];
const CASING = rgba(brand.background_darkest, 0.7);
const JUMP = rgba(brand.secondary);
const PAD = rgba(tones.pad);
const CHECKPOINT = rgba(brand.foreground);
const START = rgba(brand.primary);
const LABEL = rgba(brand.foreground);

const MapStatus = { DRAWING: "drawing", READY: "ready", FAILED: "failed" } as const;
type MapStatus = (typeof MapStatus)[keyof typeof MapStatus];



export class WorldMap {
  readonly root = document.createElement("div");
  on_ready: ((map: MapData) => void) | null = null;
  private readonly canvas = document.createElement("canvas");
  private readonly note = document.createElement("span");
  private worker: Worker | null = null;
  private timer = 0;
  private wanted: { seed: number; kind: WorldKind } | null = null;
  private map: MapData | null = null;
  private image: ImageBitmap | null = null;

  constructor() {
    this.root.className = "world-map";
    this.canvas.setAttribute("role", "img");
    this.note.className = "world-map-note";
    this.root.append(this.canvas, this.note);
  }

  /** Draws `seed`'s world, after a pause unless `now`, so typing a seed does not generate every keystroke. */
  show(seed: number, kind: WorldKind, now = false) {
    this.wanted = { seed, kind };
    clearTimeout(this.timer);
    if (this.map?.seed === seed && this.map.kind === kind) return this.draw();
    this.set_status(MapStatus.DRAWING);
    if (now) this.request(seed, kind);
    else this.timer = window.setTimeout(() => this.request(seed, kind), DEBOUNCE_MS);
  }

  stop() {
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.worker = null;
  }

  private request(seed: number, kind: WorldKind) {
    // A generation can't be cancelled from outside, so a stale one is dropped with its worker.
    this.worker?.terminate();
    const worker = new Worker(new URL("../worldgen/map-worker.ts", import.meta.url), { type: "module" });
    this.worker = worker;
    worker.addEventListener("message", (event: MessageEvent<MapData>) => {
      worker.terminate();
      if (this.worker === worker) this.worker = null;
      void this.receive(event.data);
    });
    worker.addEventListener("error", (event) => {
      worker.terminate();
      if (this.worker !== worker) return;
      this.worker = null;
      console.warn("world map: generation failed", event.message);
      this.set_status(MapStatus.FAILED);
    });
    const request: MapRequest = { seed, kind, tones: map_tones() };
    worker.postMessage(request);
  }

  private async receive(map: MapData) {
    const image = await createImageBitmap(new ImageData(map.pixels, MAP_SIDE, MAP_SIDE));
    this.image?.close();
    this.image = image;
    this.map = map;
    if (map.seed === this.wanted?.seed && map.kind === this.wanted.kind) this.draw();
  }

  private set_status(status: MapStatus) {
    this.root.dataset.status = status;
    const drawing = this.wanted ? WORLDS[this.wanted.kind].drawing : "";
    this.note.textContent = status === MapStatus.DRAWING ? drawing : status === MapStatus.FAILED ? "Preview failed" : "";
  }

  private draw() {
    const { map, image, canvas } = this;
    const ctx = canvas.getContext("2d");
    if (!map || !image || !ctx) return;
    this.set_status(MapStatus.READY);
    this.on_ready?.(map);
    canvas.setAttribute("aria-label", `Map of ${WORLDS[map.kind].map_label} ${map.seed}`);
    const ratio = devicePixelRatio;
    const side = Math.round((canvas.clientWidth || MAP_SIDE) * ratio);
    canvas.width = canvas.height = side;
    const scale = (side / MAP_SIDE) * ((MAP_SIDE - 1) / map.size);
    const at = (x: number, z: number): [number, number] => [(x + map.size / 2) * scale + side / MAP_SIDE / 2, (z + map.size / 2) * scale + side / MAP_SIDE / 2];
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, side, side);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (const kind of LINE_ORDER) {
      const style = LINE_STYLE[kind];
      const path = new Path2D();
      for (const line of map.lines) {
        if (line.kind !== kind) continue;
        const p = line.points;
        path.moveTo(...at(p[0], p[1]));
        for (let i = 2; i < p.length; i += 2) path.lineTo(...at(p[i], p[i + 1]));
        if (line.closed) path.closePath();
      }
      if (style.casing) stroke(ctx, path, CASING, (style.width + 2 * style.casing) * ratio);
      stroke(ctx, path, style.color, style.width * ratio);
    }

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

    const font = getComputedStyle(this.root).fontFamily;
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
}

function map_tones(): MapTones {
  return { terrain: mesh_tones().terrain, water: linear(tones.water), cloud: linear(sky_tones.cloud) };
}

function stroke(ctx: CanvasRenderingContext2D, path: Path2D | null, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (path) ctx.stroke(path);
  else ctx.stroke();
}

function arrow(ctx: CanvasRenderingContext2D, [x, y]: [number, number], mark: MapMark, size: number, color: string) {
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
