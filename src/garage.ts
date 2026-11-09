import * as THREE from "three";
import {
  DECALS,
  DEFAULT_BUILD,
  DEFAULT_PARTS,
  MAX_NUMBER,
  SLOTS,
  SLOT_NAMES,
  STATS,
  WHOLE_CAR,
  build_code,
  build_spec,
  parse_build,
  part_of,
  slot_view,
  stat_range,
  stats,
  type Build,
  type Part,
  type Decal,
  type Slot,
  type SlotView,
  type Stats,
} from "./build";
import { CARS, is_car } from "./cars";
import { typing, type Nav } from "./input";
import { FLAME, SIDE_BAND, SLASH } from "./livery";
import { build_view, contact_shadow, dispose_car_view, livery_of, rest_wheels, type CarView } from "./models";
import { NEUTRAL_INKS, brand, car_paints, color, dark, decal_inks, rgba } from "./palette";
import "./garage.css";

export const BUILD_KEY = "harepin:build";

const STAT_NAMES: Record<keyof Stats, string> = { power: "Power", grip: "Grip", braking: "Braking", top_speed: "Top speed" };
// An empty bar reads as broken, so the weakest car in the game still shows a sliver.
const BAR_FLOOR = 0.08;

const DECAL_NAMES: Record<Decal, string> = {
  none: "None",
  centre: "Centre stripe",
  twin: "Twin stripes",
  side: "Side stripe",
  number: "Number",
  flames: "Flames",
  slash: "Slash",
  checker: "Checker",
  rabbit: "Rabbit",
};

const EYE_AZIMUTH = Math.atan2(4.6, 5.4);
const EYE_ELEVATION = Math.atan2(2.8, Math.hypot(4.6, 5.4));
/** How far a drag tilts the view above and below the stand's usual angle, radians. */
const PITCH_MIN = -0.25;
const PITCH_MAX = 0.55;
/** Zoom over the whole-car fit; 1 is the most a pinch or the wheel backs out. */
const ZOOM_MAX = 2.6;
const DRAG_YAW = 0.01;
const DRAG_PITCH = 0.006;
const WHEEL_ZOOM = 0.0015;
/** Camera distance over the tightest fit: room around the car so it reads as a car on a stand, not a crop. */
const FIT_SLACK = 1.5;
const EASE_MS = 600;
const COUNT_MS = 450;
/** Breathing room between the car and the panels around it, CSS px. */
const FREE_PAD = 12;
const SIDE_VIEW: SlotView = { yaw: -0.87 };
/** Height of the stand's floor under the car, where the tyres sit whatever the ride height. */
const GROUND = -0.6;
/** Turns the fit is checked at, so the framing holds wherever the car is turned. */
const FIT_TURNS = 24;
/** Grid the stand's outline points snap to, metres: fewer points for the fit, nothing a pixel would show. */
const OUTLINE_GRID = 0.04;
/** Slots shown under Body: the parts you see first on the car. Every other slot lands under Performance. */
const BODY_SLOTS: readonly Slot[] = ["aero"];
const SVG = "http://www.w3.org/2000/svg";

type Point = [number, number];

// Tile car in a 64 × 26 box, nose to the right, drawn deep-bodied so the door (DOOR_X × DOOR_Y, like the 3D side panel)
// is big enough for each pattern to read at phone size.
const BODY: Point[] = [[2, 22], [2, 12.5], [15, 11], [21, 4], [41, 4], [48, 11], [62, 12.5], [62, 22]];
const GLASS: Point[] = [[22.5, 6], [39.5, 6], [45, 10.6], [18.5, 10.6]];
const WHEELS = [13, 51];
const DOOR_X: Point = [18, 46];
const DOOR_Y: Point = [20.6, 12];
const TOP_LINE = "M2 13.6 L15 12.1 M21 5.1 L41 5.1 M48 12.1 L62 13.6";

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
};

type Kind = "part" | "car" | "paint" | "ink" | "decal" | "number";

interface Item {
  id: string;
  label: string;
  kind: Kind;
  view: SlotView;
  count: number;
  /** The fitted option in `build`. */
  at(build: Build): number;
  with(build: Build, option: number): Build;
  name(option: number): string;
  blurb(option: number): string;
}

const CAR_IDS = Object.keys(CARS).filter(is_car);

const part_item = (slot: Slot): Item => ({
  id: slot,
  label: SLOTS[slot].label,
  kind: "part",
  view: slot_view(slot),
  count: SLOTS[slot].parts.length,
  at: (b) => b.parts[slot],
  with: (b, i) => ({ ...b, parts: { ...b.parts, [slot]: i } }),
  name: (i) => part_of(slot, i).name,
  blurb: (i) => part_of(slot, i).blurb ?? "",
});

