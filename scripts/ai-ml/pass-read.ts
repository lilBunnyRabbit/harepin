import { Phase } from "../../src/lab/pass-trace";

export interface PassCar {
  /** m/s. */
  v: number;
  /** Metres right of the AI line. */
  lat: number;
  throttle: number;
  brake: number;
}

export interface Pass {
  t: number;
  made: boolean;
  /** The AI car, 0 on pole. */
  car: number;
  lap: number;
  at: number;
  phase: Phase;
  /** The line's radius there (m), negative bending right; null on a straight. */
  radius: number | null;
  you: PassCar;
  ai: PassCar;
  /** The player's metres ahead of the AI car before the cars drew level and after one was clear; NaN when a placement cut the reading. */
  before: number;
  after: number;
  /** Seconds from level to clear. */
  side: number;
}

export interface GridCar extends PassCar {
  /** Metres raced from the start line; negative on the grid. */
  s: number;
}

export interface GridSample {
  t: number;
  /** The AI cars, pole first, then the player. */
  cars: GridCar[];
}

export interface PassTrial {
  pack: string;
  rev: number;
  id: string;
  car: string;
  place: string;
  status: string;
  ai_cars: number;
  lap_m: number;
  hz: number;
  full: boolean;
  passes: Pass[];
  samples: GridSample[];
}

const PHASES: readonly string[] = Object.values(Phase);
const STRAIGHT_RADIUS = 999;

function fail(line: number, why: string): never {
  throw new Error(`export line ${line + 1}: ${why}`);
}

const value = (v: string) => (v === "-" ? NaN : Number(v));

function car_of(text: string | undefined, k: number): PassCar {
  const v = text?.split("/").map(value) ?? [];
  if (v.length !== 4) fail(k, "a car is <m/s>/<m off the line>/<throttle>/<brake>");
  return { v: v[0], lat: v[1], throttle: v[2], brake: v[3] };
}

