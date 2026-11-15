import * as THREE from "three";
import type { Look } from "./build";
import type { Rim } from "./designs";
import { extrude, merge, tint, type Point } from "./geometry";
import { brand, color, mix, tones } from "../theme/palette";
import { cos, sin } from "../sim-math";

export const STOCK_TYRE: Required<Look>["tyre"] = { width: 1, rim: 1 };
export const STOCK_CALIPER: Required<Look>["caliper"] = { size: 1 };
const TREAD_BLOCKS = 12;
/** Tread block height and length at `tread` 1, metres. */
const BLOCK_TALL = 0.05;
const BLOCK_LONG = 0.1;
/** Share of the half width each tread row reaches across the centre line, so the two staggered rows overlap. */
const BLOCK_OVERLAP = 0.06;
const SIDES = 16;
const SHOULDER = 0.035;
const BARREL = 0.1;
const BAND = 0.028;
const BRAKE_GAP = 0.008;
const DISC_THICK = 0.012;

type RimStyle = "star" | "slot" | "dish";
interface StyleShape {
  lip: number;
  slope: number;
  inset: number;
  thick: number;
  hub: number;
}
const STYLES: Record<RimStyle, StyleShape> = {
  star: { lip: 0.07, slope: 0, inset: 0.012, thick: 0.028, hub: 0.24 },
  slot: { lip: 0.07, slope: 0, inset: 0.012, thick: 0.02, hub: 0.5 },
  dish: { lip: 0.3, slope: 0.03, inset: 0.006, thick: 0.026, hub: 0.3 },
};
const SLOT_OPEN = 0.26;
const DISH_SPOKES = 5;
const DISC_SLOTS = 6;

// A spokeless rim is a slotted disc, a rim with a lip is dished, the rest are stars.
const style_of = (rim: Rim): RimStyle => (rim.spokes ? (rim.lip ? "dish" : "star") : "slot");

export const chrome_tone = () => color(tones.chrome);
const RIM_TONES: Record<Rim["tone"], () => THREE.Color> = {
  metal: chrome_tone,
  light: () => color(tones.check_light),
  bronze: () => color(mix(brand.warning, tones.trim, 0.7)),
};
const disc_tone = () => chrome_tone().lerp(color(tones.tyre), 0.5);

interface RimShape {
  style: StyleShape;
  half: number;
  bead: number;
  face: number;
  spoke_front: number;
  spoke_back: number;
  back: number;
}

function rim_shape(radius: number, width: number, rim: Rim, look: Required<Look>["tyre"], style: StyleShape): RimShape {
  const half = (width * look.width) / 2;
  const bead = radius * rim.size * look.rim;
  const face = bead * (1 - Math.max(rim.lip ?? 0, style.lip));
  const spoke_front = half - style.slope - style.inset;
  return { style, half, bead, face, spoke_front, spoke_back: spoke_front - style.thick, back: half - BARREL };
}

// Turned about x from [radius, x] points; faces out when the points run from the inner side round to the outer.
function turned(points: Point[], sides: number, tone: THREE.Color): THREE.BufferGeometry {
  return tint(solid_faces(new THREE.LatheGeometry(points.map(([r, x]) => new THREE.Vector2(r, x)), sides).rotateZ(-Math.PI / 2).toNonIndexed()), tone);
}

// A lathe point on the axis turns into triangles with no area: dropped, a wheel carries some forty of them.
function solid_faces(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const keep: number[] = [];
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1).sub(a);
    c.fromBufferAttribute(position, i + 2).sub(a);
    if (b.cross(c).lengthSq() > 1e-16) keep.push(i, i + 1, i + 2);
  }
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const size = attribute.itemSize;
    const values = new Float32Array(keep.length * size);
    keep.forEach((from, to) => {
      for (let k = 0; k < size; k++) values[to * size + k] = attribute.array[from * size + k];
    });
    geometry.setAttribute(name, new THREE.BufferAttribute(values, size));
  }
  return geometry;
}

function spoke(shape: RimShape, from: number, to: number, wide: number, narrow: number, turn: number, tone: THREE.Color): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(shape.style.thick, to - from, 1).translate((shape.spoke_front + shape.spoke_back) / 2, (from + to) / 2, 0);
  const position = geometry.getAttribute("position");
  const mid = (from + to) / 2;
  for (let i = 0; i < position.count; i++) position.setZ(i, position.getZ(i) * (position.getY(i) < mid ? wide : narrow));
  return tint(geometry.rotateX(turn), tone);
}

