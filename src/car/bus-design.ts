import { hung_mirror, tail_end } from "./design-parts";
import type { Design } from "./designs";
import type { Part, Point } from "./geometry";

const BUS_OUTLINE: Point[] = [[5.84, 0.35], [5.9, 0.46], [5.92, 0.98], [5.88, 1.15], [-6.12, 1.15], [-6.16, 1.0], [-6.16, 0.46], [-6.1, 0.35]];
// A door is its seams: a post at each edge and one down the middle, on a sill step, instead of a slab over the glass.
const bus_door = (z: number): Part[] => [
  ...[-0.55, 0, 0.55].map((dz): Part => ({ size: [0.025, 2.2, dz === 0 ? 0.03 : 0.05], at: [1.255, 1.5, z + dz] })),
  { size: [0.025, 0.06, 1.1], at: [1.255, 0.43, z] },
];
const BUS_MIRROR = hung_mirror([1.25, 2.62, 5.72]);
const BUS_TAIL = tail_end(BUS_OUTLINE, 0.78, 0.5, 1.2, [{ size: [0.16, 0.46, 0.05], at: [1.08, 0.78, 0] }], { half: 1.0, y: 0.84, h: 0.05 }, 0.66);

export const BUS_DESIGN: Design = {
  outline: BUS_OUTLINE,
  width: 2.5,
  sill: 0.35,
  cabin: {
    points: [[5.86, 1.15], [5.76, 2.86], [5.6, 3.02], [-5.98, 3.02], [-6.12, 2.88], [-6.14, 1.15]],
    width: 2.48,
    tumble: 0,
    frame: [0.16, 0.04, 0.4, 0.04, 0.12, 0.12],
    screens: [[0, 0.1], [4, 0.3]],
    split: [3.95, 0.14],
    glass_to: -5.5,
  },
  arches: { gap: 0.06, steps: 7, flare: 0.04, out: 0.02, reach: 0.04, tone: "trim" },
  heads: [{ size: [0.34, 0.16, 0.05], at: [0.9, 0.62, 5.92] }],
  mirror: BUS_MIRROR,
  tails: BUS_TAIL.tails,
  paint: [
    { size: [0.8, 0.2, 2.6], at: [0.4, 3.12, -1.4] },
    ...[2.6, 1.3, 0, -1.3, -2.6, -5.1].map((z): Part => ({ size: [0.03, 1.37, 0.1], at: [1.255, 1.945, z] })),
  ],
  trim: [
    ...[4.75, -4.15].flatMap((z) => bus_door(z)),
    { size: [1.26, 0.24, 0.1], at: [0.63, 0.44, 5.9] },
    { size: [1.26, 0.24, 0.1], at: [0.63, 0.44, -6.16] },
    ...BUS_TAIL.trim,
  ],
  stripes: [{ size: [0.012, 0.08, 11.6], at: [1.2505, 1.21, -0.1] }],
  markers: [{ size: [0.86, 0.2, 0.04], at: [0.43, 2.72, 5.79] }],
  chrome: [
    ...BUS_TAIL.chrome,
  ],
  tyre: [0.3, 0.42],
  rim: { size: 0.56, spokes: 8, tone: "light", lip: 0.3 },
  deck: [-5.7, 3.02],
  hood: [-5.4, 3.02],
  eye: [6.05, 2.3],
  exhaust: [0.8, 0.42, -6.16],
  // The kit is the shell: the same body over deeper skirts, front and rear valances in the outline.
  kit: { outline: [[5.86, 0.24], [5.9, 0.3], [5.9, 0.46], [5.92, 0.98], [5.88, 1.15], [-6.12, 1.15], [-6.16, 1.0], [-6.16, 0.3], [-6.12, 0.24]], sill: 0.24 },
};
