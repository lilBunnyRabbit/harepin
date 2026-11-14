import type { Mod } from "../../car/build";
import { ASK, with_station_asks } from "../ask";
import type { Aids, Goal, Pack, Trial } from "../pack";

// The Drift preset (`PRESETS` in car/presets.ts), assists off so the car does what the tyres do.
const DRIFT = "muscle.1.5.0.3.1.0.7.0.0.0.2";
const AIDS: Aids = { assist: false, stability: false };

interface Variant {
  id: string;
  mods?: Mod[];
  feel: string;
}

// No diff in the physics yet: a stiffer rear bar is the nearest lever, it shifts rear grip under load the way a tighter diff would.
const VARIANTS: Variant[] = [
  { id: "stock", feel: "the preset as it ships: the baseline" },
  { id: "loose", mods: [{ scale: { rear_grip: 0.92 } }], feel: "8% less rear grip: easier to start, harder to hold?" },
  { id: "bar", mods: [{ scale: { arb_rear: 1.5 } }], feel: "a stiffer rear bar, standing in for a tighter diff" },
  { id: "lock", mods: [{ scale: { lock: 1.25 } }], feel: "25% more steering lock: deeper angles caught?" },
];

interface Place {
  id: string;
  station: Trial["station"];
  goal: Goal;
  try: string;
}

const PLACES: Place[] = [
  { id: "circle", station: "drift", goal: { kind: "time", seconds: 45 }, try: "hold one drift round the 20 m ring, then switch direction" },
  { id: "eight", station: "eight", goal: { kind: "time", seconds: 60 }, try: "figure-eights round the two cone posts, linking the transitions" },
  { id: "hairpins", station: "hairpin", goal: { kind: "run" }, try: "slide each of the three hairpins, start to finish" },
];

const pack: Pack = {
  id: "t2-drift",
  rev: 1,
  title: "Drift",
  brief: "The Drift preset with assists off on the drift circle, the figure-eight and the hairpins, stock and with three mods. Rate drift ease and each against the one before.",
  trials: with_station_asks(
    PLACES.flatMap((place) =>
      VARIANTS.map((v): Trial => ({ id: `${place.id}-${v.id}`, car: DRIFT, mods: v.mods, aids: AIDS, station: place.station, goal: place.goal, try: place.try, feel: v.feel })),
    ),
  ),
  ask: ASK,
};

export default pack;
