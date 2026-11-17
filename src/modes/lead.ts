import * as THREE from "three";
import { brand } from "../theme/palette";
import { CHEVRON_VERTS, type Marks } from "./marks";
import { bends, run_on, type Bend, type RoutePoint } from "./route";
import { hypot } from "../sim-math";
import type { RoadSpan } from "../worldgen/types";

const REACH = 190;
const BEHIND = 30;
const INSET = 0.3;
const LINE = { width: 0.3, opacity: 0.95 };
const CURTAIN = { tall: 0.7, opacity: 0.3 };
const EDGE_VERTS = 12;
/** A bend's sign: upright arrowheads standing `off` metres outside the road, their middle `base` over the ground. */
const SIGN = { count: 3, half: 0.75, depth: 0.9, bar: 0.5, pitch: 1.7, base: 1.6, off: 2 };
const SIGN_VERTS = 12;
/** Metres after a bend within which the next one the same way is still its corner, already signed. */
const SIGN_GAP = 80;
const WRONG_PITCH = 9;
const WRONG_SHAPE = { half: 2.2, depth: 2.4, bar: 1.1 };
/** Metres of arrows down the route from the car, where a car facing back looks, and up it. */
const WRONG_BACK = 70;
const WRONG_ON = 20;

const QUAD = [0, 1, 2, 2, 1, 3];

interface Row {
  mesh: THREE.Mesh;
  at: number[];
  verts: number;
  first: number;
  end: number;
}

export class Lead {
  private readonly along: number[];
  private readonly half: number[];
  private readonly here = { value: 0 };
  private readonly edges: THREE.Mesh[];
  private readonly signs: Row;
  private readonly wrong: Row;
  private first = -1;
  private end = -1;

  private readonly line: readonly RoutePoint[];
  /** The lap's last line index; past it the line runs on into the next lap. */
  private readonly lap_end: number;

