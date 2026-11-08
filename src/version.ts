import { ChangeKind, type Change, type Release } from "./changelog";

export interface VersionInfo {
  version: string;
  commit: string;
  /** ms epoch */
  built: number;
}

export interface RemoteVersion extends VersionInfo {
  notes: Release[];
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const KINDS: ReadonlySet<string> = new Set(Object.values(ChangeKind));
const is_kind = (k: string): k is ChangeKind => KINDS.has(k);

// A malformed version sorts as 0.0.0.
export function compare_versions(a: string, b: string): number {
  const parse = (v: string) => (SEMVER.exec(v)?.slice(1) ?? ["0", "0", "0"]).map(Number);
  const [pa, pb] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

export function newer_releases(notes: Release[], running: string): Release[] {
  return notes.filter((r) => compare_versions(r.version, running) > 0).sort((a, b) => compare_versions(b.version, a.version));
}

const is_record = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

function parse_change(x: unknown): Change | null {
  if (!is_record(x) || typeof x.text !== "string" || typeof x.kind !== "string" || !is_kind(x.kind)) return null;
  return { kind: x.kind, text: x.text };
}

function parse_release(x: unknown): Release | null {
  if (!is_record(x) || typeof x.version !== "string" || !SEMVER.test(x.version)) return null;
  if (typeof x.date !== "string" || typeof x.title !== "string" || !Array.isArray(x.changes)) return null;
  const changes = x.changes.map(parse_change).filter((c) => c !== null);
  return { version: x.version, date: x.date, title: x.title, changes };
}

// A bad release entry is dropped, not fatal: an older build may write fewer fields.
export function parse_version_file(x: unknown): RemoteVersion | null {
  if (!is_record(x) || typeof x.version !== "string" || !SEMVER.test(x.version)) return null;
  if (typeof x.commit !== "string" || typeof x.built !== "number" || !Number.isFinite(x.built)) return null;
  const notes = Array.isArray(x.notes) ? x.notes.map(parse_release).filter((r) => r !== null) : [];
  return { version: x.version, commit: x.commit, built: x.built, notes };
}
