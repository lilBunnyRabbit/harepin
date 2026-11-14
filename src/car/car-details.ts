import type { BodyStyle } from "./cars";
import { rod } from "./design-parts";
import { DESIGNS, type Detail } from "./designs";
import { arch_bolts, centred, outlet, pipe, screen_band, screen_bar, side_pipe } from "./detail-parts";
import { face_at, tail_at, top_at, type Part } from "./geometry";

const { hatch, muscle, rally, kaze, sturm, raijin, tsumuji } = DESIGNS;

const UPRIGHT = Math.PI / 2;

const CAMBER = 0.1;

const hatch_cannon = pipe(0, 0.37, -2.02, 0.19, 0.46, true);
const hatch_twin = pipe(0.115, 0.37, -2.02, 0.17, 0.46);
const HATCH: Detail[] = [
  {
    on: "street",
    cue: "Track-day tow hooks, one offset at each end",
    warning: [
      { size: [0.05, 0.1, 0.18], at: [0.45, 0.385, 2.02], one: true },
      { size: [0.05, 0.1, 0.18], at: [-0.45, 0.385, -2.04], one: true },
    ],
  },
  { on: "tuned", until: "race_engine", cue: "One fat centre-exit pipe", chrome: [hatch_cannon.chrome], trim: [hatch_cannon.trim], tips: [hatch_cannon.tip], swaps: ["pipes", "bulge"], ...hatch_cannon.outlet },
  { on: "race_engine", cue: "Twin centre-exit pipes", chrome: [hatch_twin.chrome], trim: [hatch_twin.trim], tips: [hatch_twin.tip], swaps: ["pipes"], ...hatch_twin.outlet },
  { on: "stripped", cue: "Bolt-in cage: a cross in the hatch glass", cage: [screen_bar(hatch.cabin, 2, [-0.45, 0.2], [0.45, 0.8])] },
];

const coupe_bazooka = pipe(0.55, 0.31, -2.38, 0.14, 0.4);
const coupe_twin = pipe(0.55, 0.31, -2.42, 0.19, 0.5);
const COUPE: Detail[] = [
  { on: "nitro", cue: "Underglow tube under each sill", accent: [{ size: [0.07, 0.05, 1.56], at: [0.93, 0.15, 0] }] },
  { on: "tuned", until: "race_engine", cue: "A long bazooka pipe each side", chrome: [coupe_bazooka.chrome], trim: [coupe_bazooka.trim], tips: [coupe_bazooka.tip], swaps: ["pipes"], ...coupe_bazooka.outlet },
  { on: "race_engine", cue: "Fatter, longer bazookas", chrome: [coupe_twin.chrome], trim: [coupe_twin.trim], tips: [coupe_twin.tip], swaps: ["pipes"], ...coupe_twin.outlet },
  { on: "race_engine", cue: "Front-mount intercooler in the bumper bar", bright: [centred(1.2, 0.085, 0.02, 0.362, 2.35)] },
];

const MUSCLE_HOOD_Z = 1.2;
const HOOD_FALL = 0.035;
const MUSCLE_PIPE: Part = { size: [0.13, 0.13, 1.56], at: [1.07, 0.2, 0] };
const MUSCLE_TIP: Part = { size: [0.16, 0.16, 0.1], at: [1.07, 0.2, -0.74] };
// Out past the rear tyre right behind the pipe's end.
const MUSCLE_JET = outlet([1.07, 0.2, -0.79], [Math.SQRT1_2, 0, -Math.SQRT1_2]);
const BLOWER_TOP = top_at(muscle.outline, MUSCLE_HOOD_Z) + 0.13;
const MUSCLE: Detail[] = [
  {
    on: "base",
    until: "race_engine",
    cue: "Stock hood scoop",
    paint: [{ size: [0.4, 0.1, 0.56], at: [0.2, 0.895, MUSCLE_HOOD_Z], tilt: [0.035, 0, 0] }],
    trim: [{ size: [0.34, 0.06, 0.02], at: [0.17, 0.895, 1.485] }],
  },
  { on: "tuned", cue: "Chrome side pipes along the sills, in place of tailpipes", chrome: [MUSCLE_PIPE], trim: [{ size: [0.09, 0.09, 0.02], at: [1.07, 0.2, -0.785] }], tips: [MUSCLE_TIP], swaps: ["pipes", "bulge"], ...MUSCLE_JET },
  {
    on: "street",
    cue: "Rear window louvres",
    louvres: [0.16, 0.39, 0.62, 0.85].map((share) => screen_band(muscle.cabin, 2, share - 0.075, share + 0.075, 0.55)),
  },
  {
    on: "race_engine",
    cue: "Blower through the hood under a bug-catcher scoop",
    chrome: [centred(0.44, 0.16, 0.5, BLOWER_TOP - 0.08, MUSCLE_HOOD_Z, HOOD_FALL)],
    stands: [{ points: [[MUSCLE_HOOD_Z + 0.3, BLOWER_TOP - 0.01], [MUSCLE_HOOD_Z + 0.3, BLOWER_TOP + 0.2], [MUSCLE_HOOD_Z - 0.22, BLOWER_TOP + 0.1], [MUSCLE_HOOD_Z - 0.26, BLOWER_TOP - 0.01]], from: 0, to: 0.17 }],
    red: [centred(0.26, 0.13, 0.02, BLOWER_TOP + 0.095, MUSCLE_HOOD_Z + 0.305)],
  },
  {
    on: "race",
    cue: "Wheelie bars, in place of the diffuser",
    chrome: [rod([0.3, 0.32, -2.36], [0.3, 0.1, -3.1], 0.05), centred(0.6, 0.045, 0.045, 0.19, -2.8)],
    trim: [{ size: [0.17, 0.17, 0.07], at: [0.3, 0.09, -3.12], tilt: [0, UPRIGHT, 0], round: true }],
    swaps: ["diffuser"],
  },
];

