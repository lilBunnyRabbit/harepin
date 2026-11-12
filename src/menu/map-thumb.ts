import { MAP_SIDE, type MapData } from "../worldgen/map";
import type { MapSpec } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import { el } from "./setting-rows";
import { map_request, map_worker, paint_map, road_ink } from "./world-map";

const THUMB_SIDE = 96;
// Marks and roads drawn at full size would cover a thumbnail, so its ink is thinner than the big map's.
const THUMB_INK = 0.6;

const thumbs = new Map<string, Promise<string>>();
// One generation at a time, so a long saved list never runs a worker per row at once.
let queue: Promise<unknown> = Promise.resolve();

export function map_thumb(spec: MapSpec): HTMLImageElement {
  const img = el("img", "map-thumb");
  img.alt = "";
  img.decoding = "async";
  const watch = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    watch.disconnect();
    thumb_url(spec).then(
      (url) => (img.src = url),
      (error: unknown) => console.warn("map thumb: generation failed", error),
    );
  });
  watch.observe(img);
  return img;
}

/** Reuses the big preview's generation, so a map saved from it needs no second one. */
export function keep_thumb(spec: MapSpec, map: MapData) {
  const code = map_code(spec);
  if (!thumbs.has(code)) remember(code, paint(map, spec));
}

function thumb_url(spec: MapSpec): Promise<string> {
  const code = map_code(spec);
  const kept = thumbs.get(code);
  if (kept) return kept;
  const job = queue.then(() => generate(spec)).then((map) => paint(map, spec));
  queue = job.catch(() => undefined);
  return remember(code, job);
}

function remember(code: string, job: Promise<string>): Promise<string> {
  thumbs.set(code, job);
  job.catch(() => thumbs.delete(code));
  return job;
}

function generate({ seed, kind, levels }: MapSpec): Promise<MapData> {
  return new Promise((resolve, reject) => {
    const worker = map_worker();
    worker.addEventListener("message", (event: MessageEvent<MapData>) => {
      worker.terminate();
      resolve(event.data);
    });
    worker.addEventListener("error", (event) => {
      worker.terminate();
      reject(new Error(event.message));
    });
    worker.postMessage(map_request(seed, kind, levels));
  });
}

async function paint(map: MapData, { kind, levels }: MapSpec): Promise<string> {
  const image = await createImageBitmap(new ImageData(map.pixels, MAP_SIDE, MAP_SIDE));
  const ratio = devicePixelRatio;
  const side = Math.round(THUMB_SIDE * ratio);
  const canvas = new OffscreenCanvas(side, side);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("map thumb: no 2d context");
  paint_map(ctx, map, image, road_ink(kind, levels), side, ratio * THUMB_INK, null);
  image.close();
  return URL.createObjectURL(await canvas.convertToBlob({ type: "image/webp" }));
}
