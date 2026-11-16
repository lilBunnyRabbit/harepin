import { oklab_to_linear } from "./oklab";
import type { Lab, Token } from "./theme";

/** Drawn size of the cursor in CSS px; the 2x image doubles it. Chrome drops custom cursors past 32 px near window edges. */
export const CURSOR_PX = 28;
/** Hold frames `--cursor-hold-0` (empty) to `--cursor-hold-11` (full); `style.css` keys one keyframe per frame. */
export const HOLD_STEPS = 12;
const IDLE_MS = 2000;

const BOX = 32;
const OUTLINE = 2.4;
const ROUNDING = 2.6;
const ARROW = "M4.2 4.2 L4.2 21.5 L8.8 17.6 L11.8 24.2 L14.6 23 L11.8 16.4 L17.8 16.4 Z";
const TIP = 4.2;
/** The arrow body's top and bottom edges with its rounding: the hold fill rises from FILL_FROM to FILL_TO. */
const FILL_FROM = 25.5;
const FILL_TO = 2.9;
/** The hold fill takes the one furthest from cottontail, so it reads against the cottontail outline. */
const HOLD_TOKENS: Token[] = ["primary", "secondary", "tertiary", "accent"];

interface CursorColours {
  fill: string;
  ring: string;
  hold: string;
}

const encode = (c: number) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));

function hex(lab: Lab): string {
  const channels = oklab_to_linear(lab).map((c) => encode(Math.max(0, Math.min(1, c))));
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const distance = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function hold_token(read: Record<Token, Lab>): Token {
  return HOLD_TOKENS.reduce((best, token) => (distance(read[token], read.cottontail) > distance(read[best], read.cottontail) ? token : best));
}

const outline = (paint: string) => `<path d="${ARROW}" fill="${paint}" stroke="${paint}" stroke-width="${OUTLINE * 2 + ROUNDING}" stroke-linejoin="round"/>`;
const body = (paint: string) => `<path d="${ARROW}" fill="${paint}" stroke="${paint}" stroke-width="${ROUNDING}" stroke-linejoin="round"/>`;

const arrow = ({ fill, ring }: CursorColours) => outline(ring) + body(fill);

/** Hover swaps the arrow's fill and ring; holding fills the swapped arrow with the hold colour from the tail up. */
function pressed({ fill, ring, hold }: CursorColours, share: number): string {
  const top = FILL_FROM - share * (FILL_FROM - FILL_TO);
  const rise = share > 0 ? `<clipPath id="h"><rect x="0" y="${top.toFixed(2)}" width="${BOX}" height="${BOX}"/></clipPath><g clip-path="url(#h)">${body(hold)}</g>` : "";
  return outline(fill) + body(ring) + rise;
}

function cursor(body: string, hot: number): string {
  const url = (px: number) =>
    `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${BOX} ${BOX}">${body}</svg>`)}")`;
  const spot = Math.round((hot * CURSOR_PX) / BOX);
  return `image-set(${url(CURSOR_PX)} 1x, ${url(CURSOR_PX * 2)} 2x) ${spot} ${spot}, default`;
}

/**
 * The cursor custom properties for a theme: `--cursor` (arrow), `--cursor-hover` (the same arrow, fill and ring swapped) and
 * the hold frames. Every image keeps the arrow's tip as the hotspot. A data-URI image can't read CSS variables, so the colours go in as hex.
 */
export function cursor_vars(read: Record<Token, Lab>, ring: Token): Record<string, string> {
  const colours = { fill: hex(read.cottontail), ring: hex(read[ring]), hold: hex(read[hold_token(read)]) };
  const vars: Record<string, string> = { "--cursor": cursor(arrow(colours), TIP), "--cursor-hover": cursor(pressed(colours, 0), TIP) };
  for (let step = 0; step < HOLD_STEPS; step++) vars[`--cursor-hold-${step}`] = cursor(pressed(colours, step / (HOLD_STEPS - 1)), TIP);
  return vars;
}

export class CursorIdle {
  private timer = 0;

  constructor(private readonly roaming: () => boolean) {}

  start() {
    window.addEventListener("pointermove", this.wake, { passive: true });
    this.arm();
  }

  stop() {
    window.removeEventListener("pointermove", this.wake);
    window.clearTimeout(this.timer);
    delete document.documentElement.dataset.cursorIdle;
  }

  private readonly wake = () => {
    if (document.documentElement.dataset.cursorIdle !== undefined) delete document.documentElement.dataset.cursorIdle;
    this.arm();
  };

  private readonly sleep = () => {
    if (this.roaming()) document.documentElement.dataset.cursorIdle = "";
    else this.arm();
  };

  private arm() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(this.sleep, IDLE_MS);
  }
}
