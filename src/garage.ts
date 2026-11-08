import * as THREE from "three";
import { DEFAULT_BUILD, build_code, build_spec, parse_build, type Build } from "./build";
import { CARS, is_car } from "./cars";
import { car_view, dispose_car_view, rest_wheels, type CarView } from "./models";
import { brand, car_paints, color, rgba } from "./palette";
import "./garage.css";

export const BUILD_KEY = "harepin:build";

const LEVELS: Record<"spoiler" | "suspension" | "engine", [string, string, string]> = {
  spoiler: ["None", "Lip", "Wing"],
  suspension: ["Soft", "Sport", "Race"],
  engine: ["Stock", "Tuned", "Race"],
};
type Option = keyof typeof LEVELS;
const OPTIONS = Object.keys(LEVELS) as Option[];

const CODE_FIELDS = ["car", "paint", "decal", "spoiler", "suspension", "engine"];
const PREVIEW_SPIN = 0.5;

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

export class Garage {
  on_change: ((build: Build) => void) | null = null;
  private readonly root = element("div", "garage");
  private readonly canvas = element("canvas", "garage-preview");
  private readonly buttons: HTMLButtonElement[] = [];
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
    const panel = element("div", "garage-panel hud");
    const head = element("div", "garage-head");
    head.append(element("div", "title", "Garage"), this.button("Done", "close", ""));
    panel.append(head, this.canvas);

    const cars = element("div", "garage-row");
    for (const spec of Object.values(CARS)) cars.append(this.button(spec.name, "car", spec.id));
    panel.append(this.group("Car", cars));

    const paints = element("div", "garage-row");
    car_paints.forEach((paint, i) => {
      const swatch = this.button("", "paint", String(i));
      swatch.classList.add("garage-swatch");
      swatch.style.background = rgba(paint);
      swatch.setAttribute("aria-label", `Paint ${i + 1}`);
      paints.append(swatch);
    });
    panel.append(this.group("Paint", paints));

    for (const option of OPTIONS) {
      const row = element("div", "garage-row");
      LEVELS[option].forEach((label, level) => row.append(this.button(label, option, String(level))));
      panel.append(this.group(option[0].toUpperCase() + option.slice(1), row));
    }
    this.root.append(panel);

    this.scene.add(new THREE.HemisphereLight(color(brand.foreground), color(brand.background_darkest), 2.2));
    const sun = new THREE.DirectionalLight(color(brand.foreground), 2.4);
    sun.position.set(4, 6, 3);
    this.scene.add(sun);
    this.camera.position.set(4.6, 2.2, 5.4);
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

  private group(label: string, row: HTMLElement): HTMLElement {
    const group = element("div", "garage-group");
    group.append(element("div", "dim", label), row);
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
    const field = CODE_FIELDS.indexOf(kind ?? "");
    if (field < 0 || value === undefined) return;
    const parts = build_code(this.current).split(".");
    parts[field] = value;
    const checked = parse_build(parts.join("."));
    if (!checked || build_code(checked) === build_code(this.current)) return;
    this.current = checked;
    save_build(checked);
    this.refresh();
    this.on_change?.(checked);
  };

  private readonly key = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.close();
  };

  private refresh() {
    const b = this.current;
    for (const button of this.buttons) {
      const { kind, value } = button.dataset;
      const on =
        (kind === "car" && value === b.car) ||
        (kind === "paint" && Number(value) === b.paint % car_paints.length) ||
        ((kind === "spoiler" || kind === "suspension" || kind === "engine") && Number(value) === b[kind]);
      button.setAttribute("aria-pressed", String(on));
    }
    if (this.view) {
      this.scene.remove(this.view.root);
      dispose_car_view(this.view);
    }
    const spec = build_spec(b);
    this.view = car_view(color(car_paints[b.paint % car_paints.length]), spec, b.spoiler);
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
      this.camera.updateProjectionMatrix();
    }
    renderer.render(this.scene, this.camera);
  };
}
