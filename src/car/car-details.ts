import type { BodyStyle } from "./cars";
import { canard, rod } from "./design-parts";
import { DESIGNS, type Detail } from "./designs";
import { centred, outlet, pipe, screen_band, screen_bar, side_pipe } from "./detail-parts";
import { face_at, tail_at, top_at, type Part } from "./geometry";

const { coupe, hatch, muscle, rally, kaze, sturm, raijin, tsumuji } = DESIGNS;

const UPRIGHT = Math.PI / 2;

const CAMBER = 0.1;

const hatch_cannon = pipe(0, 0.36, -1.98, 0.12, 0.3, true);
const hatch_twin = pipe(0.09, 0.36, -1.98, 0.1, 0.3);
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

// Each pipe lies in the tail and ends this far behind it.
const COUPE_PIPE_OUT = 0.09;
const COUPE_TAIL = Math.min(tail_at(coupe.outline, 0.31), tail_at(coupe.kit?.outline ?? coupe.outline, 0.31));
const coupe_pipe = (bore: number, length: number) => pipe(0.55, 0.31, COUPE_TAIL - COUPE_PIPE_OUT + length / 2, bore, length);
const coupe_bazooka = coupe_pipe(0.09, 0.3);
const coupe_twin = coupe_pipe(0.11, 0.32);
const COUPE: Detail[] = [
  { on: "nitro", cue: "Underglow tube under each sill", accent: [{ size: [0.07, 0.05, 1.56], at: [0.93, 0.15, 0] }] },
  { on: "tuned", until: "race_engine", cue: "A bazooka pipe each side", chrome: [coupe_bazooka.chrome], trim: [coupe_bazooka.trim], tips: [coupe_bazooka.tip], swaps: ["pipes"], ...coupe_bazooka.outlet },
  { on: "race_engine", cue: "Fatter bazookas", chrome: [coupe_twin.chrome], trim: [coupe_twin.trim], tips: [coupe_twin.tip], swaps: ["pipes"], ...coupe_twin.outlet },
  { on: "race_engine", cue: "Front-mount intercooler in the bumper bar", bright: [centred(1.2, 0.085, 0.02, 0.362, 2.35)] },
];

const MUSCLE_HOOD_Z = 1.2;
// A scoop's base lies this far under the panel it grows out of.
const SCOOP_SINK = 0.012;
const HOOD_FALL = 0.041;
// A slim round pipe tucked under the sill's outer edge, ending ahead of the rear tyre: one row for the stock body, one for the kit's wider, deeper shell.
const muscle_pipe = (x: number, y: number) => ({
  chrome: [{ size: [0.09, 0.09, 1.5], at: [x, y, 0.02], round: true }] satisfies Part[],
  trim: [{ size: [0.06, 0.06, 0.02], at: [x, y, -0.735], round: true }] satisfies Part[],
  tips: [{ size: [0.11, 0.11, 0.08], at: [x, y, -0.7], round: true }] satisfies Part[],
  // Out past the rear tyre right behind the pipe's end.
  ...outlet([x, y, -0.74], [Math.SQRT1_2, 0, -Math.SQRT1_2]),
});
const MUSCLE_PIPE = muscle_pipe(muscle.width / 2 + 0.01, 0.245);
const MUSCLE_KIT_PIPE = muscle_pipe(1.11, 0.155);
// The scoop is as wide and as long as the blower under it, their front faces in line.
const BLOWER_HALF = 0.2;
// Slats across the whole rear screen, laid flatter than the glass so each overlaps the next; their ends butt into a rail at each side.
const LOUVRE_HALF = 0.6;
const LOUVRE_SLATS = [0.1, 0.28, 0.46, 0.64, 0.82].map((share): Part => {
  const band = screen_band(muscle.cabin, 2, share - 0.1, share + 0.1, LOUVRE_HALF);
  return { ...band, size: [LOUVRE_HALF - 0.03, 0.022, 0.15], at: [(LOUVRE_HALF - 0.03) / 2, band.at[1] + 0.02, band.at[2]], tilt: [(band.tilt?.[0] ?? 0) * 0.35, 0, 0] };
});
const BLOWER_TOP = top_at(muscle.outline, MUSCLE_HOOD_Z) + 0.13;
const MUSCLE: Detail[] = [
  {
    on: "base",
    until: "race_engine",
    cue: "Stock hood scoop",
    hood: [{ size: [0.74, 0.1 + SCOOP_SINK, 0.56], at: [0, 0.895 - SCOOP_SINK / 2, MUSCLE_HOOD_Z], tilt: [HOOD_FALL, 0, 0], shape: "wedge", one: true }],
    trim: [{ size: [0.25, 0.055, 0.02], at: [0.125, 0.895, 1.485] }],
  },
  { on: "tuned", until: "street", cue: "Chrome side pipes under the sills, in place of tailpipes", ...MUSCLE_PIPE, swaps: ["pipes", "bulge"] },
  { on: "tuned", with: "street", cue: "The side pipes under the kit's wider sills", ...MUSCLE_KIT_PIPE, swaps: ["pipes", "bulge"] },
  {
    on: "street",
    cue: "Rear window louvres",
    louvres: [...LOUVRE_SLATS, screen_bar(muscle.cabin, 2, [LOUVRE_HALF, 0.03], [LOUVRE_HALF, 0.97], 0.06, 0.06)],
  },
  {
    on: "race_engine",
    cue: "Blower through the hood under a bug-catcher scoop",
    chrome: [centred(2 * BLOWER_HALF, 0.16, 0.5, BLOWER_TOP - 0.08, MUSCLE_HOOD_Z, HOOD_FALL)],
    stands: [{ points: [[MUSCLE_HOOD_Z + 0.25, BLOWER_TOP - 0.01], [MUSCLE_HOOD_Z + 0.25, BLOWER_TOP + 0.18], [MUSCLE_HOOD_Z - 0.22, BLOWER_TOP + 0.04], [MUSCLE_HOOD_Z - 0.25, BLOWER_TOP - 0.01]], from: 0, to: BLOWER_HALF }],
    red: [centred(2 * BLOWER_HALF - 0.08, 0.11, 0.02, BLOWER_TOP + 0.085, MUSCLE_HOOD_Z + 0.255)],
  },
  {
    on: "race",
    cue: "Short wheelie bars under the tail, in place of the diffuser",
    chrome: [rod([0.3, 0.3, -2.4], [0.3, 0.1, -2.84], 0.035), centred(0.6, 0.035, 0.035, 0.115, -2.8)],
    trim: [{ size: [0.12, 0.12, 0.05], at: [0.3, 0.07, -2.86], tilt: [0, UPRIGHT, 0], round: true }],
    swaps: ["diffuser"],
  },
];

