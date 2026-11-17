/** The query that shows #rotate in overlays.css, so a check needs no style read. */
export const ROTATE_QUERY = "(orientation: portrait) and (pointer: coarse)";

export const Turn = {
  NONE: "none",
  LOCK: "lock",
  FULLSCREEN: "fullscreen",
} as const;
export type Turn = (typeof Turn)[keyof typeof Turn];

export interface TurnState {
  /** A touch screen (`pointer: coarse`). */
  touch: boolean;
  /** The platform has a screen lock: Android does, iOS has none and only the prompt is left. */
  lockable: boolean;
  /** Held upright (`ROTATE_QUERY`). */
  upright: boolean;
  /** The rotate prompt shows: upright on the road. The menu works upright, so with it open nothing turns the screen. */
  prompt: boolean;
  fullscreen: boolean;
  /** Runs as an installed app, where Android takes a lock without fullscreen. */
  installed: boolean;
  /** A lock asked for without fullscreen was refused, so the next one goes through fullscreen. */
  refused: boolean;
  /** Inside a tap that may take fullscreen: the browser gives it nowhere else. */
  tap: boolean;
  /** The landscape lock is held. */
  locked: boolean;
}

/** The prompt covers the road only: the menu shows through it and stays usable upright. */
export const rotate_shown = (upright: boolean, menu_open: boolean) => upright && !menu_open;

/**
 * What to ask the screen for now. A reload drops both the lock and fullscreen, and an installed app can come back
 * upright with the phone's own rotation off: only a new lock turns it, so every load, turn and tap asks again.
 */
export function turn_step(state: TurnState): Turn {
  if (!state.touch || !state.lockable) return Turn.NONE;
  if (state.upright && !state.prompt) return Turn.NONE;
  if (state.locked && !state.upright) return Turn.NONE;
  if (state.fullscreen || (state.installed && !state.refused)) return Turn.LOCK;
  return state.tap ? Turn.FULLSCREEN : Turn.NONE;
}
