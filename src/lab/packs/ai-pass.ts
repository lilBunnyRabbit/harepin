import type { FieldCar } from "../../ai/field";
import { NOTE } from "../ask";
import type { Pack, RaceTrial } from "../pack";

const COUPE = "coupe.4.0.0.1.0";
const GRID: FieldCar[] = Array.from({ length: 6 }, () => ({ aggression: 3, mistakes: 3 }));

const race = (id: string, map: string, feel: string): RaceTrial => ({
  id,
  car: COUPE,
  map,
  field: { cars: GRID },
  passes: true,
  goal: { kind: "race" },
  try: "race pace from the back: pass every car you can, wherever it comes naturally, and never reset",
  feel,
  question: "Where did you get by, and what did the AI car do wrong there?",
});

const pack: Pack = {
  id: "ai-pass",
  rev: 1,
  title: "AI field: where you pass it",
  brief: "The stock coupe last on the grid against six level-3 AI cars, one lap each of two island circuits. Every pass you make or suffer is kept with both cars' speed, line and pedals; Download the file when both are done.",
  aim: "How and where does a person get by the AI: hairpin, braking zone or exit?",
  trials: [
    race("s1", "1C0000001", "island seed 1, 5.8 km with eight hairpins of r14-17: notice whether you get by under braking, at the apex or on the way out"),
    race("s0", "1C0000000", "island seed 0, 5.4 km, two r17 hairpins and fast bends between: notice where the AI brakes too early and how wide it runs"),
  ],
  ask: [{ kind: "pick", id: "where", label: "Most passes came", options: ["under braking", "mid corner", "on the exit", "on the straight"] }, NOTE],
};

export default pack;
