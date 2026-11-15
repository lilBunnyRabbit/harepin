import { build_code, DEFAULT_BUILD, type Slot } from "../../car/build";
import { CARS, type CarSpec } from "../../car/cars";
import { Trait, trait_asks } from "../ask";
import type { Aids, LabCar, Pack, Trial } from "../pack";

const BEST: Partial<Record<Slot, number>> = { engine: 2, tyres: 2, aero: 4, suspension: 2, brakes: 2, weight: 2, bias: 1, nitro: 2 };
const TOP: Partial<Record<Slot, number>> = { ...BEST, engine: 5, tyres: 6, aero: 5, weight: 3 };
const code = (parts: Partial<Record<Slot, number>>) => build_code({ ...DEFAULT_BUILD, car: "sturm", paint: 4, parts: { ...DEFAULT_BUILD.parts, ...parts } });

const AIDS: Aids = { tcs: true, assist: false, stability: false };

const OPEN: CarSpec = { ...CARS.sturm, tcs_turn_slip: 0.35 };
// Open alone moved the top build's exit only from 2.5 to 6 degrees: its slicks and GT kit hold the rear.
const LOOSE: CarSpec = { ...CARS.sturm, tcs_turn_slip: 0.45, rear_grip: CARS.sturm.rear_grip - 0.08 };

const car = (spec: CarSpec, parts: Partial<Record<Slot, number>>): LabCar => ({ name: "Sturm", spec, look: "sturm", parts });

const PINS = { station: "hairpin", lane: "asphalt", goal: { kind: "run" }, aids: AIDS } as const satisfies Partial<Trial>;
const PAD = { station: "skidpad", lane: "asphalt", goal: { kind: "laps", laps: 3 }, aids: AIDS } as const satisfies Partial<Trial>;
const PINS_TRY = "second gear into each hairpin, then full gas at the apex with the wheel still in";
const PAD_TRY = "settle on the ring, then hold full turn and full gas for a lap";
const EXIT_Q = "Out of a hairpin on full gas, does the tail step out and stay catchable, or only want to?";
const PAD_Q = "With full turn and full gas, can you hold the ring, and does the car rotate or push wide?";

const pack: Pack = {
  id: "t3-r4",
  rev: 1,
  title: "Sturm: exit slide and full lock",
  aim: "Your r3 notes: exits only want to drift, and no build holds the skidpad ring on full turn and gas. Today's car against traction control that opens in a turn, and against that plus less rear grip.",
  brief:
    "Assists as in r3: TCS on, assist and stability off. Open TCS lets the rear spin more while the wheel is turned; straight launches are as today. Loose adds less rear grip. Today goes first in each group.",
  cars: {
    "best-open": car(OPEN, BEST),
    "best-loose": car(LOOSE, BEST),
    "top-loose": car(LOOSE, TOP),
  },
  trials: [
    { id: "pins-best-today", car: code(BEST), ...PINS, try: PINS_TRY, feel: "today's best build: the exit you called a want", question: EXIT_Q, base: true },
    { id: "pins-best-open", car: "lab:best-open", ...PINS, try: PINS_TRY, feel: "TCS opens with the wheel turned, about 10 degrees on the exit in the sim: notice whether the tail steps out and TCS still catches it", question: EXIT_Q },
    { id: "pins-best-loose", car: "lab:best-loose", ...PINS, try: PINS_TRY, feel: "open TCS and less rear grip, about 17 degrees in the sim and slower out: notice whether it is a slide you hold or one that costs the exit", question: EXIT_Q },
    { id: "pins-top-today", car: code(TOP), ...PINS, try: PINS_TRY, feel: "today's top build: slicks and the GT kit pin the rear", question: EXIT_Q, base: true },
    { id: "pins-top-loose", car: "lab:top-loose", ...PINS, try: PINS_TRY, feel: "the top build loosened, about 9 degrees in the sim: notice whether the grip build now steps out a little on the gas", question: EXIT_Q },
    { id: "pad-best-today", car: code(BEST), ...PAD, try: PAD_TRY, feel: "today's best build: full gas runs it wide of the ring", question: PAD_Q, base: true },
    { id: "pad-best-loose", car: "lab:best-loose", ...PAD, try: PAD_TRY, feel: "the loose best build: in the sim full turn and gas swings the tail and the circle tightens to the ring", question: PAD_Q },
    { id: "pad-top-loose", car: "lab:top-loose", ...PAD, try: PAD_TRY, feel: "the loose top build: notice whether it holds inside the ring on full turn and gas, and still feels like the grip car", question: PAD_Q },
  ],
  ask: trait_asks(Trait.EXIT, Trait.POWER, Trait.BALANCE),
};

export default pack;
