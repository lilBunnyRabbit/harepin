import type { Decal } from "../car/build";
import { FLAME, REWARD_MOTIFS, SIDE_BAND, SLASH } from "../car/livery";
import "./decal-tile.css";

const SVG = "http://www.w3.org/2000/svg";

export interface DecalShape {
  tag: "path" | "circle" | "ellipse" | "rect" | "text";
  attributes: Record<string, string | number>;
}

export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
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
export const DECAL_VIEW_BOX = "0 3 64 23";

const path_of = (points: Point[]) => `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L")}Z`;
const door = (points: Point[]): Point[] => points.map(([u, v]) => [DOOR_X[0] + u * (DOOR_X[1] - DOOR_X[0]), DOOR_Y[0] + v * (DOOR_Y[1] - DOOR_Y[0])]);
const ink = (d: string): DecalShape => ({ tag: "path", attributes: { class: "decal-ink", d } });

function decal_marks(decal: Decal): DecalShape[] {
  switch (decal) {
    case "centre":
      return [{ tag: "path", attributes: { class: "decal-line", d: TOP_LINE, "stroke-width": 2.2 } }];
    case "twin":
      return [
        { tag: "path", attributes: { class: "decal-line", d: TOP_LINE, "stroke-width": 2.2 } },
        { tag: "path", attributes: { class: "decal-gap", d: TOP_LINE, "stroke-width": 0.7 } },
      ];
    case "side":
      return SIDE_BAND.map((band) => ink(path_of(door(band))));
    case "slash":
      return SLASH.map((band) => ink(path_of(door(band))));
    case "sky":
    case "volcano":
    case "ice":
    case "dunes":
    case "velodrome":
      return REWARD_MOTIFS[decal].map((band) => ink(path_of(door(band))));
    case "flames":
      return [ink(path_of(door(FLAME)))];
    case "number":
      return [
        { tag: "circle", attributes: { class: "decal-ink", cx: 32, cy: 16.3, r: 4.1 } },
        { tag: "text", attributes: { class: "decal-number", x: 32, y: 16.4 } },
      ];
    case "checker": {
      const marks: DecalShape[] = [{ tag: "rect", attributes: { class: "decal-back", x: 19.6, y: 13.7, width: 24.8, height: 5.2 } }];
      for (let col = 0; col < 10; col++)
        for (let row = 0; row < 2; row++)
          if ((col + row) % 2 === 0) marks.push({ tag: "rect", attributes: { class: "decal-check", x: 20 + col * 2.4, y: 14.1 + row * 2.2, width: 2.4, height: 2.2 } });
      return marks;
    }
    case "rabbit":
      return [
        { tag: "circle", attributes: { class: "decal-ink", cx: 32, cy: 17.6, r: 2.8 } },
        ...[-1, 1].map((side): DecalShape => ({
          tag: "ellipse",
          attributes: { class: "decal-ink", cx: 32 + side * 1.3, cy: 12.6, rx: 1, ry: 3, transform: `rotate(${side * 12} ${32 + side * 1.3} 12.6)` },
        })),
      ];
    default:
      return [];
  }
}

/** The tile car wearing `decal`, back to front; a `text` shape takes the car's number. */
export function decal_shapes(decal: Decal): DecalShape[] {
  return [
    { tag: "path", attributes: { class: "decal-body", d: path_of(BODY) } },
    { tag: "path", attributes: { class: "decal-glass", d: path_of(GLASS) } },
    ...decal_marks(decal),
    ...WHEELS.map((cx): DecalShape => ({ tag: "circle", attributes: { class: "decal-wheel", cx, cy: 22, r: 4 } })),
  ];
}

export function decal_tile(decal: Decal): SVGSVGElement {
  const tile = svg("svg", { viewBox: DECAL_VIEW_BOX, "aria-hidden": "true", class: "decal-tile" });
  tile.append(...decal_shapes(decal).map((shape) => svg(shape.tag, shape.attributes)));
  return tile;
}
