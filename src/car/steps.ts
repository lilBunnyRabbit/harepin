export type Steps<T> = Generator<void, T>;

/** Work a stepped build takes from one frame, ms. One step can run past it, so a step stays well under a long task's 50 ms. */
export const SLICE_MS = 8;

export function finish<T>(steps: Steps<T>): T {
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

export function advance<T>(steps: Steps<T>, budget = SLICE_MS): IteratorResult<void, T> {
  const until = performance.now() + budget;
  let step = steps.next();
  while (!step.done && performance.now() < until) step = steps.next();
  return step;
}
