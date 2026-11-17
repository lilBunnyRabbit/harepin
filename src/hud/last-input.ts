/** The input last used, written to `:root[data-input]` so glyphs show its keys, pad buttons or touch marks. */
export type LastInput = "keys" | "pad" | "touch";

/** Before any press: a phone or tablet starts on touch, so a card up while the game loads never names a key. */
export const first_input = (): LastInput => (matchMedia("(pointer: coarse)").matches ? "touch" : "keys");
