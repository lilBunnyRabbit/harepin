import { parse_build } from "./build";

export const BUILDS_KEY = "harepin:builds";
export const BUILD_NAME_LENGTH = 24;
export const MAX_BUILDS = 40;

export interface SavedBuild {
  name: string;
  code: string;
}

const clean = (name: string) => name.trim().replace(/\s+/g, " ").slice(0, BUILD_NAME_LENGTH);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function parse_builds(raw: unknown): SavedBuild[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedBuild[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const { name, code } = entry as Record<string, unknown>;
    if (typeof name !== "string" || typeof code !== "string" || !parse_build(code)) continue;
    const named = clean(name);
    if (!named || out.some((b) => same(b.name, named))) continue;
    out.push({ name: named, code });
    if (out.length === MAX_BUILDS) break;
  }
  return out;
}

/** Saved under `name`, replacing a build of the same name, newest first. Null when the name is empty or the code no build. */
export function with_build(list: readonly SavedBuild[], name: string, code: string): SavedBuild[] | null {
  const named = clean(name);
  if (!named || !parse_build(code)) return null;
  return [{ name: named, code }, ...list.filter((b) => !same(b.name, named))].slice(0, MAX_BUILDS);
}

export function without_build(list: readonly SavedBuild[], name: string): SavedBuild[] {
  return list.filter((b) => b.name !== name);
}

/** Null when the new name is empty or another build has it already. */
export function renamed(list: readonly SavedBuild[], from: string, to: string): SavedBuild[] | null {
  const named = clean(to);
  if (!named || list.some((b) => b.name !== from && same(b.name, named))) return null;
  return list.map((b) => (b.name === from ? { ...b, name: named } : b));
}

export function free_build_name(list: readonly SavedBuild[], car: string): string {
  for (let at = 1; ; at++) {
    const name = at === 1 ? car : `${car} ${at}`;
    if (!list.some((b) => same(b.name, name))) return name;
  }
}

export function load_builds(): SavedBuild[] {
  try {
    const text = localStorage.getItem(BUILDS_KEY);
    return text === null ? [] : parse_builds(JSON.parse(text));
  } catch (error) {
    console.warn("builds: saved builds unreadable", error);
    return [];
  }
}

export function store_builds(list: readonly SavedBuild[]): boolean {
  try {
    localStorage.setItem(BUILDS_KEY, JSON.stringify(list));
    return true;
  } catch (error) {
    console.warn("builds: not saved", error);
    return false;
  }
}
