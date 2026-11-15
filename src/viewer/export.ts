import { build_code, DEFAULT_BUILD, parse_build } from "../car/build";
import { is_car, type Triple } from "../car/cars";
import { asset_of_ref, AssetKind, is_asset_kind, is_item, is_part, is_seed, type AssetRef } from "./assets";
import { checked_note, pin_numbers, type Note, type Notes } from "./notes";
import { asset_ref, cam_text, is_light, is_preset_id, lamps_text, parse_cam, parse_lamps, parse_triple, view_query, type ShotPin, type ViewState } from "./view-state";

export interface Screen {
  width: number;
  height: number;
}

const stamp = (at: Date) => `${at.toISOString().slice(0, 16)}Z`;

// A world asset's note carries no build: the car does not stand on its stage.
const NO_BUILD = "-";
const STAND_IN = { car: DEFAULT_BUILD.car, preset: "stock", code: build_code(DEFAULT_BUILD) };

function note_lines(note: Note, n: number | null): string[] {
  const { view } = note;
  const fields = [`cam=${cam_text(view.cam)}`, `steer=${view.steer}`, `light=${view.light}`];
  if (note.pin) fields.push(`pin=${note.pin.join(",")}`);
  if (view.lamps !== undefined) fields.push(`lamps=${lamps_text(view.lamps)}`);
  if (view.asset && "on" in view.asset && view.asset.on) fields.push("on=1");
  const code = view.asset && "world" in view.asset ? NO_BUILD : view.code;
  return [` c ${n ?? "-"} ${code} ${fields.join(" ")}`, ` n ${JSON.stringify(note.text)}`];
}

function header(ref: AssetRef, count: number): string {
  const notes = plural(count, "note");
  return ref.kind === AssetKind.CAR ? `#car ${ref.id} ${ref.variant} ${notes}` : `#asset ${ref.kind} ${ref.id} ${ref.variant} ${ref.seed} ${notes}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Line based like the lab's block (docs/cars.md): a chat app keeps it, and two rounds diff line by line. `only` keeps the
 * notes whose ref id is it: one car with its parts, or one world kind's assets.
 */
export function export_block(notes: Notes, version: string, screen: Screen, at: Date, only: string | null = null): string {
  const lines = [`#cars v${version} ${stamp(at)} ${screen.width}x${screen.height}`];
  let cars = 0;
  let count = 0;
  for (const key of Object.keys(notes).sort()) {
    const list = notes[key];
    if (!list.length) continue;
    const ref = asset_ref(list[0].view);
    if (only !== null && ref.id !== only) continue;
    cars++;
    count += list.length;
    lines.push(header(ref, list.length));
    const numbers = pin_numbers(list);
    list.forEach((note, i) => lines.push(...note_lines(note, numbers[i])));
  }
  lines.push(`#end ${plural(cars, "preset")} ${plural(count, "note")}`);
  return lines.join("\n");
}

export interface ReadNote extends Note {
  n: number | null;
}

// Forgiving of what a chat app does to a block (CRLF, trailing spaces, lines around it); strict on every value.
export function read_block(text: string): ReadNote[] {
  const out: ReadNote[] = [];
  let ref: AssetRef | null = null;
  let pending: Omit<ReadNote, "text"> | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const car = /^#car (\S+) (\S+)/.exec(line);
    const asset = /^#asset (\S+) (\S+) (\S+) (\d+)/.exec(line);
    if (car || asset) {
      ref = car ? read_ref([AssetKind.CAR, car[1], car[2], "0"]) : asset && read_ref(asset.slice(1));
      pending = null;
      continue;
    }
    const c = /^ c (\d+|-) (\S+)((?: \w+=\S+)*)$/.exec(line);
    if (c && ref) {
      pending = read_c(ref, c[1], c[2], c[3]);
      continue;
    }
    const n = /^ n (".*")$/.exec(line);
    if (n && pending) {
      const note = checked_note({ ...pending, text: parse_text(n[1]) });
      if (note) out.push({ ...note, n: pending.n });
      pending = null;
    }
  }
  return out;
}

function parse_text(quoted: string): unknown {
  try {
    return JSON.parse(quoted);
  } catch (error) {
    console.warn("cars: note text unreadable", error);
    return null;
  }
}

function read_ref([kind, id, variant, seed_text]: string[]): AssetRef | null {
  const seed = Number(seed_text);
  if (!is_asset_kind(kind) || !is_seed(seed)) return null;
  const car_like = kind === AssetKind.CAR || is_part(kind);
  if (car_like ? !is_car(id) || !is_preset_id(variant) : !is_item(variant)) return null;
  return { kind, id, variant, seed };
}

function read_c(ref: AssetRef, number: string, code: string, rest: string): Omit<ReadNote, "text"> | null {
  const world = ref.kind !== AssetKind.CAR && !is_part(ref.kind);
  const build = world ? parse_build(STAND_IN.code) : parse_build(code);
  if (!build || (!world && build.car !== ref.id) || (world && code !== NO_BUILD)) return null;
  const fields = new Map(rest.trim().split(" ").filter(Boolean).map((kv): [string, string] => {
    const at = kv.indexOf("=");
    return [kv.slice(0, at), kv.slice(at + 1)];
  }));
  const cam = parse_cam(fields.get("cam") ?? null);
  const light = fields.get("light");
  const steer = Number(fields.get("steer"));
  if (!cam || !is_light(light) || !Number.isFinite(steer)) return null;
  const pin: Triple | null = fields.has("pin") ? parse_triple(fields.get("pin") ?? null) : null;
  if (fields.has("pin") && !pin) return null;
  const lamps = parse_lamps(fields.get("lamps"));
  if (fields.has("lamps") && lamps === null) return null;
  const asset = asset_of_ref(ref, fields.get("on") === "1");
  if (asset === undefined) return null;
  const view: ViewState = { ...(world ? STAND_IN : { car: build.car, preset: ref.variant, code }), steer, light, cam };
  if (lamps !== null) view.lamps = lamps;
  if (asset) view.asset = asset;
  return { pin, n: number === "-" ? null : Number(number), view };
}

export function note_query(note: ReadNote, shot = false): string {
  const pin: ShotPin | null = note.pin ? { at: note.pin, n: note.n ?? 1 } : null;
  return `${view_query(note.view, pin)}${shot ? "&shot" : ""}`;
}
