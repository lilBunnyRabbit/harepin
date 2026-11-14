import { SLOT_NAMES, SLOTS, type Mod, type Part, type Slot } from "../car/build";
import { CLASS_LABELS } from "../car/pi";
import { short } from "./export";
import { TOP_PARTS } from "./cars/top-tier";
import type { Shown } from "./blind";
import type { Aids, Pack, Resolved } from "./pack";

export interface Change {
  what: string;
  now: string;
  was?: string;
}

export interface Brief {
  question: string;
  /** Index of the trial this one is read against; -1 when it stands alone or is the baseline. */
  against: number;
  baseline: boolean;
  changes: Change[];
  hidden: boolean;
  pi: string | null;
}

export interface Comparison {
  base: number;
  rest: number[];
}

const AID_LABEL: Record<keyof Aids, string> = { tcs: "Traction control", abs: "ABS", assist: "Steering assist", stability: "Stability", auto: "Auto gears", steer_mode: "Steering" };

const FIELD_LABEL: Record<string, string> = {
  torque: "Torque",
  mass: "Weight",
  mu: "Tyre grip",
  rear_grip: "Rear grip",
  arb_rear: "Rear anti-roll bar",
  arb_front: "Front anti-roll bar",
  lock: "Steering lock",
  downforce: "Downforce",
  drag: "Drag",
  spring: "Springs",
  damper: "Dampers",
  redline: "Redline",
  brake_front: "Front brakes",
  brake_rear: "Rear brakes",
  cog: "Centre of mass",
};

const named = (field: string) => FIELD_LABEL[field] ?? field.replaceAll("_", " ");

/** Every part a mod can be, keyed by its mod: a pasted pack carries copies, so they match by value. */
const CATALOGUE = new Map<string, [Slot, Part]>(
  SLOT_NAMES.flatMap((slot) => [...SLOTS[slot].parts, ...(TOP_PARTS[slot] ?? [])].map((part): [string, [Slot, Part]] => [JSON.stringify(part.mod), [slot, part]])),
);

const empty = (mod: Mod) => !Object.keys(mod.scale ?? {}).length && !Object.keys(mod.add ?? {}).length;

interface Fitted {
  parts: Record<Slot, string>;
  tweaks: Change[];
}

function tweaks_of(mod: Mod): Change[] {
  const scale = Object.entries(mod.scale ?? {}).map(([f, v]) => ({ what: named(f), now: `${v < 1 ? "−" : "+"}${short(Math.abs(v - 1) * 100)}%` }));
  const add = Object.entries(mod.add ?? {}).map(([f, v]) => ({ what: named(f), now: `${v < 0 ? "−" : "+"}${short(Math.abs(v))}` }));
  return [...scale, ...add];
}

function fitted(r: Resolved): Fitted {
  const parts = Object.fromEntries(SLOT_NAMES.map((slot) => [slot, SLOTS[slot].parts[r.build.parts[slot]]?.name ?? "?"])) as Record<Slot, string>;
  const tweaks: Change[] = [];
  for (const mod of r.trial.mods ?? []) {
    if (empty(mod)) continue;
    const part = CATALOGUE.get(JSON.stringify(mod));
    if (part) parts[part[0]] = part[1].name;
    else tweaks.push(...tweaks_of(mod));
  }
  return { parts, tweaks };
}

const on_off = (v: Aids[keyof Aids]) => (v === undefined ? "as set" : typeof v === "boolean" ? (v ? "on" : "off") : v);

export function changes_of(r: Resolved, base: Resolved): Change[] {
  const out: Change[] = [];
  if (r.build.car !== base.build.car) out.push({ what: "Car", now: r.spec.name, was: base.spec.name });
  if (r.trial.station !== base.trial.station) out.push({ what: "Place", now: r.trial.station, was: base.trial.station });
  else if (r.lane.name !== base.lane.name) out.push({ what: "Lane", now: r.lane.name, was: base.lane.name });
  const now = fitted(r);
  const was = fitted(base);
  for (const slot of SLOT_NAMES) if (now.parts[slot] !== was.parts[slot]) out.push({ what: SLOTS[slot].label, now: now.parts[slot], was: was.parts[slot] });
  const known = new Set(was.tweaks.map((t) => `${t.what}${t.now}`));
  out.push(...now.tweaks.filter((t) => !known.has(`${t.what}${t.now}`)));
  const aids = new Set([...Object.keys(r.trial.aids ?? {}), ...Object.keys(base.trial.aids ?? {})] as (keyof Aids)[]);
  for (const aid of aids) {
    const a = r.trial.aids?.[aid];
    const b = base.trial.aids?.[aid];
    if (a !== b) out.push({ what: AID_LABEL[aid], now: on_off(a), was: on_off(b) });
  }
  return out;
}

export const change_text = (c: Change) => (c.was === undefined ? `${c.what} ${c.now}` : `${c.what}: ${c.now} instead of ${c.was}`);

/** The trial this one reads against: its group's base, else the trial before on the same station. */
export function against_of(pack: Pack, shown: readonly Shown[], index: number): number {
  if (shown[index].base >= 0) return shown[index].base;
  if (pack.trials[index].base) return -1;
  const before = index - 1;
  return before >= 0 && pack.trials[before].station === pack.trials[index].station ? before : -1;
}

function default_question(baseline: boolean, against: string | null): string {
  if (baseline) return "How does it drive as it is? The trials after it are read against it.";
  if (against) return `Better or worse than ${against}, and why?`;
  return "How does it drive?";
}

export function trial_brief(pack: Pack, trials: readonly Resolved[], shown: readonly Shown[], index: number): Brief {
  const r = trials[index];
  const against = against_of(pack, shown, index);
  const baseline = r.trial.base === true;
  const hidden = !shown[index].open;
  const base = against >= 0 ? trials[against] : null;
  const changes = base && !hidden ? changes_of(r, base) : [];
  const pi = base && !hidden && base.pi !== r.pi ? `${CLASS_LABELS[base.class]} ${base.pi} to ${CLASS_LABELS[r.class]} ${r.pi}` : null;
  // A blind variant shows its base's question too: its own may name the mod.
  const own = hidden ? pack.trials[shown[index].base]?.question : r.trial.question;
  return { question: own ?? default_question(baseline, against >= 0 ? shown[against].label : null), against, baseline, changes, hidden, pi };
}

export function comparisons(pack: Pack, shown: readonly Shown[]): Comparison[] {
  const out: Comparison[] = [];
  pack.trials.forEach((_, i) => {
    const against = against_of(pack, shown, i);
    if (against < 0) return;
    const group = out.find((g) => g.base === against);
    if (group) group.rest.push(i);
    else out.push({ base: against, rest: [i] });
  });
  return out;
}

export function change_summary(changes: readonly Change[]): string {
  if (!changes.length) return "same setup";
  const first = changes[0].was === undefined ? `${changes[0].what} ${changes[0].now}` : changes[0].now;
  return changes.length > 1 ? `${first} +${changes.length - 1}` : first;
}

export function against_text(brief: Brief, shown: readonly Shown[]): string {
  if (brief.against >= 0) return `#${brief.against + 1} ${shown[brief.against].label}`;
  return brief.baseline ? "Nothing: this is the baseline" : "Nothing: rate it on its own";
}
