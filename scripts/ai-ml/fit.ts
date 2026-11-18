import { readFileSync, writeFileSync } from "node:fs";
import { FEATURES, predict, type CornerModel, type Linear } from "../../src/ai/corners";
import type { CornerRow, CornerSet, PullSample } from "./corner-set";

// bun scripts/ai-ml/fit.ts <corner-set.json> [--write]: a ridge fit per target on the corner set's features, scored on
// islands held out one at a time (each fold's ridge strength picked by its own inner hold-out), then refitted on every
// row. --write puts the refit in src/ai/corner-model.ts.

interface Target {
  name: "apex" | "exit" | "brake_m" | "peak";
  unit: string;
  /** The value fitted, from a row; NaN where the row has none. */
  fit: (r: CornerRow) => number;
  /** The fitted value back in the target's own unit, for scoring. */
  raw: (r: CornerRow, y: number) => number;
}

// JSON writes a NaN as null.
const real = (v: number | null) => v ?? NaN;

const TARGETS: Target[] = [
  { name: "apex", unit: "m/s", fit: (r) => r.oracle.apex / r.shape.cap, raw: (r, y) => y * r.shape.cap },
  { name: "exit", unit: "m/s", fit: (r) => r.oracle.exit / r.shape.cap, raw: (r, y) => y * r.shape.cap },
  { name: "brake_m", unit: "m", fit: (r) => real(r.oracle.brake_m) / 100, raw: (_r, y) => Math.max(0, y * 100) },
  { name: "peak", unit: "m/s²", fit: (r) => real(r.oracle.peak) / r.capability.brake, raw: (r, y) => y * r.capability.brake },
];
const LAMBDAS = [0.1, 0.3, 1, 3, 10, 30, 100, 300];
/** Quantile of the pull share per bin the bend's fall is fitted to: the plan stays above most of what cars pull. */
const PULL_QUANTILE = 0.8;
const PULL_BINS = 10;
const PULL_MIN_BIN = 30;

/** Solves A x = b in place by Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = a[r][c] / a[c][c];
      for (let k = c; k < n; k++) a[r][k] -= f * a[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= a[r][k] * x[k];
    x[r] = s / a[r][r];
  }
  return x;
}

export function ridge(xs: readonly number[][], ys: readonly number[], lambda: number): Linear {
  const m = xs[0].length;
  const mean = Array.from({ length: m }, (_, j) => xs.reduce((s, x) => s + x[j], 0) / xs.length);
  // A feature constant over the rows (one car's capability) gets scale 1 and a coefficient the ridge holds at 0.
  const scale = mean.map((mu, j) => Math.sqrt(xs.reduce((s, x) => s + (x[j] - mu) ** 2, 0) / xs.length) || 1);
  const bias = ys.reduce((s, y) => s + y, 0) / ys.length;
  const z = xs.map((x) => x.map((v, j) => (v - mean[j]) / scale[j]));
  const a = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => z.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? lambda : 0)));
  const b = Array.from({ length: m }, (_, i) => z.reduce((s, r, k) => s + r[i] * (ys[k] - bias), 0));
  return { bias, mean, scale, coef: solve(a, b) };
}

const island = (r: CornerRow) => r.track.split("/")[0];

function sse(rows: readonly CornerRow[], t: Target, m: Linear): number {
  return rows.reduce((s, r) => s + (t.fit(r) - predict(m, r.x)) ** 2, 0);
}

/** Ridge strength with the least error on islands held out one at a time from `rows`. */
function pick_lambda(rows: readonly CornerRow[], t: Target): number {
  const groups = [...new Set(rows.map(island))];
  if (groups.length < 2) return LAMBDAS[LAMBDAS.length >> 1];
  let best = LAMBDAS[0];
  let best_err = Infinity;
  for (const lambda of LAMBDAS) {
    let err = 0;
    for (const g of groups) {
      const train = rows.filter((r) => island(r) !== g);
      err += sse(
        rows.filter((r) => island(r) === g),
        t,
        ridge(
          train.map((r) => r.x),
          train.map(t.fit),
          lambda,
        ),
      );
    }
    if (err < best_err) {
      best_err = err;
      best = lambda;
    }
  }
  return best;
}

interface Score {
  target: Target;
  rows: number;
  islands: number;
  r2: number;
  mae: number;
  /** The same scores for the shipped AI's own value in the corner, read as a prediction of the oracle's. */
  ai_r2: number;
  ai_mae: number;
  /** R² and MAE on each held-out island alone. */
  islands_of: Map<string, { r2: number; mae: number }>;
}

const r2_of = (ys: number[], ps: number[]) => {
  const mu = ys.reduce((s, y) => s + y, 0) / ys.length;
  return 1 - ys.reduce((s, y, i) => s + (y - ps[i]) ** 2, 0) / ys.reduce((s, y) => s + (y - mu) ** 2, 0);
};
const mae_of = (ys: number[], ps: number[]) => ys.reduce((s, y, i) => s + Math.abs(y - ps[i]), 0) / ys.length;

