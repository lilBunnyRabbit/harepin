import type { Triple } from "./cars";
import { rod } from "./design-parts";
import type { Cabin } from "./designs";
import { signed_area, type Part, type Point } from "./geometry";

const ON_GLASS = 0.03;
const SIDEWAYS = Math.PI / 2;

export function centred(width: number, height: number, length: number, y: number, z: number, tilt = 0): Part {
  return { size: [width / 2, height, length], at: [width / 4, y, z], tilt: [tilt, 0, 0] };
}

const TIP = 0.07;
const TIP_PROUD = 0.005;
const TIP_GIRTH = 1.25;

export interface Pipe {
  chrome: Part;
  trim: Part;
  tip: Part;
}

export function pipe(x: number, y: number, z: number, bore: number, length: number, one = false): Pipe {
  return {
    chrome: { size: [bore, bore, length], at: [x, y, z], round: true, one },
    trim: { size: [bore * 0.68, bore * 0.68, length], at: [x, y, z - 0.008], round: true, one },
    tip: { size: [bore * TIP_GIRTH, bore * TIP_GIRTH, TIP], at: [x, y, z - length / 2 + TIP / 2 - TIP_PROUD], round: true, one },
  };
}

/** The nitro flame of a rear-facing pipe starts at its end: `exhaust` sits this far ahead of it. */
const FLAME_LEAD = 0.16;

export function flame_from({ chrome }: Pipe): Triple {
  return [chrome.at[0], chrome.at[1], chrome.at[2] - chrome.size[2] / 2 + FLAME_LEAD];
}

export function side_pipe(x: number, y: number, z: number, bore: number, length: number): Pipe {
  return {
    chrome: { size: [bore, bore, length], at: [x, y, z], tilt: [0, SIDEWAYS, 0], round: true },
    trim: { size: [bore * 0.68, bore * 0.68, length], at: [x + 0.008, y, z], tilt: [0, SIDEWAYS, 0], round: true },
    tip: { size: [bore * TIP_GIRTH, bore * TIP_GIRTH, TIP], at: [x + length / 2 - TIP / 2 + TIP_PROUD, y, z], tilt: [0, SIDEWAYS, 0], round: true },
  };
}

interface Screen {
  at: (x: number, share: number) => Triple;
  length: number;
  tilt: number;
}

function screen_of(cabin: Cabin, edge: number): Screen {
  const a = cabin.points[edge];
  const b = cabin.points[edge + 1];
  const turn = Math.sign(signed_area(cabin.points));
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u: Point = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const out: Point = [u[1] * turn * ON_GLASS, -u[0] * turn * ON_GLASS];
  return { at: (x, share) => [x, a[1] + u[1] * share * length + out[1], a[0] + u[0] * share * length + out[0]], length, tilt: Math.atan2(-u[1], u[0]) };
}

export function screen_bar(cabin: Cabin, edge: number, from: Point, to: Point, thick = 0.05): Part {
  const screen = screen_of(cabin, edge);
  return rod(screen.at(from[0], from[1]), screen.at(to[0], to[1]), 0.03, thick);
}

export function screen_band(cabin: Cabin, edge: number, from: number, to: number, half: number): Part {
  const screen = screen_of(cabin, edge);
  const [, y, z] = screen.at(0, (from + to) / 2);
  return { size: [half, 0.02, (to - from) * screen.length], at: [half / 2, y, z], tilt: [screen.tilt, 0, 0] };
}

/** A bolt head on the middle of each upper facet of an arch lip: `low` is the angle the arch starts at below the axle. */
export function arch_bolts(x: number, z: number, y: number, ring: number, low: number, steps: number, across: number): Part[] {
  const step = (Math.PI - 2 * low) / steps;
  const reach = ring * Math.cos(step / 2);
  return Array.from({ length: steps - 2 }, (_, i): Part => {
    const a = low + step * (i + 1.5);
    return { size: [0.02, across, across], at: [x, y + reach * Math.sin(a), z + reach * Math.cos(a)], tilt: [-a, 0, 0] };
  });
}
