/** Idle time a page needs to build without overrunning the slot, ms; estimates, the Settings page is the heaviest. */
export const PAGE_BUILD_MS = 6;
export const SETTINGS_BUILD_MS = 12;

/**
 * The page to build in an idle slot with `remaining` ms left: the first unbuilt one, the `heavy` page last, and only
 * when the slot outlasts its build. `done` when every page is built, `wait` when the slot is too short.
 */
export function warm_pick(ids: readonly string[], built: ReadonlySet<string>, heavy: string, remaining: number): string | "done" | "wait" {
  const id = ids.find((p) => p !== heavy && !built.has(p)) ?? (ids.includes(heavy) && !built.has(heavy) ? heavy : undefined);
  if (id === undefined) return "done";
  return remaining > (id === heavy ? SETTINGS_BUILD_MS : PAGE_BUILD_MS) ? id : "wait";
}
