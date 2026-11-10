/** `FULL=1 bun test` runs every seed of a sweep; the default run takes the first few, enough to catch a broken rule. */
export const FULL = process.env.FULL === "1";
const FAST = 5;

export function sweep(count: number): number[] {
  return [...Array(FULL ? count : Math.min(count, FAST)).keys()];
}
