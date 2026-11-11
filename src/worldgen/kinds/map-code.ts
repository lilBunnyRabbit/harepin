import { DEFAULT_KIND, WorldKind } from "../types";
import { MAX_SEED, parse_seed } from "../../net/seed";
import { is_plain, KINDS, plain_map, type MapSpec } from "./kinds";
import { CODE_CHARS as ALPHABET, normal_levels, overrides, parse_opts } from "./options";

/** `newer`: made in a build that knows more presets, fields or levels; `bad`: not a map code at all. */
export type MapRead = { ok: true; map: MapSpec } | { ok: false; why: "newer" | "bad" };

const FORMAT = "1";
const SEED_CHARS = 7;
const HEAD = 2 + SEED_CHARS;
const JOIN = "-";
export const MAP_CODE_MAX = 64;

/** Preset chars are append-only, like field letters. */
export const PRESETS: readonly { char: string; kind: WorldKind }[] = [
  { char: "C", kind: WorldKind.ISLAND },
  { char: "S", kind: WorldKind.SKY },
  { char: "D", kind: WorldKind.DESERT },
  { char: "M", kind: WorldKind.MAINLAND },
  { char: "A", kind: WorldKind.ALPINE },
];

const preset_char = (kind: WorldKind) => PRESETS.find((p) => p.kind === kind)?.char ?? "";

function seed_chars(seed: number): string {
  let out = "";
  for (let i = 0, n = seed; i < SEED_CHARS; i++, n = Math.floor(n / 32)) out = ALPHABET[n % 32] + out;
  return out;
}

export function map_code({ kind, seed, levels }: MapSpec): string {
  const changed = overrides(KINDS[kind].options, levels);
  const head = `${FORMAT}${preset_char(kind)}${seed_chars(seed)}`;
  return changed ? `${head}${JOIN}${changed}` : head;
}

function normalise(text: string): string {
  return text.toUpperCase().replace(/[\s-]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
}

/** K2 codes: a bare seed, or `42-121111` with a digit per option of the kind being picked; they carry no kind. */
const LEGACY = /^(\d{1,10})(?:-(\d+))?$/;

function parse_legacy(text: string, kind: WorldKind): MapRead | null {
  const legacy = LEGACY.exec(text);
  if (!legacy) return null;
  const seed = parse_seed(legacy[1]);
  const { options } = KINDS[kind];
  const knobs = options.filter((o) => !o.slider);
  const digits = parse_opts(knobs, legacy[2] ?? "");
  if (seed === null || !digits) return { ok: false, why: "bad" };
  return { ok: true, map: { kind, seed, levels: options.map((o) => (o.slider ? o.normal : digits[knobs.indexOf(o)])) } };
}

export function parse_map_code(text: string, kind: WorldKind = DEFAULT_KIND): MapRead {
  const trimmed = text.trim();
  if (trimmed.length > MAP_CODE_MAX) return { ok: false, why: "bad" };
  const legacy = parse_legacy(trimmed, kind);
  if (legacy) return legacy;
  const code = normalise(trimmed);
  if (code.length < HEAD || (code.length - HEAD) % 2 || [...code].some((c) => !ALPHABET.includes(c))) return { ok: false, why: "bad" };
  if (code[0] !== FORMAT) return { ok: false, why: "newer" };
  const preset = PRESETS.find((p) => p.char === code[1]);
  if (!preset) return { ok: false, why: "newer" };
  const seed = [...code.slice(2, HEAD)].reduce((n, c) => n * 32 + ALPHABET.indexOf(c), 0);
  if (seed > MAX_SEED) return { ok: false, why: "bad" };
  const { options } = KINDS[preset.kind];
  const levels = normal_levels(options);
  const seen = new Set<string>();
  for (let i = HEAD; i < code.length; i += 2) {
    const field = code[i];
    const level = ALPHABET.indexOf(code[i + 1]);
    if (seen.has(field)) return { ok: false, why: "bad" };
    seen.add(field);
    const at = options.findIndex((o) => o.field === field);
    if (at < 0 || level >= options[at].labels.length) return { ok: false, why: "newer" };
    levels[at] = level;
  }
  return { ok: true, map: { kind: preset.kind, seed, levels } };
}

/** A peer's or a URL's code: kept only as the canonical code of a map off its preset, which is the only kind sent. */
export function clean_map_code(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const read = parse_map_code(raw);
  return read.ok && !is_plain(read.map) && map_code(read.map) === raw ? raw : null;
}

/** The code a link or a hello carries: only a custom map's, so plain maps keep their old links and hellos. */
export const custom_code = (map: MapSpec): string | null => (is_plain(map) ? null : map_code(map));

/** The map a pick drives: its code when it reads, else the plain map of its seed and kind. */
export function read_pick(pick: { seed: number; kind: WorldKind; code: string | null }): MapSpec {
  const read = pick.code === null ? null : parse_map_code(pick.code, pick.kind);
  return read?.ok ? read.map : plain_map(pick.kind, pick.seed);
}
