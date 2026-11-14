import { part_of, type Mod } from "../../car/build";
import type { CarId } from "../../car/cars";
import { FUN, GRIP, NOTE, PRED, VS } from "../ask";
import { CARBON_SHELL, GT_KIT, SLICKS, SUPERCHARGER, TURBO, TURBO_BOOST, TWIN_BOOST, TWIN_TURBO, turbo_car, type Boost } from "../cars/top-tier";
import type { Goal, LabCar, Pack, Question, Trial } from "../pack";

type Upgraded = "engine" | "tyres" | "aero" | "weight";
type Engine = "turbo" | "twin";

const CARS = ["sturm", "raijin", "kaze", "muscle"] as const satisfies readonly CarId[];
type Tested = (typeof CARS)[number];
const TODAY: Record<Upgraded, number> = { engine: 2, tyres: 2, aero: 4, weight: 2 };
const SLOTS = Object.keys(TODAY) as Upgraded[];

interface Variant {
  id: string;
  engine?: Engine;
  parts: Partial<Record<Upgraded, Mod>>;
  feel: string;
}

const at = (slot: Upgraded, v: Variant) => (v.parts[slot] ? 0 : TODAY[slot]);
const code = (car: Tested, v: Variant) => `${car}.4.0.${at("aero", v)}.2.${at("engine", v)}.0.7.${at("tyres", v)}.2.${at("weight", v)}.1.2`;
const lab_mods = (v: Variant): Mod[] => SLOTS.map((slot) => v.parts[slot] ?? part_of(slot, TODAY[slot]).mod);

const BEST: Variant = { id: "best", parts: {}, feel: "today's best build: the baseline" };
const SC: Variant = { id: "sc", parts: { engine: SUPERCHARGER.mod }, feel: "supercharger: more pull everywhere, no lag" };
const SINGLE: Variant = { id: "turbo", engine: "turbo", parts: { engine: TURBO.mod }, feel: "single turbo: soft below 3000 rpm, then a shove" };
const TWIN: Variant = { id: "twin", engine: "twin", parts: { engine: TWIN_TURBO.mod }, feel: "twin turbo: spools earlier, pulls hardest" };
const SLICK: Variant = { id: "slicks", parts: { tyres: SLICKS.mod }, feel: "slicks: more grip, and how the limit arrives" };
const GT: Variant = { id: "gt", parts: { aero: GT_KIT.mod }, feel: "GT kit: planted at speed, slower down the straight" };
const SHELL: Variant = { id: "shell", parts: { weight: CARBON_SHELL.mod }, feel: "carbon shell: lighter on its feet, twitchier?" };
const FULL: Variant = { id: "top", engine: "twin", parts: { engine: TWIN_TURBO.mod, tyres: SLICKS.mod, aero: GT_KIT.mod, weight: CARBON_SHELL.mod }, feel: "every top part" };

interface Place {
  id: string;
  station: Trial["station"];
  lane: string;
  goal: Goal;
  try: string;
}

const PAD: Place = { id: "pad", station: "skidpad", lane: "asphalt", goal: { kind: "laps", laps: 3 }, try: "hold the ring as fast as it goes" };
const STRAIGHT: Place = { id: "straight", station: "runway", lane: "asphalt", goal: { kind: "run" }, try: "flat out from the line" };
const PINS: Place = { id: "pins", station: "hairpin", lane: "asphalt", goal: { kind: "run" }, try: "power hard out of each hairpin" };
const SWEEP: Place = { id: "sweep", station: "sweeper", lane: "r200", goal: { kind: "run" }, try: "the sweeper as fast as it holds" };

// The Sturm, closest to S2, takes each part on its own where it shows; the others go from today's best to every top part.
const ladder = (place: Place): [Place, Variant[]] => [place, [BEST, FULL]];
const PLAN: Record<Tested, [Place, Variant[]][]> = {
  sturm: [
    [PAD, [BEST, SLICK, FULL]],
    [STRAIGHT, [BEST, SC, SINGLE, TWIN, FULL]],
    [PINS, [BEST, TWIN, SHELL, FULL]],
    [SWEEP, [BEST, GT, FULL]],
  ],
  raijin: [PAD, STRAIGHT, PINS].map(ladder),
  kaze: [PAD, STRAIGHT, PINS].map(ladder),
  muscle: [PAD, STRAIGHT, PINS].map(ladder),
};

function trial(car: Tested, place: Place, v: Variant): Trial {
  const mods = Object.values(v.parts);
  const drive = v.engine ? { car: `lab:${car}-${v.engine}`, mods: lab_mods(v) } : { car: code(car, v), mods: mods.length ? mods : undefined };
  return { id: `${car}-${place.id}-${v.id}`, ...drive, station: place.station, lane: place.lane, goal: place.goal, try: place.try, feel: v.feel };
}

const OPEN: LabCar["parts"] = { suspension: 2, brakes: 2, bias: 1, nitro: 2 };
const lab_car = (car: Tested, stage: string, boost: Boost): LabCar => ({ ...turbo_car(car, stage, boost), parts: OPEN });

const POWER: Question = { kind: "scale", id: "power", label: "Power", low: "flat", high: "more than the tyres can use" };
const WORTH: Question = { kind: "pick", id: "worth", label: "Worth the class jump", options: ["no", "unsure", "yes"] };

// One question list for every trial: per-trial lists push the pack past an inline code's size.
const pack: Pack = {
  id: "t3-top-tier",
  rev: 1,
  title: "Top-tier parts",
  brief:
    "Candidate parts past today's best: supercharger, single and twin turbo, slicks, GT kit, carbon shell. The Sturm takes each on its own; Raijin, Kaze and Muscle go from today's best to every top part. Each tile shows the PI and class: is the jump worth it? Leave vs and worth blank on a baseline.",
  cars: { "sturm-turbo": lab_car("sturm", "turbo", TURBO_BOOST), ...Object.fromEntries(CARS.map((car) => [`${car}-twin`, lab_car(car, "twin turbo", TWIN_BOOST)])) },
  trials: CARS.flatMap((car) => PLAN[car].flatMap(([place, variants]) => variants.map((v) => trial(car, place, v)))),
  ask: [GRIP, POWER, PRED, FUN, VS, WORTH, NOTE],
};

export default pack;