// Hung from the rear foot of each wheel opening, inside the body edge and swept back.
const rally_flap = (axle: number): Part => ({ size: [0.24, 0.24, 0.03], at: [0.75, 0.29, axle - 0.48], tilt: [0.25, 0, 0] });
const on_rally_roof = (part: Part): Part => ({ ...part, size: [part.size[0] / 0.9, part.size[1], part.size[2]], at: [part.at[0] / 0.9, part.at[1], part.at[2]] });
const RALLY: Detail[] = [
  { on: "knobbly", cue: "Red mudflaps behind all four wheels, with gravel tyres", red: [rally_flap(1.27), rally_flap(-1.27)] },
  {
    on: "street",
    cue: "Roof scoop",
    paint: [{ ...on_rally_roof({ size: [0.4, 0.08 + SCOOP_SINK, 0.42], at: [0, 1.45 - SCOOP_SINK / 2, 0.2] }), shape: "wedge", one: true }],
    trim: [on_rally_roof({ size: [0.14, 0.045, 0.02], at: [0.07, 1.45, 0.414] })],
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
const kaze_kit_tail = tail_at(kaze.kit?.outline ?? kaze.outline, 0.48);
// A bar across the tail on a stay each side, `half` from the centre.
const bash_bar = (width: number, half: number, tail: number): Part[] => [centred(width, 0.07, 0.07, 0.48, tail - 0.11), { size: [0.06, 0.06, 0.12], at: [half, 0.48, tail - 0.05] }];
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
  { on: "stripped", until: "street", cue: "Rear bumper off: a bash bar on two stays", trim: [centred(1.72, 0.3, 0.03, 0.46, kaze_tail - 0.012)], chrome: bash_bar(1.5, 0.5, kaze_tail) },
  // The kit's tail is its shell: no backing panel, and the bar ends short of the tow strap.
  { on: "stripped", with: "street", cue: "A bash bar on two stays over the kit's tail valance", chrome: bash_bar(1, 0.36, kaze_kit_tail) },
];

const TSUMUJI: Detail[] = [
  { on: "base", cue: "Clean bonnet: no bulge and no bare panel round the pop-ups", swaps: ["bulge", "bonnet"] },
  { on: "drift", cue: "Drift stance: negative camber", camber: CAMBER },
  { on: "light", cue: "Roll hoop behind the seats: a cross bar under the roof edge, legs down into the deck", cage: [screen_bar(tsumuji.cabin, 3, [0.4, 0.04], [0.4, 1.04]), screen_bar(tsumuji.cabin, 3, [0, 0.065], [0.425, 0.065])] },
];

const STURM: Detail[] = [
  { on: "street", cue: "Banner across the top of the windscreen", banner: [screen_band(sturm.cabin, 0, 0.7, 0.98, 0.6)] },
  { on: "tuned", cue: "Oil cooler in the front bumper", bright: [centred(0.5, 0.1, 0.02, 0.3, 2.302)] },
];

const raijin_tail = tail_at(raijin.outline, 0.47);
const raijin_kit = { ...raijin, ...raijin.kit };
// Where the kit's front wheel opening starts.
const RAIJIN_ARCH = 1.6;
const RAIJIN: Detail[] = [
  { on: "tuned", cue: "Front-mount intercooler filling the grille", bright: [centred(0.72, 0.13, 0.014, 0.56, 2.09, 0.27)] },
  { on: "race", cue: "A dive plane on each corner of the bumper bar", stands: canard(raijin_kit.outline, raijin_kit.width / 2, 0.34, RAIJIN_ARCH) },
  { on: "race", cue: "Diffuser end fences under the bumper", trim: [{ size: [0.03, 0.14, 0.4], at: [0.78, 0.24, raijin_tail + 0.15] }] },
];

const FORMULA: Detail[] = [
  { on: "base", cue: "No bulge or bare panels: the engine cover is a fin and the tub is already bare", swaps: ["bulge", "bonnet"] },
  { on: "tuned", cue: "T-camera on the airbox", warning: [centred(0.22, 0.04, 0.12, 0.985, 0.12)] },
  { on: "street", cue: "Bargeboards ahead of the sidepods", trim: [{ size: [0.02, 0.22, 0.46], at: [0.45, 0.24, 0.42], tilt: [0, 0.16, 0] }] },
  { on: "race_engine", cue: "Shark fin down the engine cover", lips: [{ points: [[-0.2, 0.85], [-0.32, 0.88], [-1.45, 0.8], [-1.6, 0.58], [-1.6, 0.42]], from: 0, to: 0.012 }] },
  { on: "race", cue: "T-wing ahead of the rear wing", trim: [centred(0.72, 0.02, 0.09, 0.86, -1.47), centred(0.03, 0.42, 0.06, 0.66, -1.47)] },
];

const fujin_exhaust = side_pipe(0.975, 0.27, -0.36, 0.1, 0.1);
const FUJIN: Detail[] = [{ on: "tuned", cue: "Side-exit pipe ahead of each rear wheel", chrome: [fujin_exhaust.chrome], trim: [fujin_exhaust.trim], tips: [fujin_exhaust.tip], swaps: ["pipes"], ...fujin_exhaust.outlet }];

const whip = (x: number, top: number): Part[] => [rod([x, 1.54, -0.56], [x, top, -0.72], 0.03)].map((part) => ({ ...part, one: true }));
const flag = (x: number, top: number): Part => ({ size: [0.014, 0.17, 0.3], at: [x, top - 0.09, -0.88], one: true });
const SAJIN: Detail[] = [
  { on: "street", cue: "Dune whip with a flag", trim: whip(0.42, 2.65), warning: [flag(0.42, 2.65)] },
  { on: "race", cue: "A second whip", trim: whip(-0.42, 2.45), warning: [flag(-0.42, 2.45)] },
  // Behind the engine, inside the tail frame's rails and against its cross bar: clear of the coils and the trailing arms.
  { on: "race", cue: "Jerry cans strapped in the tail frame behind the engine", red: [{ size: [0.15, 0.36, 0.26], at: [0.245, 0.69, -1.69] }] },
];

const BUS_STACK_Z = -3.3;
const BUS: Detail[] = [
  {
    on: "street",
    cue: "Bull bar",
    chrome: [{ size: [0.09, 0.75, 0.09], at: [0.6, 0.72, 6.02] }, centred(1.9, 0.09, 0.09, 1.05, 6.02), centred(1.9, 0.09, 0.09, 0.6, 6.02)],
  },
  { on: "race_engine", cue: "Short chrome exhaust stacks out of the roof corners, behind the roof unit and clear of the spoiler", chrome: [{ size: [0.15, 0.15, 0.5], at: [1.12, 3.15, BUS_STACK_Z], tilt: [UPRIGHT, 0, 0], round: true }], tips: [{ size: [0.18, 0.18, 0.08], at: [1.12, 3.37, BUS_STACK_Z], tilt: [UPRIGHT, 0, 0], round: true }], swaps: ["pipes"], ...outlet([1.12, 3.41, BUS_STACK_Z], [0, 1, 0]) },
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
