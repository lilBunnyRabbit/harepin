import { svg } from "./garage-widgets";

type Shape = [tag: "path" | "rect" | "circle" | "ellipse", part: string, attributes: Record<string, string | number>];

export const TourArt = {
  MODES: "modes",
  GARAGE: "garage",
  FRIENDS: "friends",
} as const;
export type TourArt = (typeof TourArt)[keyof typeof TourArt];

// The art fits the card whole; scenery runs this far past the frame so a wide or tall card shows more world, not bands.
const FAR = 400;
const VIEW = "8 24 144 92";
const HORIZON = 78;

const OUTDOORS: Shape[] = [
  ["path", "hill", { d: `M${-FAR} ${HORIZON}V62L0 64l22-8 22 6 26-12 28 10 26-8 36 10L${FAR} 64V${HORIZON}z` }],
  ["rect", "ground", { x: -FAR, y: HORIZON, width: 2 * FAR, height: FAR }],
];

function car(x: number, base: number, part: string): Shape[] {
  const at = (dx: number, dy: number) => `${x + dx} ${base + dy}`;
  return [
    ["path", part, { d: `M${at(0, -7)}L${at(3, -15)}L${at(16, -17)}L${at(22, -27)}L${at(40, -27)}L${at(48, -17)}L${at(54, -15)}L${at(56, -7)}Z` }],
    ["path", "glass", { d: `M${at(21, -18)}L${at(25, -24)}L${at(30, -24)}L${at(30, -18)}ZM${at(33, -18)}L${at(33, -24)}L${at(38, -24)}L${at(43, -18)}Z` }],
    ["circle", "tyre", { cx: x + 14, cy: base - 6, r: 7 }],
    ["circle", "tyre", { cx: x + 43, cy: base - 6, r: 7 }],
    ["circle", "hub", { cx: x + 14, cy: base - 6, r: 3 }],
    ["circle", "hub", { cx: x + 43, cy: base - 6, r: 3 }],
  ];
}

function cone(x: number, base: number): Shape[] {
  return [
    ["path", "cone", { d: `M${x - 5} ${base}L${x} ${base - 13}L${x + 5} ${base}Z` }],
    ["rect", "cone", { x: x - 8, y: base, width: 16, height: 3, rx: 1.5 }],
  ];
}

function star(x: number, y: number, r: number): Shape {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const reach = i % 2 ? r * 0.45 : r;
    return `${(x + reach * Math.cos(angle)).toFixed(1)} ${(y + reach * Math.sin(angle)).toFixed(1)}`;
  });
  return ["path", "star", { d: `M${points.join("L")}Z` }];
}

function checker(x: number, y: number, cols: number, size: number): Shape[] {
  return Array.from({ length: cols * 2 }, (_, i): Shape => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return ["rect", (col + row) % 2 ? "flag-dark" : "flag-light", { x: x + col * size, y: y + row * size, width: size, height: size }];
  });
}

const MODES: Shape[] = [
  ...OUTDOORS,
  ["path", "road", { d: "M-140 340h360L84 78h-8z" }],
  ["path", "mark", { d: "M78.4 140h3.2l-.5-12h-2.2zM79 120h2l-.4-10h-1.2zM79.5 102h1l-.2-7h-.6zM79.8 89h.4l-.1-5h-.2z" }],
  ["rect", "post", { x: 60, y: 60, width: 4, height: 32 }],
  ["rect", "post", { x: 96, y: 60, width: 4, height: 32 }],
  ...checker(58, 56, 9, 5),
  ...cone(32, 102),
  ...cone(130, 106),
  star(64, 40, 7),
  star(80, 36, 9),
  star(96, 40, 7),
];

const GARAGE: Shape[] = [
  ["rect", "frame", { x: -FAR, y: -FAR, width: 2 * FAR, height: FAR + 88 }],
  ["rect", "wall", { x: 14, y: 12, width: 132, height: 76 }],
  ["rect", "door", { x: 14, y: 12, width: 132, height: 14 }],
  ["rect", "frame", { x: 14, y: 18, width: 132, height: 2 }],
  ["rect", "ground", { x: -FAR, y: 88, width: 2 * FAR, height: FAR }],
  ["ellipse", "turntable", { cx: 80, cy: 102, rx: 40, ry: 6 }],
  ...car(52, 102, "car"),
  ["rect", "tyre", { x: 20, y: 84, width: 20, height: 8, rx: 3 }],
  ["rect", "tyre", { x: 20, y: 94, width: 20, height: 8, rx: 3 }],
  ["rect", "chip-secondary", { x: 98, y: 38, width: 12, height: 12, rx: 3 }],
  ["rect", "chip-accent", { x: 114, y: 38, width: 12, height: 12, rx: 3 }],
  ["rect", "chip-tertiary", { x: 130, y: 38, width: 12, height: 12, rx: 3 }],
];

const FRIENDS: Shape[] = [
  ...OUTDOORS,
  ["rect", "road", { x: -FAR, y: 86, width: 2 * FAR, height: 28 }],
  ...Array.from({ length: FAR / 10 }, (_, i): Shape => ["rect", "mark", { x: 4 - FAR + i * 20, y: 99, width: 10, height: 2 }]),
  ...car(16, 97, "car-friend"),
  ...car(86, 112, "car"),
  ["path", "bubble", { d: "M98 40h36a7 7 0 0 1 7 7v10a7 7 0 0 1-7 7h-24l-12 9 2-9h-2a7 7 0 0 1-7-7V47a7 7 0 0 1 7-7z" }],
  ["rect", "link", { x: 101, y: 48, width: 16, height: 8, rx: 4 }],
  ["rect", "link", { x: 113, y: 48, width: 16, height: 8, rx: 4 }],
];

const SCENES: Record<TourArt, Shape[]> = {
  [TourArt.MODES]: MODES,
  [TourArt.GARAGE]: GARAGE,
  [TourArt.FRIENDS]: FRIENDS,
};

export function tour_art(scene: TourArt): SVGSVGElement {
  const node = svg("svg", { viewBox: VIEW, "aria-hidden": "true", class: "tour-art" });
  for (const [tag, part, attributes] of SCENES[scene]) node.append(svg(tag, { ...attributes, class: `art-${part}` }));
  return node;
}