const rally_flap = (z: number): Part => ({ size: [0.32, 0.3, 0.035], at: [0.81, 0.25, z] });
const on_rally_roof = (part: Part): Part => ({ ...part, size: [part.size[0] / 0.9, part.size[1], part.size[2]], at: [part.at[0] / 0.9, part.at[1], part.at[2]] });
const RALLY: Detail[] = [
  { on: "knobbly", cue: "Red mudflaps behind all four wheels, with gravel tyres", red: [rally_flap(0.72), rally_flap(-1.82)] },
  {
    on: "street",
    cue: "Roof scoop",
    paint: [on_rally_roof({ size: [0.2, 0.08, 0.34], at: [0.1, 1.45, 0.2] })],
    trim: [on_rally_roof({ size: [0.16, 0.05, 0.02], at: [0.08, 1.455, 0.375] })],
  },
  {
    on: "race",
    cue: "Four-lamp pod on the bonnet for night stages",
    heads: [0.13, 0.37].map((x): Part => ({ size: [0.17, 0.17, 0.04], at: [x, 0.86, 2.0], round: true })),
    trim: [{ size: [0.52, 0.2, 0.1], at: [0.26, 0.85, 1.94] }],
  },
  { on: "race", cue: "Sump guard under the nose", chrome: [centred(1.0, 0.1, 0.05, 0.31, face_at(rally.outline, 0.4) - 0.03), centred(1.0, 0.04, 0.6, 0.28, 1.74)] },
];

const kaze_tail = tail_at(kaze.outline, 0.46);
const KAZE: Detail[] = [
  { on: "drift", cue: "Drift stance: negative camber", camber: CAMBER },
  {
    on: "street",
    cue: "Tow straps, one offset at each end",
    warning: [
      { size: [0.05, 0.16, 0.06], at: [0.62, 0.4, 2.07], one: true },
      { size: [0.05, 0.16, 0.06], at: [-0.62, 0.45, -2.18], one: true },
    ],
  },
  {
    on: "stripped",
    cue: "Rear bumper off: a bash bar on two stays",
    trim: [centred(1.72, 0.3, 0.03, 0.46, kaze_tail - 0.012)],
    chrome: [centred(1.5, 0.07, 0.07, 0.48, kaze_tail - 0.11), { size: [0.06, 0.06, 0.12], at: [0.5, 0.48, kaze_tail - 0.05] }],
  },
];

const TSUMUJI: Detail[] = [
  { on: "base", cue: "Clean bonnet: no bulge and no bare panel round the pop-ups", swaps: ["bulge", "bonnet"] },
  { on: "drift", cue: "Drift stance: negative camber", camber: CAMBER },
  { on: "light", cue: "Roll hoop behind the seats, seen through the rear screen", cage: [screen_bar(tsumuji.cabin, 3, [0.4, 0.15], [0.4, 0.95]), screen_bar(tsumuji.cabin, 3, [0, 0.15], [0.4, 0.15])] },
];

const STURM_LIP = 0.85 + 0.15 + 0.004;
const STURM_RING = 0.34 + 0.085 - 0.004 + 0.035;
const STURM_ARCH_LOW = Math.asin((sturm.sill - 0.34) / (0.34 + 0.085));
const sturm_bolts = (z: number) => arch_bolts(STURM_LIP, z, 0.34, STURM_RING, STURM_ARCH_LOW, 6, 0.055);
const STURM: Detail[] = [
  { on: "street", cue: "Four bolt heads on each bolt-on arch", bright: [...sturm_bolts(1.362), ...sturm_bolts(-0.908)] },
  { on: "street", cue: "Banner across the top of the windscreen", banner: [screen_band(sturm.cabin, 0, 0.7, 0.98, 0.6)] },
  { on: "tuned", cue: "Oil cooler in the front bumper", bright: [centred(0.5, 0.1, 0.02, 0.3, 2.302)] },
];

