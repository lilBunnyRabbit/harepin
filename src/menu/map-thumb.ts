import { MAP_SIDE, type MapData } from "../worldgen/map";
import type { MapSpec } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import { el } from "./setting-rows";
import { map_request, map_worker, paint_map, road_ink } from "./world-map";

const FALLBACK_SIDE = 96;
// Marks and roads drawn at full size would cover a thumbnail, so its ink is thinner than the big map's.
const THUMB_INK = 0.6;

// Keyed by map code and drawn size, since each slot paints at its own size to keep the lines readable.
const thumbs = new Map<string, Promise<string>>();
const spares = new Map<string, MapData>();
// One generation at a time, so a long saved list never runs a worker per row at once.
let queue: Promise<unknown> = Promise.resolve();

export function map_thumb(spec: MapSpec): HTMLImageElement {
  const img = el("img", "map-thumb");
  img.alt = "";
  img.decoding = "async";
  const watch = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    watch.disconnect();
    const side = Math.round((Math.min(img.clientWidth, img.clientHeight) || FALLBACK_SIDE) * devicePixelRatio);
    thumb_url(spec, side).then(
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
  if (![...thumbs.keys()].some((key) => key.startsWith(`${code}@`))) spares.set(code, map);
}

function thumb_url(spec: MapSpec, side: number): Promise<string> {
  const code = map_code(spec);
  const key = `${code}@${side}`;
  const kept = thumbs.get(key);
  if (kept) return kept;
  const spare = spares.get(code);
  spares.delete(code);
  const job = spare ? paint(spare, spec, side) : queue.then(() => generate(spec)).then((map) => paint(map, spec, side));
  if (!spare) queue = job.catch(() => undefined);
  thumbs.set(key, job);
  job.catch(() => thumbs.delete(key));
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

async function paint(map: MapData, { kind, levels }: MapSpec, side: number): Promise<string> {
  const image = await createImageBitmap(new ImageData(map.pixels, MAP_SIDE, MAP_SIDE));
  const ratio = devicePixelRatio;
  const canvas = new OffscreenCanvas(side, side);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("map thumb: no 2d context");
  paint_map(ctx, map, image, road_ink(kind, levels), side, ratio * THUMB_INK, null);
  image.close();
  return URL.createObjectURL(await canvas.convertToBlob({ type: "image/webp" }));
}
