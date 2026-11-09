import * as THREE from "three";
import { DECALS, DEFAULT_BUILD, DEFAULT_PARTS, MAX_NUMBER, SLOTS, SLOT_NAMES, STATS, build_code, build_spec, parse_build, part_of, stat_range, stats, type Build, type Decal, type Slot, type Stats } from "./build";
import { CARS, is_car, type CarSpec } from "./cars";
import { FLAME, SIDE_BAND, SLASH } from "./livery";
import { build_view, dispose_car_view, livery_of, rest_wheels, type CarView } from "./models";
import { NEUTRAL_INKS, brand, car_paints, color, dark, decal_inks, rgba } from "./palette";
import "./garage.css";

export const BUILD_KEY = "harepin:build";

const STAT_NAMES: Record<keyof Stats, string> = { power: "Power", grip: "Grip", braking: "Braking", top_speed: "Top speed" };
// An empty bar reads as broken, so the weakest car in the game still shows a sliver.
const BAR_FLOOR = 0.08;

const is_slot = (value: string): value is Slot => Object.hasOwn(SLOTS, value);

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
const NUMERIC = ["paint", "decal", "ink"] as const;
type Numeric = (typeof NUMERIC)[number];
const is_numeric = (kind: string): kind is Numeric => (NUMERIC as readonly string[]).includes(kind);

const PREVIEW_SPIN = 0.5;
const PREVIEW_EYE = new THREE.Vector3(4.6, 2.8, 5.4).normalize();
const PREVIEW_MARGIN = 1.08;
// Front three-quarter with the left flank toward the camera, so a fresh decal shows before the spin carries it away.
const SIDE_YAW = -0.5;
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

export class Garage {
  on_change: ((build: Build) => void) | null = null;
  private readonly root = element("div", "garage");
  private readonly canvas = element("canvas", "garage-preview");
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly decals = element("div", "garage-row garage-decals");
  private readonly decal_label = element("div", "garage-label");
  private readonly stepper = element("div", "garage-choice garage-stepper");
  private readonly number_input = element("input", "garage-number");
  private readonly part_names = new Map<Slot, HTMLElement>();
  private readonly bars = new Map<keyof Stats, { fill: HTMLElement; delta: HTMLElement; text: HTMLElement }>();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  private renderer: THREE.WebGLRenderer | null = null;
  private view: CarView | null = null;
  private frame = 0;
  private last = 0;
  private spin = SIDE_YAW;
  /** Car centre, its reach from the spin axis, and its half height: the bounds the turning car stays inside. */
  private readonly fit = { center: new THREE.Vector3(), reach: 1, half_height: 1 };

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

    const slots = element("div", "garage-parts");
    for (const slot of SLOT_NAMES) {
      const cycler = element("div", "garage-choice garage-cycler");
      const name = element("span", "garage-part");
      this.part_names.set(slot, name);
      const prev = this.button("‹", "part", `${slot}:-1`);
      const next = this.button("›", "part", `${slot}:1`);
      prev.setAttribute("aria-label", `Previous ${slot}`);
      next.setAttribute("aria-label", `Next ${slot}`);
      cycler.append(prev, name, next);
      const cell = element("div", "garage-slot");
      cell.append(element("div", "garage-label garage-slot-label", SLOTS[slot].label), cycler);
      slots.append(cell);
    }
    panel.append(this.group("parts", element("div", "garage-label", "Parts"), slots));

    const meters = element("div", "garage-stats");
    for (const key of STATS) {
      const track = element("div", "garage-bar");
      const fill = element("div", "garage-bar-fill");
      const delta = element("div", "garage-bar-delta");
      track.append(fill, delta);
      const text = element("span", "garage-bar-text");
      meters.append(element("span", "garage-bar-label", STAT_NAMES[key]), track, text);
      this.bars.set(key, { fill, delta, text });
    }
    panel.append(this.group("stats", element("div", "garage-label", "Stats vs stock"), meters));

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

