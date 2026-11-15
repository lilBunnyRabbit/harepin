import { parse_build } from "../../car/build";
import { CARS } from "../../car/cars";
import { Trait, trait_asks } from "../ask";
import { LAB_CAR, type Aids, type Goal, type Pack, type Trial } from "../pack";

// The Drift preset (`PRESETS` in car/presets.ts), assist and stability off so the car does what the tyres do.
const DRIFT = "muscle.1.5.0.3.1.0.7.0.0.0.2";
const OLD_CAP = "drift-old-cap";
const DRIFT_PARTS = parse_build(DRIFT)?.parts;
if (!DRIFT_PARTS) throw new Error(`bad Drift preset code ${DRIFT}`);
/** Round 1's side-grip cap: past twice peak wheelspin the rears stopped losing side grip, so the gas could not swing the tail. */
const OLD_SIDE_SX = 2;

interface Variant {
  id: string;
  car: string;
  aids: Aids;
  question: string;
  feel: string;
}

const VARIANTS: Variant[] = [
  {
    id: "new",
    car: DRIFT,
    aids: { assist: false, stability: false, tcs: true },
    question: "Can you start a drift on the gas, hold it, and turn it in tighter with the gas and the key?",
    feel: "TCS on, the new drift: a power or lift-off slide holds without the handbrake, the rear pushes, more gas swings the tail wider",
  },
  {
    id: "tcs-off",
    car: DRIFT,
    aids: { assist: false, stability: false, tcs: false },
    question: "Is TCS off the drift you want, or is the new TCS-on drift better?",
    feel: "TCS off: no drift help at all, the car runs on its tyres and the gas alone",
  },
  {
    id: "old-cap",
    car: `${LAB_CAR}${OLD_CAP}`,
    aids: { assist: false, stability: false, tcs: true },
    question: "New drift, old cap: does the old side-grip cap feel more like the arcade hold from round 1?",
    feel: "new drift, old cap: TCS on, the new drift with round 1's side-grip cap, so the gas no longer swings the tail once the rear spins up",
  },
];

interface Place {
  id: string;
  station: Trial["station"];
  goal: Goal;
  try: string;
}

const PLACES: Place[] = [
  { id: "circle", station: "drift", goal: { kind: "time", seconds: 45 }, try: "start a drift on the gas without the handbrake, hold it round the 20 m ring, then tighten it with gas and key" },
  { id: "hairpins", station: "hairpin", goal: { kind: "run" }, try: "slide each of the three hairpins on the gas, start to finish" },
];

const pack: Pack = {
  id: "t2-drift",
  rev: 3,
  title: "Drift r2",
  aim: "Round 1 drifts lost speed, auto-corrected out and would not turn in. The drift code changed: is the new TCS-on drift the one you want, against TCS off and against the new drift with round 1's side-grip cap?",
  brief: "The Drift preset, steering assist and stability off, on the drift circle and the hairpins. At each place the new drift with TCS on goes first, then TCS off, then the new drift with the old cap. Rate turn-in, hold and exit.",
  cars: { [OLD_CAP]: { name: "New drift, old cap", spec: { ...CARS.muscle, drift_side_sx: OLD_SIDE_SX }, look: "muscle", parts: DRIFT_PARTS } },
  trials: PLACES.flatMap((place) =>
    VARIANTS.map((v, i): Trial => ({
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
