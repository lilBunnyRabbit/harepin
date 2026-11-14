import type { Mod } from "../../car/build";
import { ASK, VS, VS_BASELINE, with_station_asks } from "../ask";
import type { Aids, Goal, Pack, Trial } from "../pack";

// The Drift preset (`PRESETS` in car/presets.ts), assists off so the car does what the tyres do.
const DRIFT = "muscle.1.5.0.3.1.0.7.0.0.0.2";
const AIDS: Aids = { assist: false, stability: false };

interface Variant {
  id: string;
  mods?: Mod[];
  question: string;
  feel: string;
}

// No diff in the physics yet: a stiffer rear bar is the nearest lever, it shifts rear grip under load the way a tighter diff would.
const VARIANTS: Variant[] = [
  {
    id: "stock",
    question: "How easy is the preset to drift as it ships? The three changes after it are felt against this.",
    feel: "the preset as it ships: note how it starts a slide, how long it holds the angle and how it catches",
  },
  {
    id: "loose",
    mods: [{ scale: { rear_grip: 0.92 } }],
    question: "Does less rear grip make drifting easier, or only spinnier?",
    feel: "8% less rear grip: notice whether slides start easier and whether they get harder to hold or catch",
  },
  {
    id: "bar",
    mods: [{ scale: { arb_rear: 1.5 } }],
    question: "Would a tighter diff help hold a drift?",
    feel: "a stiffer rear bar, standing in for a tighter diff: notice whether the rear steps out more on power and holds its angle",
  },
  {
    id: "lock",
    mods: [{ scale: { lock: 1.25 } }],
    question: "Does more steering lock save the deep slides?",
    feel: "25% more steering lock: notice whether you catch deeper angles before it spins",
  },
];

interface Place {
  id: string;
  station: Trial["station"];
  goal: Goal;
  try: string;
}

const PLACES: Place[] = [
  { id: "circle", station: "drift", goal: { kind: "time", seconds: 45 }, try: "hold one drift round the 20 m ring, then flick it the other way" },
  { id: "eight", station: "eight", goal: { kind: "time", seconds: 60 }, try: "figure-eights round the two cone posts, linking the transitions" },
  { id: "hairpins", station: "hairpin", goal: { kind: "run" }, try: "slide each of the three hairpins, start to finish" },
];

const pack: Pack = {
  id: "t2-drift",
  rev: 1,
  title: "Drift",
  aim: "Find what makes the Drift preset easier to start and hold a slide with assists off. At each place the preset as it ships goes first, then three single changes, each felt against it.",
  brief: "The Drift preset with assists off on the drift circle, the figure-eight and the hairpins, stock and with three mods. Rate drift ease and each change against the preset as it ships.",
  // Each change reads against its place's stock trial, so the station's "vs" asks against that.
  trials: with_station_asks(
    PLACES.flatMap((place) =>
      VARIANTS.map((v, i): Trial => ({
        id: `${place.id}-${v.id}`,
        car: DRIFT,
        mods: v.mods,
        aids: AIDS,
        station: place.station,
        goal: place.goal,
        try: place.try,
        feel: v.feel,
        question: v.question,
        ...(i === 0 ? { base: true as const } : {}),
      })),
    ),
  ).map((t) => ({ ...t, ask: t.ask?.map((q) => (q === VS ? VS_BASELINE : q)) })),
  ask: ASK,
};

export default pack;