function hold_out(all: readonly CornerRow[], t: Target): Score {
  const rows = all.filter((r) => Number.isFinite(t.fit(r)));
  const groups = [...new Set(rows.map(island))];
  const ys: number[] = [];
  const ps: number[] = [];
  const ai: number[] = [];
  const islands_of = new Map<string, { r2: number; mae: number }>();
  for (const g of groups) {
    const from = ys.length;
    const train = rows.filter((r) => island(r) !== g);
    const m = ridge(
      train.map((r) => r.x),
      train.map(t.fit),
      pick_lambda(train, t),
    );
    for (const r of rows.filter((r) => island(r) === g)) {
      ys.push(t.raw(r, t.fit(r)));
      ps.push(t.raw(r, predict(m, r.x)));
      ai.push(real(r.ai[t.name]));
    }
    islands_of.set(g, { r2: r2_of(ys.slice(from), ps.slice(from)), mae: mae_of(ys.slice(from), ps.slice(from)) });
  }
  return { target: t, rows: rows.length, islands: groups.length, r2: r2_of(ys, ps), mae: mae_of(ys, ps), ai_r2: r2_of(ys, ai), ai_mae: mae_of(ys, ai), islands_of };
}

/** `share = top (1 - k used²)` through the PULL_QUANTILE of each bin of the bend's share of the grip: k, least squares. */
export function pull_bend(samples: readonly PullSample[]): number {
  const bins: { used: number; q: number }[] = [];
  for (let b = 0; b < PULL_BINS; b++) {
    const xs = samples.filter((s) => s.used >= b / PULL_BINS && s.used < (b + 1) / PULL_BINS).map((s) => s.share);
    if (xs.length < PULL_MIN_BIN) continue;
    xs.sort((a, b) => a - b);
    bins.push({ used: (b + 0.5) / PULL_BINS, q: xs[Math.floor(PULL_QUANTILE * (xs.length - 1))] });
  }
  if (bins.length < 2) return 0;
  const top = bins[0].q;
  // q / top = 1 - k u²: k = sum(u² (1 - q/top)) / sum(u⁴).
  const k = bins.reduce((s, b) => s + b.used ** 2 * (1 - b.q / top), 0) / bins.reduce((s, b) => s + b.used ** 4, 0);
  return Math.max(0, k);
}

if (import.meta.main) {
  const [path] = process.argv.slice(2);
  const set = JSON.parse(readFileSync(path, "utf8")) as CornerSet;
  const tracks = new Set(set.rows.map((r) => `${r.car} ${r.track}`));
  console.log(`corner set ${set.data}: ${set.rows.length} rows, ${tracks.size} oracle runs, ${new Set(set.rows.map(island)).size} islands, cars ${[...new Set(set.rows.map((r) => r.car))].join(", ")}\n`);
  console.log("| target | rows | islands | hold-out R² | hold-out MAE | shipped AI R² | shipped AI MAE |");
  console.log("|---|---|---|---|---|---|---|");
  const scores = TARGETS.map((t) => hold_out(set.rows, t));
  for (const s of scores) {
    const t = s.target;
    console.log(`| ${t.name} | ${s.rows} | ${s.islands} | ${s.r2.toFixed(3)} | ${s.mae.toFixed(2)} ${t.unit} | ${s.ai_r2.toFixed(3)} | ${s.ai_mae.toFixed(2)} ${t.unit} |`);
  }
  console.log(`
| island | ${scores.map((s) => `${s.target.name} R² / MAE`).join(" | ")} |`);
  console.log(`|---|${scores.map(() => "---").join("|")}|`);
  for (const g of [...scores[0].islands_of.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    console.log(`| ${g} | ${scores.map((s) => {
      const v = s.islands_of.get(g);
      return v ? `${v.r2.toFixed(2)} / ${v.mae.toFixed(1)}` : "-";
    }).join(" | ")} |`);
  }
  const fits = Object.fromEntries(
    TARGETS.map((t) => {
      const rows = set.rows.filter((r) => Number.isFinite(t.fit(r)));
      const lambda = pick_lambda(rows, t);
      return [t.name, ridge(
        rows.map((r) => r.x),
        rows.map(t.fit),
        lambda,
      )];
    }),
  ) as Record<Target["name"], Linear>;
  const k = pull_bend(set.pull);
  console.log(`\npull at full throttle: 1 - ${k.toFixed(3)} x (share of grip the bend takes)², from ${set.pull.length} samples`);
  for (const t of TARGETS) console.log(`${t.name}: bias ${fits[t.name].bias.toFixed(3)}, ${FEATURES.map((f, j) => `${f} ${fits[t.name].coef[j].toFixed(3)}`).join(", ")}`);
  if (process.argv.includes("--write")) {
    const round = (m: Linear): Linear => ({ bias: +m.bias.toPrecision(6), mean: m.mean.map((v) => +v.toPrecision(6)), scale: m.scale.map((v) => +v.toPrecision(6)), coef: m.coef.map((v) => +v.toPrecision(6)) });
    const model: CornerModel = { data: set.data, rows: set.rows.length, features: [...FEATURES], apex: round(fits.apex), exit: round(fits.exit), brake_m: round(fits.brake_m), peak: round(fits.peak), pull_bend: +k.toPrecision(6) };
    const out = `// Generated by scripts/ai-ml/fit.ts from corner set ${set.data} (${set.rows.length} corners, ${tracks.size} oracle runs): never edit by hand.\nimport type { CornerModel } from "./corners";\n\nexport const CORNER_MODEL: CornerModel = ${JSON.stringify(model)};\n`;
    writeFileSync(new URL("../../src/ai/corner-model.ts", import.meta.url), out);
    console.log("\nwrote src/ai/corner-model.ts");
  }
}