/** Every race trial with a ` passes` block in one or more exports (Download files or pasted Copy blocks); the rest is skipped. */
export function read_passes(text: string): PassTrial[] {
  const out: PassTrial[] = [];
  let pack = "";
  let rev = 0;
  let head: Pick<PassTrial, "id" | "car" | "place" | "status"> | null = null;
  let trial: PassTrial | null = null;
  let counts = [0, 0];
  const close = (k: number) => {
    if (trial && (trial.passes.length !== counts[0] || trial.samples.length !== counts[1])) fail(k, `trial ${trial.id} names ${counts[0]} passes and ${counts[1]} samples, holds ${trial.passes.length} and ${trial.samples.length}: a cut paste`);
    trial = null;
  };
  const rows = text.split(/\r?\n/);
  rows.forEach((raw, k) => {
    const line = raw.replace(/^>\s?/, "");
    const word = line.trimStart().split(/\s+/);
    if (line.startsWith("#lab ")) {
      close(k);
      pack = word[1];
      rev = Number(word[2].slice(1));
      head = null;
    } else if (line.startsWith("#trial ")) {
      close(k);
      const place = word.find((w) => /^[^/#=]+\/[^/=]+$/.test(w)) ?? fail(k, "no <map>/<route>");
      const status = word.find((w) => ["done", "stopped", "running", "skipped"].includes(w)) ?? fail(k, "no status");
      head = { id: word[1], car: word[2], place, status };
    } else if (line.startsWith(" passes ")) {
      if (!head) fail(k, "passes outside a trial");
      const [passes, samples, ai_cars, lap_m, hz] = word.slice(1, 6).map(Number);
      if (![passes, samples, ai_cars, lap_m, hz].every(Number.isFinite)) fail(k, "not ` passes <passes> <samples> <AI cars> <lap m> <Hz>`");
      counts = [passes, samples];
      trial = { pack, rev, ...head, ai_cars, lap_m, hz, full: word[6] === "full", passes: [], samples: [] };
      out.push(trial);
    } else if (line.startsWith(" p ")) {
      if (!trial) fail(k, "a pass outside a passes block");
      const keys: Record<string, string | undefined> = Object.fromEntries(word.slice(3).flatMap((w) => (w.includes("=") ? [w.split("=", 2)] : [])));
      const phase = Object.values(Phase).find((p) => word.includes(p)) ?? fail(k, "no corner phase");
      const [before, after] = (keys.gap ?? "").split("/").map(value);
      const radius = Number(keys.r);
      const pass: Pass = { t: Number(word[1]), made: word[2] === "made", car: Number(keys.car), lap: Number(keys.lap), at: Number(keys.at), phase, radius: Math.abs(radius) >= STRAIGHT_RADIUS ? null : radius, you: car_of(keys.you, k), ai: car_of(keys.ai, k), before, after, side: Number(keys.side) };
      if ((word[2] !== "made" && word[2] !== "lost") || ![pass.t, pass.car, pass.lap, pass.at, radius, pass.side].every(Number.isFinite)) fail(k, "not a pass line");
      if (pass.car < 0 || pass.car >= trial.ai_cars) fail(k, `AI car ${pass.car} outside 0-${trial.ai_cars - 1}`);
      trial.passes.push(pass);
    } else if (line.startsWith(" ft ")) {
      if (!trial) fail(k, "a sample outside a passes block");
      const cars = word.slice(2).map((w): GridCar => {
        const v = w.split(",").map(value);
        if (v.length !== 5) fail(k, "a sampled car is <m raced>,<m off the line>,<m/s>,<throttle>,<brake>");
        return { s: v[0], lat: v[1], v: v[2], throttle: v[3], brake: v[4] };
      });
      if (cars.length !== trial.ai_cars + 1) fail(k, `${cars.length} cars in a sample, expected ${trial.ai_cars + 1}`);
      trial.samples.push({ t: Number(word[1]), cars });
    }
  });
  close(rows.length);
  return out;
}

/** Where the player ran beside the AI car as they drew level: the inside or outside of the bend, or a side of a straight. */
export function side_of(pass: Pass): string {
  const right = pass.you.lat - pass.ai.lat;
  if (pass.radius === null) return right > 0 ? "right" : "left";
  // A positive radius bends left, away from the right normal.
  return right * pass.radius < 0 ? "inside" : "outside";
}

const f = (v: number, digits = 1) => (Number.isFinite(v) ? v.toFixed(digits) : "-");
const pedals = (c: PassCar) => `${f(c.throttle, 2)}/${f(c.brake, 2)}`;

export function pass_table(trial: PassTrial): string {
  const head = ["| t s | pass | AI car | lap | at m | phase | line r m | you ran | side by side s | you m/s | AI m/s | you off line m | AI off line m | you thr/brk | AI thr/brk | gap before m | gap after m |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"];
  const rows = trial.passes.map((p) => `| ${f(p.t)} | ${p.made ? "made" : "lost"} | ${p.car} | ${p.lap} | ${f(p.at, 0)} | ${p.phase} | ${p.radius === null ? "-" : f(p.radius, 0)} | ${side_of(p)} | ${f(p.side, 2)} | ${f(p.you.v)} | ${f(p.ai.v)} | ${f(p.you.lat)} | ${f(p.ai.lat)} | ${pedals(p.you)} | ${pedals(p.ai)} | ${f(p.before)} | ${f(p.after)} |`);
  return [...head, ...rows].join("\n");
}

export function phase_table(trial: PassTrial): string {
  const rows = PHASES.map((phase) => {
    const at = trial.passes.filter((p) => p.phase === phase);
    const made = at.filter((p) => p.made);
    const over = made.length ? f(made.reduce((sum, p) => sum + p.you.v - p.ai.v, 0) / made.length) : "-";
    return `| ${phase} | ${made.length} | ${at.length - made.length} | ${over} |`;
  });
  return ["| phase | made | lost | mean m/s over the AI car, passes made |", "|---|---|---|---|", ...rows].join("\n");
}
