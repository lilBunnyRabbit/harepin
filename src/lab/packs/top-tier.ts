import { part_of, type Mod } from "../../car/build";
import { CARS, type CarId } from "../../car/cars";
import { FUN, GRIP, NOTE, PRED, VS_BASELINE } from "../ask";
import { CARBON_SHELL, GT_KIT, SLICKS, SUPERCHARGER, TURBO, TURBO_BOOST, TWIN_BOOST, TWIN_TURBO, turbo_car, type Boost } from "../cars/top-tier";
import { LAB_CAR, type Goal, type LabCar, type Pack, type Question, type Trial } from "../pack";

type Upgraded = "engine" | "tyres" | "aero" | "weight";
type Engine = "turbo" | "twin";

export type Tested = Extract<CarId, "sturm" | "raijin" | "kaze" | "muscle">;
const TODAY: Record<Upgraded, number> = { engine: 2, tyres: 2, aero: 4, weight: 2 };
const SLOTS = Object.keys(TODAY) as Upgraded[];

export interface Variant {
  id: string;
  engine?: Engine;
  parts: Partial<Record<Upgraded, Mod>>;
  question: string;
  feel: string;
}

const at = (slot: Upgraded, v: Variant) => (v.parts[slot] ? 0 : TODAY[slot]);
const code = (car: Tested, v: Variant) => `${car}.4.0.${at("aero", v)}.2.${at("engine", v)}.0.7.${at("tyres", v)}.2.${at("weight", v)}.1.2`;
const lab_mods = (v: Variant): Mod[] => SLOTS.map((slot) => v.parts[slot] ?? part_of(slot, TODAY[slot]).mod);

export const BEST: Variant = {
  id: "best",
  parts: {},
  question: "How does today's best build drive? Every other trial here is felt against it.",
  feel: "the reference: note the pull out of slow corners, where the grip runs out and the top speed",
};
export const SC: Variant = {
  id: "sc",
  parts: { engine: SUPERCHARGER.mod },
  question: "Is a supercharger's instant pull worth more than the Race engine?",
  feel: "supercharger: strong pull from idle, no wait: notice whether the rear tyres spin out of slow corners",
};
export const SINGLE: Variant = {
  id: "turbo",
  engine: "turbo",
  parts: { engine: TURBO.mod },
  question: "Is the turbo's late shove worth its lag?",
  feel: "turbo: soft below 3000 rpm, then a shove: notice the lag out of slow corners and how sudden the kick is",
};
export const TWIN: Variant = {
  id: "twin",
  engine: "twin",
  parts: { engine: TWIN_TURBO.mod },
  question: "Does the twin turbo's earlier boost make it the engine to fit?",
  feel: "twin turbo: boost from about 2000 rpm, the hardest pull: notice where it arrives and whether it breaks traction",
};
export const SLICK: Variant = {
  id: "slicks",
  parts: { tyres: SLICKS.mod },
  question: "Do slicks add grip you can use, or only a later, sharper limit?",
  feel: "slicks: more grip on tarmac: notice how much later the slide comes and whether it lets go suddenly",
};
export const GT: Variant = {
  id: "gt",
  parts: { aero: GT_KIT.mod },
  question: "Is the GT kit's grip in fast corners worth the top speed it costs?",
  feel: "GT kit: pressed down at speed, more drag: notice the grip in fast corners and the speed lost on the straight",
};
export const SHELL: Variant = {
  id: "shell",
  parts: { weight: CARBON_SHELL.mod },
  question: "Does a quarter less weight make it quicker, or just nervous?",
  feel: "carbon shell: a quarter lighter: notice the quicker turn-in and pull, and whether the rear gets twitchy",
};
export const FULL: Variant = {
  id: "top",
  engine: "twin",
  parts: { engine: TWIN_TURBO.mod, tyres: SLICKS.mod, aero: GT_KIT.mod, weight: CARBON_SHELL.mod },
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

const lab_key = (car: Tested, engine: Engine) => `${car}-${engine}`;

function trial(car: Tested, place: Place, v: Variant, base: boolean): Trial {
  const mods = Object.values(v.parts);
  const drive = v.engine ? { car: `${LAB_CAR}${lab_key(car, v.engine)}`, mods: lab_mods(v) } : { car: code(car, v), mods: mods.length ? mods : undefined };
  return { id: `${car}-${place.id}-${v.id}`, ...drive, station: place.station, lane: place.lane, goal: place.goal, try: place.try, feel: v.feel, question: v.question, ...(base ? { base: true as const } : {}) };
}

const OPEN: LabCar["parts"] = { suspension: 2, brakes: 2, bias: 1, nitro: 2 };
const STAGES: Record<Engine, [stage: string, boost: Boost]> = { turbo: ["turbo", TURBO_BOOST], twin: ["twin turbo", TWIN_BOOST] };

function lab_cars(car: Tested, variants: readonly Variant[]): Record<string, LabCar> {
  const engines = new Set(variants.flatMap((v) => (v.engine ? [v.engine] : [])));
  return Object.fromEntries([...engines].map((engine) => [lab_key(car, engine), { ...turbo_car(car, ...STAGES[engine]), parts: OPEN }]));
}

const POWER: Question = { kind: "scale", id: "power", label: "Power", low: "flat", high: "more than the tyres can use" };
const WORTH: Question = { kind: "pick", id: "worth", label: "Worth the class jump", options: ["no", "unsure", "yes"] };
const BASELINE = "Each tile shows the PI and class: is the jump worth it? Leave vs and worth blank on a baseline.";

export type Plan = [Place, Variant[]][];

/** Each place's variants in order, the first today's best so `vs` reads against the baseline. One question list for every trial: per-trial lists push a pack past an inline code's size. */
export function top_tier_pack(id: string, title: string, brief: string, car: Tested, plan: Plan): Pack {
  return {
    id,
    rev: 1,
    title,
    aim: `Which top-tier parts are worth fitting to the ${CARS[car].name}? At each place today's best build goes first, then each part on its own against it.`,
    brief: `${brief} ${BASELINE}`,
    cars: lab_cars(car, plan.flatMap(([, variants]) => variants)),
    trials: plan.flatMap(([place, variants]) => variants.map((v, i) => trial(car, place, v, i === 0))),
    ask: [GRIP, POWER, PRED, FUN, VS_BASELINE, WORTH, NOTE],
  };
}