const PART_ITEMS = new Map(SLOT_NAMES.map((slot) => [slot, part_item(slot)]));
const part_items = (slots: readonly Slot[]) => slots.flatMap((slot) => PART_ITEMS.get(slot) ?? []);

const CAR_ITEM: Item = {
  id: "car",
  label: "Car",
  kind: "car",
  view: WHOLE_CAR,
  count: CAR_IDS.length,
  at: (b) => CAR_IDS.indexOf(b.car),
  with: (b, i) => ({ ...b, car: CAR_IDS[i] }),
  name: (i) => CARS[CAR_IDS[i]].name,
  blurb: (i) => {
    const spec = CARS[CAR_IDS[i]];
    return `${spec.drive.toUpperCase()} · ${Math.round(spec.mass)} kg`;
  },
};

const DECAL_ITEM: Item = {
  id: "decal",
  label: "Decal",
  kind: "decal",
  view: SIDE_VIEW,
  count: DECALS.length,
  at: (b) => b.decal,
  with: (b, i) => ({ ...b, decal: i }),
  name: (i) => DECAL_NAMES[DECALS[i]],
  blurb: () => "",
};

const NUMBER_ITEM: Item = {
  id: "number",
  label: "Number",
  kind: "number",
  view: SIDE_VIEW,
  count: MAX_NUMBER + 1,
  at: (b) => b.number,
  with: (b, i) => ({ ...b, number: i }),
  name: (i) => String(i).padStart(2, "0"),
  blurb: () => "",
};

const PAINT_ITEM: Item = {
  id: "paint",
  label: "Paint",
  kind: "paint",
  view: WHOLE_CAR,
  count: car_paints.length,
  at: (b) => b.paint % car_paints.length,
  with: (b, i) => ({ ...b, paint: i }),
  name: (i) => `Paint ${i + 1}`,
  blurb: () => "",
};

const INK_ITEM: Item = {
  id: "ink",
  label: "Decal colour",
  kind: "ink",
  view: SIDE_VIEW,
  count: decal_inks.length,
  at: (b) => b.ink % decal_inks.length,
  with: (b, i) => ({ ...b, ink: i }),
  name: (i) => (i < NEUTRAL_INKS ? ["Light", "Dark"][i] : `Paint ${i - NEUTRAL_INKS + 1}`),
  blurb: () => "",
};

interface Tab {
  label: string;
  items(build: Build): Item[];
}

const TABS: Tab[] = [
  { label: "Body", items: (b) => [CAR_ITEM, ...part_items(BODY_SLOTS), DECAL_ITEM, ...(DECALS[b.decal] === "number" ? [NUMBER_ITEM] : [])] },
  { label: "Performance", items: () => part_items(SLOT_NAMES.filter((slot) => !BODY_SLOTS.includes(slot))) },
  { label: "Paint", items: (b) => [PAINT_ITEM, ...(DECALS[b.decal] === "none" ? [] : [INK_ITEM])] },
];

/** Glyphs per input: the pad's, then the keyboard's. */
const GLYPHS: Record<"move" | "accept" | "back" | "prev" | "next", [string, string]> = {
  move: ["✥", "Arrows"],
  accept: ["A", "Enter"],
  back: ["B", "Esc"],
  prev: ["LB", "Q"],
  next: ["RB", "E"],
};

const KEY_NAV: Record<string, Nav> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "accept",
  NumpadEnter: "accept",
  Escape: "back",
  KeyQ: "prev",
  KeyE: "next",
};

export function load_build(query: string | null): Build {
  const asked = parse_build(query);
  if (asked) return asked;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(BUILD_KEY);
  } catch (error) {
    console.warn("garage: saved build unreadable", error);
  }
  const base = parse_build(saved) ?? DEFAULT_BUILD;
  return query !== null && is_car(query) ? { ...base, car: query } : base;
}

