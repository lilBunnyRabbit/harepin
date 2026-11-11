import { DEFAULT_KIND, WorldKind } from "../types";
import { MAX_SEED, parse_seed } from "../../net/seed";
import { KINDS } from "./kinds";
import { normal_levels, parse_opts } from "./options";

export interface MapSpec {
  kind: WorldKind;
  seed: number;
  levels: readonly number[];
}

/** `newer`: made in a build that knows more presets, fields or levels; `bad`: not a map code at all. */
export type MapRead = { ok: true; map: MapSpec } | { ok: false; why: "newer" | "bad" };

/** Crockford base32: no I, L, O or U, so a code read out loud or copied by hand survives. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
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
  const { options } = KINDS[kind];
  const overrides = options
    .map((o, i) => ({ field: o.field, level: levels[i] ?? o.normal, normal: o.normal }))
    .filter((o) => o.level !== o.normal)
    .sort((a, b) => (a.field < b.field ? -1 : 1))
    .map((o) => o.field + ALPHABET[o.level])
    .join("");
  const head = `${FORMAT}${preset_char(kind)}${seed_chars(seed)}`;
  return overrides ? `${head}${JOIN}${overrides}` : head;
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
  const levels = parse_opts(KINDS[kind].options, legacy[2] ?? "");
  return seed === null || !levels ? { ok: false, why: "bad" } : { ok: true, map: { kind, seed, levels } };
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
