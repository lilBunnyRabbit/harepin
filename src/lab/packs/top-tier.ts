import { build_code, DEFAULT_BUILD, type Slot } from "../../car/build";
import { CARS, type CarId } from "../../car/cars";
import { Trait, trait_asks } from "../ask";
import type { Goal, Pack, Trial } from "../pack";

type Upgraded = Extract<Slot, "engine" | "tyres" | "aero" | "weight">;

export type Tested = Extract<CarId, "sturm" | "raijin" | "kaze" | "muscle">;
const BEST_PARTS: Record<Slot, number> = { engine: 2, tyres: 2, aero: 4, suspension: 2, brakes: 2, weight: 2, bias: 1, nitro: 2 };

export interface Variant {
  id: string;
  parts: Partial<Record<Upgraded, number>>;
  question: string;
  feel: string;
}

const code = (car: CarId, v: Variant) => build_code({ ...DEFAULT_BUILD, car, paint: 4, parts: { ...BEST_PARTS, ...v.parts } });

export const BEST: Variant = {
  id: "best",
  parts: {},
  question: "How does the best build under the top tier drive? Every other trial here is felt against it.",
  feel: "the reference: note the pull out of slow corners, where the grip runs out and the top speed",
};
export const SC: Variant = {
  id: "sc",
  parts: { engine: 3 },
  question: "Is a supercharger's instant pull worth more than the Race engine?",
  feel: "supercharger: strong pull from idle, no wait: notice whether the rear tyres spin out of slow corners",
};
export const SINGLE: Variant = {
  id: "turbo",
  parts: { engine: 4 },
  question: "Is the turbo's late shove worth its lag?",
  feel: "turbo: soft below 3000 rpm, then a shove: notice the lag out of slow corners and how sudden the kick is",
};
export const TWIN: Variant = {
  id: "twin",
  parts: { engine: 5 },
  question: "Does the twin turbo's earlier boost make it the engine to fit?",
  feel: "twin turbo: boost from about 1800 rpm, the hardest pull: notice where it arrives and whether it breaks traction",
};
export const SLICK: Variant = {
  id: "slicks",
  parts: { tyres: 6 },
  question: "Do slicks add grip you can use, or only a later, sharper limit?",
  feel: "slicks: more grip on tarmac: notice how much later the slide comes and whether it lets go suddenly",
};
export const GT: Variant = {
  id: "gt",
  parts: { aero: 5 },
  question: "Is the GT kit's grip in fast corners worth the top speed it costs?",
  feel: "GT kit: pressed down at speed, more drag: notice the grip in fast corners and the speed lost on the straight",
};
export const SHELL: Variant = {
  id: "shell",
  parts: { weight: 3 },
  question: "Does a quarter less weight make it quicker, or just nervous?",
  feel: "carbon shell: a quarter lighter: notice the quicker turn-in and pull, and whether the rear gets twitchy",
};
export const FULL: Variant = {
  id: "top",
  parts: { engine: 5, tyres: 6, aero: 5, weight: 3 },
  question: "With every top part fitted, is it still drivable at the limit, and worth the class?",
  feel: "every top part at once: notice whether it stays drivable at the limit or is only fast in a straight line",
};

export interface Place {
  id: string;
  station: Trial["station"];
  lane: string;
  goal: Goal;
  try: string;
}

export const PAD: Place = { id: "pad", station: "skidpad", lane: "asphalt", goal: { kind: "laps", laps: 3 }, try: "three laps of the cone ring, as fast as it grips" };
export const STRAIGHT: Place = { id: "straight", station: "runway", lane: "asphalt", goal: { kind: "run" }, try: "flat out from the line to the end gate, no lifting" };
export const PINS: Place = { id: "pins", station: "hairpin", lane: "asphalt", goal: { kind: "run" }, try: "brake late into each hairpin, then full power out" };
export const SWEEP: Place = { id: "sweep", station: "sweeper", lane: "r200", goal: { kind: "run" }, try: "the sweeper as fast as it holds the line" };

function trial(car: Tested, place: Place, v: Variant, base: boolean): Trial {
  return { id: `${car}-${place.id}-${v.id}`, car: code(car, v), station: place.station, lane: place.lane, goal: place.goal, try: place.try, feel: v.feel, question: v.question, ...(base ? { base: true as const } : {}) };
}

const BASELINE = "Each tile shows the PI and class: is the jump worth it? Say so in the note.";

export type Plan = [Place, Variant[]][];

/** Each place's variants in order, the first the best build under the top tier so `vs` reads against the baseline. One question list for every trial: per-trial lists push a pack past an inline code's size. */
export function top_tier_pack(id: string, title: string, brief: string, car: Tested, plan: Plan): Pack {
  return {
    id,
    rev: 3,
    title,
    aim: `Which top-tier parts are worth fitting to the ${CARS[car].name}? At each place the best build under the top tier goes first, then each top part on its own against it.`,
    brief: `${brief} ${BASELINE}`,
    trials: plan.flatMap(([place, variants]) => variants.map((v, i) => trial(car, place, v, i === 0))),
    ask: trait_asks(Trait.BALANCE, Trait.POWER, Trait.TOP),
  };
}
