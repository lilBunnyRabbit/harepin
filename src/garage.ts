import * as THREE from "three";
import { DECALS, DEFAULT_BUILD, MAX_NUMBER, build_code, build_spec, parse_build, type Build, type Decal } from "./build";
import { CARS, is_car } from "./cars";
import { FLAME, SIDE_BAND, SLASH } from "./livery";
import { build_view, dispose_car_view, livery_of, rest_wheels, type CarView } from "./models";
import { NEUTRAL_INKS, brand, car_paints, color, decal_inks, rgba } from "./palette";
import "./garage.css";

export const BUILD_KEY = "harepin:build";

const LEVELS: Record<"spoiler" | "suspension" | "engine", [string, string, string]> = {
  spoiler: ["None", "Lip", "Wing"],
  suspension: ["Soft", "Sport", "Race"],
  engine: ["Stock", "Tuned", "Race"],
};
type Option = keyof typeof LEVELS;
const OPTIONS = Object.keys(LEVELS) as Option[];

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
const NUMERIC = ["paint", "decal", "ink", "spoiler", "suspension", "engine"] as const;
type Numeric = (typeof NUMERIC)[number];
const is_numeric = (kind: string): kind is Numeric => (NUMERIC as readonly string[]).includes(kind);

const PREVIEW_SPIN = 0.5;
const PREVIEW_EYE = new THREE.Vector3(4.6, 2.2, 5.4);
// The default framing fits a 16:9 canvas; a narrower one (the landscape phone column) backs the camera off to keep the whole car in view.
const PREVIEW_ASPECT = 1.6;
const SVG = "http://www.w3.org/2000/svg";

type Point = [number, number];

// Tile car in a 64 × 23 box, nose to the right; the door spans DOOR_X × DOOR_Y like the 3D side panel.
const BODY: Point[] = [[3, 23], [3, 16], [18, 14], [24, 7], [42, 7], [49, 14], [61, 16], [61, 23]];
const GLASS: Point[] = [[25.5, 9], [40.5, 9], [45.5, 13.6], [21.5, 13.6]];
const DOOR_X: Point = [20, 44];
const DOOR_Y: Point = [21.5, 15];
const TOP_LINE = "M3 17.2 L18 15.2 M24 8.2 L42 8.2 M49 15.2 L61 17.2";

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

const path_of = (points: Point[]) => `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L")}Z`;
const door = (points: Point[]): Point[] => points.map(([u, v]) => [DOOR_X[0] + u * (DOOR_X[1] - DOOR_X[0]), DOOR_Y[0] + v * (DOOR_Y[1] - DOOR_Y[0])]);

function decal_marks(decal: Decal): SVGElement[] {
  const ink = { class: "decal-ink" };
  switch (decal) {
    case "centre":
      return [svg("path", { class: "decal-line", d: TOP_LINE, "stroke-width": 2.4 })];
    case "twin":
      return [svg("path", { class: "decal-line", d: TOP_LINE, "stroke-width": 2.6 }), svg("path", { class: "decal-gap", d: TOP_LINE, "stroke-width": 0.8 })];
    case "side":
      return SIDE_BAND.map((band) => svg("path", { ...ink, d: path_of(door(band)) }));
    case "slash":
      return SLASH.map((band) => svg("path", { ...ink, d: path_of(door(band)) }));
    case "flames":
      return [svg("path", { ...ink, d: path_of(door(FLAME)) })];
    case "number":
      return [svg("circle", { ...ink, cx: 32, cy: 18.2, r: 3.7 }), svg("text", { class: "decal-number", x: 32, y: 18.3 })];
    case "checker": {
      const marks: SVGElement[] = [svg("rect", { class: "decal-back", x: 21.6, y: 16.6, width: 20.8, height: 3.2 })];
      for (let col = 0; col < 16; col++)
        for (let row = 0; row < 2; row++)
          if ((col + row) % 2 === 0) marks.push(svg("rect", { class: "decal-check", x: 22 + col * 1.25, y: 17 + row * 1.2, width: 1.25, height: 1.2 }));
      return marks;
    }
    case "rabbit":
      return [
        svg("circle", { ...ink, cx: 32, cy: 19.4, r: 2.3 }),
        ...[-1, 1].map((side) => svg("ellipse", { ...ink, cx: 32 + side * 1.1, cy: 15.6, rx: 0.8, ry: 2.6, transform: `rotate(${side * 12} ${32 + side * 1.1} 15.6)` })),
      ];
    default:
      return [];
  }
}

