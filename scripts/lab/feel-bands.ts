import { readFileSync } from "node:fs";
import { fields_of, type Moved } from "./handling-golden";

const DOC = new URL("../../docs/car-feel.md", import.meta.url);
/** The band columns of docs/car-feel.md, in table order, by their handling golden key. */
const COLUMNS = ["t100", "top", "stop", "g", "turn", "lift", "pwr"] as const;
/** The bands hold the stock car on asphalt; every other row has none yet. */
const BANDED = "stock asphalt";

export interface Band {
  low: number;
  high: number;
  /** Marked `?` in the draft: today's number sits outside on purpose, for the owner to settle. */
  draft: boolean;
}

export function read_bands(text = readFileSync(DOC, "utf8")): Map<string, Map<string, Band>> {
  const out = new Map<string, Map<string, Band>>();
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < COLUMNS.length + 2) continue;
    const row = new Map<string, Band>();
    COLUMNS.forEach((key, i) => {
      const m = cells[i + 2].match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/);
      if (m) row.set(key, { low: Number(m[1]), high: Number(m[2]), draft: cells[i + 2].includes("?") });
    });
    if (row.size) out.set(cells[0], row);
  }
  return out;
}

export interface BandCheck {
  red: string[];
  warn: string[];
}

export function check_bands(moved: readonly Moved[], bands = read_bands()): BandCheck {
  const out: BandCheck = { red: [], warn: [] };
  for (const m of moved) {
    const row = bands.get(m.car);
    if (!row || !m.line || m.key !== `${m.car}.${BANDED}`) continue;
    for (const [key, v] of fields_of(m.line)) {
      const band = row.get(key);
      const n = Number(v);
      if (!band || !Number.isFinite(n) || (n >= band.low && n <= band.high)) continue;
      (band.draft ? out.warn : out.red).push(`${m.key} ${key}=${v} outside ${band.low}-${band.high}${band.draft ? " (draft ?)" : ""}`);
    }
  }
  return out;
}
