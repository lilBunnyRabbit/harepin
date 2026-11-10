import type { Decal } from "../car/build";
import { FLAME, SIDE_BAND, SLASH } from "../car/livery";
import { el } from "./setting-rows";

const SVG = "http://www.w3.org/2000/svg";

const ICONS: Record<string, string> = {
  car: "M3 14l2-5h11l3 5v3H3zM7 17a1.6 1.6 0 1 0 0 .1M16 17a1.6 1.6 0 1 0 0 .1",
  engine: "M4 8h12v9H4zM8 8V5h4v3M16 11h3v4h-3M4 12H2",
  tyres: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
  aero: "M3 8h18l-2 3H5zM8 11v6M16 11v6",
  suspension: "M12 3v3l-5 2 10 2-10 2 10 2-10 2 5 2v3",
  brakes: "M11 6a7 7 0 1 0 0 14a7 7 0 1 0 0-14M11 11a2 2 0 1 0 0 4a2 2 0 1 0 0-4M16 5a8 8 0 0 1 4 6",
  weight: "M8 8a4 4 0 1 1 8 0M6 8h12l2 12H4z",
  bias: "M12 4v16M5 20h14M4 9l3-4 3 4M14 9l3-4 3 4M4 9a3 3 0 0 0 6 0M14 9a3 3 0 0 0 6 0",
  nitro: "M9 3h6M10 3v3M14 3v3M8 6h8v14H8zM8 11h8",
  decal: "M4 16l5-8h5l-5 8zM12 16l5-8h3l-5 8z",
  number: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M10 9l2-1v8",
  paint: "M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z",
  ink: "M4 20l4-1 11-11-3-3L5 16zM14 7l3 3",
  part: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  rename: "M4 20h4L19 9l-4-4L4 16z",
  delete: "M6 6l12 12M18 6L6 18",
};

/** Glyphs per input: the pad's, then the keyboard's. */
const GLYPHS: Record<"move" | "accept" | "back" | "prev" | "next", [string, string]> = {
  move: ["✥", "Arrows"],
  accept: ["A", "Enter"],
  back: ["B", "Esc"],
  prev: ["LT", ""],
  next: ["RT", ""],
};

export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

export function icon(id: string): SVGSVGElement {
  const node = svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", class: "garage-icon" });
  node.append(svg("path", { d: ICONS[id] ?? ICONS.part }));
  return node;
}

export function glyph(which: keyof typeof GLYPHS): HTMLElement {
  const [pad, keys] = GLYPHS[which];
  const node = el("span", "garage-glyph");
  node.append(el("kbd", "garage-key garage-key-pad", pad), el("kbd", "garage-key garage-key-keys", keys));
  return node;
}

export function hint(label: string, ...keys: (keyof typeof GLYPHS)[]): HTMLElement {
  const node = el("span", "garage-hint");
  node.append(...keys.map(glyph), label);
  return node;
}

type Point = [number, number];

// Tile car in a 64 × 26 box, nose to the right, drawn deep-bodied so the door (DOOR_X × DOOR_Y, like the 3D side panel)
// is big enough for each pattern to read at phone size.
const BODY: Point[] = [[2, 22], [2, 12.5], [15, 11], [21, 4], [41, 4], [48, 11], [62, 12.5], [62, 22]];
const GLASS: Point[] = [[22.5, 6], [39.5, 6], [45, 10.6], [18.5, 10.6]];
const WHEELS = [13, 51];
const DOOR_X: Point = [18, 46];
const DOOR_Y: Point = [20.6, 12];
const TOP_LINE = "M2 13.6 L15 12.1 M21 5.1 L41 5.1 M48 12.1 L62 13.6";

const path_of = (points: Point[]) => `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L")}Z`;
const door = (points: Point[]): Point[] => points.map(([u, v]) => [DOOR_X[0] + u * (DOOR_X[1] - DOOR_X[0]), DOOR_Y[0] + v * (DOOR_Y[1] - DOOR_Y[0])]);

function decal_marks(decal: Decal): SVGElement[] {
  const ink = { class: "decal-ink" };
  switch (decal) {
    case "centre":
      return [svg("path", { class: "decal-line", d: TOP_LINE, "stroke-width": 2.2 })];
    case "twin":
      return [svg("path", { class: "decal-line", d: TOP_LINE, "stroke-width": 2.2 }), svg("path", { class: "decal-gap", d: TOP_LINE, "stroke-width": 0.7 })];
    case "side":
      return SIDE_BAND.map((band) => svg("path", { ...ink, d: path_of(door(band)) }));
    case "slash":
      return SLASH.map((band) => svg("path", { ...ink, d: path_of(door(band)) }));
    case "flames":
      return [svg("path", { ...ink, d: path_of(door(FLAME)) })];
    case "number":
      return [svg("circle", { ...ink, cx: 32, cy: 16.3, r: 4.1 }), svg("text", { class: "decal-number", x: 32, y: 16.4 })];
    case "checker": {
      const marks: SVGElement[] = [svg("rect", { class: "decal-back", x: 19.6, y: 13.7, width: 24.8, height: 5.2 })];
      for (let col = 0; col < 10; col++)
        for (let row = 0; row < 2; row++)
          if ((col + row) % 2 === 0) marks.push(svg("rect", { class: "decal-check", x: 20 + col * 2.4, y: 14.1 + row * 2.2, width: 2.4, height: 2.2 }));
      return marks;
    }
    case "rabbit":
      return [
        svg("circle", { ...ink, cx: 32, cy: 17.6, r: 2.8 }),
        ...[-1, 1].map((side) => svg("ellipse", { ...ink, cx: 32 + side * 1.3, cy: 12.6, rx: 1, ry: 3, transform: `rotate(${side * 12} ${32 + side * 1.3} 12.6)` })),
      ];
    default:
      return [];
  }
}

export function decal_tile(decal: Decal): SVGSVGElement {
  const tile = svg("svg", { viewBox: "0 3 64 23", "aria-hidden": "true", class: "decal-tile" });
  tile.append(
    svg("path", { class: "decal-body", d: path_of(BODY) }),
    svg("path", { class: "decal-glass", d: path_of(GLASS) }),
    ...decal_marks(decal),
    ...WHEELS.map((cx) => svg("circle", { class: "decal-wheel", cx, cy: 22, r: 4 })),
  );
  return tile;
}
