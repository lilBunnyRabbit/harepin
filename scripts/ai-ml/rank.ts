import { cma_update, type Cma, type Sample } from "../ai-tune/cma";

/**
 * Best-first order of `loss`, thrown on a non-finite loss or an order that does not sort: the 24-seed ai-tune run
 * (t302) ranked gens 5-9 in one fixed wrong order in-process while the saved losses sorted fine.
 */
export function rank(loss: readonly number[], what: string): number[] {
  const order = loss.map((_, k) => k).sort((a, b) => loss[a] - loss[b]);
  if (!loss.every(Number.isFinite) || order.some((k, i) => i > 0 && loss[order[i - 1]] > loss[k])) throw new Error(`${what} ranked out of order: ${order.map((k) => loss[k].toFixed(2)).join(" ")}`);
  return order;
}

export const step = (cma: Cma, samples: readonly Sample[], order: readonly number[]): Cma => cma_update(cma, order.map((k) => samples[k]));