function decal_tile(decal: Decal): SVGSVGElement {
  const tile = svg("svg", { viewBox: "0 5 64 23", "aria-hidden": "true", class: "decal-tile" });
  tile.append(
    svg("path", { class: "decal-body", d: path_of(BODY) }),
    svg("path", { class: "decal-glass", d: path_of(GLASS) }),
    ...decal_marks(decal),
    ...[14, 50].map((cx) => svg("circle", { class: "decal-wheel", cx, cy: 23, r: 4.6 })),
  );
  return tile;
}

export class Garage {
  on_change: ((build: Build) => void) | null = null;
  private readonly root = element("div", "garage");
  private readonly canvas = element("canvas", "garage-preview");
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly decals = element("div", "garage-row garage-decals");
  private readonly decal_label = element("div", "garage-label");
  private readonly stepper = element("div", "garage-choice garage-stepper");
  private readonly number_input = element("input", "garage-number");
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  private renderer: THREE.WebGLRenderer | null = null;
  private view: CarView | null = null;
  private frame = 0;
  private last = 0;
  private spin = 0;

  constructor(
    private readonly parent: HTMLElement,
    private current: Build,
  ) {
    this.root.hidden = true;
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Garage");
    const panel = element("div", "garage-panel");
    const head = element("div", "garage-head");
    const done = this.button("Done", "close", "");
    done.classList.add("garage-done");
    head.append(element("h2", "garage-title", "Garage"), done);
    panel.append(head, this.canvas);

    const cars = element("div", "garage-row garage-choice");
    for (const spec of Object.values(CARS)) cars.append(this.button(spec.name, "car", spec.id));
    panel.append(this.group("car", element("div", "garage-label", "Car"), cars));

    const paints = element("div", "garage-row");
    car_paints.forEach((paint, i) => {
      const swatch = this.button("", "paint", String(i));
      swatch.classList.add("garage-swatch");
      swatch.style.background = rgba(paint);
      swatch.setAttribute("aria-label", `Paint ${i + 1}`);
      paints.append(swatch);
    });
    panel.append(this.group("paint", element("div", "garage-label", "Paint"), paints));

    for (const option of OPTIONS) {
      const row = element("div", "garage-row garage-choice");
      LEVELS[option].forEach((label, level) => row.append(this.button(label, option, String(level))));
      panel.append(this.group(option, element("div", "garage-label", option[0].toUpperCase() + option.slice(1)), row));
    }

    DECALS.forEach((decal, i) => {
      const tile = this.button("", "decal", String(i));
      tile.classList.add("garage-decal");
      tile.setAttribute("aria-label", DECAL_NAMES[decal]);
      tile.title = DECAL_NAMES[decal];
      tile.append(decal_tile(decal));
      this.decals.append(tile);
    });
    const inks = element("div", "garage-row garage-inks");
    inks.setAttribute("aria-label", "Decal colour");
    decal_inks.forEach((ink, i) => {
      const swatch = this.button("", "ink", String(i));
      swatch.classList.add("garage-swatch", "garage-ink");
      swatch.style.background = rgba(ink);
      swatch.setAttribute("aria-label", i < NEUTRAL_INKS ? ["Light", "Dark"][i] : `Paint ${i - NEUTRAL_INKS + 1}`);
      inks.append(swatch);
    });
    this.number_input.type = "text";
    this.number_input.inputMode = "numeric";
    this.number_input.maxLength = 2;
    this.number_input.size = 2;
    this.number_input.setAttribute("aria-label", "Number");
    this.number_input.addEventListener("input", this.typed);
    const down = this.button("−", "number", "-1");
    const up = this.button("+", "number", "1");
    down.setAttribute("aria-label", "Number down");
    up.setAttribute("aria-label", "Number up");
    this.stepper.append(down, this.number_input, up);
    inks.append(this.stepper);
    const decal_group = this.group("decal", this.decal_label, this.decals);
    decal_group.append(inks);
    panel.append(decal_group);
    this.root.append(panel);

    this.scene.add(new THREE.HemisphereLight(color(brand.foreground), color(brand.background_darkest), 2.2));
    const sun = new THREE.DirectionalLight(color(brand.foreground), 2.4);
    sun.position.set(4, 6, 3);
    this.scene.add(sun);
    this.camera.position.copy(PREVIEW_EYE);
    this.camera.lookAt(0, 0.1, 0);
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
    this.root.addEventListener("click", this.click);
    addEventListener("keydown", this.key);
    this.refresh();
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  close() {
    if (!this.is_open) return;
    this.root.hidden = true;
    this.root.removeEventListener("click", this.click);
    removeEventListener("keydown", this.key);
    cancelAnimationFrame(this.frame);
  }

  private button(label: string, kind: string, value: string): HTMLButtonElement {
    const button = element("button", "garage-option", label);
    button.type = "button";
    button.dataset.kind = kind;
    button.dataset.value = value;
    this.buttons.push(button);
    return button;
  }

  private group(area: string, label: HTMLElement, row: HTMLElement): HTMLElement {
    const group = element("div", "garage-group");
    group.dataset.area = area;
    group.append(label, row);
    return group;
  }

  private readonly click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>(".garage-option");
    if (!button) {
      if (event.target === this.root) this.close();
      return;
    }
    const { kind, value } = button.dataset;
    if (kind === "close") return this.close();
    if (kind === undefined || value === undefined) return;
    const b = this.current;
    if (kind === "car" && is_car(value)) this.apply({ ...b, car: value });
    else if (kind === "number") this.apply({ ...b, number: (b.number + Number(value) + MAX_NUMBER + 1) % (MAX_NUMBER + 1) });
    else if (is_numeric(kind)) this.apply({ ...b, [kind]: Number(value) });
  };

