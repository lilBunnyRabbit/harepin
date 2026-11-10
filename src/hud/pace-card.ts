import type { Car } from "../car/car";
import type { Route } from "../worldgen/types";
import { corners_ahead, nearest_point, read_route, reverse_route, Side, type Ahead, type Corner, type PaceRoute } from "./pace";
import "./map.css";

const OFF_ROUTE = 40;
const SEARCH = 30;
/** Facing within this of square to the road keeps the direction it had, so a spin doesn't flip the notes back and forth. */
const FLIP_DOT = 0.3;
const DISTANCE_STEP = 10;
const SVG = "http://www.w3.org/2000/svg";

const ARROW_BEND = [0, 120, 100, 80, 60, 42, 26].map((deg) => (deg * Math.PI) / 180);
const ARROW_ARC = 26;
const ARROW_MIN_RADIUS = 11;

function arrow_path(bend: number): string {
  const head = 8;
  if (!bend) return `M24 44V6M16 14L24 6L32 14`;
  const r = Math.max(ARROW_ARC / bend, ARROW_MIN_RADIUS);
  const width = r * (1 - Math.cos(bend));
  const x0 = 24 - width / 2;
  const y0 = 32;
  const ex = x0 + r - r * Math.cos(bend);
  const ey = y0 - r * Math.sin(bend);
  const dx = Math.sin(bend);
  const dy = -Math.cos(bend);
  const point = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;
  const wing = (side: number) => point(ex - dx * head + side * dy * head, ey - dy * head - side * dx * head);
  return `M${point(x0, 44)}V${y0}A${point(r, r)} 0 0 1 ${point(ex, ey)}M${wing(1)}L${point(ex, ey)}L${wing(-1)}`;
}

const ARROWS = ARROW_BEND.map(arrow_path);
const HAIRPIN_ARROW = "M15 44V22A9 9 0 0 1 33 22V40M26 33L33 40L40 33";

const short = (corner: Corner) => `${corner.side === Side.LEFT ? "L" : "R"}${corner.hairpin ? " hairpin" : corner.grade}`;

function svg_arrow(): [SVGSVGElement, SVGPathElement] {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG, "path");
  svg.append(path);
  return [svg, path];
}

interface Reading {
  forward: PaceRoute;
  back: PaceRoute | null;
}

export class PaceCard {
  readonly el = document.createElement("div");
  private arrow: SVGPathElement;
  private grade = document.createElement("b");
  private side = document.createElement("span");
  private distance = document.createElement("span");
  private then = document.createElement("span");
  private readings = new Map<string, Reading>();
  private route: Route | null = null;
  private point = -1;
  private reversed = false;
  private ahead: Ahead = { next: -1, distance: 0, then: -1, into: false };
  private shown = "";

  constructor(private routes: readonly Route[]) {
    this.el.id = "pace";
    this.el.setAttribute("role", "status");
    const [svg, path] = svg_arrow();
    this.arrow = path;
    svg.classList.add("pace-arrow");
    const call = document.createElement("div");
    call.className = "pace-call";
    this.side.className = "pace-side";
    this.distance.className = "pace-distance";
    call.append(this.grade, this.side, this.distance);
    this.then.className = "pace-then";
    this.el.append(svg, call, this.then);
  }

  private reading(route: Route, reversed: boolean): PaceRoute {
    let reading = this.readings.get(route.id);
    if (!reading) {
      reading = { forward: read_route(route.points, route.closed), back: null };
      this.readings.set(route.id, reading);
    }
    if (!reversed) return reading.forward;
    reading.back ??= reverse_route(reading.forward);
    return reading.back;
  }

  update(car: Car, route_id: string) {
    if (this.route?.id !== route_id) {
      this.route = this.routes.find((r) => r.id === route_id) ?? this.routes[0] ?? null;
      this.point = -1;
    }
    const { route } = this;
    if (!route) return;
    const { x, z } = car.pos;
    this.point = nearest_point(route.points, route.closed, x, z, this.point, SEARCH, OFF_ROUTE);
    const p = route.points[this.point];
    const off = Math.hypot(p.x - x, p.z - z) > OFF_ROUTE;
    const h = car.heading;
    const facing = Math.sin(h) * p.tx + Math.cos(h) * p.tz;
    if (facing < -FLIP_DOT) this.reversed = true;
    else if (facing > FLIP_DOT) this.reversed = false;
    const reading = this.reading(route, this.reversed);
    corners_ahead(reading, reading.at[this.point], this.ahead);
    const { next, then, into } = this.ahead;
    const metres = Math.round(this.ahead.distance / DISTANCE_STEP) * DISTANCE_STEP;
    const key = off ? "off" : `${next}|${then}|${into}|${metres}|${this.reversed}`;
    if (key === this.shown) return;
    this.shown = key;
    this.write(off, next < 0 ? null : reading.corners[next], then < 0 ? null : reading.corners[then], into, metres);
  }

  private write(off: boolean, corner: Corner | null, after: Corner | null, into: boolean, metres: number) {
    this.el.toggleAttribute("data-off", off);
    this.el.toggleAttribute("data-tight", false);
    if (off || !corner) {
      this.el.dataset.side = "";
      this.arrow.setAttribute("d", ARROWS[0]);
      this.grade.textContent = "";
      this.side.textContent = off ? "off route" : "straight";
      this.distance.textContent = off ? "" : "to the finish";
      this.then.textContent = "";
      return;
    }
    this.el.dataset.side = corner.side;
    this.el.toggleAttribute("data-tight", corner.grade <= 2);
    this.arrow.setAttribute("d", corner.hairpin ? HAIRPIN_ARROW : ARROWS[corner.grade]);
    this.grade.textContent = String(corner.grade);
    this.side.textContent = corner.hairpin ? "hairpin" : corner.side;
    this.distance.textContent = metres > 0 ? `${metres} m` : "now";
    this.then.textContent = after ? `${into ? "into" : "then"} ${short(after)}` : "";
  }
}
