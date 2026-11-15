// Separable CMA-ES (Ros & Hansen 2008): CMA-ES with a diagonal covariance, so no eigendecomposition, in a unit box.
// A sample outside [0, 1] is clamped and the clamped step is what the update learns from.

export interface Cma {
  gen: number;
  mean: number[];
  sigma: number;
  /** Diagonal of the covariance. */
  c: number[];
  ps: number[];
  pc: number[];
}

export interface Sample {
  x: number[];
  /** (x - mean) / sigma. */
  y: number[];
}

export function cma_init(mean: readonly number[], sigma: number): Cma {
  const d = mean.length;
  return { gen: 0, mean: [...mean], sigma, c: Array(d).fill(1), ps: Array(d).fill(0), pc: Array(d).fill(0) };
}

function gauss(rng: () => number): number {
  const u = Math.max(1e-12, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export function cma_sample(cma: Cma, lambda: number, rng: () => number): Sample[] {
  return Array.from({ length: lambda }, () => {
    const x = cma.mean.map((m, i) => Math.max(0, Math.min(1, m + cma.sigma * Math.sqrt(cma.c[i]) * gauss(rng))));
    return { x, y: x.map((v, i) => (v - cma.mean[i]) / cma.sigma) };
  });
}

function weights(lambda: number): number[] {
  const mu = Math.floor(lambda / 2);
  const raw = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

/** `ranked` best first. */
export function cma_update(cma: Cma, ranked: readonly Sample[]): Cma {
  const d = cma.mean.length;
  const w = weights(ranked.length);
  const mueff = 1 / w.reduce((s, v) => s + v * v, 0);
  const cs = (mueff + 2) / (d + mueff + 5);
  const ds = 1 + 2 * Math.max(0, Math.sqrt((mueff - 1) / (d + 1)) - 1) + cs;
  const cc = (4 + mueff / d) / (d + 4 + (2 * mueff) / d);
  const sep = (d + 2) / 3;
  const c1 = Math.min(1, (sep * 2) / ((d + 1.3) ** 2 + mueff));
  const cmu = Math.min(1 - c1, (sep * 2 * (mueff - 2 + 1 / mueff)) / ((d + 2) ** 2 + mueff));
  const chi = Math.sqrt(d) * (1 - 1 / (4 * d) + 1 / (21 * d * d));
  const yw = Array.from({ length: d }, (_, i) => w.reduce((s, wk, k) => s + wk * ranked[k].y[i], 0));
  const mean = cma.mean.map((m, i) => m + cma.sigma * yw[i]);
  const ks = Math.sqrt(cs * (2 - cs) * mueff);
  const ps = cma.ps.map((p, i) => (1 - cs) * p + (ks * yw[i]) / Math.sqrt(cma.c[i]));
  const norm = Math.hypot(...ps);
  const hs = norm / Math.sqrt(1 - (1 - cs) ** (2 * (cma.gen + 1))) < (1.4 + 2 / (d + 1)) * chi ? 1 : 0;
  const kc = Math.sqrt(cc * (2 - cc) * mueff);
  const pc = cma.pc.map((p, i) => (1 - cc) * p + hs * kc * yw[i]);
  const c = cma.c.map((ci, i) => {
    const rank_mu = w.reduce((s, wk, k) => s + wk * ranked[k].y[i] ** 2, 0);
    return (1 - c1 - cmu) * ci + c1 * (pc[i] ** 2 + (1 - hs) * cc * (2 - cc) * ci) + cmu * rank_mu;
  });
  const sigma = cma.sigma * Math.exp((cs / ds) * (norm / chi - 1));
  return { gen: cma.gen + 1, mean, sigma, c, ps, pc };
}
