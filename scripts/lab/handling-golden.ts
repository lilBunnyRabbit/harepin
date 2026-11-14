import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { CarSpec } from "../../src/car/cars";
import { CLASS_LABELS, class_of, spec_pi } from "../../src/car/pi";
import { spec_hash } from "../../src/lab/pack";
import type { GroundName } from "../grounds";
import type { Setup } from "./setups";
import type { Traits } from "./sims";

export const HANDLING_GOLDEN = new URL("../golden/handling.txt", import.meta.url);

const fixed = (v: number, digits: number) => (Number.isNaN(v) ? "-" : v.toFixed(digits));

export function golden_line(setup: Setup, ground: GroundName, spec: CarSpec, t: Traits): string {
  const pi = spec_pi(spec);
  const fields = [
    `spec#${spec_hash(spec)}`,
    `pi=${pi}${CLASS_LABELS[class_of(pi)]}`,
    `t100=${fixed(t.t100, 2)}`,
    `top=${fixed(t.top, 0)}`,
    `stop=${fixed(t.stop, 1)}`,
    `g=${fixed(t.g, 2)}`,
    `turn=${fixed(t.turn * 1000, 0)}`,
    `lift=${fixed(t.lift, 1)}`,
    `pwr=${fixed(t.pwr, 1)}`,
    `hb=${fixed(t.hb, 0)}`,
    `kick220=${fixed(t.kick, 2)}`,
  ];
  return `${setup.id} ${ground} ${fields.join(" ")}`;
}

const key_of = (line: string) => line.split(" ", 2).join(" ");

export function read_handling(): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(HANDLING_GOLDEN)) return out;
  for (const line of readFileSync(HANDLING_GOLDEN, "utf8").split("\n")) if (line.trim()) out.set(key_of(line), line);
  return out;
}

export const write_handling = (lines: string[]) => writeFileSync(HANDLING_GOLDEN, lines.join("\n") + "\n");

export interface Moved {
  key: string;
  car: string;
  fields: string[];
}

function fields_of(line: string): Map<string, string> {
  return new Map(line.split(" ").slice(2).map((f) => (f.startsWith("spec#") ? ["spec", f.slice(5)] : (f.split("=", 2) as [string, string]))));
}

export function diff_handling(golden: Map<string, string>, lines: string[]): Moved[] {
  const out: Moved[] = [];
  const now = new Map(lines.map((l) => [key_of(l), l]));
  const car = (key: string) => key.split(".", 1)[0];
  for (const [key, line] of now) {
    const old = golden.get(key);
    if (old === line) continue;
    if (old === undefined) {
      out.push({ key, car: car(key), fields: ["(new)"] });
      continue;
    }
    const a = fields_of(old);
    const b = fields_of(line);
    const fields = [...b].filter(([f, v]) => a.get(f) !== v).map(([f, v]) => `${f} ${a.get(f) ?? "-"}->${v}`);
    out.push({ key, car: car(key), fields });
  }
  for (const key of golden.keys()) if (!now.has(key)) out.push({ key, car: car(key), fields: ["(gone)"] });
  return out;
}