function spokes(shape: RimShape, rim: Rim, kind: RimStyle, sides: number, tone: THREE.Color): THREE.BufferGeometry[] {
  const { style, face, spoke_front, spoke_back } = shape;
  const hub = face * style.hub;
  const cap: Point[] = [
    [hub, spoke_back],
    [hub, spoke_front + 0.008],
    [0, spoke_front + 0.008],
  ];
  const pieces = [turned(cap, Math.max(8, sides / 2), tone)];
  const wide = (rim.spoke ?? 0.06) * (kind === "dish" ? 1.3 : 1.2);
  const count = kind === "slot" ? DISC_SLOTS : kind === "dish" ? Math.min(rim.spokes, DISH_SPOKES) : rim.spokes;
  for (let i = 0; i < count; i++) {
    const turn = (i * 2 * Math.PI) / count;
    if (kind === "slot") {
      const sector = (2 * Math.PI) / count;
      pieces.push(tint(new THREE.RingGeometry(hub * 0.9, face, 2, 1, turn, sector * (1 - SLOT_OPEN)).rotateY(Math.PI / 2).translate(spoke_front, 0, 0), tone));
    } else pieces.push(spoke(shape, hub * 0.8, face + 0.004, wide, wide * 0.72, turn, tone));
  }
  return pieces;
}

export function wheel_geometry(radius: number, width: number, rim: Rim, look: Required<Look>["tyre"]): THREE.BufferGeometry {
  const kind = style_of(rim);
  const round = SIDES;
  const tone = RIM_TONES[rim.tone]();
  const rubber = color(tones.tyre);
  const shape = rim_shape(radius, width, rim, look, STYLES[kind]);
  const { half, bead, face, back } = shape;
  const tall = BLOCK_TALL * (look.tread ?? 0);
  const long = BLOCK_LONG * (look.tread ?? 0);
  // The blocks' outer corners reach the rolling radius, not past it, so knobbly tyres sit on the ground the wheels feel.
  const block_at = Math.sqrt(radius * radius - (long * long) / 4) - tall / 2;
  const carcass = look.tread ? block_at : radius;
  const band = look.band ? bead + BAND : bead;
  const lip_in = half - shape.style.slope;
  const pieces = [
    turned(
      [
        [0, -half],
        [carcass - SHOULDER, -half],
        [carcass, -half + SHOULDER],
        [carcass, half - SHOULDER],
        [carcass - SHOULDER, half],
        [band, half],
      ],
      round,
      rubber,
    ),
    turned(
      [
        [bead, half],
        [face, lip_in],
      ],
      round,
      rim.lip ? color(tones.clear) : tone,
    ),
    turned(
      [
        [face, lip_in],
        [face, back],
      ],
      round,
      color(tones.trim),
    ),
    turned(
      [
        [face, back],
        [0, back],
      ],
      round,
      rubber,
    ),
    ...spokes(shape, rim, kind, round, tone),
  ];
  if (look.band)
    pieces.push(
      turned(
        [
          [band, half],
          [bead, half],
        ],
        round,
        color(brand[look.band]),
      ),
    );
  // Each row's outer edge stops where the carcass shoulder starts, so a block's corner never stands past a plain tyre's:
  // square to the sidewall, it poked through the body where the nose narrows ahead of the arch.
  const block_out = half - SHOULDER;
  const block_in = -half * BLOCK_OVERLAP;
  if (look.tread)
    for (let i = 0; i < TREAD_BLOCKS; i++)
      pieces.push(tint(new THREE.BoxGeometry(block_out - block_in, tall, long).translate(((i % 2 ? 1 : -1) * (block_out + block_in)) / 2, block_at, 0).rotateX((i * 2 * Math.PI) / TREAD_BLOCKS), rubber));
  return merge(...pieces);
}

/** The space inside the barrel the brake may fill: a radius about the axle and an x span, clear of everything that spins. */
export function brake_room(radius: number, width: number, rim: Rim, look: Required<Look>["tyre"]) {
  const shape = rim_shape(radius, width, rim, look, STYLES[style_of(rim)]);
  return { reach: shape.face - BRAKE_GAP * 2, back: shape.back + BRAKE_GAP, front: shape.spoke_back - BRAKE_GAP };
}

// Fixed to the steering knuckle, not the spinning wheel: a disc on the barrel's back plate and a caliper over it, both
// inside the barrel and behind the spokes, so nothing the wheel spins passes through them. Outer face at +x.
export function brake_geometry(radius: number, width: number, rim: Rim, look: Required<Look>["tyre"], { size, tone }: Required<Look>["caliper"]): THREE.BufferGeometry {
  const { reach, back: disc_at, front } = brake_room(radius, width, rim, look);
  const disc = tint(new THREE.RingGeometry(reach * 0.3, reach * 0.94, SIDES, 1).rotateY(Math.PI / 2).translate(disc_at + DISC_THICK, 0, 0), disc_tone());
  const deep = front - disc_at;
  const inner = reach * (1 - Math.min(0.5, 0.34 * size));
  const sweep = Math.min(0.75, 0.42 * size);
  const steps = 3;
  const rim_arc = Array.from({ length: steps + 1 }, (_, i): Point => {
    const a = -sweep + (2 * sweep * i) / steps;
    return [sin(a) * reach, cos(a) * reach];
  });
  const hub_arc = rim_arc.map(([z, y]): Point => [(z * inner) / reach, (y * inner) / reach]).reverse();
  const caliper = tint(extrude([...rim_arc, ...hub_arc], deep).translate(disc_at + deep / 2, 0, 0).rotateX(-0.8), color(tone ? brand[tone] : tones.trim));
  return merge(disc, caliper);
}
