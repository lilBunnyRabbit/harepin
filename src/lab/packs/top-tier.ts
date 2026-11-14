import { part_of, type Mod } from "../../car/build";
import type { CarId } from "../../car/cars";
import { FUN, GRIP, NOTE, PRED, VS } from "../ask";
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
  feel: string;
}

const at = (slot: Upgraded, v: Variant) => (v.parts[slot] ? 0 : TODAY[slot]);
const code = (car: Tested, v: Variant) => `${car}.4.0.${at("aero", v)}.2.${at("engine", v)}.0.7.${at("tyres", v)}.2.${at("weight", v)}.1.2`;
const lab_mods = (v: Variant): Mod[] => SLOTS.map((slot) => v.parts[slot] ?? part_of(slot, TODAY[slot]).mod);

export const BEST: Variant = { id: "best", parts: {}, feel: "today's best build: the baseline" };
export const SC: Variant = { id: "sc", parts: { engine: SUPERCHARGER.mod }, feel: "supercharger: more pull everywhere, no lag" };
export const SINGLE: Variant = { id: "turbo", engine: "turbo", parts: { engine: TURBO.mod }, feel: "single turbo: soft below 3000 rpm, then a shove" };
export const TWIN: Variant = { id: "twin", engine: "twin", parts: { engine: TWIN_TURBO.mod }, feel: "twin turbo: spools earlier, pulls hardest" };
export const SLICK: Variant = { id: "slicks", parts: { tyres: SLICKS.mod }, feel: "slicks: more grip, and how the limit arrives" };
export const GT: Variant = { id: "gt", parts: { aero: GT_KIT.mod }, feel: "GT kit: planted at speed, slower down the straight" };
export const SHELL: Variant = { id: "shell", parts: { weight: CARBON_SHELL.mod }, feel: "carbon shell: lighter on its feet, twitchier?" };
export const FULL: Variant = { id: "top", engine: "twin", parts: { engine: TWIN_TURBO.mod, tyres: SLICKS.mod, aero: GT_KIT.mod, weight: CARBON_SHELL.mod }, feel: "every top part" };

export interface Place {
  id: string;
  station: Trial["station"];
  lane: string;
  goal: Goal;
  try: string;
}

export const PAD: Place = { id: "pad", station: "skidpad", lane: "asphalt", goal: { kind: "laps", laps: 3 }, try: "hold the ring as fast as it goes" };
export const STRAIGHT: Place = { id: "straight", station: "runway", lane: "asphalt", goal: { kind: "run" }, try: "flat out from the line" };
export const PINS: Place = { id: "pins", station: "hairpin", lane: "asphalt", goal: { kind: "run" }, try: "power hard out of each hairpin" };
export const SWEEP: Place = { id: "sweep", station: "sweeper", lane: "r200", goal: { kind: "run" }, try: "the sweeper as fast as it holds" };

export function trial(car: Tested, place: Place, v: Variant): Trial {
  const mods = Object.values(v.parts);
  const drive = v.engine ? { car: `${LAB_CAR}${car}-${v.engine}`, mods: lab_mods(v) } : { car: code(car, v), mods: mods.length ? mods : undefined };
  return { id: `${car}-${place.id}-${v.id}`, ...drive, station: place.station, lane: place.lane, goal: place.goal, try: place.try, feel: v.feel };
}

/** Each place's variants in order, every one starting from today's best so `vs` reads against the baseline. */
export const ladder = (car: Tested, plan: [Place, Variant[]][]): Trial[] => plan.flatMap(([place, variants]) => variants.map((v) => trial(car, place, v)));

const OPEN: LabCar["parts"] = { suspension: 2, brakes: 2, bias: 1, nitro: 2 };
const STAGES: Record<Engine, [string, Boost]> = { turbo: ["turbo", TURBO_BOOST], twin: ["twin turbo", TWIN_BOOST] };

function lab_cars(trials: readonly Trial[]): Record<string, LabCar> {
  const keys = [...new Set(trials.flatMap((t) => (t.car.startsWith(LAB_CAR) ? [t.car.slice(LAB_CAR.length)] : [])))];
  return Object.fromEntries(
    keys.map((key) => {
      const [car, engine] = key.split("-") as [Tested, Engine];
      const [stage, boost] = STAGES[engine];
      return [key, { ...turbo_car(car, stage, boost), parts: OPEN }];
    }),
  );
}

const POWER: Question = { kind: "scale", id: "power", label: "Power", low: "flat", high: "more than the tyres can use" };
const WORTH: Question = { kind: "pick", id: "worth", label: "Worth the class jump", options: ["no", "unsure", "yes"] };
const BASELINE = "Each tile shows the PI and class: is the jump worth it? Leave vs and worth blank on a baseline.";

// One question list for every trial: per-trial lists push a pack past an inline code's size.
export const top_tier_pack = (id: string, title: string, brief: string, trials: Trial[]): Pack => ({
  id,
  rev: 1,
  title,
  brief: `${brief} ${BASELINE}`,
  cars: lab_cars(trials),
  trials,
  ask: [GRIP, POWER, PRED, FUN, VS, WORTH, NOTE],
});
