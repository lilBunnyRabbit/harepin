import { expect, test } from "bun:test";
import { mulberry32 } from "../../src/rng";
import { cma_init, cma_sample, cma_update } from "./cma";

test("finds the bottom of a shifted bowl inside the unit box", () => {
  const goal = [0.3, 0.7, 0.1, 0.9, 0.5];
  const loss = (x: readonly number[]) => x.reduce((s, v, i) => s + (i + 1) * (v - goal[i]) ** 2, 0);
  let cma = cma_init([0.5, 0.5, 0.5, 0.5, 0.5], 0.2);
  const rng = mulberry32(7);
  for (let g = 0; g < 80; g++) {
    const samples = cma_sample(cma, 8, rng).sort((a, b) => loss(a.x) - loss(b.x));
    cma = cma_update(cma, samples);
  }
  expect(loss(cma.mean)).toBeLessThan(1e-4);
});

test("a goal past the box's edge settles on the edge", () => {
  let cma = cma_init([0.5, 0.5], 0.2);
  const rng = mulberry32(3);
  for (let g = 0; g < 60; g++) cma = cma_update(cma, cma_sample(cma, 8, rng).sort((a, b) => a.x[0] + a.x[1] - (b.x[0] + b.x[1])));
  expect(cma.mean[0]).toBeLessThan(0.02);
  expect(cma.mean[1]).toBeLessThan(0.02);
});
