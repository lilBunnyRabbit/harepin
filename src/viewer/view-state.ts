import { build_code, parse_build } from "../car/build";
import { is_car, type CarId, type Triple } from "../car/cars";
import { CARS_PARAM } from "./params";
import { viewer_build, viewer_presets } from "./presets";

export const Light = { DAY: "day", DUSK: "dusk" } as const;
export type Light = (typeof Light)[keyof typeof Light];
/** The light is the theme the page loads with: the palette is read once per load. */
export const LIGHT_THEMES: Record<Light, string> = { day: "Brand Light", dusk: "Brand Dark" };

/** The orbit camera: angles in degrees, `yaw` the bearing from the car's nose, `pitch` the elevation; metres for the rest. */
export interface Cam {
  yaw: number;
  pitch: number;
  dist: number;
  target: Triple;
  fov: number;
}

export interface ViewState {
  car: CarId;
  /** A viewer preset id (`presets.ts`); with `car`, the key comments are kept under. */
  preset: string;
  /** The build drawn, paint included: the truth for the picture even when a deploy moves what a preset holds. */
  code: string;
  /** Share of the car's steering lock, -1 to 1; positive steers right. */
  steer: number;
  light: Light;
  cam: Cam;
}

export const PITCH_MIN = -5;
export const PITCH_MAX = 89;
export const DIST_MIN = 0.5;
export const DIST_MAX = 80;
export const FOV_MIN = 10;
export const FOV_MAX = 90;
export const DEFAULT_FOV = 30;
const TARGET_REACH = 20;
const PRESET_ID = /^[a-z0-9-]{1,40}$/;

const round = (v: number, places: number) => {
  const r = Math.round(v * 10 ** places) / 10 ** places;
  return r === 0 ? 0 : r;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const wrap_yaw = (yaw: number) => {
  const w = ((((yaw + 180) % 360) + 360) % 360) - 180;
  return w === -180 ? 180 : w;
};

/** What a comment stores and the URL prints: rounded once, so the store, the export and the link all agree. */
export function settled_cam(cam: Cam): Cam {
  return {
    yaw: round(wrap_yaw(cam.yaw), 1),
    pitch: round(clamp(cam.pitch, PITCH_MIN, PITCH_MAX), 1),
    dist: round(clamp(cam.dist, DIST_MIN, DIST_MAX), 3),
    target: cam.target.map((v) => round(clamp(v, -TARGET_REACH, TARGET_REACH), 3)) as Triple,
    fov: round(clamp(cam.fov, FOV_MIN, FOV_MAX), 1),
  };
}

export function settled_view(view: ViewState): ViewState {
  return { ...view, steer: round(clamp(view.steer, -1, 1), 2), cam: settled_cam(view.cam) };
}

export function cam_text(cam: Cam): string {
  return [cam.yaw, cam.pitch, cam.dist, ...cam.target, cam.fov].join(",");
}

export function parse_cam(text: string | null): Cam | null {
  if (!text) return null;
  const parts = text.split(",");
  if (parts.length !== 6 && parts.length !== 7) return null;
  const n = parts.map(Number);
  if (!n.every(Number.isFinite)) return null;
  return settled_cam({ yaw: n[0], pitch: n[1], dist: n[2], target: [n[3], n[4], n[5]], fov: n[6] ?? DEFAULT_FOV });
}

export function parse_triple(text: string | null): Triple | null {
  if (!text) return null;
  const n = text.split(",").map(Number);
  if (n.length !== 3 || !n.every(Number.isFinite)) return null;
  return n.map((v) => round(v, 3)) as Triple;
}

export const is_light = (v: unknown): v is Light => v === Light.DAY || v === Light.DUSK;
export const is_preset_id = (v: unknown): v is string => typeof v === "string" && PRESET_ID.test(v);

export function checked_view(x: unknown): ViewState | null {
  if (typeof x !== "object" || x === null) return null;
  const v = x as Record<string, unknown>;
  if (typeof v.car !== "string" || !is_car(v.car) || !is_preset_id(v.preset) || !is_light(v.light) || !finite(v.steer)) return null;
  const build = parse_build(v.code);
  if (!build || build.car !== v.car) return null;
  const cam = v.cam as Record<string, unknown> | null;
  if (typeof cam !== "object" || cam === null || !Array.isArray(cam.target) || cam.target.length !== 3) return null;
  const { yaw, pitch, dist, fov, target } = cam;
  if (!finite(yaw) || !finite(pitch) || !finite(dist) || !finite(fov) || !target.every(finite)) return null;
  return settled_view({ car: v.car, preset: v.preset, code: v.code as string, steer: v.steer, light: v.light, cam: { yaw, pitch, dist, fov, target: target as Triple } });
}

export interface ShotPin {
  at: Triple;
  n: number;
}

export interface Asked {
  view: Partial<ViewState> & { car: CarId };
  pin: ShotPin | null;
    shot: boolean;
}

/** `?cars=<car>&p=<preset>&b=<build>&cam=<yaw,pitch,dist,tx,ty,tz,fov>&steer=<-1..1>&light=day|dusk[&pin=x,y,z,n][&shot]`. */
export function read_asked(params: URLSearchParams, fallback: CarId): Asked {
  const asked_car = params.get(CARS_PARAM) ?? "";
  const build = parse_build(params.get("b"));
  const car = build?.car ?? (is_car(asked_car) ? asked_car : fallback);
  const view: Asked["view"] = { car };
  const preset = params.get("p");
  if (is_preset_id(preset)) view.preset = preset;
  if (build) view.code = build_code(build);
  const cam = parse_cam(params.get("cam"));
  if (cam) view.cam = cam;
  const steer = Number(params.get("steer"));
  if (params.has("steer") && Number.isFinite(steer)) view.steer = round(clamp(steer, -1, 1), 2);
  const light = params.get("light");
  if (is_light(light)) view.light = light;
  const pin_parts = params.get("pin")?.split(",") ?? [];
  const pin_at = parse_triple(pin_parts.slice(0, 3).join(","));
  const n = Number(pin_parts[3] ?? 1);
  return { view, pin: pin_at && Number.isInteger(n) && n > 0 ? { at: pin_at, n } : null, shot: params.has("shot") };
}

export function filled_view(asked: Asked["view"], cam: Cam, light: Light, paint: number): ViewState {
  const presets = viewer_presets(asked.car);
  const preset = presets.find((p) => p.id === asked.preset) ?? presets[0];
  const code = asked.code ?? build_code(viewer_build(asked.car, preset, paint));
  return settled_view({ car: asked.car, preset: asked.preset ?? preset.id, code, steer: asked.steer ?? 0, light, cam: asked.cam ?? cam });
}

export function view_query(view: ViewState, pin: ShotPin | null = null): string {
  const params = new URLSearchParams({ [CARS_PARAM]: view.car, p: view.preset, b: view.code, cam: cam_text(view.cam), steer: String(view.steer), light: view.light });
  if (pin) params.set("pin", [...pin.at, pin.n].join(","));
  return `?${params}`.replaceAll("%2C", ",");
}
