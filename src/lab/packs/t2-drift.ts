import { parse_build } from "../../car/build";
import { CARS } from "../../car/cars";
import { Trait, trait_asks } from "../ask";
import { LAB_CAR, type Aids, type Goal, type Pack, type StationTrial, type Trial } from "../pack";

// The Drift preset (`PRESETS` in car/presets.ts), assist and stability off so the car does what the tyres do.
const DRIFT = "muscle.1.5.0.3.1.0.7.0.0.0.2";
const DRIFT_PARTS = parse_build(DRIFT)?.parts;
if (!DRIFT_PARTS) throw new Error(`bad Drift preset code ${DRIFT}`);
const ROTATE = "drift-rotate";
const ANGLE = "drift-angle";
const LIVELY = "drift-tcs-off";
const OLD_CAP = "drift-old-cap";
/** Round 1's side-grip cap: r3 rated it best on the hairpins, so it stays their reference. */
const OLD_SIDE_SX = 2;
/**
 * r3 "hits a cap on angle": a weaker swing damper and a later side-grip cap let a held key carry the tail past 60 degrees
 * and on into a spin (sim: held turn key 3 s, 36 to 87 degrees), with no spin catch in a held drift.
 */
const FREE_ANGLE = { drift_damp: 1, drift_side_sx: 8, drift_catch: 0 };
/** r3 "can't start a drift without the handbrake": TCS weighs the rears' sideways slip at half, so the gas steps the tail out (sim: 2.05 to 0.28 s). */
const GAS_ENTRY = { tcs_lateral: 0.7 };
/** r3 "like on ice": TCS off keeps half the held-drift helpers, the gas still uncut (sim: hold 1.3 to 5.0 s, no spin, 53 to 58 km/h). */
const OFF_HOLD = { drift_tcs_off: 0.5 };

interface Variant {
  id: string;
  car: string;
  aids: Aids;
  question: string;
  feel: string;
  /** The one place this variant runs at; absent runs at every place. */
  only?: string;
}

const ON: Aids = { assist: false, stability: false, tcs: true };

const VARIANTS: Variant[] = [
  {
    id: "new",
    car: DRIFT,
    aids: ON,
    question: "As r3: the drift to beat",
    feel: "TCS on, the r3 drift: holds, but needs the handbrake to start and stops at one angle",
  },
  {
    id: "rotate",
    car: `${LAB_CAR}${ROTATE}`,
    aids: ON,
    question: "Can you start it on the gas, turn it in further, and spin it if you keep asking?",
    feel: "TCS on, the gas steps the tail out without the handbrake, and the angle has no cap: keep the key in and it spins",
  },
  {
    id: "angle",
    car: `${LAB_CAR}${ANGLE}`,
    aids: ON,
    question: "Does the angle go as far as you ask now?",
    feel: "TCS on, the r3 start, but no cap on angle: keep the key in and it turns in further, then spins",
  },
  {
    id: "old-cap",
    car: `${LAB_CAR}${OLD_CAP}`,
    aids: ON,
    question: "r3's best on the hairpins: do the new ones beat it?",
    feel: "TCS on, the r3 drift with round 1's side-grip cap, as rated best on the hairpins in r3",
    only: "hairpins",
  },
  {
    id: "tcs-off",
    car: `${LAB_CAR}${LIVELY}`,
    aids: { assist: false, stability: false, tcs: false },
    question: "TCS off: lively but drivable, or still ice?",
    feel: "TCS off, the gas uncut, but a countersteered slide holds as with TCS on, at half the help",
  },
];

interface Place {
  id: string;
  station: StationTrial["station"];
  goal: Goal;
  try: string;
}

const PLACES: Place[] = [
  { id: "circle", station: "drift", goal: { kind: "time", seconds: 45 }, try: "start a drift on the gas without the handbrake, hold it round the 20 m ring, then tighten it with gas and key" },
  { id: "hairpins", station: "hairpin", goal: { kind: "run" }, try: "turn each of the three hairpins tight on the gas, start to finish" },
];

const pack: Pack = {
  id: "t2-drift",
  rev: 4,
  title: "Drift r4",
  aim: "r3: the drift held but needed the handbrake to start, stopped at one angle, pushed wide in hairpins, and TCS off was ice. Does the gas start it, the key turn it past the hold into a spin, and does TCS off stay drivable?",
  brief: "The Drift preset, steering assist and stability off, on the drift circle and the hairpins. At each place the r3 drift goes first, then gas start with no angle cap, then no angle cap alone, then TCS off with half the hold; the hairpins add r3's old cap. Rate turn-in, hold and exit.",
  cars: {
    [ROTATE]: { name: "Gas start, no angle cap", spec: { ...CARS.muscle, ...FREE_ANGLE, ...GAS_ENTRY }, look: "muscle", parts: DRIFT_PARTS },
    [ANGLE]: { name: "No angle cap", spec: { ...CARS.muscle, ...FREE_ANGLE }, look: "muscle", parts: DRIFT_PARTS },
    [OLD_CAP]: { name: "r3 drift, old cap", spec: { ...CARS.muscle, drift_side_sx: OLD_SIDE_SX }, look: "muscle", parts: DRIFT_PARTS },
    [LIVELY]: { name: "TCS off, half hold", spec: { ...CARS.muscle, ...OFF_HOLD }, look: "muscle", parts: DRIFT_PARTS },
  },
  trials: PLACES.flatMap((place) =>
    VARIANTS.filter((v) => !v.only || v.only === place.id).map((v, i): Trial => ({
      id: `${place.id}-${v.id}`,
      car: v.car,
      aids: v.aids,
      station: place.station,
      goal: place.goal,
      try: place.try,
      feel: v.feel,
      question: v.question,
      ...(i === 0 ? { base: true as const } : {}),
    })),
  ),
  ask: trait_asks(Trait.TURN_IN, Trait.HOLD, Trait.EXIT),
};

export default pack;
