import { CARS, type CarSpec } from "../../car/cars";
import { FUN, LANDING, NOTE, PRED, VS_BASELINE } from "../ask";
import { LAB_CAR, type Goal, type Pack, type Question, type Trial } from "../pack";

const TODAY = "sajin.4.0.0.1.0";
const OLD = "sajin-tall";

const TALL_FLOOR = 0.29;
const TALL_TOP = 0.89;
const TALL_MOUNT = 0.1;

const TALL: CarSpec = {
  ...CARS.sajin,
  wheel: { ...CARS.sajin.wheel, mounts: CARS.sajin.wheel.mounts.map(([x, , z]) => [x, TALL_MOUNT, z]) },
  band: [TALL_FLOOR, TALL_TOP],
  corners: CARS.sajin.corners.map(([x, y, z]) => [x, y < 0 ? -TALL_FLOOR : TALL_TOP, z]),
};

interface Place {
  id: string;
  station: Trial["station"];
  lane: string;
  goal: Goal;
  try: string;
  old: string;
  today: string;
  question: string;
  ask?: Question[];
}

const ROLL: Question = { kind: "scale", id: "roll", label: "Body roll", low: "tips onto two wheels", high: "sits flat" };
const SOFT: Question = { kind: "scale", id: "soft", label: "Soft buggy feel", low: "stiff road car", high: "soft, long travel" };
const SAJIN: Question = { kind: "pick", id: "char", label: "Still feels like the Sajin", options: ["lost it", "unsure", "yes"] };
const ASK: Question[] = [ROLL, SOFT, PRED, FUN, VS_BASELINE, SAJIN, NOTE];

const PLACES: Place[] = [
  {
    id: "kick",
    station: "kicker",
    lane: "big",
    goal: { kind: "run" },
    try: "full throttle off the big kicker, keep it pinned on the dirt landing",
    old: "the tall Sajin: notice how far the body leans and pitches in the air and whether the landing tips it onto a side",
    today: "today's Sajin: notice whether it still soaks the landing on its long travel or lands flatter and harder",
    question: "Off a kicker, does today's Sajin land without tipping, and still soak it up?",
    ask: [LANDING, ...ASK],
  },
  {
    id: "dirt",
    station: "hairpin",
    lane: "dirt",
    goal: { kind: "run" },
    try: "the dirt hairpins: throttle on early, let the tail step out on the loose ground",
    old: "the tall Sajin on dirt: notice the lean into each bend and how it rocks out of it",
    today: "today's Sajin on dirt: notice whether it still slides loose and playful, or turned planted and plain",
    question: "On dirt, is today's Sajin still the loose, playful buggy?",
  },
  {
    id: "pad",
    station: "skidpad",
    lane: "asphalt",
    goal: { kind: "laps", laps: 3 },
    try: "three laps of the cone ring at the edge of grip",
    old: "the tall Sajin on tarmac: notice how far it leans and the inside wheels going light",
    today: "today's Sajin on tarmac: notice whether it leans less and grips more, and whether the tread still squirms",
    question: "On tarmac, does today's Sajin roll less and hold more grip?",
  },
  {
    id: "lift",
    station: "sweeper",
    lane: "r120",
    goal: { kind: "run" },
    try: "the r120 sweeper at the limit, then lift off sharply halfway round",
    old: "the tall Sajin on a lift: notice how far the tail swings and how much it rolls as it goes",
    today: "today's Sajin on a lift: notice whether the tail tucks in smaller and the body stays calmer",
    question: "Lifting mid corner, is today's Sajin calmer, and still alive?",
  },
  {
    id: "straight",
    station: "runway",
    lane: "asphalt",
    goal: { kind: "run" },
    try: "flat out from the line to the end gate, no lifting",
    old: "the tall Sajin flat out: notice the squat at launch and the pull",
    today: "today's Sajin flat out: notice whether launch and pull feel the same; the sim says 0-100 is 0.16 s slower",
    question: "In a straight line, did today's Sajin lose anything you can feel?",
  },
];

function pair(place: Place): Trial[] {
  const common = { station: place.station, lane: place.lane, goal: place.goal, try: place.try, question: place.question, ...(place.ask ? { ask: place.ask } : {}) };
  return [
    { id: `${place.id}-tall`, car: `${LAB_CAR}${OLD}`, ...common, feel: place.old, base: true },
    { id: `${place.id}-today`, car: TODAY, ...common, feel: place.today },
  ];
}

const pack: Pack = {
  id: "t4-sajin",
  rev: 1,
  title: "Sajin: lower centre of mass",
  aim: "Today's Sajin rides its centre of mass 0.25 m lower so bumps stop rolling it over. Does it still feel like a soft long-travel buggy, does it roll less, did it lose its character?",
  brief: "At each place the old, tall Sajin goes first, then today's. Same springs, dampers, bars and travel: only the centre of mass moved. The sim has the skidpad 0.83 to 0.88 g, 0-100 4.58 to 4.74 s and lift-off slip 27.5 to 13.1 degrees.",
  cars: { [OLD]: { name: "Sajin (tall)", spec: TALL, look: "sajin" } },
  trials: PLACES.flatMap(pair),
  ask: ASK,
};

export default pack;