  private readonly typed = () => {
    const digits = this.number_input.value.replace(/\D/g, "");
    if (digits !== this.number_input.value) this.number_input.value = digits;
    if (digits) this.apply({ ...this.current, number: Number(digits) });
  };

  private readonly key = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.close();
  };

  private apply(next: Build) {
    const checked = parse_build(build_code(next));
    if (!checked || build_code(checked) === build_code(this.current)) return;
    this.current = checked;
    save_build(checked);
    this.refresh();
    this.on_change?.(checked);
  }

  private refresh() {
    const b = this.current;
    for (const button of this.buttons) {
      const { kind, value } = button.dataset;
      if (kind === "number" || kind === "close") continue;
      const on =
        (kind === "car" && value === b.car) ||
        (kind === "paint" && Number(value) === b.paint % car_paints.length) ||
        ((kind === "decal" || kind === "ink" || kind === "spoiler" || kind === "suspension" || kind === "engine") && Number(value) === b[kind]);
      button.setAttribute("aria-pressed", String(on));
    }
    const decal = DECALS[b.decal];
    const livery = livery_of(b);
    this.decal_label.textContent = `Decal · ${DECAL_NAMES[decal]}`;
    this.decals.style.setProperty("--decal-paint", rgba(car_paints[b.paint % car_paints.length]));
    this.decals.style.setProperty("--decal-ink", livery.ink.getStyle());
    this.decals.style.setProperty("--decal-mark", livery.mark.getStyle());
    this.decals.style.setProperty("--decal-key", livery.key ? livery.key.getStyle() : "transparent");
    for (const text of this.decals.querySelectorAll(".decal-number")) text.textContent = String(b.number);
    this.stepper.hidden = decal !== "number";
    if (document.activeElement !== this.number_input) this.number_input.value = String(b.number).padStart(2, "0");

    if (this.view) {
      this.scene.remove(this.view.root);
      dispose_car_view(this.view);
    }
    const spec = build_spec(b);
    this.view = build_view(b, spec);
    rest_wheels(this.view, spec);
    this.view.root.position.y = -this.view.body.position.y - 0.6;
    this.view.root.rotation.y = this.spin;
    this.scene.add(this.view.root);
  }

  private readonly tick = (now: number) => {
    this.frame = requestAnimationFrame(this.tick);
    const renderer = this.renderer;
    if (!renderer || !this.view) return;
    this.spin += ((now - this.last) / 1000) * PREVIEW_SPIN;
    this.last = now;
    this.view.root.rotation.y = this.spin;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(width * devicePixelRatio) || this.canvas.height !== Math.round(height * devicePixelRatio)) {
      renderer.setPixelRatio(devicePixelRatio);
      renderer.setSize(width, height, false);
      this.camera.aspect = width / Math.max(1, height);
      this.camera.position.copy(PREVIEW_EYE).multiplyScalar(Math.sqrt(Math.max(1, PREVIEW_ASPECT / this.camera.aspect)));
      this.camera.updateProjectionMatrix();
    }
    renderer.render(this.scene, this.camera);
  };
}