  /** `closed`: `lap` ends on its first point, so the lead runs on over the line while another lap follows. */
  constructor(
    private readonly marks: Marks,
    lap: readonly RoutePoint[],
    road: readonly RoadSpan[],
    closed: boolean,
  ) {
    const line = closed ? run_on(lap, REACH) : lap;
    this.line = line;
    this.lap_end = lap.length - 1;
    this.along = [0];
    for (let i = 1; i < line.length; i++) this.along.push(this.along[i - 1] + hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z));
    this.half = [];
    let span = 0;
    for (let i = 0; i < lap.length; i++) {
      while (span + 1 < road.length && road[span + 1].from <= i) span++;
      this.half.push(road[span].half);
    }
    for (let i = lap.length; i < line.length; i++) this.half.push(this.half[i - this.lap_end]);
    this.edges = this.lay_edges();
    this.signs = this.lay_signs(bends(line));
    this.wrong = this.lay_wrong();
    this.hide();
  }

  private fading(material: THREE.MeshBasicMaterial): THREE.MeshBasicMaterial {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.lead_at = this.here;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float along;\nuniform float lead_at;\nvarying float v_lead;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>\nfloat lead_d = along - lead_at;\nv_lead = lead_d < 0.0 ? 1.0 + lead_d / ${BEHIND.toFixed(1)} : 1.0 - lead_d / ${REACH.toFixed(1)};`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float v_lead;")
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= smoothstep(0.0, 0.7, v_lead);");
    };
    material.customProgramCacheKey = () => "lead";
    material.depthWrite = false;
    return material;
  }

  private laid(positions: number[], rise: number[], along: number[], material: THREE.Material): THREE.Mesh {
    const mesh = this.marks.mesh(positions, material, rise);
    mesh.geometry.setAttribute("along", new THREE.Float32BufferAttribute(along, 1));
    // Its draw range is a window that moves along the route, which the bounding sphere of the whole strip says nothing about.
    mesh.frustumCulled = false;
    return mesh;
  }

  // Inside a bend tighter than the road is wide the offset line would run backwards and fold over itself: it holds its last point until the line moves on.
  private edge_line(side: number, inset: number): [number, number][] {
    const { line, half } = this;
    const out: [number, number][] = [];
    for (let i = 0; i < line.length; i++) {
      const p = line[i];
      const u = side * (half[i] - inset);
      const x = p.x + p.tz * u;
      const z = p.z - p.tx * u;
      const last = out[i - 1];
      out.push(last && (x - last[0]) * p.tx + (z - last[1]) * p.tz < 0 ? last : [x, z]);
    }
    return out;
  }

  private lay_edges(): THREE.Mesh[] {
    const { marks, along } = this;
    const rim = [-1, 1].map((side) => this.edge_line(side, INSET));
    const inner = [-1, 1].map((side) => this.edge_line(side, INSET + LINE.width));
    const strip = (low: [number, number][][], high: [number, number][][], tall: number, opacity: number) => {
      const positions: number[] = [];
      const rise: number[] = [];
      const walked: number[] = [];
      for (let i = 0; i < this.line.length - 1; i++)
        for (let side = 0; side < 2; side++) {
          const q = [low[side][i], high[side][i], low[side][i + 1], high[side][i + 1]];
          for (const k of QUAD) {
            const up = k % 2 ? tall : 0;
            positions.push(...marks.drape(q[k][0], q[k][1], up));
            rise.push(up);
            walked.push(along[i + (k >> 1)]);
          }
        }
      return this.laid(positions, rise, walked, this.fading(marks.paint(brand.accent, opacity)));
    };
    return [strip(inner, rim, 0, LINE.opacity), strip(rim, rim, CURTAIN.tall, CURTAIN.opacity)];
  }

  private lay_signs(found: readonly Bend[]): Row {
    const { line, marks, along, half } = this;
    const positions: number[] = [];
    const rise: number[] = [];
    const walked: number[] = [];
    const at: number[] = [];
    const back = -(SIGN.depth + SIGN.bar) / 2;
    const tip = back + SIGN.depth;
    let before: Bend | null = null;
    for (const bend of found) {
      const same_corner = before !== null && before.side === bend.side && along[bend.from] - along[before.to] < SIGN_GAP;
      before = bend;
      if (same_corner) continue;
      const entry = line[bend.from];
      let i = bend.from;
      // Where the road has swung clear of the line the car arrives on: the sign stands straight ahead of that line.
      while (i < bend.to && Math.abs((line[i].x - entry.x) * entry.tz - (line[i].z - entry.z) * entry.tx) < half[i] * 0.5) i++;
      const p = line[i];
      const off = half[i] + SIGN.off;
      const frame: RoutePoint = { x: p.x - p.tz * bend.side * off, z: p.z + p.tx * bend.side * off, tx: entry.tx, tz: entry.tz };
      for (let k = 0; k < SIGN.count; k++) {
        const centre = (k - (SIGN.count - 1) / 2) * SIGN.pitch;
        for (const wing of [-1, 1]) {
          const q = [
            [back, wing * SIGN.half],
            [back + SIGN.bar, wing * SIGN.half],
            [tip, 0],
            [tip + SIGN.bar, 0],
          ];
          for (const c of QUAD) {
            const up = SIGN.base + q[c][1];
            positions.push(...marks.point(frame, bend.side * (centre + q[c][0]), 0, up));
            rise.push(up);
            walked.push(along[bend.from]);
          }
        }
        at.push(bend.from);
      }
    }
    return { mesh: this.laid(positions, rise, walked, this.fading(marks.paint(brand.accent, 0.9))), at, verts: SIGN_VERTS, first: -1, end: -1 };
  }

  private lay_wrong(): Row {
    const at: number[] = [];
    let last = -WRONG_PITCH;
    for (let i = 1; i < this.line.length; i++)
      if (this.along[i] - last >= WRONG_PITCH) {
        at.push(i);
        last = this.along[i];
      }
    const mesh = this.marks.chevrons(
      at.map((i) => this.line[i]),
      WRONG_SHAPE,
      this.marks.paint(brand.error, 0.95),
    );
    mesh.frustumCulled = false;
    return { mesh, at, verts: CHEVRON_VERTS, first: -1, end: -1 };
  }

  private window(row: Row, from: number, to: number) {
    const first = after(row.at, from);
    const end = Math.max(first, after(row.at, to));
    if (first === row.first && end === row.end) return;
    row.first = first;
    row.end = end;
    row.mesh.geometry.setDrawRange(first * row.verts, (end - first) * row.verts);
  }

  /** `more`: another lap follows this one, so a closed route's lead carries on over the line. */
  show(at: number, wrong: boolean, more: boolean) {
    const { along } = this;
    const here = along[at];
    const first = Math.max(0, after(along, here - BEHIND) - 1);
    const end = Math.min(more ? this.line.length - 1 : this.lap_end, after(along, here + REACH));
    if (first !== this.first || end !== this.end) {
      this.first = first;
      this.end = end;
      for (const edge of this.edges) edge.geometry.setDrawRange(first * EDGE_VERTS, (end - first) * EDGE_VERTS);
    }
    this.here.value = here;
    if (wrong) {
      this.window(this.signs, 0, 0);
      this.window(this.wrong, after(along, here - WRONG_BACK), after(along, here + WRONG_ON));
    } else {
      this.window(this.signs, first, end);
      this.window(this.wrong, 0, 0);
    }
  }

  hide() {
    this.first = this.end = -1;
    for (const edge of this.edges) edge.geometry.setDrawRange(0, 0);
    this.window(this.signs, 0, 0);
    this.window(this.wrong, 0, 0);
  }
}

function after(sorted: readonly number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
