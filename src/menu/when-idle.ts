const BUSY_POLL_MS = 1500;

/**
 * Runs `run` once `busy` is false: now when it already is, else on the first poll that finds it so. What interrupts a
 * run (the update's reload and toast, the Updated card) waits here, so a race is never cut or covered. Returns the
 * poll's timer for `clearInterval`, 0 when it ran at once.
 */
export function when_idle(busy: () => boolean, run: () => void, every = BUSY_POLL_MS): number {
  if (!busy()) {
    run();
    return 0;
  }
  const timer = setInterval(() => {
    if (busy()) return;
    clearInterval(timer);
    run();
  }, every);
  return Number(timer);
}
