import type { RacerStats } from "../ai/field";
import type { FieldPlace } from "../modes/mode";
import { FIELD_MAX } from "./pack";

export interface FieldRow {
  name: string;
  you: boolean;
  /** s from the start; NaN while still racing. */
  finish: number;
  /** s behind the leader; NaN before the car is past the line. */
  gap: number;
  /** Null for the player's car, whose drive the trial's metrics already hold. */
  ai: AiCounts | null;
}

export interface AiCounts {
  spins: number;
  resets: number;
  contacts: number;
  /** m/s closing speed of its hardest touch. */
  hardest: number;
  overtakes: number;
}

const NAME_MAX = 60;
const COUNTS: readonly (keyof AiCounts)[] = ["spins", "resets", "contacts", "hardest", "overtakes"];

/** `stats` is empty when the field ran in the sim worker, which keeps them: the rows then carry places only. */
export function field_rows(places: readonly FieldPlace[], stats: readonly RacerStats[]): FieldRow[] {
  return places.map((p) => {
    const s = p.you ? undefined : stats[p.car];
    return {
      name: p.name,
      you: p.you,
      finish: Number.isFinite(p.finish) ? p.finish : NaN,
      gap: p.gap,
      ai: s ? { spins: s.spins, resets: s.resets, contacts: s.contacts, hardest: s.hardest, overtakes: s.overtakes } : null,
    };
  });
}

const num = (v: number) => (Number.isNaN(v) ? "-" : String(Number(v.toFixed(1))));

export function field_lines(rows: readonly FieldRow[]): string[] {
  return rows.map((r, i) => {
    const counts = r.ai ? ` spins=${r.ai.spins} resets=${r.ai.resets} hits=${r.ai.contacts} hard=${num(r.ai.hardest)} pass=${r.ai.overtakes}` : "";
    return ` f P${i + 1} ${r.you ? "you" : JSON.stringify(r.name)} ${Number.isNaN(r.finish) ? "racing" : num(r.finish)} ${Number.isNaN(r.gap) ? "-" : `+${num(r.gap)}`}${counts}`;
  });
}

const finite_or_nan = (v: unknown): number | null => (v === null ? NaN : typeof v === "number" && Number.isFinite(v) ? v : null);

function counts_of(raw: unknown): AiCounts | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "object") return undefined;
  const given = raw as Record<string, unknown>;
  const out: Partial<AiCounts> = {};
  for (const key of COUNTS) {
    const v = given[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return undefined;
    out[key] = v;
  }
  return out as AiCounts;
}

/** Stored rows are untrusted: any row that does not check out drops them all. JSON writes NaN as null. */
export function read_field_rows(raw: unknown): FieldRow[] | null {
  if (!Array.isArray(raw) || raw.length > FIELD_MAX + 1) return null;
  const rows: FieldRow[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) return null;
    const { name, you, finish, gap, ai } = row as Record<string, unknown>;
    const at = finite_or_nan(finish);
    const behind = finite_or_nan(gap);
    const counts = counts_of(ai);
    if (typeof name !== "string" || name.length > NAME_MAX || typeof you !== "boolean" || at === null || behind === null || counts === undefined) return null;
    rows.push({ name, you, finish: at, gap: behind, ai: counts });
  }
  return rows;
}
