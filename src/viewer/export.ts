import { parse_build } from "../car/build";
import { is_car, type CarId, type Triple } from "../car/cars";
import { checked_note, pin_numbers, type Note, type Notes } from "./notes";
import { cam_text, is_light, is_preset_id, lamps_text, parse_cam, parse_lamps, parse_triple, view_query, type ShotPin, type ViewState } from "./view-state";

export interface Screen {
  width: number;
  height: number;
}

const stamp = (at: Date) => `${at.toISOString().slice(0, 16)}Z`;

function note_lines(note: Note, n: number | null): string[] {
  const { view } = note;
  const fields = [`cam=${cam_text(view.cam)}`, `steer=${view.steer}`, `light=${view.light}`];
  if (note.pin) fields.push(`pin=${note.pin.join(",")}`);
  if (view.lamps !== undefined) fields.push(`lamps=${lamps_text(view.lamps)}`);
  return [` c ${n ?? "-"} ${view.code} ${fields.join(" ")}`, ` n ${JSON.stringify(note.text)}`];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Line based like the lab's block (docs/cars.md): a chat app keeps it, and two rounds diff line by line. */
export function export_block(notes: Notes, version: string, screen: Screen, at: Date, only: CarId | null = null): string {
  const lines = [`#cars v${version} ${stamp(at)} ${screen.width}x${screen.height}`];
  let cars = 0;
  let count = 0;
  const keys = Object.keys(notes)
    .filter((key) => only === null || key.startsWith(`${only}/`))
    .sort();
  for (const key of keys) {
    const list = notes[key];
    if (!list.length) continue;
    const [car, preset] = key.split("/");
    cars++;
    count += list.length;
    lines.push(`#car ${car} ${preset} ${plural(list.length, "note")}`);
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
  let car: CarId | null = null;
  let preset: string | null = null;
  let pending: Omit<ReadNote, "text"> | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const head = /^#car (\S+) (\S+)/.exec(line);
    if (head) {
      [car, preset] = is_car(head[1]) && is_preset_id(head[2]) ? [head[1], head[2]] : [null, null];
      pending = null;
      continue;
    }
    const c = /^ c (\d+|-) (\S+)((?: \w+=\S+)*)$/.exec(line);
    if (c && car && preset) {
      pending = read_c(car, preset, c[1], c[2], c[3]);
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

function read_c(car: CarId, preset: string, number: string, code: string, rest: string): Omit<ReadNote, "text"> | null {
  const build = parse_build(code);
  if (!build || build.car !== car) return null;
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
  const view: ViewState = { car, preset, code, steer, light, cam };
  if (lamps !== null) view.lamps = lamps;
  return { pin, n: number === "-" ? null : Number(number), view };
}

export function note_query(note: ReadNote, shot = false): string {
  const pin: ShotPin | null = note.pin ? { at: note.pin, n: note.n ?? 1 } : null;
  return `${view_query(note.view, pin)}${shot ? "&shot" : ""}`;
}
