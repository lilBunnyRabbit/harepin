// Seconds a pop-up pod takes to swing all the way.
const POPUP_S = 0.35;

/** Share of the swing open past which the lamp in the pod lights. */
export const POPUP_LIT = 0.9;

/** Ease in and out over the swing: the pods start and land softly. */
export const popup_ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

/** `open` one step of `dt` seconds toward open (`on`) or shut. */
export const popup_step = (open: number, on: boolean, dt: number) => Math.min(1, Math.max(0, open + (on ? dt : -dt) / POPUP_S));