    // Light themes have a dark foreground, which would light the car like dusk; their light comes from the page white.
    const light = dark ? brand.foreground : brand.background_lightest;
    this.scene.add(new THREE.HemisphereLight(color(light), color(brand.background_darkest), 2.2));
    const sun = new THREE.DirectionalLight(color(light), 2.4);
    sun.position.set(4, 6, 3);
    this.scene.add(sun);
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
    this.spin = SIDE_YAW;
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
    else if (kind === "part") {
      const [slot, step] = value.split(":");
      if (!is_slot(slot)) return;
      const count = SLOTS[slot].parts.length;
      this.apply({ ...b, parts: { ...b.parts, [slot]: (b.parts[slot] + Number(step) + count) % count } });
    }
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
    const was = this.current;
    if (checked.car !== was.car || checked.decal !== was.decal || checked.ink !== was.ink || checked.number !== was.number) this.spin = SIDE_YAW;
    this.current = checked;
    save_build(checked);
    this.refresh();
    this.on_change?.(checked);
  }

  private refresh() {
    const b = this.current;
    for (const button of this.buttons) {
      const { kind, value } = button.dataset;
      if (kind === "number" || kind === "close" || kind === "part") continue;
      const on =
        (kind === "car" && value === b.car) ||
        (kind === "paint" && Number(value) === b.paint % car_paints.length) ||
        ((kind === "decal" || kind === "ink") && Number(value) === b[kind]);
      button.setAttribute("aria-pressed", String(on));
    }
    const decal = DECALS[b.decal];
    const livery = livery_of(b);
    const swapped = decal !== "none" && !livery.ink.equals(color(decal_inks[b.ink % decal_inks.length]));
    this.decal_label.textContent = `Decal · ${DECAL_NAMES[decal]}${swapped ? " · auto-contrast" : ""}`;
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
    this.show_parts(spec);
    this.view = build_view(b, spec);
    rest_wheels(this.view, spec);
    this.view.root.position.y = -this.view.body.position.y - 0.6;
    this.view.root.rotation.y = 0;
    this.view.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.view.root);
    const size = box.getSize(new THREE.Vector3());
    this.fit.center.set(0, (box.min.y + box.max.y) / 2, 0);
    this.fit.reach = Math.hypot(Math.max(-box.min.x, box.max.x), Math.max(-box.min.z, box.max.z));
    this.fit.half_height = size.y / 2;
    this.view.root.rotation.y = this.spin;
    this.scene.add(this.view.root);
    this.frame_car();
  }

  private show_parts(spec: CarSpec) {
    const b = this.current;
    for (const [slot, name] of this.part_names) name.textContent = part_of(slot, b.parts[slot]).name;
    const now = stats(spec);
    const stock = stats(build_spec({ ...b, parts: DEFAULT_PARTS }));
    const { low, high } = stat_range();
    const at = (key: keyof Stats, value: number) => BAR_FLOOR + (1 - BAR_FLOOR) * Math.max(0, Math.min(1, (value - low[key]) / (high[key] - low[key])));
    for (const [key, bar] of this.bars) {
      const was = at(key, stock[key]);
      const is = at(key, now[key]);
      bar.fill.style.width = `${Math.min(was, is) * 100}%`;
      bar.delta.style.left = `${Math.min(was, is) * 100}%`;
      bar.delta.style.width = `${Math.abs(is - was) * 100}%`;
      const change = Math.round((now[key] / stock[key] - 1) * 100);
      bar.delta.dataset.trend = change > 0 ? "up" : change < 0 ? "down" : "flat";
      bar.text.dataset.trend = bar.delta.dataset.trend;
      bar.text.textContent = change === 0 ? "" : `${change > 0 ? "+" : "−"}${Math.abs(change)}%`;
    }
  }

  private frame_car() {
    const half_v = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const half_h = Math.atan(Math.tan(half_v) * this.camera.aspect);
    const { reach, half_height } = this.fit;
    const elevation = Math.asin(PREVIEW_EYE.y);
    const tall = reach * Math.sin(elevation) + half_height * Math.cos(elevation);
    // The near end of the car sits up to `reach` closer than the centre and looks larger; half of that covers it in practice.
    const distance = Math.max(reach / Math.tan(half_h), tall / Math.tan(half_v)) * PREVIEW_MARGIN + reach * 0.5;
    this.camera.position.copy(PREVIEW_EYE).multiplyScalar(distance).add(this.fit.center);
    this.camera.lookAt(this.fit.center);
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
      this.camera.updateProjectionMatrix();
      this.frame_car();
    }
    renderer.render(this.scene, this.camera);
  };
}