const raijin_canard_z = face_at(raijin.outline, 0.52);
const raijin_tail = tail_at(raijin.outline, 0.47);
const RAIJIN: Detail[] = [
  { on: "tuned", cue: "Front-mount intercooler filling the grille", bright: [centred(0.72, 0.15, 0.014, 0.494, 2.102, 0.27)] },
  { on: "street", cue: "Flat floor planes out past the skirts", trim: [{ size: [0.11, 0.03, 1.5], at: [0.945, 0.13, -0.21] }] },
  {
    on: "race",
    cue: "Splitter end fences and a second, bigger canard",
    trim: [
      { size: [0.025, 0.13, 0.36], at: [0.86, 0.28, 1.94] },
      { size: [0.26, 0.02, 0.2], at: [0.74, 0.52, raijin_canard_z + 0.02] },
    ],
  },
  { on: "street", cue: "Red tow hook on the rear bumper", red: [{ size: [0.05, 0.15, 0.16], at: [0.26, 0.47, raijin_tail - 0.05], one: true }] },
  { on: "race", cue: "Tall diffuser fences out past the bumper", trim: [{ size: [0.03, 0.26, 0.62], at: [0.78, 0.33, raijin_tail - 0.1] }] },
];

const FORMULA: Detail[] = [
  { on: "tuned", cue: "T-camera on the airbox", warning: [centred(0.22, 0.04, 0.12, 0.985, 0.12)] },
  { on: "street", cue: "Bargeboards ahead of the sidepods", trim: [{ size: [0.02, 0.22, 0.46], at: [0.45, 0.24, 0.42], tilt: [0, 0.16, 0] }] },
  { on: "race_engine", cue: "Shark fin down the engine cover", lips: [{ points: [[-0.2, 0.85], [-0.32, 0.88], [-1.45, 0.8], [-1.6, 0.58], [-1.6, 0.42]], from: 0, to: 0.012 }] },
  { on: "race", cue: "T-wing ahead of the rear wing", trim: [centred(0.72, 0.02, 0.09, 0.86, -1.47), centred(0.03, 0.42, 0.06, 0.66, -1.47)] },
];

const fujin_exhaust = side_pipe(0.985, 0.27, -0.36, 0.16, 0.12);
const FUJIN: Detail[] = [{ on: "tuned", cue: "Side-exit pipe ahead of each rear wheel", chrome: [fujin_exhaust.chrome], trim: [fujin_exhaust.trim], tips: [fujin_exhaust.tip], swaps: ["pipes"], ...fujin_exhaust.outlet }];

const whip = (x: number, top: number): Part[] => [rod([x, 1.54, -0.56], [x, top, -0.72], 0.03)].map((part) => ({ ...part, one: true }));
const flag = (x: number, top: number): Part => ({ size: [0.014, 0.17, 0.3], at: [x, top - 0.09, -0.88], one: true });
const SAJIN: Detail[] = [
  { on: "street", cue: "Dune whip with a flag", trim: whip(0.42, 2.65), warning: [flag(0.42, 2.65)] },
  { on: "race", cue: "A second whip", trim: whip(-0.42, 2.45), warning: [flag(-0.42, 2.45)] },
  { on: "race", cue: "Jerry cans strapped beside the engine", red: [{ size: [0.15, 0.36, 0.26], at: [0.37, 0.73, -1.18] }] },
];

const BUS_STACK_Z = -3.3;
const BUS: Detail[] = [
  {
    on: "street",
    cue: "Bull bar",
    chrome: [{ size: [0.09, 0.75, 0.09], at: [0.6, 0.72, 6.02] }, centred(1.9, 0.09, 0.09, 1.05, 6.02), centred(1.9, 0.09, 0.09, 0.6, 6.02)],
  },
  { on: "race_engine", cue: "Chrome exhaust stacks over the roof, behind the roof unit and clear of the spoiler", chrome: [{ size: [0.16, 1.5, 0.16], at: [1.12, 3.1, BUS_STACK_Z] }], tips: [{ size: [0.2, 0.12, 0.2], at: [1.12, 3.8, BUS_STACK_Z] }], swaps: ["pipes"], ...outlet([1.12, 3.86, BUS_STACK_Z], [0, 1, 0]) },
];

export const DETAILS: Record<BodyStyle, Detail[]> = {
  coupe: COUPE,
  hatch: HATCH,
  muscle: MUSCLE,
  rally: RALLY,
  kaze: KAZE,
  sturm: STURM,
  raijin: RAIJIN,
  bus: BUS,
  formula: FORMULA,
  fujin: FUJIN,
  sajin: SAJIN,
  tsumuji: TSUMUJI,
};