function save_build(build: Build) {
  try {
    localStorage.setItem(BUILD_KEY, build_code(build));
  } catch (error) {
    console.warn("garage: build not saved", error);
  }
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, class_name: string, text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = class_name;
  node.textContent = text;
  return node;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

function icon(id: string): SVGSVGElement {
  const node = svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", class: "garage-icon" });
  node.append(svg("path", { d: ICONS[id] ?? ICONS.part }));
  return node;
}

function glyph(which: keyof typeof GLYPHS): HTMLElement {
  const [pad, keys] = GLYPHS[which];
  const node = element("span", "garage-glyph");
  node.append(element("kbd", "garage-key garage-key-pad", pad), element("kbd", "garage-key garage-key-keys", keys));
  return node;
}

function hint(label: string, ...keys: (keyof typeof GLYPHS)[]): HTMLElement {
  const node = element("span", "garage-hint");
  node.append(...keys.map(glyph), label);
  return node;
}

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

function decal_tile(decal: Decal): SVGSVGElement {
  const tile = svg("svg", { viewBox: "0 3 64 23", "aria-hidden": "true", class: "decal-tile" });
  tile.append(
    svg("path", { class: "decal-body", d: path_of(BODY) }),
    svg("path", { class: "decal-glass", d: path_of(GLASS) }),
    ...decal_marks(decal),
    ...WHEELS.map((cx) => svg("circle", { class: "decal-wheel", cx, cy: 22, r: 4 })),
  );
  return tile;
}

const bar_of = (key: keyof Stats, value: number) => {
  const { low, high } = stat_range();
  return BAR_FLOOR + (1 - BAR_FLOOR) * Math.max(0, Math.min(1, (value - low[key]) / (high[key] - low[key])));
};
const rating = (key: keyof Stats, value: number) => Math.round(bar_of(key, value) * 100);
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const trend = (n: number) => (n > 0 ? "up" : n < 0 ? "down" : "flat");
const ease = (u: number) => 1 - (1 - u) ** 3;
const turn = (from: number, to: number) => ((((to - from + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

interface Pose {
  yaw: number;
  /** Tilt added to the stand's camera angle by a drag, radians. */
  pitch: number;
  zoom: number;
}

const pose_of = (view: SlotView): Pose => ({ yaw: view.yaw, pitch: 0, zoom: 1 });

interface Meter {
  value: HTMLElement;
  change: HTMLElement;
  fill: HTMLElement;
  ghost: HTMLElement;
  stock: HTMLElement;
  shown: number;
  count: number;
}

export class Garage {
  on_change: ((build: Build) => void) | null = null;
  private readonly root = element("div", "garage");
  private readonly canvas = element("canvas", "garage-canvas");
  private readonly top = element("header", "garage-top");
  private readonly car_name = element("span", "garage-sub");
  private readonly tabs = element("nav", "garage-tabs");
  private readonly rail = element("nav", "garage-panel garage-rail");
  private readonly panel = element("section", "garage-panel garage-stats");
  private readonly bottom = element("section", "garage-bottom");
  private readonly strip_head = element("div", "garage-strip-head");
  private readonly strip = element("div", "garage-strip");
  private readonly number_input = element("input", "garage-number");
  private readonly meters = new Map<keyof Stats, Meter>();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  private readonly shadow = contact_shadow();
  private renderer: THREE.WebGLRenderer | null = null;
  private view: CarView | null = null;
  private shown_code = "";
  private strip_key = "";
  private tab = 1;
  private item: Item = TABS[1].items(DEFAULT_BUILD)[0];
  private cursor = 0;
  private frame = 0;
  /** The car's centre and half extents with no turn, and the radius it sweeps when it turns. */
  /** The outline of every part this car can wear, unturned: the framing is fitted to it once per car, so swapping a part never moves the camera. */
  private points: THREE.Vector3[] = [];
  private stand_car: string | null = null;
  /** The point the camera looks at and its distance there before zoom; set by `frame_car`. */
  private readonly aim_at = new THREE.Vector3();
  private fit_distance = 10;
  /** The clear area between the panels in normalised device coordinates, -1..1, +y up. */
  private readonly clear = { left: -1, right: 1, bottom: -1, top: 1 };
  private area = { left: 0, top: 0, right: 0, bottom: 0 };
  private pose: Pose = pose_of(WHOLE_CAR);
  private from: Pose = pose_of(WHOLE_CAR);
  private to: Pose = pose_of(WHOLE_CAR);
  private moved = 0;
  private readonly calm = matchMedia("(prefers-reduced-motion: reduce)");
  private readonly pointers = new Map<number, { x: number; y: number }>();

  constructor(
    private readonly parent: HTMLElement,
    private current: Build,
  ) {
    this.root.hidden = true;
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Garage");
    this.root.dataset.input = "keys";

    const title = element("div", "garage-title");
    title.append(element("h2", "garage-heading", "Garage"), this.car_name);
    const done = element("button", "garage-done");
    done.type = "button";
    done.dataset.action = "close";
    done.append(glyph("back"), "Done");
    this.top.append(title, this.tabs, done);

    this.panel.append(element("h3", "garage-panel-title", "Against stock"));
    const rows = element("div", "garage-meters");
    for (const key of STATS) {
      const value = element("span", "garage-meter-value");
      const change = element("span", "garage-meter-change");
      const track = element("div", "garage-meter");
      const fill = element("div", "garage-meter-fill");
      const ghost = element("div", "garage-meter-ghost");
      const stock = element("i", "garage-meter-stock");
      track.append(fill, ghost, stock);
      rows.append(element("span", "garage-meter-label", STAT_NAMES[key]), value, change, track);
      this.meters.set(key, { value, change, fill, ghost, stock, shown: Number.NaN, count: 0 });
    }
    this.panel.append(rows);

    const hints = element("div", "garage-hints");
    hints.append(hint("Slot / part", "move"), hint("Fit", "accept"), hint("Tabs", "prev", "next"), hint("Back", "back"));
    this.bottom.append(this.strip_head, this.strip, hints);

    this.number_input.type = "text";
    this.number_input.inputMode = "numeric";
    this.number_input.maxLength = 2;
    this.number_input.size = 2;
    this.number_input.setAttribute("aria-label", "Number");
    this.number_input.addEventListener("input", this.typed);

    this.root.append(this.canvas, this.top, this.rail, this.panel, this.bottom);

    // Light themes have a dark foreground, which would light the car like dusk; their light comes from the page white.
    const light = dark ? brand.foreground : brand.background_lightest;
    this.scene.add(new THREE.HemisphereLight(color(light), color(brand.background_darkest), 2.2));
    const sun = new THREE.DirectionalLight(color(light), 2.4);
    sun.position.set(4, 6, 3);
    this.scene.add(sun);
    // The game's patch multiplies the ground under it; here there is no ground, only the page behind a clear canvas. As an
    // alpha map the blob reads its green channel, which is solid out to the rim; as a map its alpha fades it out.
    this.shadow.material.blending = THREE.NormalBlending;
    this.shadow.material.premultipliedAlpha = false;
    this.shadow.material.map = this.shadow.material.alphaMap;
    this.shadow.material.alphaMap = null;
    this.scene.add(this.shadow.mesh);
  }

  get build(): Build {
    return this.current;
  }

  get is_open(): boolean {
    return !this.root.hidden;
  }

  open() {
    if (this.is_open) return;
    if (!this.root.isConnected) this.parent.append(this.root);
    this.renderer ??= new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.root.hidden = false;
    this.root.dataset.input = navigator.getGamepads?.().some((pad) => pad?.connected) ? "pad" : "keys";
    this.root.addEventListener("click", this.click);
    this.root.addEventListener("pointerover", this.hover);
    this.strip.addEventListener("pointerleave", this.unhover);
    this.canvas.addEventListener("pointerdown", this.grab);
    this.canvas.addEventListener("pointermove", this.drag);
    this.canvas.addEventListener("lostpointercapture", this.release);
    this.canvas.addEventListener("wheel", this.wheel, { passive: false });
    addEventListener("keydown", this.key);
    addEventListener("resize", this.resized);
    const items = TABS[this.tab].items(this.current);
    this.item = items.find((item) => item.id === this.item.id) ?? items[0];
    this.cursor = this.item.at(this.current);
    this.pose = pose_of(this.item.view);
    this.to = this.pose;
    this.shown_code = "";
    this.refresh();
    this.resized();
  }

  close() {
    if (!this.is_open) return;
    this.root.hidden = true;
    this.root.removeEventListener("click", this.click);
    this.root.removeEventListener("pointerover", this.hover);
    this.strip.removeEventListener("pointerleave", this.unhover);
    this.canvas.removeEventListener("pointerdown", this.grab);
    this.canvas.removeEventListener("pointermove", this.drag);
    this.canvas.removeEventListener("lostpointercapture", this.release);
    this.canvas.removeEventListener("wheel", this.wheel);
    this.pointers.clear();
    removeEventListener("keydown", this.key);
    removeEventListener("resize", this.resized);
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    for (const meter of this.meters.values()) cancelAnimationFrame(meter.count);
  }

  /** Pad menu presses from `Input.nav`, once per game frame while open. */
  navigate(presses: readonly Nav[]) {
    if (!presses.length) return;
    this.root.dataset.input = "pad";
    for (const nav of presses) this.act(nav);
  }

  private act(nav: Nav) {
    if (!this.is_open) return;
    const items = TABS[this.tab].items(this.current);
    const index = Math.max(0, items.findIndex((item) => item.id === this.item.id));
    if (nav === "up" || nav === "down") this.select(items[(index + (nav === "up" ? -1 : 1) + items.length) % items.length]);
    else if (nav === "left" || nav === "right") {
      const step = nav === "left" ? -1 : 1;
      const count = this.item.count;
      this.preview(this.item.kind === "number" ? (this.cursor + step + count) % count : Math.max(0, Math.min(count - 1, this.cursor + step)));
    } else if (nav === "accept") this.fit(this.cursor);
    else if (nav === "back") this.close();
    else this.switch_tab(this.tab + (nav === "prev" ? -1 : 1));
  }

  private switch_tab(tab: number) {
    this.tab = (tab + TABS.length) % TABS.length;
    this.select(TABS[this.tab].items(this.current)[0]);
  }

  private select(item: Item) {
    this.item = item;
    this.cursor = item.at(this.current);
    this.aim(item.view);
    this.refresh();
  }

  private preview(option: number) {
    if (option === this.cursor) return;
    this.cursor = option;
    this.refresh();
  }

  private fit(option: number) {
    this.cursor = option;
    this.apply(this.item.with(this.current, option));
    this.refresh();
  }

  private readonly click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLElement>("[data-action]");
    if (!target) return;
    const { action, value } = target.dataset;
    const n = Number(value);
    if (action === "close") this.close();
    else if (action === "tab") this.switch_tab(n);
    else if (action === "item") {
      const item = TABS[this.tab].items(this.current).find((it) => it.id === value);
      if (item) this.select(item);
    } else if (action === "option") this.fit(n);
    else if (action === "step") this.fit((this.cursor + n + MAX_NUMBER + 1) % (MAX_NUMBER + 1));
  };

  // Hover previews like the pad cursor does; a tap fits straight away through `click`, so touch never sees a preview.
  private readonly hover = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
    const card = event.target.closest<HTMLElement>("[data-action='option']");
    if (card) this.preview(Number(card.dataset.value));
  };

  private readonly unhover = (event: PointerEvent) => {
    if (event.pointerType === "mouse") this.preview(this.item.at(this.current));
  };

  private readonly typed = () => {
    const digits = this.number_input.value.replace(/\D/g, "");
    if (digits !== this.number_input.value) this.number_input.value = digits;
    if (digits) this.fit(Number(digits));
  };

  private readonly key = (event: KeyboardEvent) => {
    const nav = KEY_NAV[event.code];
    if (!nav || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (typing(event.target) && nav !== "back" && nav !== "accept") return;
    event.preventDefault();
    this.root.dataset.input = "keys";
    this.act(nav);
  };

  private apply(next: Build) {
    const checked = parse_build(build_code(next));
    if (!checked || build_code(checked) === build_code(this.current)) return;
    this.current = checked;
    save_build(checked);
    this.on_change?.(checked);
  }

  /** The build the screen shows: the fitted one with the cursor's option tried on. */
  private get shown(): Build {
    return this.cursor === this.item.at(this.current) ? this.current : this.item.with(this.current, this.cursor);
  }

  private refresh() {
    const shown = this.shown;
    this.car_name.textContent = CARS[shown.car].name;
    this.render_tabs();
    this.render_rail();
    this.render_strip(shown);
    this.render_meters(shown);
    this.show_car(shown);
  }

  private render_tabs() {
    this.tabs.replaceChildren(
      glyph("prev"),
      ...TABS.map((tab, i) => {
        const button = element("button", "garage-tab", tab.label);
        button.type = "button";
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(i === this.tab));
        button.dataset.action = "tab";
        button.dataset.value = String(i);
        return button;
      }),
      glyph("next"),
    );
  }

  private render_rail() {
    this.rail.replaceChildren(
      ...TABS[this.tab].items(this.current).map((item) => {
        const button = element("button", "garage-slot");
        button.type = "button";
        button.dataset.action = "item";
        button.dataset.value = item.id;
        button.setAttribute("aria-label", item.label);
        if (item.id === this.item.id) button.setAttribute("aria-current", "true");
        button.append(icon(item.id), element("small", "garage-slot-label", item.label), element("b", "garage-slot-part", item.name(item.at(this.current))));
        return button;
      }),
    );
  }

  private render_strip(shown: Build) {
    const item = this.item;
    const fitted = item.at(this.current);
    const livery = livery_of(shown);
    this.strip.style.setProperty("--decal-paint", rgba(car_paints[shown.paint % car_paints.length]));
    this.strip.style.setProperty("--decal-ink", livery.ink.getStyle());
    this.strip.style.setProperty("--decal-mark", livery.mark.getStyle());
    this.strip.style.setProperty("--decal-key", livery.key ? livery.key.getStyle() : "transparent");

    const swapped = DECALS[shown.decal] !== "none" && !livery.ink.equals(color(decal_inks[shown.ink % decal_inks.length]));
    const head: (Node | string)[] = [icon(item.id), element("b", "", item.label)];
    if (item.kind !== "number") head.push(` · ${this.cursor + 1} of ${item.count}`);
    if ((item.kind === "decal" || item.kind === "ink") && swapped) head.push(" · auto-contrast");
    if (this.cursor !== fitted) head.push(hint("Fit", "accept"));
    this.strip_head.replaceChildren(...head);

    const key = `${item.id}:${item.count}:${this.tab}`;
    if (key !== this.strip_key) {
      this.strip_key = key;
      this.strip.dataset.kind = item.kind;
      if (item.kind === "number") {
        const card = element("div", "garage-card garage-stepper");
        const step = (label: string, value: string, aria: string) => {
          const button = element("button", "garage-step", label);
          button.type = "button";
          button.dataset.action = "step";
          button.dataset.value = value;
          button.setAttribute("aria-label", aria);
          return button;
        };
        card.append(step("−", "-1", "Number down"), this.number_input, step("+", "1", "Number up"));
        this.strip.replaceChildren(card);
      } else
        this.strip.replaceChildren(
          ...Array.from({ length: item.count }, (_, i) => {
            const card = element("button", "garage-card");
            card.type = "button";
            card.dataset.action = "option";
            card.dataset.value = String(i);
            if (item.kind === "paint" || item.kind === "ink") {
              const swatch = element("i", "garage-swatch");
              swatch.style.background = rgba((item.kind === "paint" ? car_paints : decal_inks)[i]);
              card.append(swatch);
            }
            if (item.kind === "decal") card.append(decal_tile(DECALS[i]));
            card.append(element("b", "garage-card-name", item.name(i)));
            const blurb = item.blurb(i);
            if (blurb) card.append(element("span", "garage-card-blurb", blurb));
            return card;
          }),
        );
    }
    for (const text of this.strip.querySelectorAll(".decal-number")) text.textContent = String(shown.number);
    if (item.kind === "number") {
      if (document.activeElement !== this.number_input) this.number_input.value = item.name(this.cursor);
      this.strip.firstElementChild?.classList.toggle("is-cursor", this.cursor !== fitted);
      return;
    }
    for (const card of this.strip.children) {
      if (!(card instanceof HTMLElement)) continue;
      const i = Number(card.dataset.value);
      card.setAttribute("aria-pressed", String(i === fitted));
      card.classList.toggle("is-cursor", i === this.cursor);
      if (i === this.cursor) card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: this.calm.matches ? "instant" : "smooth" });
    }
  }

  private render_meters(shown: Build) {
    const now = stats(build_spec(this.current));
    const next = stats(build_spec(shown));
    const stock = stats(build_spec({ ...shown, parts: DEFAULT_PARTS }));
    for (const [key, meter] of this.meters) {
      const a = bar_of(key, now[key]);
      const b = bar_of(key, next[key]);
      const lo = Math.min(a, b);
      meter.fill.style.width = `${lo * 100}%`;
      meter.ghost.style.left = `${lo * 100}%`;
      meter.ghost.style.width = `${Math.abs(b - a) * 100}%`;
      meter.stock.style.left = `${bar_of(key, stock[key]) * 100}%`;
      const fitted = rating(key, now[key]);
      const tried = rating(key, next[key]);
      meter.ghost.dataset.trend = trend(tried - fitted);
      if (tried !== fitted) {
        meter.change.textContent = `→ ${tried}`;
        meter.change.dataset.trend = trend(tried - fitted);
      } else {
        const against = fitted - rating(key, stock[key]);
        meter.change.textContent = against ? signed(against) : "";
        meter.change.dataset.trend = trend(against);
      }
      this.count(meter, fitted);
    }
  }

  private count(meter: Meter, to: number) {
    const from = meter.shown;
    meter.shown = to;
    cancelAnimationFrame(meter.count);
    if (Number.isNaN(from) || from === to || this.calm.matches) {
      meter.value.textContent = String(to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / COUNT_MS);
      meter.value.textContent = String(Math.round(from + (to - from) * ease(u)));
      if (u < 1) meter.count = requestAnimationFrame(step);
    };
    meter.count = requestAnimationFrame(step);
  }

  private show_car(build: Build) {
    const code = build_code(build);
    if (code === this.shown_code) return;
    this.shown_code = code;
    if (this.view) {
      this.scene.remove(this.view.root);
      dispose_car_view(this.view);
    }
    this.view = stand_view(build);
    this.scene.add(this.view.root);
    if (build.car !== this.stand_car) this.stand(build);
    this.draw();
  }

  /** Outlines the car with every part it can wear, so the framing and shadow fit them all and stay put across swaps. */
  private stand(build: Build) {
    this.stand_car = build.car;
    const base: Build = { ...build, parts: { ...DEFAULT_PARTS } };
    // Only parts that change the shape: a look of their own, or a ride height or centre of mass that moves the body.
    const shaped = ({ look, mod }: Part) => look !== undefined || [mod.add, mod.scale].some((m) => m?.rest !== undefined || m?.cog !== undefined);
    const builds = [base];
    for (const slot of SLOT_NAMES) {
      const parts: Part[] = SLOTS[slot].parts;
      parts.forEach((part, i) => shaped(part) && builds.push({ ...base, parts: { ...base.parts, [slot]: i } }));
    }
    const seen = new Set<string>();
    const vertex = new THREE.Vector3();
    const box = new THREE.Box3();
    this.points = [];
    for (const variant of builds) {
      const view = stand_view(variant);
      view.root.traverseVisible((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const position = object.geometry.getAttribute("position");
        for (let i = 0; i < position.count; i++) {
          vertex.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
          box.expandByPoint(vertex);
          const key = `${Math.round(vertex.x / OUTLINE_GRID)},${Math.round(vertex.y / OUTLINE_GRID)},${Math.round(vertex.z / OUTLINE_GRID)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          this.points.push(vertex.clone());
        }
      });
      dispose_car_view(view);
    }
    const center = box.getCenter(new THREE.Vector3());
    const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    this.shadow.mesh.position.set(center.x, GROUND + 0.02, center.z);
    this.shadow.mesh.scale.set(half.x, 1, half.z / 2);
    this.frame_car();
  }

  private aim(view: SlotView) {
    this.from = { ...this.pose };
    this.to = pose_of(view);
    this.moved = performance.now();
    if (this.calm.matches) {
      this.pose = this.to;
      this.draw();
    } else if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number) => {
    const u = Math.min(1, (now - this.moved) / EASE_MS);
    const e = ease(u);
    this.pose = {
      yaw: this.from.yaw + turn(this.from.yaw, this.to.yaw) * e,
      pitch: THREE.MathUtils.lerp(this.from.pitch, this.to.pitch, e),
      zoom: THREE.MathUtils.lerp(this.from.zoom, this.to.zoom, e),
    };
    this.draw();
    this.frame = u < 1 ? requestAnimationFrame(this.tick) : 0;
  };

  private stop_easing() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private readonly grab = (event: PointerEvent) => {
    this.canvas.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.stop_easing();
  };

  // One pointer turns the car on its stand and tilts the view; two pinch the zoom. Each move draws one frame, so a car
  // left alone runs no loop.
  private readonly drag = (event: PointerEvent) => {
    const last = this.pointers.get(event.pointerId);
    if (!last) return;
    const spread = () => {
      const [a, b] = [...this.pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    if (this.pointers.size === 2) {
      const before = spread();
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (before > 0) this.zoom_by(spread() / before);
      return;
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.pose.yaw += (event.clientX - last.x) * DRAG_YAW;
    this.pose.pitch = THREE.MathUtils.clamp(this.pose.pitch + (event.clientY - last.y) * DRAG_PITCH, PITCH_MIN, PITCH_MAX);
    this.draw();
  };

  private readonly release = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
  };

  private readonly wheel = (event: WheelEvent) => {
    event.preventDefault();
    this.stop_easing();
    this.zoom_by(Math.exp(-event.deltaY * WHEEL_ZOOM));
  };

  private zoom_by(factor: number) {
    this.pose.zoom = THREE.MathUtils.clamp(this.pose.zoom * factor, 1, ZOOM_MAX);
    this.draw();
  }

  /** Frames the car in the part of the screen the panels leave clear. */
  private readonly resized = () => {
    const renderer = this.renderer;
    if (!renderer || !this.is_open) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    renderer.setSize(width, height, false);
    const area = { left: 0, top: 0, right: width, bottom: height };
    const box = (panel: HTMLElement) => {
      const r = panel.getBoundingClientRect();
      return r.width && r.height ? r : null;
    };
    const top = box(this.top);
    const rail = box(this.rail);
    const stats = box(this.panel);
    const bottom = box(this.bottom);
    if (top) area.top = Math.max(area.top, top.bottom + FREE_PAD);
    if (rail) area.left = Math.max(area.left, rail.right + FREE_PAD);
    if (stats) area.right = Math.min(area.right, stats.left - FREE_PAD);
    if (bottom) area.bottom = Math.min(area.bottom, bottom.top - FREE_PAD);
    this.area = area;
    this.clear.left = (2 * area.left) / width - 1;
    this.clear.right = (2 * Math.max(area.right, area.left + 80)) / width - 1;
    this.clear.top = 1 - (2 * area.top) / height;
    this.clear.bottom = 1 - (2 * Math.max(area.bottom, area.top + 80)) / height;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.frame_car();
    this.draw();
  };

  /**
   * Fits the stand outline into the clear area at every turn and finds one camera for all of them, so turning the car
   * to a slot, or swapping its parts, never moves the camera. Runs per car and per resize, not per frame.
   */
  private frame_car() {
    const n = this.points.length;
    if (!n) return;
    const { forward, side, up } = axes(0);
    const tan_v = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const tan_h = tan_v * this.camera.aspect;
    const { left, right, bottom, top } = this.clear;
    const total = n * FIT_TURNS;
    const along = { side: new Float64Array(total), up: new Float64Array(total), depth: new Float64Array(total) };
    const turned = new THREE.Vector3();
    for (let t = 0; t < FIT_TURNS; t++)
      this.points.forEach((point, i) => {
        turned.copy(point).applyAxisAngle(THREE.Object3D.DEFAULT_UP, (t / FIT_TURNS) * 2 * Math.PI);
        along.side[t * n + i] = turned.dot(side);
        along.up[t * n + i] = turned.dot(up);
        along.depth[t * n + i] = turned.dot(forward);
      });
    // With the view direction fixed, a camera `d` behind the stand's axis and slid by (x, y) across the view shows a point
    // at screen x = (side_i - x) / (depth_i + d) / tan_h; keeping every point of every turn inside the clear area bounds
    // x and y to an interval per distance, and the intervals only widen as the camera backs off.
    const slide = (d: number) => {
      const range = { x0: -Infinity, x1: Infinity, y0: -Infinity, y1: Infinity };
      for (let i = 0; i < total; i++) {
        const w = along.depth[i] + d;
        if (w <= 0.05) return null;
        range.x0 = Math.max(range.x0, along.side[i] - right * w * tan_h);
        range.x1 = Math.min(range.x1, along.side[i] - left * w * tan_h);
        range.y0 = Math.max(range.y0, along.up[i] - top * w * tan_v);
        range.y1 = Math.min(range.y1, along.up[i] - bottom * w * tan_v);
      }
      return range.x0 <= range.x1 && range.y0 <= range.y1 ? range : null;
    };
    let near = 0.1;
    let far = 400;
    for (let i = 0; i < 40 && slide(far) === null; i++) far *= 2;
    for (let i = 0; i < 28; i++) {
      const mid = (near + far) / 2;
      if (slide(mid)) far = mid;
      else near = mid;
    }
    this.fit_distance = far * FIT_SLACK;
    const range = slide(this.fit_distance) ?? { x0: 0, x1: 0, y0: 0, y1: 0 };
    this.aim_at.set(0, 0, 0).addScaledVector(side, (range.x0 + range.x1) / 2).addScaledVector(up, (range.y0 + range.y1) / 2);
  }

  private draw() {
    const renderer = this.renderer;
    if (!renderer || !this.view) return;
    const { yaw, pitch, zoom } = this.pose;
    this.view.root.rotation.y = yaw;
    this.shadow.mesh.rotation.y = yaw;
    this.camera.position.copy(this.aim_at).addScaledVector(axes(pitch).forward, -this.fit_distance / zoom);
    this.camera.lookAt(this.aim_at);
    renderer.render(this.scene, this.camera);
  }
}

/** The camera's view direction and screen axes, tilted by a drag's `pitch` above the stand's usual angle. */
function axes(pitch: number) {
  const elevation = EYE_ELEVATION + pitch;
  const forward = new THREE.Vector3(Math.sin(EYE_AZIMUTH) * Math.cos(elevation), Math.sin(elevation), Math.cos(EYE_AZIMUTH) * Math.cos(elevation)).negate();
  const side = forward.clone().cross(THREE.Object3D.DEFAULT_UP).normalize();
  return { forward, side, up: side.clone().cross(forward) };
}

/** The car on its stand: unturned, tyres on the floor, so a lower ride shows as the body dropping. */
function stand_view(build: Build): CarView {
  const spec = build_spec(build);
  const view = build_view(build, spec);
  rest_wheels(view, spec);
  view.root.position.y = GROUND - view.body.position.y;
  view.root.updateMatrixWorld(true);
  return view;
}
